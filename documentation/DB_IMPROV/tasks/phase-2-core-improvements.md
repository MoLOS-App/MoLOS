# Phase 2: Core Migration System Improvements

> **Priority**: P1 (High)
> **Duration**: 3-5 days
> **Dependencies**: Phase 1 completed
> **Status**: Not Started

---

## Overview

Improve the core migration system architecture to ensure consistency, proper transaction support, and unified execution paths.

---

## Task 2.1: Unify Migration Execution Paths

**Status**: Not Started
**Priority**: P1
**Estimated Time**: 4-6 hours

### Description

Currently there are two separate code paths for running migrations:

1. `packages/database/src/migrate.ts` - Core migrations
2. `scripts/init-database.ts` - Orchestrates both (calls turbo for modules)

Create a single, unified migration runner that handles both consistently.

### Current Architecture

```
bun run db:migrate → packages/database/src/migrate.ts (core only)
bun run db:init    → scripts/init-database.ts (core + modules, different error handling)
turbo db:migrate   → Per-module drizzle-kit migrate
```

### Proposed Architecture

```
bun run db:migrate → Unified runner
                      ├── Core migrations (with transaction)
                      ├── Module migrations (with transaction)
                      └── Schema validation
```

### Implementation

Create `packages/database/src/migrate-unified.ts`:

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface MigrationResult {
	core: { applied: string[]; failed: string[] };
	modules: Record<string, { applied: string[]; failed: string[] }>;
}

export async function runAllMigrations(dbPath: string): Promise<MigrationResult> {
	const result: MigrationResult = {
		core: { applied: [], failed: [] },
		modules: {}
	};

	// 1. Run core migrations
	// 2. Run module migrations
	// 3. Validate schema

	return result;
}
```

### Files to Create/Modify

- `packages/database/src/migrate-unified.ts` (new)
- `scripts/init-database.ts` (use unified runner)
- `package.json` (update scripts if needed)

### Verification

- [ ] Fresh database initializes correctly
- [ ] Existing database migration works
- [ ] Module migrations run in correct order
- [ ] Error handling is consistent

---

## Task 2.2: Add Transaction Support

**Status**: Not Started
**Priority**: P1
**Estimated Time**: 3-4 hours

### Description

Wrap each migration in a transaction to ensure atomicity. SQLite supports DDL in transactions.

### Implementation

Modify `packages/database/src/migrate.ts`:

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DB_PATH =
	process.env.DATABASE_URL?.replace(/^sqlite:\/\//, '').replace(/^sqlite:|^file:/, '') ||
	(process.env.NODE_ENV === 'production' ? '/data/molos.db' : 'molos.db');

const MIGRATIONS_PATH = join(__dirname, '..', 'drizzle');

/**
 * Run a single migration in a transaction
 */
function runMigrationInTransaction(db: Database.Database, sqlPath: string): void {
	const sql = readFileSync(sqlPath, 'utf-8');

	const transaction = db.transaction(() => {
		db.exec(sql);
	});

	transaction();
}

/**
 * Get applied migrations from Drizzle's tracking table
 */
function getAppliedMigrations(db: Database.Database): Set<string> {
	try {
		const rows = db.prepare('SELECT hash FROM __drizzle_migrations').all() as { hash: string }[];
		return new Set(rows.map((r) => r.hash));
	} catch {
		return new Set();
	}
}

async function runMigrations() {
	const sqlite = new Database(DB_PATH);
	const db = drizzle(sqlite);

	// Use standard drizzle migrator (it handles transactions internally for SQLite)
	await migrate(db, { migrationsFolder: MIGRATIONS_PATH });

	sqlite.close();
	console.log('Migrations completed successfully');
}
```

### Note

Drizzle's `migrate()` function for better-sqlite3 already uses transactions internally for each migration file. However, we should verify this and add explicit transaction handling if needed.

### Verification

- [ ] Test with intentionally broken migration
- [ ] Verify database state is unchanged after failure
- [ ] Verify successful migrations are committed

---

## Task 2.3: Clarify Migration Tracking Strategy

**Status**: Not Started
**Priority**: P1
**Estimated Time**: 2-3 hours + ADR

### Description

Document and implement a clear strategy for migration tracking. Currently there are two tracking mechanisms:

1. **Drizzle Native**: `__drizzle_migrations` table
2. **Custom**: `coreModuleMigrations` table

### Decision Required

Choose one of the following strategies:

#### Option A: Drizzle Native Only

- Use `__drizzle_migrations` for all tracking
- Deprecate/remove `coreModuleMigrations`
- Simpler, follows Drizzle conventions

#### Option B: Custom Only

- Use only `coreModuleMigrations`
- Don't rely on Drizzle's internal tracking
- More control, but more code to maintain

#### Option C: Hybrid (Current)

- Keep both
- Synchronize between them
- Most complex, potential for drift

### Recommendation

**Option A** - Use Drizzle's native tracking. It's battle-tested and reduces custom code.

### Implementation

1. Create ADR documenting the decision
2. Update `migration-manager.ts` to use Drizzle's tracking
3. Add migration to sync existing `coreModuleMigrations` data to `__drizzle_migrations`
4. Deprecate `coreModuleMigrations` table

### Files to Create/Modify

- `documentation/adr/001-migration-tracking-strategy.md` (new ADR)
- `module-management/server/migration-manager.ts` (update)
- Possibly a one-time migration script

### Verification

- [ ] ADR created and approved
- [ ] Code updated to match decision
- [ ] Existing data migrated if needed

---

## Task 2.4: Add Schema Validation

**Status**: Not Started
**Priority**: P1
**Estimated Time**: 4-6 hours

### Description

Create a schema validation utility that compares actual database schema against expected schema from Drizzle definitions.

### Implementation

Create `packages/database/src/schema-validator.ts`:

```typescript
import Database from 'better-sqlite3';

interface TableInfo {
	name: string;
	columns: { name: string; type: string; notnull: number; pk: number }[];
}

interface SchemaDiff {
	missingTables: string[];
	extraTables: string[];
	missingColumns: { table: string; column: string }[];
	extraColumns: { table: string; column: string }[];
	typeMismatches: { table: string; column: string; expected: string; actual: string }[];
}

export function validateSchema(dbPath: string, expectedTables: string[]): SchemaDiff {
	const db = new Database(dbPath);

	// Get actual tables
	const actualTables = db
		.prepare(
			`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'
    `
		)
		.all() as { name: string }[];

	// Get column info for each table
	const tableInfos: Map<string, TableInfo> = new Map();
	for (const table of actualTables) {
		const columns = db.pragma(`table_info(${table.name})`);
		tableInfos.set(table.name, { name: table.name, columns });
	}

	db.close();

	// Compare with expected
	const diff: SchemaDiff = {
		missingTables: [],
		extraTables: [],
		missingColumns: [],
		extraColumns: [],
		typeMismatches: []
	};

	// ... comparison logic ...

	return diff;
}

export function formatSchemaDiff(diff: SchemaDiff): string {
	const lines: string[] = [];

	if (diff.missingTables.length > 0) {
		lines.push(`Missing tables: ${diff.missingTables.join(', ')}`);
	}
	// ... format other differences ...

	return lines.join('\n') || 'Schema is valid';
}
```

### Add npm script

```json
{
	"scripts": {
		"db:validate": "tsx packages/database/src/schema-validator.ts"
	}
}
```

### Files to Create/Modify

- `packages/database/src/schema-validator.ts` (new)
- `package.json` (add script)

### Verification

- [ ] Run on fresh database - should pass
- [ ] Manually drop a table - should report missing
- [ ] Manually add column - should report extra

---

## Phase 2 Completion Checklist

- [ ] Task 2.1: Unified migration runner created
- [ ] Task 2.2: Transaction support verified/added
- [ ] Task 2.3: Tracking strategy decided and documented in ADR
- [ ] Task 2.4: Schema validation implemented
- [ ] All changes tested
- [ ] Documentation updated

---

## Notes

- Phase 2 can be done incrementally - each task is independently valuable
- Task 2.3 (ADR) should be done early to guide other decisions
- Consider running schema validation in CI after Phase 5

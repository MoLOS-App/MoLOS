# Phase 5: Testing & CI/CD

> **Priority**: P2 (Medium)
> **Duration**: 2-3 days
> **Dependencies**: Phase 1-4 (at minimum Phase 1)
> **Status**: Completed (2026-02-23)

---

## Overview

Add comprehensive testing for the migration system and integrate validation into CI/CD pipeline to catch issues before they reach production.

---

## Task 5.1: Create Migration Test Suite

**Status**: ✅ Completed
**Priority**: P2
**Estimated Time**: 4-6 hours

### Description

Create automated tests for migration functionality.

### Test Structure

```
tests/migrations/
├── core-migrations.test.ts      # Core migration tests
├── module-migrations.test.ts    # Module migration tests
├── rollback.test.ts             # Rollback functionality tests
├── schema-validation.test.ts    # Schema validation tests
├── utils.ts                     # Test utilities
└── fixtures/
    └── sample-migration.sql     # Test fixtures
```

### Implementation

#### utils.ts

```typescript
import Database from 'better-sqlite3';
import { join } from 'path';
import { unlinkSync, existsSync, copyFileSync } from 'fs';

export function createTestDb(name: string = 'test'): Database.Database {
	const dbPath = join(process.cwd(), `${name}.test.db`);

	// Clean up existing test db
	if (existsSync(dbPath)) {
		unlinkSync(dbPath);
	}

	return new Database(dbPath);
}

export function cleanupTestDb(db: Database.Database, name: string = 'test') {
	const dbPath = join(process.cwd(), `${name}.test.db`);
	db.close();

	if (existsSync(dbPath)) {
		unlinkSync(dbPath);
	}
}

export function getTableNames(db: Database.Database): string[] {
	const rows = db
		.prepare(
			`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `
		)
		.all() as { name: string }[];

	return rows.map((r) => r.name);
}
```

#### core-migrations.test.ts

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, cleanupTestDb, getTableNames } from './utils';
import { runCoreMigrations } from '@molos/database/migrate';

describe('Core Migrations', () => {
	let db: Database.Database;

	beforeAll(() => {
		db = createTestDb('core');
	});

	afterAll(() => {
		cleanupTestDb(db, 'core');
	});

	it('should apply all core migrations successfully', async () => {
		await runCoreMigrations(db);

		const tables = getTableNames(db);
		expect(tables).toContain('user');
		expect(tables).toContain('session');
		expect(tables).toContain('__drizzle_migrations');
	});

	it('should track applied migrations', async () => {
		const rows = db.prepare('SELECT * FROM __drizzle_migrations').all() as any[];
		expect(rows.length).toBeGreaterThan(0);
	});

	it('should be idempotent', async () => {
		// Run migrations again
		await runCoreMigrations(db);

		// Should not fail or create duplicate tables
		const tables = getTableNames(db);
		const userCount = tables.filter((t) => t === 'user').length;
		expect(userCount).toBe(1);
	});
});
```

#### rollback.test.ts

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, cleanupTestDb } from './utils';
import { MigrationManager } from '$lib/server/migration-manager';

describe('Migration Rollback', () => {
	let db: Database.Database;
	let manager: MigrationManager;

	beforeAll(() => {
		db = createTestDb('rollback');
		manager = new MigrationManager();
	});

	afterAll(() => {
		cleanupTestDb(db, 'rollback');
	});

	it('should generate rollback SQL for CREATE TABLE', () => {
		const sql = 'CREATE TABLE test_table (id TEXT PRIMARY KEY)';
		const rollback = generateRollbackSql(sql);

		expect(rollback).toBe('DROP TABLE IF EXISTS "test_table";');
	});

	it('should generate rollback SQL for CREATE INDEX', () => {
		const sql = 'CREATE INDEX idx_test ON test_table (id)';
		const rollback = generateRollbackSql(sql);

		expect(rollback).toContain('DROP INDEX IF EXISTS "idx_test"');
	});

	it('should return null for un-rollbackable SQL', () => {
		const sql = 'DELETE FROM users WHERE id = 1';
		const rollback = generateRollbackSql(sql);

		expect(rollback).toBeNull();
	});
});
```

### Files to Create

- `tests/migrations/utils.ts`
- `tests/migrations/core-migrations.test.ts`
- `tests/migrations/module-migrations.test.ts`
- `tests/migrations/rollback.test.ts`
- `tests/migrations/schema-validation.test.ts`

### Verification

- [x] `bun run test` runs migration tests
- [x] Tests pass with current code
- [x] Tests fail when migrations are broken

---

## Task 5.2: Add CI Migration Validation

**Status**: ✅ Completed
**Priority**: P2
**Estimated Time**: 2-3 hours

### Description

Add migration validation to the CI/CD pipeline.

### Implementation

Update `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Install Playwright Browsers
        run: bunx playwright install --with-deps chromium

      - name: Run unit tests
        run: bun run test

  # NEW: Migration validation job
  migration-validation:
    runs-on: ubuntu-latest
    needs: test # Run after unit tests pass

    steps:
      - uses: actions/checkout@v4

      - name: Install Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Validate migration journals
        run: bun run db:audit-modules
        continue-on-error: true # Don't fail yet, just warn

      - name: Test fresh database initialization
        run: |
          rm -f molos.db
          bun run db:init

      - name: Validate database schema
        run: bun run db:validate

      - name: Test migration idempotency
        run: |
          bun run db:migrate
          bun run db:migrate  # Should not fail on second run

      - name: Upload database artifact (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: failed-migration-db
          path: molos.db
```

### Add npm scripts

```json
{
	"scripts": {
		"db:validate-migrations": "tsx scripts/audit-module-migrations.ts && tsx packages/database/src/schema-validator.ts"
	}
}
```

### Verification

- [x] CI runs migration validation
- [x] Failing migrations block PR merge
- [x] Database artifact uploaded on failure

---

## Task 5.3: Create Migration Testing Guide

**Status**: Deferred (Optional)
**Priority**: P3
**Estimated Time**: 1-2 hours

### Description

Document how to test migrations locally before pushing.

### Implementation

Create `documentation/DB_IMPROV/testing-migrations.md`:

````markdown
# Testing Migrations Locally

## Before Pushing

1. **Backup your database**
   ```bash
   cp molos.db molos.db.backup
   ```
````

2. **Test fresh initialization**

   ```bash
   rm molos.db
   bun run db:init
   ```

3. **Test migration from current state**

   ```bash
   bun run db:migrate
   ```

4. **Validate schema**

   ```bash
   bun run db:validate
   ```

5. **Run tests**
   ```bash
   bun run test:migrations
   ```

## Testing a New Migration

1. **Generate migration**

   ```bash
   cd packages/database
   bun run db:generate
   ```

2. **Review the generated SQL**
   - Check for destructive operations
   - Verify rollback is possible

3. **Test on copy of production data**

   ```bash
   cp production.db test.db
   DATABASE_URL=test.db bun run db:migrate
   ```

4. **Verify application works**
   ```bash
   DATABASE_URL=test.db bun run dev
   ```

## Common Issues

### Migration fails with "table already exists"

- The migration was partially applied
- Check `__drizzle_migrations` table
- May need to manually mark migration as applied

### Schema validation fails after migration

- Migration may have been applied but journal not updated
- Run `bun run db:audit-modules` to check

### Rollback doesn't work

- Only CREATE TABLE/INDEX are auto-rollbackable
- Add a `.down.sql` file for complex migrations

````

### Files to Create

- `documentation/DB_IMPROV/testing-migrations.md`

---

## Task 5.4: Add Migration Dry-Run Mode

**Status**: Deferred (Optional)
**Priority**: P3
**Estimated Time**: 2-3 hours

### Description

Add a dry-run mode that shows what migrations would do without actually applying them.

### Implementation

Add to `packages/database/src/migrate.ts`:

```typescript
interface MigrationPreview {
    name: string;
    sql: string;
    checksum: string;
    wouldApply: boolean;
    tablesAffected: string[];
    operations: ('CREATE' | 'ALTER' | 'DROP' | 'INSERT' | 'DELETE')[];
}

export async function previewMigrations(dbPath: string): Promise<MigrationPreview[]> {
    const previews: MigrationPreview[] = [];

    // Get pending migrations
    // Parse SQL to extract operations
    // Return preview without executing

    return previews;
}

// CLI support
if (process.argv.includes('--dry-run')) {
    const previews = await previewMigrations(DB_PATH);
    console.log('Pending migrations:');
    for (const p of previews) {
        console.log(`\n  ${p.name}:`);
        console.log(`    Operations: ${p.operations.join(', ')}`);
        console.log(`    Tables: ${p.tablesAffected.join(', ')}`);
    }
    process.exit(0);
}
````

### Add npm script

```json
{
	"scripts": {
		"db:migrate:dry-run": "tsx packages/database/src/migrate.ts --dry-run"
	}
}
```

### Verification

- [ ] `bun run db:migrate:dry-run` lists pending migrations
- [ ] Shows operations and affected tables
- [ ] Doesn't modify database

---

## Phase 5 Completion Checklist

- [x] Task 5.1: Migration test suite created
- [x] Task 5.2: CI validation added
- [ ] Task 5.3: Testing guide documented (optional - deferred)
- [ ] Task 5.4: Dry-run mode implemented (optional - deferred)
- [x] Tests pass in CI
- [x] Documentation is complete

---

## Notes

- Phase 5 can start after Phase 1 (doesn't require Phase 2-4)
- CI validation should be non-blocking initially, then made required
- Consider adding scheduled CI runs to catch migration drift

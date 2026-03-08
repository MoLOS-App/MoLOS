# @molos/database Package

## Overview

`@molos/database` provides the database schema, migrations, and data access utilities for MoLOS. It uses Drizzle ORM with SQLite as the underlying database.

## Location

```
packages/database/
├── src/
│   ├── schema/              # Database schema definitions
│   │   ├── core/            # Core tables (user, session, settings)
│   │   └── external/        # External module tables
│   ├── migrate.ts           # Core migration runner
│   ├── migrate-unified.ts   # Unified migration runner (core + modules)
│   ├── schema-validator.ts  # Schema validation utility
│   ├── migration-logger.ts  # Structured logging for migrations
│   ├── utils/               # Database utilities
│   │   └── namespace.ts     # Table namespacing helpers
│   └── index.ts             # Main exports
├── drizzle/                 # Core migration files
├── package.json
└── drizzle.config.ts
```

## Exports

| Export                             | Description                      |
| ---------------------------------- | -------------------------------- |
| `@molos/database`                  | Main exports (db client, schema) |
| `@molos/database/schema`           | Schema definitions               |
| `@molos/database/schema/core`      | Core schema only                 |
| `@molos/database/utils`            | Table namespacing utilities      |
| `@molos/database/migrate-unified`  | Unified migration runner         |
| `@molos/database/schema-validator` | Schema validation utility        |
| `@molos/database/migration-logger` | Structured logging               |

## Usage

### Database Connection

```typescript
import { db } from '@molos/database';

// Query using Drizzle
const users = await db.select().from(users);
```

### Table Namespacing

All external module tables use a namespaced naming convention to prevent collisions:

**Format:** `MoLOS-{ModuleName}_{table_name}`

```typescript
import { getTableName } from '@molos/database';

const MODULE_ID = 'MoLOS-Tasks';

// Creates table: MoLOS-Tasks_projects
export const projects = sqliteTable(getTableName(MODULE_ID, 'projects'), {
	id: text('id').primaryKey(),
	name: text('name').notNull()
});
```

| Pattern                | Example             | Status     |
| ---------------------- | ------------------- | ---------- |
| `MoLOS-{Name}_{table}` | `MoLOS-Tasks_tasks` | Correct    |
| `mod_{module}_{table}` | `mod_tasks_tasks`   | Deprecated |

### Helper Functions

| Function                            | Description                        |
| ----------------------------------- | ---------------------------------- |
| `getTableName(moduleId, tableName)` | Generate prefixed table name       |
| `isModuleTable(fullName, moduleId)` | Check table ownership              |
| `getModuleTablePattern(moduleId)`   | Get LIKE pattern for module tables |

---

## Migrations

### Migration Architecture

MoLOS uses a **unified migration system** based on Drizzle ORM:

- **Core migrations**: `drizzle/` directory (tracked in `__drizzle_migrations`)
- **Module migrations**: `modules/{ModuleName}/drizzle/` (per-module tracking)

See [ADR-001](../adr/001-migration-tracking-strategy.md) for the tracking strategy decision.

### Commands

| Command                    | Description                                                              | Usage Context              |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| `bun run db:init`          | Initialize database (first-time setup, applies existing migrations only) | New setup, fresh install   |
| `bun run db:migrate`       | Run all pending migrations                                               | Update existing DB         |
| `bun run db:migrate`       | Unified runner with logging                                              | Debugging migrations       |
| `bun run db:generate`      | **DEVELOPMENT ONLY**: Generate new migration files from schema changes   | After editing schema files |
| `bun run db:push`          | Push schema directly (dev only)                                          | Quick iteration in dev     |
| `bun run db:validate`      | Validate schema matches migrations                                       | Verify migration health    |
| `bun run db:audit-modules` | Audit all module migrations                                              | Check module DB setup      |
| `bun run db:studio`        | Open Drizzle Studio                                                      | Visual DB inspection       |
| `bun run db:reset`         | Reset database (destructive)                                             | Clean slate                |

**Important:** `db:generate` is only for development when creating new migrations from schema changes. It is NOT part of `db:init` which only applies existing migrations. See [Migration Workflow](#migration-workflow) for details.

### Migration Workflow

#### Understanding the Two Phases

Database migration has two distinct phases that must be kept separate:

| Phase           | Command               | Purpose                                | Fails If...                           |
| --------------- | --------------------- | -------------------------------------- | ------------------------------------- |
| **Generation**  | `bun run db:generate` | CREATE new migration files from schema | ANY module has invalid schema         |
| **Application** | `bun run db:migrate`  | APPLY existing migrations to database  | Migration SQL has errors or conflicts |

**Why They Must Be Separate:**

- **Generation** scans ALL module schemas - one bad schema blocks everyone
- **Application** only runs pending migrations - independent of other modules
- **Generation** is development-time (schema → SQL files)
- **Application** is runtime/deploy-time (SQL files → database)
- **Init script** should only APPLY, not GENERATE

#### Creating a New Migration (Development Phase)

```bash
# 1. Modify schema in packages/database/src/schema/
# 2. Generate migration
cd packages/database
bun run db:generate

# 3. Review generated SQL in drizzle/*.sql
# 4. Test migration
cd ../..
bun run db:migrate
bun run db:validate
```

#### Module Migrations

```bash
# 1. Modify schema in modules/{ModuleName}/src/server/database/schema.ts
# 2. Generate migration
cd modules/{ModuleName}
bun run db:generate

# 3. Review and test
bun run db:migrate
```

### Migration Files

Migration files follow Drizzle conventions:

```
drizzle/
├── 0000_initial.sql
├── 0001_add_settings.sql
├── ...
├── 0015_cleanup_duplicate_ai_messages.sql
└── meta/
    └── _journal.json     # Migration tracking
```

**Important**: Each SQL file must use `--> statement-breakpoint` to separate statements:

```sql
CREATE TABLE users (id TEXT PRIMARY KEY);

--> statement-breakpoint

CREATE INDEX idx_users_email ON users (email);
```

### Data Migrations

For data transformations (DELETE, UPDATE, INSERT):

1. **Always backup before running** - Use `bun run db:init` which creates automatic backups
2. **Use statement breakpoints** - Separate DDL from DML
3. **Consider rollback** - Create a `.down.sql` file if rollback is needed

Example data migration:

```sql
-- 0016_cleanup_duplicates.sql
DELETE FROM table WHERE duplicate = true;

--> statement-breakpoint

CREATE INDEX idx_table_status ON table (status);
```

### Rollback Support

The system supports rollback via:

1. **Manual `.down.sql` files** - Place alongside migration file
2. **Auto-generated rollback** - For simple DDL (CREATE TABLE, CREATE INDEX, ALTER TABLE ADD COLUMN)

```
drizzle/
├── 0016_add_column.sql
├── 0016_add_column.down.sql  # Manual rollback
```

---

## Schema Structure

### Core Tables

| Table                       | Description             |
| --------------------------- | ----------------------- |
| `user`                      | User accounts           |
| `session`                   | Authentication sessions |
| `settings`                  | Application settings    |
| `settings_external_modules` | Module activation state |
| `__drizzle_migrations`      | Migration tracking      |

### Module Tables

External module tables follow the `MoLOS-{ModuleName}_{table_name}` naming convention:

| Module                  | Tables                                              |
| ----------------------- | --------------------------------------------------- |
| `@molos/module-tasks`   | `MoLOS-Tasks_tasks`, `MoLOS-Tasks_projects`         |
| `@molos/module-goals`   | `MoLOS-Goals_tracker`, `MoLOS-Goals_settings`       |
| `@molos/module-health`  | `MoLOS-Health_user_profile`, `MoLOS-Health_metrics` |
| `@molos/module-finance` | `MoLOS-Finance_accounts`, `MoLOS-Finance_expenses`  |

---

## Observability

### Health Endpoint

Check migration status via `/api/health/migrations`:

```json
{
	"status": "healthy",
	"core": {
		"applied": 16,
		"pending": [],
		"lastApplied": "2026-02-23T12:00:00Z"
	},
	"modules": {
		"MoLOS-Tasks": { "applied": 2, "pending": [], "tablesExist": true }
	},
	"backup": { "exists": true, "age": "2h ago" }
}
```

### Migration Logs

Logs are written to `logs/migrations.log` in JSONL format:

```json
{
	"timestamp": "2026-02-23T12:00:00Z",
	"level": "info",
	"operation": "apply",
	"target": "core",
	"migrationName": "0016_add_column",
	"duration": 45,
	"success": true
}
```

---

## Testing

### Test Suite

The database package has comprehensive tests in `tests/migrations/`:

| Test File                      | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| `utils.ts`                     | Test utilities (createTestDb, cleanupTestDb, etc.) |
| `migrations.spec.ts`           | Core & module migration tests                      |
| `rollback.spec.ts`             | Rollback SQL generation tests                      |
| `logger-and-validator.spec.ts` | Migration logger & schema validator tests          |
| `namespace.spec.ts`            | Table namespacing utility tests                    |

### Running Tests

```bash
# Run all migration tests
bun run test:unit -- tests/migrations --run

# Run specific test file
bun run test:unit -- tests/migrations/rollback.spec.ts --run

# Run with coverage
bun run test:unit -- tests/migrations --coverage --run
```

### Test Utilities

```typescript
import { createTestDb, cleanupTestDb, tableExists } from '../utils';

describe('My Test', () => {
	let testDb: ReturnType<typeof createTestDb>;

	beforeEach(() => {
		testDb = createTestDb('my-test');
	});

	afterEach(() => {
		cleanupTestDb(testDb.db, testDb.path);
	});

	it('should work', () => {
		expect(tableExists(testDb.db, 'users')).toBe(true);
	});
});
```

---

## Dependencies

- `drizzle-orm` - ORM for type-safe queries
- `better-sqlite3` - SQLite driver
- `@molos/core` - Shared types and utilities

## Related

- [Database Architecture](../architecture/database.md)
- [Data Namespacing](../architecture/data-namespacing.md)
- [ADR-001: Migration Tracking Strategy](../adr/001-migration-tracking-strategy.md)
- [Troubleshooting](../getting-started/troubleshooting.md)
- [Testing Guide](../getting-started/testing.md)

---

_Last Updated: 2026-02-23_

# Database Architecture

> **Last Updated**: 2026-02-23

## Overview

MoLOS uses SQLite as its primary database, managed through Drizzle ORM. The architecture supports both core application tables and modular, plugin-style tables for external modules.

## Technology Stack

| Component  | Technology     | Purpose                    |
| ---------- | -------------- | -------------------------- |
| Database   | SQLite         | Lightweight, file-based DB |
| ORM        | Drizzle ORM    | Type-safe queries          |
| Driver     | better-sqlite3 | Synchronous SQLite driver  |
| Migrations | drizzle-kit    | Schema migrations          |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      MoLOS Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │   Core Tables    │    │      Module Tables           │   │
│  │                  │    │                              │   │
│  │  • user          │    │  MoLOS-Tasks_*               │   │
│  │  • session       │    │  MoLOS-Goals_*               │   │
│  │  • settings      │    │  MoLOS-Finance_*             │   │
│  │  • ai_messages   │    │  MoLOS-Health_*              │   │
│  │  • ...           │    │  ...                         │   │
│  └──────────────────┘    └──────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  __drizzle_migrations                │   │
│  │              (Migration Tracking Table)              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   molos.db      │
                    │   (SQLite)      │
                    └─────────────────┘
```

## Directory Structure

```
packages/database/
├── src/
│   ├── schema/
│   │   ├── core/                    # Core schema
│   │   │   ├── index.ts
│   │   │   ├── user.ts
│   │   │   ├── session.ts
│   │   │   ├── settings.ts
│   │   │   └── migration.ts         # Migration tracking
│   │   └── external/                # External module schemas
│   ├── migrate.ts                   # Core migrations only
│   ├── migrate-unified.ts           # Unified runner
│   ├── schema-validator.ts          # Validation utility
│   ├── migration-logger.ts          # Logging utility
│   └── index.ts
├── drizzle/                         # Core migration files
│   ├── 0000_*.sql
│   ├── ...
│   └── meta/_journal.json

modules/MoLOS-{Name}/
├── drizzle/                         # Module migrations
│   ├── 0000_*.sql
│   └── meta/_journal.json
└── src/server/database/
    └── schema.ts                    # Module schema
```

---

## Table Namespacing

### Convention

All module tables MUST use the prefix `MoLOS-{ModuleName}_`:

```
MoLOS-{ModuleName}_{table_name}
```

### Examples

| Module             | Correct Table Name           | Incorrect       |
| ------------------ | ---------------------------- | --------------- |
| MoLOS-Tasks        | `MoLOS-Tasks_tasks`          | `tasks`         |
| MoLOS-Goals        | `MoLOS-Goals_tracker`        | `goals_tracker` |
| MoLOS-AI-Knowledge | `MoLOS-AI-Knowledge_prompts` | `ai_prompts`    |

### Rationale

1. **Namespace isolation** - Prevents table name collisions between modules
2. **Clear ownership** - Easy to identify which module owns a table
3. **Safe uninstall** - Can drop all module tables with `LIKE 'MoLOS-{Name}_%'`

---

## Migration System

### Tracking Strategy

MoLOS uses Drizzle's native migration tracking (`__drizzle_migrations` table) exclusively. See [ADR-001](../adr/001-migration-tracking-strategy.md) for the decision rationale.

```sql
-- Migration tracking table (managed by Drizzle)
CREATE TABLE __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER
);
```

### Migration Flow

```
bun run db:init
       │
       ▼
┌──────────────────┐
│  Check DB exists │──No──▶ Create DB
└──────────────────┘
       │Yes
       ▼
┌──────────────────┐
│  Backup DB       │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Run core        │
│  migrations      │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Run module      │
│  migrations      │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  Validate schema │
└──────────────────┘
       │
       ▼
    Complete
```

### Transaction Support

Drizzle's migrator wraps each migration file in a transaction for SQLite. This ensures:

- **Atomicity** - Either all statements apply or none
- **Rollback** - Failed migrations don't leave partial state
- **Consistency** - Database always in valid state

### Statement Breakpoints

Migration files with multiple statements MUST use `--> statement-breakpoint`:

```sql
-- Correct
CREATE TABLE users (id TEXT PRIMARY KEY);

--> statement-breakpoint

CREATE INDEX idx_users_email ON users (email);
```

```sql
-- Incorrect (will fail)
CREATE TABLE users (id TEXT PRIMARY KEY);
CREATE INDEX idx_users_email ON users (email);
```

---

## Module Migrations

### Structure

Each module with database tables has its own `drizzle/` directory:

```
modules/MoLOS-Tasks/
├── drizzle/
│   ├── 0000_initial.sql
│   ├── 0001_add_projects.sql
│   └── meta/
│       └── _journal.json
├── drizzle.config.ts
└── src/server/database/
    └── schema.ts
```

### drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/server/database/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: 'file:../../molos.db' }, // Points to root DB
	verbose: true,
	strict: true
});
```

### Module Migration Commands

```bash
# From module directory
cd modules/MoLOS-Tasks

# Generate migration
bun run db:generate

# Apply migrations (from root)
cd ../..
bun run db:migrate
```

---

## Safety Features

### Pre-Migration Backup

`bun run db:init` automatically creates timestamped backups:

```
molos.db.backup-2026-02-23T12-00-00
```

### Schema Validation

Validate actual database matches expected schema:

```bash
bun run db:validate
```

### Module Audit

Check all modules for migration issues:

```bash
bun run db:audit-modules
```

Output:

```
| Module              | Drizzle | Journal | SQLs | Synced | Prefix | Issues |
|---------------------|---------|---------|------|--------|--------|--------|
| MoLOS-Tasks         | ✅      | ✅      | 2    | ✅     | ✅     | ✅     |
| MoLOS-Goals         | ✅      | ✅      | 1    | ✅     | ✅     | ✅     |
```

---

## Observability

### Health Endpoint

`GET /api/health/migrations`

```json
{
	"status": "healthy",
	"timestamp": "2026-02-23T12:00:00Z",
	"core": {
		"applied": 16,
		"pending": [],
		"lastApplied": "2026-02-23T10:00:00Z"
	},
	"modules": {
		"MoLOS-Tasks": {
			"hasMigrations": true,
			"applied": 2,
			"pending": [],
			"tablesExist": true
		}
	},
	"backup": {
		"exists": true,
		"path": "/data/molos.db.backup-2026-02-23",
		"age": "2h ago"
	},
	"database": {
		"path": "molos.db",
		"size": "1.2 MB",
		"tables": 99
	}
}
```

### Structured Logging

All migration operations are logged to `logs/migrations.log`:

```json
{
	"timestamp": "2026-02-23T12:00:00.000Z",
	"level": "info",
	"operation": "apply",
	"target": "core",
	"migrationName": "0016_add_column",
	"duration": 45,
	"checksum": "abc123...",
	"success": true
}
```

---

## Testing

### Test Structure

```
tests/migrations/
├── utils.ts                    # Test utilities
├── migrations.spec.ts          # Core & module migration tests (7 tests)
├── rollback.spec.ts            # Rollback SQL generation tests (8 tests)
├── logger-and-validator.spec.ts # Logger & validator tests (7 tests)
└── namespace.spec.ts           # Table namespacing tests (4 tests)
```

**Total: 26 tests**

### Running Tests

```bash
# Run all migration tests
bun run test:unit -- tests/migrations --run

# Run specific test file
bun run test:unit -- tests/migrations/rollback.spec.ts --run

# Run with coverage
bun run test:unit -- tests/migrations --coverage --run
```

### Test Coverage

| Area              | Tests | Description                                 |
| ----------------- | ----- | ------------------------------------------- |
| Core Migrations   | 4     | Apply, track, idempotency                   |
| Module Migrations | 3     | Journal sync, table prefix validation       |
| Rollback SQL      | 8     | CREATE TABLE, INDEX, ALTER TABLE generation |
| Schema Validation | 3     | Missing/extra tables detection              |
| Migration Logger  | 3     | Structured JSONL logging                    |
| Namespacing       | 4     | Table name generation, reserved names       |

### CI Integration

Migration validation runs in CI:

1. Audit module migrations
2. Test fresh database initialization
3. Validate schema
4. Test migration idempotency
5. Run migration tests (26 tests)

---

## Related

- [Database Package](../packages/database.md)
- [ADR-001: Migration Tracking Strategy](../adr/001-migration-tracking-strategy.md)
- [Troubleshooting](../getting-started/troubleshooting.md)
- [Testing Guide](../getting-started/testing.md)
- [Data Namespacing](./data-namespacing.md)

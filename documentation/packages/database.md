# @molos/database Package

## Overview

`@molos/database` provides the database schema, migrations, and data access utilities for MoLOS. It uses Drizzle ORM with SQLite as the underlying database.

## Location

```
packages/database/
├── src/
│   ├── schema/          # Database schema definitions
│   │   ├── core/        # Core tables
│   │   └── external/    # External module tables
│   ├── migrations/      # Migration files
│   ├── utils/           # Database utilities
│   │   └── namespace.ts # Table namespacing helpers
│   └── index.ts         # Main exports
├── drizzle/
├── package.json
└── drizzle.config.ts
```

## Installation

```bash
npm install @molos/database
```

## Usage

### Database Connection

```typescript
import { db } from '@molos/database';

// Query using Drizzle
const users = await db.select().from(users);
```

### Table Namespacing

All module tables use a namespaced naming convention to prevent collisions:

```typescript
import { getTableName } from '@molos/database';

const MODULE_ID = 'my-module';

// Creates table: mod_my_module_projects
export const projects = sqliteTable(
  getTableName(MODULE_ID, 'projects'),
  {
    id: text('id').primaryKey(),
    name: text('name').notNull()
  }
);
```

### Helper Functions

| Function | Description |
|----------|-------------|
| `getTableName(moduleId, tableName)` | Generate prefixed table name |
| `isModuleTable(fullName, moduleId)` | Check table ownership |
| `getModuleTablePattern(moduleId)` | Get LIKE pattern for module tables |

## Schema Structure

### Core Tables

- `user` - User accounts
- `session` - Authentication sessions
- `settings` - Application settings
- `settings_external_modules` - Module activation state

### Module Tables

Module tables follow the `mod_{moduleId}_{tableName}` naming convention:

| Module | Tables |
|--------|--------|
| `@molos/module-tasks` | `mod_tasks_tasks`, `mod_tasks_categories` |
| `@molos/module-ai` | AI-related tables |

## Migrations

```bash
# Generate migrations
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (development)
npm run db:push
```

## Dependencies

- `drizzle-orm` - ORM for type-safe queries
- `better-sqlite3` - SQLite driver
- `@molos/core` - Shared types and utilities

## Related

- [Data Namespacing](../architecture/data-namespacing.md)
- [Module Development](../modules/development.md)

---

*See also: [Architecture Overview](../architecture/overview.md)*

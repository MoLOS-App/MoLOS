# MoLOS AI Context Reference

> **Purpose**: Single comprehensive reference for AI assistants working on the MoLOS codebase.

---

## Project Overview

**MoLOS** (Modular Life Organization System) is a privacy-focused, deeply modular productivity suite built with SvelteKit. It uses a package-based module system where modules can be installed from npm, GitHub, or developed locally within the monorepo.

**Core Principles:**

- Privacy-first design (self-hostable)
- Modular architecture (install only what you need)
- Type-safe throughout (TypeScript + Drizzle ORM)
- Fast development experience (Bun + Turborepo)

**Distribution Strategy:**

- Official Docker image ships with **all verified modules** at verified versions
- Users **activate/deactivate** modules at runtime (not build-time)
- Custom images with user-selected modules are **at own risk**

---

## Tech Stack

| Component       | Technology    | Notes                            |
| --------------- | ------------- | -------------------------------- |
| Frontend/API    | SvelteKit 2.x | Svelte 5 with runes              |
| Database        | SQLite        | Via better-sqlite3               |
| ORM             | Drizzle       | Type-safe queries                |
| Styling         | Tailwind CSS  | With shadcn-svelte components    |
| Build           | Turborepo     | Monorepo task orchestration      |
| Package Manager | Bun           | Fast installs, workspace support |
| Auth            | better-auth   | Session-based authentication     |

---

## Directory Structure

```
MoLOS/
├── apps/
│   └── web/                    # Main SvelteKit application (future)
├── packages/
│   ├── core/                   # @molos/core - utilities and types
│   ├── database/               # @molos/database - schema and migrations
│   └── ui/                     # @molos/ui - shared components
├── modules/
│   ├── ai/                     # @molos/module-ai (internal)
│   └── tasks/                  # @molos/module-tasks
├── external_modules/           # External modules (migrated)
│   ├── MoLOS-Goals/
│   ├── MoLOS-Health/
│   ├── MoLOS-Finance/
│   ├── MoLOS-Meals/
│   ├── MoLOS-Google/
│   ├── MoLOS-AI-Knowledge/
│   └── MoLOS-Sample-Module/
├── src/                        # Main SvelteKit app
│   ├── lib/
│   │   ├── components/         # UI components
│   │   ├── server/             # Server-side code
│   │   ├── stores/             # Svelte stores
│   │   ├── models/             # TypeScript types
│   │   ├── repositories/       # Data access layer
│   │   └── config/             # App configuration
│   └── routes/                 # SvelteKit routes
├── scripts/                    # Build and utility scripts
├── drizzle/                    # Core database migrations
└── documentation/              # This documentation
```

---

## Module System Quick Reference

### Module Types

| Type     | ID Format      | Example           | Location                         |
| -------- | -------------- | ----------------- | -------------------------------- |
| Internal | lowercase      | `dashboard`, `ai` | `src/lib/config/`, `modules/ai/` |
| External | `MoLOS-{Name}` | `MoLOS-Tasks`     | `modules/`, `external_modules/`  |

### Module Structure (External)

```
modules/MoLOS-{Name}/
├── package.json              # @molos/module-{name}
├── manifest.yaml             # Module manifest
├── drizzle.config.ts         # Database config (if has DB)
├── drizzle/                  # Migrations (if has DB)
└── src/
    ├── config.ts             # ModuleConfig (REQUIRED)
    ├── index.ts              # Package exports
    ├── models/               # TypeScript types
    ├── server/
    │   ├── database/schema.ts
    │   └── repositories/
    ├── routes/
    │   ├── ui/               # SvelteKit UI routes
    │   └── api/              # API endpoints
    ├── components/           # Svelte components
    └── stores/               # Svelte stores
```

### Module Config Pattern

```typescript
// src/config.ts
import { SquareCheck } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export const myModuleConfig: ModuleConfig = {
	id: 'MoLOS-Tasks', // REQUIRED: Must match module ID convention
	name: 'Tasks', // REQUIRED: Display name
	href: '/ui/MoLOS-Tasks', // REQUIRED: Base route
	icon: SquareCheck, // REQUIRED: Lucide icon
	description: 'Task management', // REQUIRED: Short description
	navigation: [
		// OPTIONAL: Sidebar navigation
		{ name: 'Dashboard', icon: ListTodo, href: '/ui/MoLOS-Tasks/dashboard' }
	]
};

export default myModuleConfig;
```

---

## Quick Reference Links

For detailed information on specific topics, see:

- **[Migration System Overview](./archive/DB_IMPROV/IMPLEMENTATION_COMPLETE.md)** - Complete migration system documentation
- **[Migration Quick Start](./archive/DB_IMPROV/QUICK_START.md)** - Quick reference for migrations
- **[Database Naming Convention](./QUICK-REFERENCE.md#database-table-naming)** - Table naming rules for modules
- **[Import Patterns](./QUICK-REFERENCE.md#import-patterns)** - How to import modules and dependencies
- **[Common Commands](./QUICK-REFERENCE.md#commands)** - Development and build commands
- **[Environment Variables](./QUICK-REFERENCE.md#environment-variables)** - Configuration options
- **[Troubleshooting](./QUICK-REFERENCE.md#troubleshooting-quick-fixes)** - Common issues and solutions

---

## Migration System (v2.1 - Production Ready)

**Production Readiness**: 9.5/10 ✅

**Use the improved migration system for safety:**

```bash
# Create migration
bun run db:migration:create --name add_feature --module core --reversible

# Apply migrations (SAFE - transaction-wrapped, auto-backup)
bun run db:migrate:improved

# Validate schema
bun run db:validate

# Diagnose issues
bun run db:repair

# Repair corrupted migrations
bun run db:repair:fix

# Backup management (NEW!)
bun run db:restore --list       # List backups
bun run db:restore --latest     # Restore latest
bun run db:restore --file <name> # Restore specific
```

**Safety Features (v2.1)**:

- ✅ **Automatic backups** with integrity verification
- ✅ **Transaction wrapping** (no partial states)
- ✅ **Checksum validation** with SQL normalization
- ✅ **Migration locking** (prevents concurrent runs)
- ✅ **Two-phase tracking** (prevents crash corruption)
- ✅ **Disk space checks** (100MB minimum)
- ✅ **Backup rotation** (keeps last 10)
- ✅ **Secure permissions** (0600 on backups)
- ✅ **Error categorization** (9 specific types)
- ✅ **Interactive restoration** with confirmation

**See**:

- [FINAL_SUMMARY.md](./archive/DB_IMPROV/FINAL_SUMMARY.md) - Complete implementation details
- [QUICK_START.md](./archive/DB_IMPROV/QUICK_START.md) - Developer quick reference

---

## Database Naming Convention

**CRITICAL**: All external module tables MUST follow this naming:

```
MoLOS-{ModuleName}_{table_name}
```

| Pattern                     | Example                     | Status                 |
| --------------------------- | --------------------------- | ---------------------- |
| `MoLOS-{Name}_{table}`      | `MoLOS-Tasks_tasks`         | Correct                |
| `MoLOS-{Name}_{table}`      | `MoLOS-Health_user_profile` | Correct                |
| `{module}_{table}`          | `health_user_profile`       | Wrong - missing prefix |
| `{module}_{module}_{table}` | `meals_meals_settings`      | Wrong - duplicated     |
| `{table}`                   | `tasks`                     | Wrong - no prefix      |

### Core Tables (No Prefix)

- `user` - User accounts
- `session` - Authentication sessions
- `settings` - Application settings
- `settings_external_modules` - Module activation state

**See:** [Quick Reference - Database Naming](./QUICK-REFERENCE.md#database-table-naming)

---

## Import Patterns

### Within a Module (Use $lib alias)

```typescript
// From main app
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';
```

### Cross-Module Imports

```typescript
// Pattern 1: $lib/modules/{ModuleName}
import { goalsStore } from '$lib/modules/MoLOS-Goals/stores';

// Pattern 2: $lib/{type}/external_modules/{ModuleName}
import { Goal } from '$lib/models/external_modules/MoLOS-Goals';
import { GoalRepository } from '$lib/repositories/external_modules/MoLOS-Goals';
```

### Route Imports (Use .js extension)

```typescript
// Always use .js for TypeScript imports in routes
import { TaskRepository } from '../../../server/repositories/task-repository.js';
```

**See:** [Quick Reference - Import Patterns](./QUICK-REFERENCE.md#import-patterns)

---

## Common Commands

| Command                                       | Description                                      |
| --------------------------------------------- | ------------------------------------------------ |
| `bun run dev`                                 | Start dev server (auto-discovers modules)        |
| `bun run build`                               | Build for production                             |
| `bun run prod`                                | Build and serve production (migrations run auto) |
| `bun run serve`                               | Serve production build (migrations run auto)     |
| `bun run module:sync`                         | Sync and initialize modules                      |
| `bun run module:link`                         | Create route symlinks                            |
| `bun run db:init`                             | Initialize database (first-time setup, dev only) |
| `bun run db:migration:create --name <name>    | Create new migration                             |
| `bun run db:migrate`                          | Run all pending migrations                       |
| `bun run db:migrate`                          | Unified runner - used by prod and dev            |
| `bun run db:push`                             | Push schema changes (dev only)                   |
| `bun run db:validate`                         | Validate schema matches migrations               |
| `bun run db:audit-modules`                    | Audit all module migrations                      |
| `bun run db:studio`                           | Open Drizzle Studio                              |
| `bun run db:reset`                            | Reset database (destructive)                     |
| `bun run test`                                | Run all tests (via turbo)                        |
| `bun run test:unit`                           | Run unit tests in watch mode                     |
| `bun run test:unit -- tests/migrations --run` | Run migration tests (26 tests)                   |
| `bun run changeset`                           | Create a new changeset                           |
| `bun run changeset:version`                   | Apply changesets to bump versions                |
| `bun run changeset:status`                    | View pending changesets                          |
| `bun run release [patch\|minor\|major]`       | Manual release CLI                               |
| `bun run release:modules-config`              | Update modules.config.ts                         |

**See:** [Quick Reference - Commands](./QUICK-REFERENCE.md#commands)

---

## Key File Locations

| What                     | Where                                       |
| ------------------------ | ------------------------------------------- |
| App entry point          | `src/app.html`                              |
| Module registry          | `src/lib/config/index.ts`                   |
| Module types             | `src/lib/config/types.ts`                   |
| Database client          | `src/lib/server/db/index.ts`                |
| Core schema              | `packages/database/src/schema/core/`        |
| Module schemas           | `packages/database/src/schema/external/`    |
| Core migrations          | `drizzle/`                                  |
| Unified migration runner | `packages/database/src/migrate-unified.ts`  |
| Schema validator         | `packages/database/src/schema-validator.ts` |
| Migration logger         | `packages/database/src/migration-logger.ts` |
| Migration logs           | `logs/migrations.log`                       |
| Migration tests          | `tests/migrations/`                         |
| Shared components        | `packages/ui/src/lib/components/`           |
| Module linker script     | `scripts/link-modules.ts`                   |
| Migration audit script   | `scripts/audit-module-migrations.ts`        |
| Release CLI              | `scripts/release-cli.ts`                    |
| Modules config updater   | `scripts/update-modules-config.ts`          |
| Changeset config         | `.changeset/config.json`                    |
| Modules config           | `modules.config.ts`                         |

---

## modules.config.ts

Module configuration for production builds:

```typescript
export interface ModuleConfigEntry {
	id: string; // Module identifier (folder name)
	git: string; // Git repository URL
	tag?: string; // Git tag (mutually exclusive with branch)
	branch?: string; // Git branch (mutually exclusive with tag)
	required?: boolean; // Build fails if required module can't be fetched
}
```

**Tag vs Branch Behavior:**

| Ref Type            | If Exists | Behavior                                |
| ------------------- | --------- | --------------------------------------- |
| `tag: 'v1.0.0'`     | Re-clones | Ensures exact version, no local changes |
| `branch: 'develop'` | Skips     | Preserves local changes for development |

**Use `tag` for production, `branch` for development.**

---

## Symlink Structure

Modules are linked to these locations:

| Target                                            | Points To                       |
| ------------------------------------------------- | ------------------------------- |
| `src/routes/ui/(modules)/(external_modules)/{id}` | `{module}/src/routes/ui`        |
| `src/routes/api/(external_modules)/{id}`          | `{module}/src/routes/api`       |
| `src/lib/modules/{id}`                            | `{module}/src/lib`              |
| `src/lib/models/external_modules/{id}`            | `{module}/src/lib/models`       |
| `src/lib/repositories/external_modules/{id}`      | `{module}/src/lib/repositories` |
| `src/lib/stores/external_modules/{id}`            | `{module}/src/lib/stores`       |
| `src/lib/components/external_modules/{id}`        | `{module}/src/lib/components`   |

**See:** [Quick Reference - Symlink Locations](./QUICK-REFERENCE.md#symlink-locations)

---

## Environment Variables

```bash
# .env

# Empty = load all modules
VITE_MOLOS_AUTOLOAD_MODULES=

# Or filter specific modules (dashboard and ai always load)
VITE_MOLOS_AUTOLOAD_MODULES=MoLOS-Tasks,MoLOS-Finance

# Database path (default: ./molos.db)
DATABASE_URL=./molos.db
```

**See:** [Quick Reference - Environment Variables](./QUICK-REFERENCE.md#environment-variables)

---

## Error Troubleshooting

### Module not in sidebar

1. Check `src/config.ts` exists with correct `id`, `name`, `href`
2. Run `bun run module:sync`
3. Check `VITE_MOLOS_AUTOLOAD_MODULES` env var

### 404 on routes

1. Check symlink exists: `ls -la src/routes/ui/(modules)/(external_modules)/`
2. Run `bun run module:sync`

### Database table not found

1. Run `bun run db:migrate` to apply all migrations
2. Run `bun run db:validate` to check for missing tables
3. Check table prefix matches module ID (`MoLOS-{Name}_{table}`)

### Migration fails with "statement-breakpoint" error

1. Add `--> statement-breakpoint` between SQL statements in migration file
2. Regenerate migration if using drizzle-kit

### Schema validation fails

1. Run `bun run db:audit-modules` to check module migrations
2. Run `bun run db:validate` to identify missing/extra tables
3. Check `logs/migrations.log` for errors

### Import errors ($lib/modules/...)

1. Run `bun run module:sync` to create symlinks
2. Check symlink: `ls -la src/lib/modules/{ModuleName}`

**See:** [Quick Reference - Troubleshooting](./QUICK-REFERENCE.md#troubleshooting-quick-fixes)
**See:** [Troubleshooting Guide](./getting-started/troubleshooting.md)

---

## Module Development

For comprehensive module development guide, see **[Module Development Guide](./modules/development.md)**.

### Quick Reference

- **[Module Standards](./modules/standards.md)** - Module structure, naming, and code standards
- **[Module Quick Reference](./modules/quick-reference.md)** - Common commands and workflows
- **[AI Tools Development](./modules/ai-tools-development.md)** - AI tool development and error handling
- **[Turborepo](./modules/turborepo.md)** - Build system and task orchestration

### Module Development Checklist

- [ ] `package.json` with correct `@molos/module-{name}` and exports
- [ ] `src/config.ts` with `ModuleConfig` (id, name, href, icon, description)
- [ ] `src/models/types.ts` with TypeScript interfaces and enums
- [ ] `src/server/database/schema.ts` with `MoLOS-{Name}_{table}` naming
- [ ] `src/server/repositories/` extending `BaseRepository`
- [ ] `src/routes/api/+server.ts` with CRUD endpoints
- [ ] `src/routes/ui/` with SvelteKit pages
- [ ] `drizzle/` directory with migrations (migrations are NOT auto-generated)
- [ ] `drizzle.config.ts` pointing to root DB
- [ ] Run `bun run module:sync` from root

**Important:** Migrations must be manually created using `bun run db:migration:create --name <name> --module {module}` and included in the module's `drizzle/` directory. Migrations are NOT auto-generated during module fetch or dev startup.

**Reference Implementation:** `modules/MoLOS-Tasks/` is the reference module implementation.

---

## Related Documentation

- [Database Architecture](./architecture/database.md) - Database system design
- [Database Package](./packages/database.md) - @molos/database usage
- [Module Standards](./modules/standards.md) - Detailed conventions
- [Module Development](./modules/development.md) - Creating modules
- [Architecture Overview](./architecture/overview.md) - System design
- [Database Architecture](./architecture/database.md) - Database system design
- [Database Package](./packages/database.md) - @molos/database usage
- [Testing Guide](./getting-started/testing.md) - Testing documentation
- [Quick Start](./getting-started/quick-start.md) - Getting started guide
- [Troubleshooting](./getting-started/troubleshooting.md) - Common issues
- [ADR-001: Migration Tracking](./adr/001-migration-tracking-strategy.md) - Migration strategy
- [Release System](./deployment/release-system.md) - Automated versioning and releases

---

_Last Updated: 2026-02-25_

# MoLOS Quick Reference

> Single-page reference for common commands, patterns, and conventions.

---

## Commands

### Development

```bash
bun run dev              # Start dev server (auto-discovers modules)
bun run build            # Build for production
bun run preview          # Preview production build
```

### Modules

```bash
bun run module:sync      # Sync and initialize modules
bun run module:link      # Create route symlinks only
```

### Database

```bash
# MIGRATION SYSTEM v2.1 (PRODUCTION READY - 9.5/10)
bun run db:migration:create --name <name> [--module <module>] [--reversible]
                         # Create new migration with proper naming
bun run db:migrate:improved
                         # Apply migrations safely (transaction-wrapped, auto-backup)
bun run db:validate      # Validate schema integrity
bun run db:repair        # Diagnose migration issues
bun run db:repair:fix    # Repair corrupted migrations
bun run db:backup        # Create manual backup

# BACKUP MANAGEMENT (NEW!)
bun run db:restore --list
                         # List available backups
bun run db:restore --latest
                         # Restore from latest backup
bun run db:restore --file <filename>
                         # Restore from specific backup

# LEGACY COMMANDS (for backward compatibility)
bun run db:migrate:unified
                         # Old unified migration runner
bun run db:generate      # Generate migrations with drizzle-kit
bun run db:push          # Push schema changes directly (dev only)

# UTILITY COMMANDS
bun run db:studio        # Open Drizzle Studio
bun run db:reset         # Reset database (WARNING: deletes data)
```

---

## Module ID Convention

| Type     | Format         | Example                      |
| -------- | -------------- | ---------------------------- |
| Internal | lowercase      | `dashboard`, `ai`            |
| External | `MoLOS-{Name}` | `MoLOS-Tasks`, `MoLOS-Goals` |

---

## Database Table Naming

**External modules:** `MoLOS-{ModuleName}_{table_name}`

```typescript
// Correct
sqliteTable("MoLOS-Tasks_tasks", { ... })
sqliteTable("MoLOS-Goals_milestones", { ... })

// Wrong
sqliteTable("tasks", { ... })                    // No prefix
sqliteTable("mod_tasks_tasks", { ... })          // Old format
sqliteTable("MoLOS-Tasks_MoLOS-Tasks_tasks")     // Duplicated
```

**Core tables:** No prefix (`user`, `session`, `settings`)

---

## Import Patterns

### From Main App

```typescript
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';
```

### Cross-Module

```typescript
// Pattern 1: $lib/modules/{ModuleName}
import { store } from '$lib/modules/MoLOS-Goals/stores';

// Pattern 2: $lib/{type}/external_modules/{ModuleName}
import { Goal } from '$lib/models/external_modules/MoLOS-Goals';
import { Repo } from '$lib/repositories/external_modules/MoLOS-Tasks';
```

### In Routes (Always .js)

```typescript
// TypeScript imports need .js extension
import { repo } from '../../../server/repositories/repo.js';
```

---

## Module Config Template

```typescript
// src/config.ts
import { Icon } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export default {
	id: 'MoLOS-MyModule',
	name: 'My Module',
	href: '/ui/MoLOS-MyModule',
	icon: Icon,
	description: 'Module description',
	navigation: [{ name: 'Dashboard', icon: Icon, href: '/ui/MoLOS-MyModule/dashboard' }]
} satisfies ModuleConfig;
```

---

## Directory Structure

```
MoLOS/
├── packages/
│   ├── core/          # @molos/core
│   ├── database/      # @molos/database
│   └── ui/            # @molos/ui
├── modules/           # External modules (in monorepo)
├── external_modules/  # Migrated external modules
├── src/               # Main SvelteKit app
│   ├── lib/
│   │   ├── components/
│   │   ├── server/
│   │   ├── stores/
│   │   └── config/
│   └── routes/
└── documentation/
```

---

## Symlink Locations

| Path                                              | Points To                 |
| ------------------------------------------------- | ------------------------- |
| `src/routes/ui/(modules)/(external_modules)/{id}` | `{module}/src/routes/ui`  |
| `src/routes/api/(external_modules)/{id}`          | `{module}/src/routes/api` |
| `src/lib/modules/{id}`                            | `{module}/src/lib`        |
| `src/lib/models/external_modules/{id}`            | `{module}/src/lib/models` |

---

## Environment Variables

```bash
# .env

# Load all modules (empty) or filter specific ones
VITE_MOLOS_AUTOLOAD_MODULES=

# Database path
DATABASE_URL=./molos.db
```

---

## Troubleshooting Quick Fixes

| Issue                                                     | Solution                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Module not in sidebar                                     | `bun run module:sync`                                                            |
| 404 on routes                                             | Check symlinks, run `module:link`                                                |
| Table not found                                           | Run `bun run db:migrate:improved`                                                |
| Migration failed                                          | Run `bun run db:repair`, then `bun run db:restore --latest`                      |
| Checksum mismatch                                         | Revert changes OR create new migration (never edit applied migrations)           |
| Import errors                                             | Use `$lib` alias, check symlinks                                                 |
| tsconfig errors                                           | Remove standalone configs from module                                            |
| Duplicate column name error                               | Normal if db created from snapshot - see ADR-002                                 |
| "Cannot read properties of undefined (reading 'headers')" | API needs `request` in params: use `({ locals, params, request })` - see ADR-003 |

---

_See [AI-CONTEXT.md](./AI-CONTEXT.md) for comprehensive reference._

# Module System Quick Reference

Quick guide for common module operations.

## Quick Start

```bash
# Start development (auto-discovers, installs, syncs, and runs)
bun run dev
```

## Commands

```bash
# Start dev server (includes auto-discovery and sync)
bun run dev

# Manual commands (usually not needed)
bun run module:sync-deps    # Auto-discover modules
bun run module:sync         # Sync routes
bun run module:link         # Link routes only
```

## Database Operations

```bash
# Navigate to module directory first
cd modules/tasks

# Generate migration for schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# View database
npx drizzle-kit studio
```

## Module ID Convention

| Type | ID Format | Example |
|------|-----------|---------|
| Internal | lowercase | `dashboard`, `ai` |
| External | `MoLOS-{Name}` | `MoLOS-Tasks`, `MoLOS-Finance` |

## Environment Variables

```bash
# Load all modules (default)
VITE_MOLOS_AUTOLOAD_MODULES=

# Load specific modules
VITE_MOLOS_AUTOLOAD_MODULES=MoLOS-Tasks,MoLOS-Finance

# Note: dashboard and ai are always loaded (mandatory)
```

## File Locations

```
modules/{name}/
├── src/
│   ├── config.ts                    # Module config (REQUIRED)
│   ├── models/index.ts              # TypeScript types
│   ├── server/database/schema.ts    # Drizzle schema
│   ├── routes/ui/                   # UI routes
│   └── routes/api/                  # API routes
├── drizzle.config.ts                # Migration config
└── package.json                     # @molos/module-{name}

# Symlinked routes
src/routes/ui/(modules)/(external_modules)/{ModuleID} → module's routes/ui
src/routes/api/(external_modules)/{ModuleID} → module's routes/api
```

## Import Patterns

### From Module to Main App

```typescript
// ✅ Use $lib alias
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';

// ❌ Don't use relative paths (breaks in node_modules)
import { db } from '../../../../../src/lib/server/db';
```

### Within Module

```typescript
// Use relative paths with .js extension
import { TaskRepository } from '../server/repositories/task-repository.js';
import { TaskStatus } from '../models/index.js';
```

## Common Workflows

### Installing a New Module

```bash
# 1. Add to package.json
bun add @molos/module-name@github:MoLOS-App/MoLOS-Name

# 2. Install
bun install

# 3. Sync routes
bun run module:sync

# 4. Run migrations (if needed)
cd node_modules/@molos/module-name
npx drizzle-kit migrate
```

### Updating a Module

```bash
# 1. Update package
bun update @molos/module-tasks

# 2. Re-sync
bun run module:sync

# 3. Run new migrations if any
cd node_modules/@molos/module-tasks
npx drizzle-kit migrate
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Module not in sidebar | Check `config.ts` exists, run `bun run module:sync` |
| 404 on routes | Check symlink exists, run `bun run module:link` |
| Table not found | Generate and run migrations |
| Import errors | Use `$lib` alias instead of relative paths |

## SQL Queries

```sql
-- See all module tables
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'MoLOS-%';

-- Check module status (if tracked)
SELECT * FROM settings_external_modules;
```

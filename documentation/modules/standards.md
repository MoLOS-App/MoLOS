# Module System Standards

This document defines the standards and conventions for MoLOS modules.

## Module Types

### Internal Modules (Core)

Internal modules are always loaded and cannot be filtered out. They live in the main app.

| Module ID | Location | Description |
|-----------|----------|-------------|
| `dashboard` | `src/lib/config/dashboard/config.ts` | Core dashboard |
| `ai` | `modules/ai/` | AI assistant interface |

### External Modules

External modules can be installed from npm or GitHub. They follow the naming convention `MoLOS-{Name}` for the repo and `@molos/module-{name}` for the package.

| Module ID | Package | GitHub Repo |
|-----------|---------|-------------|
| `MoLOS-Tasks` | `@molos/module-tasks` | `github:MoLOS-App/MoLOS-Tasks` |
| `MoLOS-Finance` | `@molos/module-finance` | `github:MoLOS-App/MoLOS-Finance` |
| `MoLOS-Goals` | `@molos/module-goals` | `github:MoLOS-App/MoLOS-Goals` |

## Module ID Convention

- **Internal modules**: Simple lowercase (`dashboard`, `ai`)
- **External modules**: `MoLOS-{Name}` format (`MoLOS-Tasks`, `MoLOS-Finance`)

This distinction is important because:
- Routes are prefixed with the module ID: `/ui/MoLOS-Tasks/dashboard`
- Database tables are prefixed: `MoLOS-Tasks_tasks`, `MoLOS-Tasks_projects`
- The module ID must match between config, routes, and database schema

## Module Structure

```
modules/{module-name}/
├── package.json              # @molos/module-{name}
├── drizzle.config.ts         # Database migration config
├── drizzle/                  # Migration files
│   ├── 0000_initial.sql
│   └── meta/
├── src/
│   ├── index.ts              # Main exports
│   ├── config.ts             # Module configuration (REQUIRED)
│   ├── models/               # TypeScript types and enums
│   │   └── index.ts
│   ├── server/
│   │   ├── database/
│   │   │   └── schema.ts     # Drizzle schema
│   │   └── repositories/     # Data access layer
│   │       ├── base-repository.ts
│   │       └── *.ts
│   ├── routes/
│   │   ├── ui/               # SvelteKit UI routes
│   │   │   ├── +layout.svelte
│   │   │   ├── +page.svelte
│   │   │   └── */            # Sub-routes
│   │   └── api/              # API endpoints
│   │       └── +server.ts
│   ├── components/           # Svelte components
│   └── stores/               # Svelte stores
└── tsconfig.json
```

## Configuration Standards

### config.ts (REQUIRED)

Every module MUST have a `config.ts` file with a default export:

```typescript
// modules/tasks/src/config.ts
import { SquareCheck, ListTodo } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export const tasksConfig: ModuleConfig = {
  id: 'MoLOS-Tasks',              // REQUIRED: Must match module ID convention
  name: 'Tasks',                  // REQUIRED: Display name
  href: '/ui/MoLOS-Tasks',        // REQUIRED: Base route
  icon: SquareCheck,              // REQUIRED: Lucide icon
  description: 'Task management', // REQUIRED: Short description
  navigation: [                   // OPTIONAL: Sidebar navigation items
    {
      name: 'Dashboard',
      icon: ListTodo,
      href: '/ui/MoLOS-Tasks/dashboard',  // Must start with base href
    },
  ],
};

export default tasksConfig;
```

### package.json Exports

```json
{
  "name": "@molos/module-tasks",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/config.ts",
    "./server/database/schema": "./src/server/database/schema.ts",
    "./models": "./src/models/index.ts"
  },
  "peerDependencies": {
    "svelte": "^5.45.0"
  }
}
```

## Database Standards

### Table Naming

Tables are prefixed with the module ID:

```typescript
// Correct: Module ID prefix
export const tasksTasks = sqliteTable("MoLOS-Tasks_tasks", { ... });
export const tasksProjects = sqliteTable("MoLOS-Tasks_projects", { ... });

// Wrong: No prefix
export const tasks = sqliteTable("tasks", { ... });
```

### Schema File Location

```
src/server/database/schema.ts
```

### drizzle.config.ts

```typescript
// modules/tasks/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/database/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: 'file:../../molos.db' },  // Relative to main app DB
  verbose: true,
  strict: true
});
```

## Import Standards

### Within a Module

Use `$lib` alias for imports from the main app:

```typescript
// ✅ Correct: Use $lib alias
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';

// ❌ Wrong: Relative paths don't work in node_modules
import { db } from '../../../../../src/lib/server/db';
```

### From Models

```typescript
// Within module
import { TaskStatus } from '../../models/index.js';

// From main app
import { TaskStatus } from '@molos/module-tasks/models';
```

### In Route Files

Always use `.js` extension for TypeScript imports:

```typescript
// ✅ Correct
import { TaskRepository } from '../../../server/repositories/task-repository.js';

// ❌ Wrong: Missing .js extension
import { TaskRepository } from '../../../server/repositories/task-repository';
```

## Route Standards

### Directory Structure

```
src/routes/
├── ui/
│   ├── +layout.svelte         # Module layout
│   ├── +page.svelte           # Index page
│   ├── dashboard/
│   │   └── +page.svelte
│   └── settings/
│       └── +page.svelte
└── api/
    ├── +server.ts             # Module API index
    └── tasks/
        └── +server.ts
```

### Page Server Files

Use the event's fetch for API calls:

```typescript
// +page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const response = await fetch('/api/MoLOS-Tasks/tasks');
  const tasks = await response.json();
  return { tasks };
};
```

## Environment Variables

### Autoload Filter

```bash
# .env
# Leave empty to load all modules
VITE_MOLOS_AUTOLOAD_MODULES=

# Or specify which modules to load (mandatory modules always load)
VITE_MOLOS_AUTOLOAD_MODULES=MoLOS-Tasks,MoLOS-Finance
```

### Mandatory Modules

The following modules are always loaded regardless of the filter:
- `dashboard`
- `ai`

## Installation

### From GitHub

```bash
# Add to package.json
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks
```

### From npm (when published)

```bash
bun add @molos/module-tasks
```

### After Installation

```bash
bun run module:sync    # Sync routes
bun run module:link    # Link routes only
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `bun run module:sync` | Sync and initialize modules |
| `bun run module:link` | Create route symlinks |
| `npx drizzle-kit generate` | Generate migrations (run in module directory) |
| `npx drizzle-kit migrate` | Apply migrations (run in module directory) |
| `bun run dev` | Start development server |

## Error Checklist

### Module not appearing in sidebar

1. Check `config.ts` exists and has correct `id`, `name`, `href`
2. Run `bun run module:sync`
3. Check `VITE_MOLOS_AUTOLOAD_MODULES` is empty or includes the module

### 404 errors on routes

1. Check symlink exists: `ls -la src/routes/ui/(modules)/(external_modules)/`
2. Run `bun run module:link`
3. Verify module ID matches route path

### Database table not found

1. Generate migrations: `cd modules/tasks && npx drizzle-kit generate`
2. Apply migrations: `npx drizzle-kit migrate`
3. Check table prefix matches module ID

### Import errors in node_modules

1. Replace relative imports with `$lib` alias
2. Ensure `.js` extension on TypeScript imports
3. Check package.json exports are correct

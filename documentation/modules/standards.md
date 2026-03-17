# Module System Standards

This document defines the standards and conventions for MoLOS modules.

## Module Types

### Internal Modules (Core)

Internal modules are always loaded and cannot be filtered out. They live in the main app.

| Module ID   | Location                             | Description            |
| ----------- | ------------------------------------ | ---------------------- |
| `dashboard` | `src/lib/config/dashboard/config.ts` | Core dashboard         |
| `ai`        | `modules/ai/`                        | AI assistant interface |

### External Modules

External modules are developed in the monorepo `modules/` directory and can be published to npm or GitHub. They follow naming convention `MoLOS-{Name}` for repo and `@molos/module-{name}` for package.

| Module ID             | Package                      | GitHub Repo                                                             | Description                       | Version |
| --------------------- | ---------------------------- | ----------------------------------------------------------------------- | --------------------------------- | ------- |
| `MoLOS-Tasks`         | `@molos/module-tasks`        | [MoLOS-Tasks](https://github.com/MoLOS-App/MoLOS-Tasks)                 | Task management and projects      | 1.0.4   |
| `MoLOS-AI-Knowledge`  | `@molos/module-ai-knowledge` | [MoLOS-AI-Knowledge](https://github.com/MoLOS-App/MoLOS-AI-Knowledge)   | AI prompts, playground, workflows | 1.0.0   |
| `MoLOS-LLM-Council`   | `@molos/module-llm-council`  | [MoLOS-LLM-Council](https://github.com/MoLOS-App/MoLOS-LLM-Council)     | Multi-LLM consultation            | 1.0.0   |
| `MoLOS-Goals`         | `@molos/module-goals`        | [MoLOS-Goals](https://github.com/MoLOS-App/MoLOS-Goals)                 | OKR and goal tracking             | -       |
| `MoLOS-Meals`         | `@molos/module-meals`        | [MoLOS-Meals](https://github.com/MoLOS-App/MoLOS-Meals)                 | Meal planning and nutrition       | -       |
| `MoLOS-Health`        | `@molos/module-health`       | [MoLOS-Health](https://github.com/MoLOS-App/MoLOS-Health)               | Health and fitness tracking       | -       |
| `MoLOS-Finance`       | `@molos/module-finance`      | [MoLOS-Finance](https://github.com/MoLOS-App/MoLOS-Finance)             | Financial tracking and budgets    | -       |
| `MoLOS-Markdown`      | `@molos/module-markdown`     | [MoLOS-Markdown](https://github.com/MoLOS-App/MoLOS-Markdown)           | Markdown editing and preview      | -       |
| `MoLOS-Google`        | `@molos/module-google`       | [MoLOS-Google](https://github.com/MoLOS-App/MoLOS-Google)               | Google services integration       | -       |
| `MoLOS-Sample-Module` | `@molos/module-sample`       | [MoLOS-Sample-Module](https://github.com/MoLOS-App/MoLOS-Sample-Module) | Example module for reference      | -       |

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
├── manifest.yaml             # Module manifest
├── drizzle.config.ts         # Database migration config (if has DB)
├── drizzle/                  # Migration files (if has DB)
│   ├── 0000_initial.sql
│   └── meta/
└── src/
    ├── index.ts              # Main exports
    ├── config.ts             # Module configuration (REQUIRED)
    ├── models/               # TypeScript types and enums
    │   └── index.ts
    ├── lib/                  # Library code
    │   └── components/       # Svelte components
    ├── server/
    │   ├── ai/               # AI tools (optional)
    │   │   └── ai-tools.ts
    │   ├── db/               # Database schema
    │   │   └── schema/
    │   │       ├── index.ts
    │   │       └── tables.ts
    │   └── repositories/     # Data access layer
    │       ├── base-repository.ts
    │       └── *.ts
    ├── routes/
    │   ├── ui/               # SvelteKit UI routes
    │   │   ├── +layout.svelte
    │   │   ├── +page.svelte
    │   │   └── */            # Sub-routes
    │   └── api/              # API endpoints
    │       └── +server.ts
    └── stores/               # Svelte stores
        └── index.ts
```

**Note**: Modules in the monorepo do NOT need their own `tsconfig.json`, `vite.config.ts`, or `svelte.config.js`. These are handled by the main SvelteKit app.

## Configuration Standards

### config.ts (REQUIRED)

Every module MUST have a `config.ts` file in `src/config.ts` with a default export:

```typescript
// modules/MoLOS-Tasks/src/config.ts
import { SquareCheck, ListTodo } from 'lucide-svelte';
import type { ModuleConfig } from '$lib/config/types';

export const tasksConfig: ModuleConfig = {
	id: 'MoLOS-Tasks', // REQUIRED: Must match module ID convention
	name: 'Tasks', // REQUIRED: Display name
	href: '/ui/MoLOS-Tasks', // REQUIRED: Base route
	icon: SquareCheck, // REQUIRED: Lucide icon
	description: 'Task management', // REQUIRED: Short description
	navigation: [
		// OPTIONAL: Sidebar navigation items
		{
			name: 'Dashboard',
			icon: ListTodo,
			href: '/ui/MoLOS-Tasks/dashboard' // Must start with base href
		}
	]
};

export default tasksConfig;
```

**Important**: Use `$lib/config/types` for the ModuleConfig import, not `@molos/module-types`. This ensures compatibility with both development and production builds.

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

### Table Naming Convention

**CRITICAL**: All module database tables MUST follow the naming convention:

```
MoLOS-{ModuleName}_{table_name}
```

The naming convention has two parts with different separators:

| Part                               | Separator       | Example             |
| ---------------------------------- | --------------- | ------------------- |
| Module ID prefix                   | **Hyphens**     | `MoLOS-LLM-Council` |
| Separator between module and table | **Underscore**  | `_`                 |
| Table name                         | **Underscores** | `conversations`     |

**Examples:**

| Pattern                     | Example                           | Status                              |
| --------------------------- | --------------------------------- | ----------------------------------- |
| `MoLOS-{Name}_{table}`      | `MoLOS-Tasks_tasks`               | ✅ Correct                          |
| `MoLOS-{Name}_{table}`      | `MoLOS-Health_user_profile`       | ✅ Correct                          |
| `MoLOS-{Name}_{table}`      | `MoLOS-LLM-Council_conversations` | ✅ Correct                          |
| `MoLOS_{Name}_{table}`      | `MoLOS_LLM_Council_conversations` | ❌ Wrong - underscores in module ID |
| `{module}_{table}`          | `health_user_profile`             | ❌ Wrong - missing MoLOS prefix     |
| `{module}_{module}_{table}` | `meals_meals_settings`            | ❌ Wrong - duplicated prefix        |
| `{table}`                   | `tasks`                           | ❌ Wrong - no prefix at all         |

```typescript
// ✅ Correct: Module ID with HYPHENS, separator with UNDERSCORE
export const tasksTasks = sqliteTable("MoLOS-Tasks_tasks", { ... });
export const healthUserProfile = sqliteTable("MoLOS-Health_user_profile", { ... });
export const llmCouncilConversations = sqliteTable("MoLOS-LLM-Council_conversations", { ... });

// ❌ Wrong: Underscores in module ID (breaks migration verification)
export const llmCouncilConversations = sqliteTable("MoLOS_LLM_Council_conversations", { ... });

// ❌ Wrong: Missing MoLOS prefix
export const healthProfile = sqliteTable("health_user_profile", { ... });

// ❌ Wrong: No prefix at all
export const tasks = sqliteTable("tasks", { ... });
```

**Why this matters:**

The database initialization script verifies module tables by looking for the pattern `MoLOS-{ModuleName}_%`. If you use underscores in the module ID (e.g., `MoLOS_LLM_Council_`), the verification won't find your tables even though they exist, causing confusing errors.

### Schema File Location

```
src/server/db/schema/tables.ts
src/server/db/schema/index.ts
```

### drizzle.config.ts

```typescript
// modules/tasks/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/server/db/schema/tables.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: { url: 'file:../../molos.db' }, // Relative to main app DB
	verbose: true,
	strict: true
});
```

## Import Standards

### Within a Module (Use `$module` alias)

**CRITICAL**: When importing from within a module's own code, ALWAYS use the `$module` alias. This ensures imports work in both development and production builds.

```typescript
// ✅ Correct: Use $module alias for module-internal imports
import { TaskRepository } from '$module/server/repositories/task-repository.js';
import { TaskStatus } from '$module/models/index.js';
import { myValidator } from '$module/server/utils/validator.js';
import { db } from '$module/server/database/schema.js';

// ❌ Wrong: Fragile relative paths (break in production builds)
import { TaskRepository } from '../../../../../server/repositories/task-repository.js';
import { TaskStatus } from '../../../../models/index.js';
```

The `$module` alias is resolved by a custom Vite plugin in `vite.config.ts` that automatically detects which module is importing and resolves to that module's `src/` directory.

### From Main App (Use `$lib` alias)

Use `$lib` alias for imports from the main app:

```typescript
// ✅ Correct: Use $lib alias
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';

// ❌ Wrong: Relative paths don't work in node_modules
import { db } from '../../../../../src/lib/server/db';
```

### Import Summary Table

| What You're Importing    | Use This Pattern                |
| ------------------------ | ------------------------------- |
| Module's own server code | `$module/server/...`            |
| Module's own models      | `$module/models/...`            |
| Module's own lib         | `$module/lib/...`               |
| Main app database        | `$lib/server/db`                |
| Main app auth            | `$lib/server/auth`              |
| Main app UI components   | `$lib/components/ui/...`        |
| Another module's code    | `$lib/modules/{ModuleName}/...` |

### Cross-Module Imports

Modules can import from other modules using two patterns:

```typescript
// Pattern 1: $lib/modules/{ModuleName} - imports from module's lib directory
import { goalsStore } from '$lib/modules/MoLOS-Goals/stores';
import { TaskRepository } from '$lib/modules/MoLOS-Tasks/repositories';

// Pattern 2: $lib/{type}/external_modules/{ModuleName} - imports specific subdirectory
import { Goal } from '$lib/models/external_modules/MoLOS-Goals';
import { Task } from '$lib/models/external_modules/MoLOS-Tasks';
import { GoalRepository } from '$lib/repositories/external_modules/MoLOS-Goals';
```

These paths are resolved via symlinks created by `bun run module:sync`:

- `src/lib/modules/{ModuleName}` → `modules/{ModuleName}/src/lib`
- `src/lib/{type}/external_modules/{ModuleName}` → `modules/{ModuleName}/src/lib/{type}`

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

| Command                       | Description                                                 |
| ----------------------------- | ----------------------------------------------------------- |
| `bun run dev`                 | Start development server (auto-discovers and syncs modules) |
| `bun run module:sync`         | Sync and initialize modules                                 |
| `bun run module:link`         | Create route symlinks                                       |
| `bun run db:migration:create` | Create new migration (from MoLOS root)                      |
| `bun run db:migrate`          | Apply all pending migrations                                |
| `bun run db:validate`         | Validate schema integrity                                   |

**⚠️ CRITICAL SAFETY RULE: NEVER RUN drizzle-kit generate**

**FORBIDDEN:** Never run `drizzle-kit generate` or `bun run db:generate`. These commands are explicitly removed for safety.

**Why:**

- Creates journal/SQL desync (migrations in journal but no SQL files)
- Generates random names (`0003_dizzy_jane_foster.sql`) - zero context
- Cannot enforce table naming conventions (`MoLOS-{Name}_{table}`)
- Overwrites manual migrations without warning

**Correct approach:**

```bash
# Always create migrations manually with descriptive names
bun run db:migration:create --name add_user_preferences --module core

# Validate after creating
bun run db:validate

# Apply (safe with auto-backup)
bun run db:migrate
```

**Important:** Migrations are NOT auto-generated during module fetch or dev startup.

## Error Checklist

### Module not appearing in sidebar

1. Check `src/config.ts` exists and has correct `id`, `name`, `href`
2. Run `bun run module:sync`
3. Check `VITE_MOLOS_AUTOLOAD_MODULES` is empty or includes the module

### 404 errors on routes

1. Check symlink exists: `ls -la src/routes/ui/(modules)/(external_modules)/`
2. Run `bun run module:sync`
3. Verify module ID matches route path

### Database table not found

1. Create migration: `bun run db:migration:create --name add_table --module MoLOS-Tasks`
2. Edit the generated SQL file in `modules/MoLOS-Tasks/drizzle/`
3. Apply migrations: `bun run db:migrate`
4. Check table prefix matches module ID

### Import errors (Cannot find module '$lib/modules/...')

1. Run `bun run module:sync` to create symlinks
2. Check symlink exists: `ls -la src/lib/modules/{ModuleName}`
3. For `$lib/{type}/external_modules/...` imports, check: `ls -la src/lib/models/external_modules/{ModuleName}`

### Import errors in node_modules

1. Replace relative imports with `$lib` alias for main app
2. Replace relative imports with `$module` alias for module-internal code
3. Ensure `.js` extension on TypeScript imports
4. Check package.json exports are correct

### Production build fails with "Could not resolve" error

1. Check that module-internal imports use `$module` alias
2. Replace fragile relative paths like `../../../../../server/...` with `$module/server/...`
3. The `$module` alias is resolved by a custom Vite plugin in `vite.config.ts`
4. Dev mode (Vite) may be more lenient than production builds (Rollup)

### tsconfig.json/vite.config.ts errors

If you see errors about `.svelte-kit/tsconfig.json` not found:

1. Remove standalone `tsconfig.json`, `vite.config.ts`, `svelte.config.js` from module root
2. Modules in the monorepo don't need these files

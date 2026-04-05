# Old Module System Fix - 2026-02-17

## Summary

Fixed the old module system to work with the monorepo setup. The dev server was failing when running `db:migrate` via Turborepo, and old modules had inconsistent package structures and import paths.

## Problem

1. **`db:migrate` Error**: `@molos/database` had a `db:migrate` script that caused Turborepo to fail because drizzle-kit resolves incorrectly in workspace environments (Bun hoists dependencies to root `node_modules/`, but Turborepo runs from package directory expecting local `node_modules/`).

2. **Inconsistent Module Structure**: Old modules had:
   - Missing or incorrectly named `package.json` files
   - Config files at root level instead of `src/config.ts`
   - Routes at `routes/` instead of `src/routes/`
   - Lib at `lib/` instead of `src/lib/`
   - Standalone SvelteKit config files that interfered with monorepo

3. **Missing Symlinks**: The module linker only created route symlinks, but modules also needed:
   - `$lib/modules/{ModuleName}` symlinks
   - `$lib/{type}/external_modules/{ModuleName}` symlinks for subdirectories

## Changes Made

### 1. Fixed `@molos/database`

- **File**: `packages/database/package.json`
- Removed `db:migrate` script (root handles core migrations, modules handle their own)

### 2. Standardized Module Structure

For each old module (MoLOS-Goals, MoLOS-Health, MoLOS-Meals, MoLOS-AI-Knowledge, MoLOS-Google, MoLOS-Sample-Module):

| Module              | Package Name                 | Changes                                         |
| ------------------- | ---------------------------- | ----------------------------------------------- |
| MoLOS-Goals         | `@molos/module-goals`        | Created package.json, moved to src/ structure   |
| MoLOS-Health        | `@molos/module-health`       | Created package.json, moved to src/ structure   |
| MoLOS-Meals         | `@molos/module-meals`        | Created package.json, moved to src/ structure   |
| MoLOS-AI-Knowledge  | `@molos/module-ai-knowledge` | Renamed, added exports, moved to src/ structure |
| MoLOS-Google        | `@molos/module-google`       | Renamed, added exports, moved to src/ structure |
| MoLOS-Sample-Module | `@molos/module-sample`       | Added exports, moved to src/ structure          |

**Standard structure now:**

```
modules/MoLOS-{Name}/
├── package.json           # @molos/module-{name}
├── manifest.yaml
├── drizzle.config.ts      # if has database
├── drizzle/               # if has database
└── src/
    ├── config.ts          # ModuleConfig export
    ├── index.ts           # Package exports
    ├── lib/
    │   ├── models/
    │   ├── repositories/
    │   ├── server/
    │   ├── stores/
    │   └── components/
    └── routes/
        ├── api/
        └── ui/
```

### 3. Removed Standalone Configs

Deleted from external modules (they interfered with monorepo Vite resolution):

- `tsconfig.json`
- `vite.config.ts`
- `svelte.config.js`

### 4. Updated Module Linker

**File**: `scripts/link-modules.ts`

Now creates symlinks for:

1. **Routes**:
   - `src/routes/ui/(modules)/(external_modules)/{moduleId}` → `{module}/src/routes/ui`
   - `src/routes/api/(external_modules)/{moduleId}` → `{module}/src/routes/api`

2. **Lib** (for `$lib/modules/{ModuleName}/*` imports):
   - `src/lib/modules/{moduleId}` → `{module}/src/lib`

3. **Lib Subdirs** (for `$lib/{type}/external_modules/{ModuleName}/*` imports):
   - `src/lib/models/external_modules/{moduleId}` → `{module}/src/lib/models`
   - `src/lib/repositories/external_modules/{moduleId}` → `{module}/src/lib/repositories`
   - `src/lib/server/external_modules/{moduleId}` → `{module}/src/lib/server`
   - `src/lib/stores/external_modules/{moduleId}` → `{module}/src/lib/stores`
   - `src/lib/components/external_modules/{moduleId}` → `{module}/src/lib/components`
   - `src/lib/utils/external_modules/{moduleId}` → `{module}/src/lib/utils`

## Import Patterns

Modules can use these import patterns:

```typescript
// From module's own code - use $lib/modules/{ModuleName}
import { something } from '$lib/modules/MoLOS-Goals/stores';

// From main app or other modules - use $lib/{type}/external_modules/{ModuleName}
import { Goal } from '$lib/models/external_modules/MoLOS-Goals';
import { GoalRepository } from '$lib/repositories/external_modules/MoLOS-Goals';
```

## Results

| Metric             | Before | After |
| ------------------ | ------ | ----- |
| Directories linked | 4      | 58    |
| Modules discovered | 2      | 9     |
| Dev server         | Failed | Works |

All 9 modules now properly discovered and registered:

- `@molos/module-ai-knowledge`
- `@molos/module-finance`
- `@molos/module-goals`
- `@molos/module-google`
- `@molos/module-health`
- `@molos/module-meals`
- `@molos/module-sample`
- `@molos/module-tasks`
- `@molos/module-ai`

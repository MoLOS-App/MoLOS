# Changelog - Module Management Fixes (2026-02-16)

## Summary
Attempted to fix external module loading issues related to missing database tables for Health, Goals, and Meals modules.

## Changes Made

### 1. Fixed MoLOS-Health Import Path (External Repository)
**File:** `/home/eduardez/Workspace/MoLOS-org/MoLOS-Health/lib/server/db/schema/tables.ts`

Changed relative import to use `$lib` alias:
```typescript
// Before
import { HealthSex, HealthUnits, HealthActivityType } from '../../models';

// After
import { HealthSex, HealthUnits, HealthActivityType } from '$lib/models/external_modules/MoLOS-Health';
```

### 2. Updated External Module Schema Exports
**File:** `src/lib/server/db/schema/index.ts`

Added exports for external module schemas that have symlinks:
```typescript
export * from './auth-schema';
export * from './settings/tables';
export * from './ai-schema';

// External module schemas (only modules that exist in external_modules/)
export * from './external_modules/MoLOS-AI-Knowledge';
export * from './external_modules/MoLOS-Google';
export * from './external_modules/MoLOS-Sample-Module';
```

**Note:** Health, Goals, and Meals modules are NOT exported because they don't exist in `external_modules/` directory.

## Reverted/Incomplete Changes

### Drizzle Config tsconfig Addition (Reverted)
Attempted to add `tsconfig: './.svelte-kit/tsconfig.json'` to `drizzle.config.ts` to resolve `$lib` imports. This did not work and was reverted.

### Health Module Structure (Removed)
Created a partial module structure in `external_modules/MoLOS-Health/` but removed it because:
1. Migrations cannot be generated due to `$lib` import resolution issue
2. The module structure was incomplete

## Issues Identified But Not Resolved

### Drizzle-Kit Cannot Resolve $lib Imports
The `$lib` path alias is a SvelteKit-specific feature that drizzle-kit cannot resolve when running `bun run db:generate`. This prevents generating migrations for modules that use `$lib` imports in their schema files.

**Error:**
```
Error: Cannot find module '$lib/server/db/utils'
```

**Affected files:**
- `external_modules/MoLOS-AI-Knowledge/lib/server/db/schema/tables.ts`
- `external_modules/MoLOS-Health/lib/server/db/schema/tables.ts`
- Other module schema files using `$lib` imports

### Missing Migrations for Health, Goals, Meals
The Health, Goals, and Meals modules are registered in the database with `error_config` status:
```
MoLOS-Health|error_config|local://MoLOS/external_modules/MoLOS-Health
MoLOS-Goals|error_config|local://MoLOS/external_modules/MoLOS-Goals
MoLOS-Meals|error_config|local://MoLOS/external_modules/MoLOS-Meals
```

These modules need:
1. Full module structure in `external_modules/` directory
2. Migration files in their `drizzle/` directories
3. Proper configuration to work with the module manager

## Database State
- **Modules with tables:** MoLOS-AI-Knowledge, MoLOS-Google, MoLOS-Sample-Module, MoLOS-Tasks
- **Modules missing tables:** MoLOS-Health, MoLOS-Goals, MoLOS-Meals

## Next Steps Required
1. Determine how module migrations should be generated (per-module or centrally)
2. Set up proper module structure for Health, Goals, and Meals in `external_modules/`
3. Create migration SQL files for the missing modules
4. Run migrations to create the missing database tables

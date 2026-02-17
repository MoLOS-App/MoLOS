# Changelog - Module System Overhaul (2026-02-16)

## Summary

Complete overhaul of the module discovery and management system to support external modules from GitHub/npm.

## Problems Solved

1. **Empty sidebar** - Modules weren't showing because of wrong environment filter
2. **No mandatory modules** - Essential modules could be filtered out
3. **Incorrect module IDs** - Tasks module used `tasks` instead of `MoLOS-Tasks`
4. **Missing database tables** - No migrations for external modules
5. **Relative import issues** - Imports broke when modules installed in node_modules

## Changes Made

### 1. Mandatory Modules System

**File:** `src/lib/config/index.ts`

```typescript
const MANDATORY_MODULES = ['dashboard', 'ai'] as const;

// In buildModuleRegistry():
const isMandatory = MANDATORY_MODULES.includes(config.id);
if (!isMandatory && autoloadFilter && !autoloadFilter.includes(config.id)) {
    return acc;  // Skip non-mandatory modules not in filter
}
```

### 2. Fixed Environment Variable

**File:** `.env`

```bash
# Before (broken)
VITE_MOLOS_AUTOLOAD_MODULES=finance  # Module doesn't exist

# After (correct)
VITE_MOLOS_AUTOLOAD_MODULES=  # Empty = load all
```

### 3. Module ID Convention

**File:** `modules/tasks/src/config.ts`

```typescript
// External modules use MoLOS-{Name} format
export const tasksConfig: ModuleConfig = {
  id: 'MoLOS-Tasks',
  href: '/ui/MoLOS-Tasks',
  navigation: [
    { href: '/ui/MoLOS-Tasks/dashboard' },
    // ...
  ]
};
```

### 4. Link Script Enhancement

**File:** `scripts/link-modules.ts`

- Now reads module ID from `config.ts` instead of using folder name
- Creates symlinks with correct module ID names

### 5. Database Migrations

**File:** `modules/tasks/drizzle.config.ts` (new)

- Independent drizzle config for each module
- Migrations stored in module's `drizzle/` directory
- Tables prefixed with module ID: `MoLOS-Tasks_tasks`

### 6. Package Database Utils Fix

**File:** `packages/database/package.json`

- Added `default` export condition for CJS compatibility with drizzle-kit

## Module Classification

| Module | Type | ID | Package |
|--------|------|----|----|
| Dashboard | Internal | `dashboard` | Core |
| AI | Internal | `ai` | `@molos/module-ai` (workspace) |
| Tasks | External | `MoLOS-Tasks` | `@molos/module-tasks` |

## Installation Method

```bash
# External modules are installed from GitHub
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks

# Sync routes
bun run module:sync
```

## Documentation Created

- `documentation/modules/standards.md` - Complete module standards
- `documentation/modules/README.md` - Updated overview
- `documentation/modules/quick-reference.md` - Quick command reference
- `documentation/modules/turborepo-management.md` - Multi-repo workflow

## Known Issues

### Import Paths in External Modules

External modules must use `$lib` alias instead of relative paths:

```typescript
// ✅ Works in node_modules
import { db } from '$lib/server/db';

// ❌ Breaks in node_modules
import { db } from '../../../../../src/lib/server/db';
```

**Fix required in MoLOS-Tasks repo:** Update `base-repository.ts` to use `$lib` alias.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/config/index.ts` | Added MANDATORY_MODULES, updated filter logic |
| `.env` | Cleared VITE_MOLOS_AUTOLOAD_MODULES |
| `package.json` | Changed tasks to GitHub dependency |
| `scripts/link-modules.ts` | Read module ID from config |
| `modules/tasks/src/config.ts` | Updated to MoLOS-Tasks ID |
| `modules/tasks/drizzle.config.ts` | Created |
| `modules/tasks/drizzle/0000_*.sql` | Created migrations |
| `packages/database/package.json` | Added default exports |
| Documentation files | Created/updated |

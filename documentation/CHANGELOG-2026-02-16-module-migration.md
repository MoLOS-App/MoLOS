# Changelog: External Module Migration

**Date:** 2026-02-16
**Commit:** `79179ab`
**Summary:** Migrated all external MoLOS modules into the monorepo and cleaned up legacy code

## Overview

Migrated 7 external modules from sibling directories into `external_modules/`, fixed import standardization issues, and cleaned up legacy code.

## Modules Migrated

| Module | Source | Has package.json | Status |
|--------|--------|------------------|--------|
| MoLOS-AI-Knowledge | `../MoLOS-AI-Knowledge/` | Yes | Active |
| MoLOS-Finance | `../MoLOS-Finance/` | Created | Active |
| MoLOS-Goals | `../MoLOS-Goals/` | Created | Active |
| MoLOS-Google | `../MoLOS-Google/` | Yes | Active |
| MoLOS-Health | `../MoLOS-Health/` | Created | Active |
| MoLOS-Meals | `../MoLOS-Meals/` | Created | Active |
| MoLOS-Sample-Module | `../MoLOS-Sample-Module/` | Yes | Active |

## Changes Made

### 1. Workspace Configuration

**File:** `package.json`
- Added `modules/*` to workspaces array
- Changed `@molos/module-*` dependencies to use `workspace:*` protocol
- Added `@molos/database` as workspace dependency

### 2. Import Standardization Fix

**File:** `module-management/server/initialization.ts`

**Problem:** The standardization logic was setting `changed = true` when regex patterns matched, even if no actual replacement occurred. This caused a rebuild loop.

**Fix:** Added content comparison before setting `changed` flag:
```typescript
const originalContent = content;
content = content.replace(regex, ...);
if (content !== originalContent) {
  changed = true;
}
```

**Also added:** Standardization patterns for `$lib/modules/{moduleId}/` imports (without `/lib/` prefix):
- `$lib/modules/{moduleId}/stores` → `$lib/stores/external_modules/{moduleId}`
- `$lib/modules/{moduleId}/components` → `$lib/components/external_modules/{moduleId}`
- `$lib/modules/{moduleId}/models` → `$lib/models/external_modules/{moduleId}`
- `$lib/modules/{moduleId}/repositories` → `$lib/repositories/external_modules/{moduleId}`

### 3. Cleanup

**Files Modified:**
- `modules/ai/src/config.ts` - Removed unused icons (Key, ScrollText, List, Activity)
- `src/lib/server/ai/mcp/oauth/token-service.ts` - Removed unused `timingSafeEqual` import
- `src/lib/server/ai/module-tools.ts` - Removed dead commented code

**Files Deleted:**
- `src/lib/config/modules/` directory (legacy, marked for removal)
- `src/server/` (empty directory)
- `module-management/validation/` (empty directory)

### 4. Module Setup

For each migrated module:
1. Copied to `external_modules/MoLOS-{NAME}/`
2. Removed `.git`, `node_modules`, `.svelte-kit`
3. Created/updated `package.json` with `@molos/external-{id}` name
4. Fixed `config.ts` to use `$lib/config/types` import
5. Verified `manifest.yaml` ID matches folder name

## Verification

All 7 modules registered and active in database:
```
MoLOS-AI-Knowledge|active
MoLOS-Finance|active
MoLOS-Goals|active
MoLOS-Google|active
MoLOS-Health|active
MoLOS-Meals|active
MoLOS-Sample-Module|active
```

## Known Issues (Pre-existing)

1. **@molos/module-tasks/ai config loading** - TypeScript files cannot be loaded directly via file:// protocol. This is a pre-existing issue with the ModuleRegistry.

2. **better-auth export error** - Dependency version mismatch, unrelated to this migration.

3. **Type errors in external modules** - Pre-existing type issues in module code (implicit any, missing properties).

## File Structure After Migration

```
external_modules/
├── MoLOS-AI-Knowledge/
│   ├── config.ts
│   ├── manifest.yaml
│   ├── package.json
│   ├── lib/
│   └── routes/
├── MoLOS-Finance/
│   ├── config.ts
│   ├── manifest.yaml
│   ├── package.json (created)
│   ├── lib/
│   └── routes/
├── MoLOS-Goals/
│   └── ...
├── MoLOS-Google/
│   └── ...
├── MoLOS-Health/
│   └── ...
├── MoLOS-Meals/
│   └── ...
└── MoLOS-Sample-Module/
    └── ...
```

## Symlink Structure

Modules are linked via symlinks to:
- `src/lib/config/external_modules/{ModuleId}.ts`
- `src/lib/stores/external_modules/{ModuleId}/`
- `src/lib/components/external_modules/{ModuleId}/`
- `src/lib/models/external_modules/{ModuleId}/`
- `src/lib/repositories/external_modules/{ModuleId}/`
- `src/lib/server/ai/external_modules/{ModuleId}/`
- `src/lib/server/db/schema/external_modules/{ModuleId}/`
- `src/routes/ui/(modules)/(external_modules)/{ModuleId}/`
- `src/routes/api/(external_modules)/{ModuleId}/`

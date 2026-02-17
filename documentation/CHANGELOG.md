# MoLOS Changelog

> Consolidated changelog for the MoLOS project.

---

## 2026-02-17 - Old Module System Fix

**Summary:** Fixed the old module system to work with the monorepo setup. Standardized module structure across all external modules.

### Changes

- Removed `db:migrate` script from `@molos/database` (root handles core migrations)
- Standardized module structure for MoLOS-Goals, MoLOS-Health, MoLOS-Meals, MoLOS-AI-Knowledge, MoLOS-Google, MoLOS-Sample-Module
- Updated module linker to create symlinks for `$lib/modules/{ModuleName}` and `$lib/{type}/external_modules/{ModuleName}` patterns
- Removed standalone `tsconfig.json`, `vite.config.ts`, `svelte.config.js` from external modules

### Results

| Metric | Before | After |
|--------|--------|-------|
| Directories linked | 4 | 58 |
| Modules discovered | 2 | 9 |
| Dev server | Failed | Works |

---

## 2026-02-16 - Module System Overhaul

**Summary:** Complete overhaul of the module discovery and management system to support external modules from GitHub/npm.

### Changes

- Added mandatory modules system (`dashboard`, `ai` always load)
- Fixed module ID convention: External modules use `MoLOS-{Name}` format
- Enhanced link script to read module ID from `config.ts`
- Created independent drizzle configs for each module
- Fixed environment variable handling for module filtering

### Module Classification

| Module | Type | ID | Package |
|--------|------|----|----|
| Dashboard | Internal | `dashboard` | Core |
| AI | Internal | `ai` | `@molos/module-ai` |
| Tasks | External | `MoLOS-Tasks` | `@molos/module-tasks` |

---

## 2026-02-16 - Package Module Migration

**Summary:** Migrated MoLOS from a symlink-based external module system to a package-based module system.

### Module Structure Migration

**Before:**
```
external_modules/MoLOS-MyModule/
├── config.ts
├── lib/
├── routes/
└── manifest.yaml
```

**After:**
```
modules/my-module/
├── package.json           # @molos/module-my-module
├── manifest.yaml
└── src/
    ├── index.ts
    ├── config.ts
    ├── lib/
    └── routes/
```

### Benefits

1. Cleaner imports using `@molos/module-*` package imports
2. Better IDE support via workspace packages
3. Simplified build without complex symlink handling
4. Proper type safety for module exports

---

## 2026-02-16 - External Module Migration

**Commit:** `79179ab`

**Summary:** Migrated 7 external MoLOS modules into the monorepo and cleaned up legacy code.

### Modules Migrated

| Module | Status |
|--------|--------|
| MoLOS-AI-Knowledge | Active |
| MoLOS-Finance | Active |
| MoLOS-Goals | Active |
| MoLOS-Google | Active |
| MoLOS-Health | Active |
| MoLOS-Meals | Active |
| MoLOS-Sample-Module | Active |

### Changes

- Added `modules/*` to workspace configuration
- Fixed import standardization logic (prevented rebuild loop)
- Cleaned up unused imports and dead code
- Created/updated package.json files for each module

---

## 2025-02-16 - Monorepo System Adaptation

**Summary:** Adapted codebase to work with the new monorepo package structure.

### Changes

- Created `module-management/build/linker.ts` for symlink management
- Added Vite aliases for `@molos/database`, `@molos/ui`, `@molos/module-*`
- Fixed ESM compatibility in `symlink-config.ts`
- Consolidated documentation into `documentation/` folder

### Package Structure

| Package | Location | Status |
|---------|----------|--------|
| `@molos/core` | `packages/core/` | Active |
| `@molos/database` | `packages/database/` | Active |
| `@molos/ui` | `packages/ui/` | Active |
| `@molos/module-tasks` | `modules/tasks/` | Active |
| `@molos/module-ai` | `modules/ai/` | Active |

---

## 2025-02-16 - Codebase Cleanup

**Summary:** Removed unnecessary files and added AI context files.

### Files Deleted

- Backup files (`.bak`)
- Deprecated `modules.config.ts`
- Empty directories

### Files Created

- AI context files (`.context.md`) for all packages and modules
- `.gitkeep` for placeholder directories

---

*For detailed information about specific changes, see the archived CHANGELOG-*.md files.*

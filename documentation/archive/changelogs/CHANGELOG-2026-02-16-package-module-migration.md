# Changelog: Package Module Migration

**Date**: 2026-02-16
**Type**: Architecture Change
**Impact**: High

## Summary

Migrated MoLOS from a symlink-based external module system to a package-based module system. All modules now live in `modules/` directory and use workspace package imports (`@molos/module-*`).

## Changes

### Module Structure

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

### Files Modified

| File                                         | Change                                                    |
| -------------------------------------------- | --------------------------------------------------------- |
| `package.json`                               | Added workspace dependencies for new modules              |
| `vite.config.ts`                             | Removed symlink infrastructure, added module aliases      |
| `src/lib/config/index.ts`                    | Updated module discovery to use `modules/*/src/config.ts` |
| `src/lib/server/ai/toolbox.ts`               | Updated AI tools loading path                             |
| `src/lib/server/db/schema/index.ts`          | Removed external module schema exports                    |
| `src/lib/config/types.ts`                    | Added `isPackageModule` flag                              |
| `module-management/server/initialization.ts` | Removed symlink-config dependency                         |
| `module-management/server/utils.ts`          | Simplified to route symlinks only                         |
| `module-management/server/paths.ts`          | Updated for modules/ directory                            |
| `scripts/link-modules.ts`                    | Only handles route symlinks now                           |
| `scripts/sync-modules.ts`                    | Works with modules/ directory                             |
| `scripts/cleanup-module-symlinks.ts`         | Only cleans route symlinks                                |

### Files Deleted

- `module-management/build/linker.ts`
- `module-management/config/symlink-config.ts`
- `src/lib/config/external_modules/` (entire directory)
- `src/lib/components/external_modules/` (entire directory)
- `src/lib/models/external_modules/` (entire directory)
- `src/lib/repositories/external_modules/` (entire directory)
- `src/lib/stores/external_modules/` (entire directory)
- `src/lib/utils/external_modules/` (entire directory)
- `src/lib/server/ai/external_modules/` (entire directory)
- `src/lib/server/db/schema/external_modules/` (entire directory)

### New Modules Created

- `modules/ai-knowledge/` (from `external_modules/MoLOS-AI-Knowledge/`)
- `modules/google/` (from `external_modules/MoLOS-Google/`)
- `modules/sample/` (from `external_modules/MoLOS-Sample-Module/`)

### Route Symlinks Updated

Route symlinks now point to `modules/*/src/routes/` instead of `external_modules/*/routes/`:

- `src/routes/ui/(modules)/(external_modules)/*`
- `src/routes/api/(external_modules)/*`

## Migration Benefits

1. **Cleaner imports**: Use `@molos/module-*` package imports
2. **Better IDE support**: Workspace packages provide better autocomplete
3. **Simplified build**: No complex symlink handling in vite.config.ts
4. **Type safety**: Module packages can export types properly
5. **Reduced complexity**: Symlinks only needed for routes (SvelteKit requirement)

## Breaking Changes

### Import Paths

**Before:**

```typescript
import { something } from '$lib/models/external_modules/MoLOS-MyModule';
```

**After:**

```typescript
// Within module - use relative imports
import { something } from '../../../lib/models/index.js';
```

### Module Config

**Before:**

```typescript
config.isExternal = true;
```

**After:**

```typescript
config.isPackageModule = true;
```

## Verification

1. Run `bun install` - workspace packages should install correctly
2. Run `bun run dev` - server should start without errors
3. Run `bun run build` - production build should succeed
4. Test module routes work correctly
5. Test AI tools from modules are available

## Rollback

If needed, rollback by:

1. Restore `external_modules/` from git history
2. Restore deleted symlink infrastructure files
3. Revert `vite.config.ts` to symlink-based version
4. Revert `src/lib/config/index.ts` and `src/lib/server/ai/toolbox.ts`

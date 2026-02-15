# Task: Module Conversion to Package Format

## Implementation Status: PARTIAL (40%)

**Completed**: Feb 15, 2026

### What Was Implemented ✅
- Created `modules/tasks/` package (@molos/module-tasks)
- Created `modules/ai/` package (@molos/module-ai)
- Workspace linking via npm workspaces
- Package discovery system for @molos/module-* packages
- Config loading from package modules
- Vite config updated to filter package modules from symlinking
- Root app builds successfully

### What Was NOT Implemented ❌
- No `@sveltejs/package` build system (modules use direct src imports)
- No `dist/` compilation output
- No `tsconfig.json` in modules
- No `svelte.config.js` in modules
- Import paths still use `$lib/...` or relative paths (not @molos/database, @molos/ui, @molos/core)
- Symlink infrastructure NOT removed (kept for backward compatibility)
- Route integration incomplete (routes exist in packages but not registered in main app)
- No module build scripts

### Key Architectural Difference

**Spec Expected**: Compiled packages with `@sveltejs/package` → `dist/` output
**Implemented**: Direct source imports via workspace linking → `src/` referenced directly

This is a simpler approach that works but doesn't match the full monorepo package vision.

---

## Agent Assignment
- **Agent**: Agent 2
- **Worktree**: `/home/eduardez/Workspace/MoLOS-org/MoLOS-modules`
- **Branch**: `feature/modules`
- **Focus Area**: Convert external modules to proper npm packages

## Context

You are converting MoLOS's external modules from symlinked directories to proper npm packages within the monorepo. Currently, modules in `external_modules/` are symlinked to `src/lib/external_modules/` for development. After your work, they will be installable packages.

### Current Module System

**Symlink Configuration** (`module-management/config/symlink-config.ts`):
- Defines which directories get symlinked
- Maps module paths to `src/lib/external_modules/`

**Module Linker** (`module-management/build/linker.ts`):
- Creates symlinks at build/dev time
- Resolves module paths

**Example Module** (`external_modules/MoLOS-Product-Owner/`):
```
MoLOS-Product-Owner/
├── lib/
│   ├── server/
│   │   └── db/
│   │       └── schema/
│   │           └── tables.ts
│   └── index.ts
├── routes/
│   └── (app)/
│       └── products/
├── manifest.yaml
└── manifest.json
```

### Current Import Paths

```typescript
// In routes or components
import { something } from '$lib/external_modules/MoLOS-Product-Owner';

// Or more specifically
import { ProductTable } from '$lib/external_modules/MoLOS-Product-Owner/lib/server/db/schema/tables';
```

### Target Import Paths

```typescript
// After conversion
import { something } from '@molos/module-product-owner';

// Or specific exports
import { ProductTable } from '@molos/module-product-owner/database';
```

## Dependencies

**Must wait for completion of:**
- Agent 1 (Core Foundation) - for package structure patterns
- Agent 3 (Database Migration) - for database schema extraction
- Agent 4 (UI Integration) - for UI component package

**Coordinate with:**
- Agent 3: Where module-specific database schemas go
- Agent 4: How to import shared UI components

## Files to Create

### modules/product-owner/

```
modules/product-owner/
├── src/
│   ├── index.ts              # Main exports
│   ├── server/
│   │   └── index.ts          # Server-side exports
│   ├── routes/
│   │   └── index.ts          # Route exports (for registration)
│   └── components/
│       └── index.ts          # Component exports
├── manifest.yaml             # Module metadata
├── package.json              # @molos/module-product-owner
└── tsconfig.json
```

### Template for Other Modules

Each module in `external_modules/` should be converted similarly.

## Files to Modify

| Current Path | Action | New Path |
|-------------|--------|----------|
| `external_modules/MoLOS-Product-Owner/` | Convert | `modules/product-owner/` |
| `src/lib/external_modules/` | Remove | (symlinks no longer needed) |
| `module-management/build/linker.ts` | Update/Remove | Use package imports instead |
| `module-management/config/symlink-config.ts` | Update/Remove | New module discovery |

## Implementation Steps

### Step 1: Initialize Worktree

```bash
cd /home/eduardez/Workspace/MoLOS-org/MoLOS
git worktree add ../MoLOS-modules -b feature/modules
cd ../MoLOS-modules
```

### Step 2: Wait for Dependencies

Check that other agents have completed:

```bash
# Pull latest from other branches
git fetch origin feature/core
git fetch origin feature/database
git fetch origin feature/ui

# Merge core foundation first
git merge origin/feature/core --no-edit
```

### Step 3: Analyze Existing Modules

```bash
# List all external modules
ls -la external_modules/

# For each module, understand:
# - What it exports
# - What it depends on
# - Its database schema (coordinate with Agent 3)
# - Its UI components (coordinate with Agent 4)
```

Document findings:

| Module | Routes | Database Tables | Components | Dependencies |
|--------|--------|-----------------|------------|--------------|
| MoLOS-Product-Owner | /products, /owners | projects, products | ProductCard, OwnerList | - |
| ... | ... | ... | ... | ... |

### Step 4: Create modules/ Directory Structure

```bash
mkdir -p modules/product-owner/src/{server,routes,components}
```

### Step 5: Create Module package.json

Create `modules/product-owner/package.json`:

```json
{
  "name": "@molos/module-product-owner",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./server": {
      "types": "./dist/server/index.d.ts",
      "default": "./dist/server/index.js"
    },
    "./routes": {
      "types": "./dist/routes/index.d.ts",
      "default": "./dist/routes/index.js"
    },
    "./components": {
      "types": "./dist/components/index.d.ts",
      "svelte": "./dist/components/index.js",
      "default": "./dist/components/index.js"
    },
    "./database": {
      "types": "./dist/database/index.d.ts",
      "default": "./dist/database/index.js"
    }
  },
  "files": ["dist", "src"],
  "scripts": {
    "build": "svelte-package",
    "dev": "svelte-package --watch",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@molos/core": "workspace:*",
    "@molos/database": "workspace:*",
    "@molos/ui": "workspace:*"
  },
  "devDependencies": {
    "@sveltejs/package": "^2.0.0",
    "svelte": "^5.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^5.0.0"
  }
}
```

### Step 6: Create Module tsconfig.json

Create `modules/product-owner/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "target": "ES2022"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 7: Create Main Export File

Create `modules/product-owner/src/index.ts`:

```typescript
// Main public exports for @molos/module-product-owner
// Export components
export * from './components';

// Export types
export type { ProductOwnerConfig, ProductOwnerManifest } from './types';

// Re-export commonly used items
export { default as ProductCard } from './components/ProductCard.svelte';
export { default as OwnerList } from './components/OwnerList.svelte';
```

### Step 8: Create Server Exports

Create `modules/product-owner/src/server/index.ts`:

```typescript
// Server-side exports (only imported in server code)
// Database schema will be imported from @molos/database

export { getProducts, getProductById, createProduct } from './services/products';
export { getOwners, getOwnerById } from './services/owners';

// Types
export type { Product, Owner, NewProduct } from './types';
```

### Step 9: Create Route Registration

Create `modules/product-owner/src/routes/index.ts`:

```typescript
// Route registration for SvelteKit
// This helps the main app know what routes this module provides

import type { RouteDefinition } from '@molos/core';

export const routes: RouteDefinition[] = [
  {
    path: '/products',
    component: () => import('./(app)/products/+page.svelte'),
    meta: { requiresAuth: true }
  },
  {
    path: '/products/:id',
    component: () => import('./(app)/products/[id]/+page.svelte'),
    meta: { requiresAuth: true }
  },
  {
    path: '/owners',
    component: () => import('./(app)/owners/+page.svelte'),
    meta: { requiresAuth: true }
  }
];
```

### Step 10: Create Component Exports

Create `modules/product-owner/src/components/index.ts`:

```typescript
// Component exports
export { default as ProductCard } from './ProductCard.svelte';
export { default as ProductList } from './ProductList.svelte';
export { default as OwnerList } from './OwnerList.svelte';
export { default as OwnerCard } from './OwnerCard.svelte';
```

### Step 11: Copy and Adapt Module Files

```bash
# Copy existing module files
cp -r external_modules/MoLOS-Product-Owner/lib/* modules/product-owner/src/

# Copy routes
cp -r external_modules/MoLOS-Product-Owner/routes modules/product-owner/src/

# Copy manifest
cp external_modules/MoLOS-Product-Owner/manifest.yaml modules/product-owner/
```

### Step 12: Update Import Paths

In all module files, update imports:

```typescript
// Before
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';

// After
import { db } from '@molos/database';
import { Button } from '@molos/ui';
```

Use find-and-replace or regex:

```bash
# Example replacements
find modules/ -name "*.ts" -o -name "*.svelte" | xargs sed -i 's|\$lib/server/db|@molos/database|g'
find modules/ -name "*.ts" -o -name "*.svelte" | xargs sed -i 's|\$lib/components/ui|@molos/ui|g'
```

### Step 13: Update Database Schema References

Coordinate with Agent 3 on database package structure. The module's database schema should either:

Option A: Be in `@molos/database` with namespacing
```typescript
import { modProductOwner } from '@molos/database/schema';
```

Option B: Have its own exports from module package
```typescript
import { productTables } from '@molos/module-product-owner/database';
```

Choose based on Agent 3's implementation.

### Step 14: Update Module Discovery

Update `module-management/` to use package-based discovery:

Create `module-management/discovery/package-discovery.ts`:

```typescript
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ModuleManifest } from '@molos/core';

export function discoverModules(modulesDir: string): ModuleManifest[] {
  const modules: ModuleManifest[] = [];

  const moduleDirs = readdirSync(modulesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const moduleName of moduleDirs) {
    const manifestPath = join(modulesDir, moduleName, 'manifest.yaml');

    try {
      const manifestContent = readFileSync(manifestPath, 'utf-8');
      // Parse YAML (use a library like js-yaml)
      const manifest = parseYaml(manifestContent);
      modules.push({
        ...manifest,
        packageName: `@molos/module-${moduleName}`
      });
    } catch (error) {
      console.warn(`No manifest found for module: ${moduleName}`);
    }
  }

  return modules;
}
```

### Step 15: Create svelte.config.js for Module

If using `@sveltejs/package`, create `modules/product-owner/svelte.config.js`:

```javascript
import { sveltePackage } from '@sveltejs/package';

export default {
  // Package configuration
};
```

### Step 16: Update Root package.json Workspaces

Ensure modules are included in workspaces:

```json
{
  "workspaces": [
    "packages/*",
    "modules/*",
    "apps/*"
  ]
}
```

### Step 17: Remove Symlink Infrastructure

After packages work:

```bash
# Remove old symlink directories
rm -rf src/lib/external_modules

# Update or remove symlink config
# Keep module-management for discovery, remove linking
```

### Step 18: Build and Test

```bash
# Install dependencies
npm install

# Build module
cd modules/product-owner && npm run build && cd ../..

# Verify exports
node -e "console.log(require('@molos/module-product-owner'))"
```

## Verification

### Package Build Verification

```bash
# Build the module package
cd modules/product-owner
npm run build
ls dist/  # Should have compiled files
```

### Import Verification

Create test file in main app:

```typescript
// src/test-module-import.ts
import { ProductCard, routes } from '@molos/module-product-owner';
import { getProducts } from '@molos/module-product-owner/server';

console.log('Module imports work!', ProductCard, routes, getProducts);
```

### Route Verification

Verify routes can be registered:

```typescript
// In main app's routes setup
import { routes as productOwnerRoutes } from '@molos/module-product-owner/routes';

// Register routes with SvelteKit
```

## Module Package Template

For other modules, use this template:

```json
{
  "name": "@molos/module-[module-name]",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/server/index.js",
    "./routes": "./dist/routes/index.js",
    "./components": "./dist/components/index.js",
    "./database": "./dist/database/index.js"
  },
  "dependencies": {
    "@molos/core": "workspace:*",
    "@molos/database": "workspace:*",
    "@molos/ui": "workspace:*"
  },
  "peerDependencies": {
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^5.0.0"
  }
}
```

## Integration Notes

### For Main App (after merge)

Update imports throughout the app:

```typescript
// Before
import { something } from '$lib/external_modules/MoLOS-Product-Owner';

// After
import { something } from '@molos/module-product-owner';
```

### Route Integration

SvelteKit routes from modules need to be integrated. Options:

1. **Copy routes to main app**: During build, copy module routes to `src/routes/`
2. **Dynamic route registration**: Use SvelteKit's advanced routing features
3. **Symlink routes**: Temporary solution during migration

Recommended: Copy during build for production, use dev server hooks for development.

## Handling Special Cases

### Modules with Shared State

If modules share state through `$lib`:
- Move shared state to `@molos/core`
- Create module-specific context

### Modules with Circular Dependencies

Break circular dependencies by:
- Extracting shared code to `@molos/core`
- Using dependency injection
- Restructuring module boundaries

### Database-Heavy Modules

Coordinate with Agent 3:
- Large schemas may stay in module package
- Small, shared schemas go to `@molos/database`

## Rollback Plan

```bash
# Discard changes
git checkout -- .

# Remove worktree
cd /home/eduardez/Workspace/MoLOS-org/MoLOS
git worktree remove ../MoLOS-modules
git branch -D feature/modules
```

## Status Tracking

### Original Spec Steps (Using Compiled Package Approach)

- [x] Step 1: Worktree initialized
- [ ] Step 2: Dependencies merged (skipped - worked independently)
- [x] Step 3: Modules analyzed (MoLOS-Tasks and AI module)
- [x] Step 4: Directory structure created (modules/tasks/, modules/ai/)
- [~] Step 5: package.json created (using src/ exports, not dist/)
- [ ] Step 6: tsconfig.json created (NOT DONE)
- [x] Step 7: Main exports created
- [x] Step 8: Server exports created
- [x] Step 9: Route registration created (routes exist but not integrated)
- [x] Step 10: Component exports created
- [x] Step 11: Module files copied (from MoLOS-Tasks to modules/tasks/)
- [~] Step 12: Import paths updated (used relative paths, not @molos/* packages)
- [~] Step 13: Database references updated (kept in-module, not @molos/database)
- [x] Step 14: Module discovery updated (package discovery added)
- [ ] Step 15: svelte.config.js created (NOT DONE)
- [x] Step 16: Workspaces updated (added to root package.json)
- [ ] Step 17: Symlink infrastructure removed (KEPT for compatibility)
- [x] Step 18: Build and test successful (root app builds)

### What Actually Got Created

```
modules/
├── tasks/
│   ├── package.json              # @molos/module-tasks
│   └── src/
│       ├── index.ts              # Main exports
│       ├── config.ts             # Module config
│       ├── server/
│       │   ├── index.ts
│       │   ├── database/
│       │   │   ├── index.ts
│       │   │   └── schema.ts
│       │   ├── repositories/     # All repos copied
│       │   └── ai/
│       │       └── ai-tools.ts
│       ├── models/
│       │   ├── index.ts
│       │   └── types.ts
│       ├── stores/
│       │   ├── index.ts
│       │   ├── tasks.store.ts
│       │   └── api.ts
│       ├── components/
│       │   ├── index.ts
│       │   ├── kanban-board.svelte
│       │   └── task-item.svelte
│       └── routes/
│           ├── api/              # API routes
│           └── ui/               # UI routes
└── ai/
    ├── package.json              # @molos/module-ai
    └── src/
        ├── index.ts
        └── config.ts
```

### Package Exports (Actual)

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/server/index.ts",
    "./database": "./src/server/database/index.ts",
    "./routes/*": "./src/routes/*/index.ts",
    "./components": "./src/components/index.ts",
    "./stores": "./src/stores/index.ts",
    "./models": "./src/models/index.ts",
    "./config": "./src/config.ts"
  }
}
```

**Note**: Exports reference `src/` directly, not compiled `dist/` output.

## Completion Criteria

### Original Spec Requirements

Task is complete when:
1. All external modules converted to packages
2. `npm install` resolves all workspace dependencies
3. Module packages build successfully
4. Imports work from `@molos/module-*`
5. Routes can be registered in main app
6. Symlink system no longer needed

### Current Status vs Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| All external modules converted to packages | Partial | Only tasks and AI modules converted |
| npm install resolves workspace dependencies | ✅ Complete | Works with workspace linking |
| Module packages build successfully | ❌ Incomplete | No build step - direct src imports |
| Imports work from @molos/module-* | ✅ Complete | Package imports work |
| Routes can be registered in main app | ❌ Incomplete | Routes exist but not integrated |
| Symlink system no longer needed | ❌ Incomplete | Still used for non-package modules |

## Remaining Work to Fully Match Spec

### High Priority
1. **Add @sveltejs/package build system**
   - Create `svelte.config.js` in each module
   - Add build scripts to package.json
   - Output to `dist/` directory

2. **Create module tsconfig.json files**
   - Extend from root tsconfig.base.json
   - Configure for compilation

3. **Extract database schemas** (coordinate with Agent 3)
   - Decide: shared in @molos/database or per-module?
   - Update imports accordingly

4. **Route integration system**
   - Implement build-time route copying OR
   - Create dynamic route registration system

5. **Remove symlink infrastructure**
   - Once all modules are packages
   - Update module-management to use only package discovery

### Medium Priority
6. **Create @molos/core package** for shared utilities
7. **Create @molos/ui package** for shared components
8. **Update module imports** to use @molos/core, @molos/ui, @molos/database
9. **Convert remaining external modules** to packages

### Low Priority
10. **Add module manifest system** for metadata
11. **Implement module versioning**
12. **Add module inter-dependencies** support

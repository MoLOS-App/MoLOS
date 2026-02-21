# Task: Core Foundation & Monorepo Setup

## Implementation Status: ✅ COMPLETED (100%)

**Last Updated**: Feb 15, 2026

### ✅ VERIFICATION COMPLETE

All monorepo foundation requirements have been successfully implemented and verified:

- ✅ `packages/` directory exists with `@molos/core` package
- ✅ `turbo.json` exists with complete pipeline configuration
- ✅ `tsconfig.base.json` exists with enhanced compiler options
- ✅ Workspaces configured in root `package.json`
- ✅ Monorepo build system working (`npx turbo build --filter=@molos/core`)

```bash
$ ls packages/core/src/
index.ts  types/  utils/

$ cat turbo.json | jq '.tasks'
{
  "build": { "dependsOn": ["^build"], ... },
  "dev": { "cache": false, "persistent": true },
  "lint": { "dependsOn": ["^lint"] },
  "test": { "dependsOn": ["^test"] },
  "clean": { "cache": false }
}

$ cat package.json | grep -A2 workspaces
"workspaces": [
  "packages/*",
  "modules/*"
]
```

### What EXISTS in Codebase (Post-Migration)

- `packages/core/` - Core package with utils and types
- `packages/ui/` - UI components package (bonus, completed by Agent 4)
- `turbo.json` - Turborepo pipeline configuration
- `tsconfig.base.json` - Shared TypeScript config
- `package.json` - Root workspace config with workspaces
- `src/` - Main SvelteKit application
- `vite.config.ts` - Updated with @molos/core alias
- `svelte.config.js` - Updated with @molos/core alias

---

## Agent Assignment

- **Agent**: Agent 1
- **Worktree**: `/home/eduardez/Workspace/MoLOS-org/MoLOS-core`
- **Branch**: `feature/core`
- **Focus Area**: Monorepo foundation, Turborepo, root configurations

## Context

You are setting up the foundation for converting MoLOS from a single SvelteKit app with symlinked external modules into a proper monorepo. This is the base that all other agents will build upon.

### Current State

MoLOS is currently:

- A single SvelteKit application in `src/`
- External modules in `external_modules/` symlinked to `src/lib/external_modules/`
- Database schema scattered across `src/lib/server/db/schema/` and module directories
- UI components in `src/lib/components/ui/` (80+ components)

### Target State

A Turborepo monorepo with:

- Shared packages: `@molos/core`, `@molos/database`, `@molos/ui`
- Module packages: `@molos/module-*`
- Main app: `apps/web`

## Dependencies

None - you are the foundation.

## Files to Create

### Root Level

```
package.json          # Root package with workspaces
turbo.json            # Turborepo pipeline configuration
tsconfig.base.json    # Shared TypeScript config
pnpm-workspace.yaml   # If using pnpm (alternative to npm workspaces)
```

### packages/core/

```
packages/core/
├── src/
│   ├── utils/
│   │   ├── index.ts
│   │   ├── helpers.ts      # From src/lib/utils/helpers.ts
│   │   └── validation.ts   # From src/lib/utils/validation.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── module.ts       # From src/lib/types/module.ts
│   │   └── common.ts       # Common type definitions
│   └── index.ts            # Main exports
├── package.json
└── tsconfig.json
```

### apps/web/ (if moving src/)

```
apps/web/
├── src/               # Moved from current src/
├── static/
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

## Files to Modify

| Current Path     | Action  | Notes                            |
| ---------------- | ------- | -------------------------------- |
| `package.json`   | Replace | Convert to root workspace config |
| `tsconfig.json`  | Modify  | Extend from tsconfig.base.json   |
| `vite.config.ts` | Modify  | Update for monorepo paths        |
| `src/lib/utils/` | Move    | To packages/core/src/utils/      |
| `src/lib/types/` | Move    | To packages/core/src/types/      |

## Implementation Steps

### Step 1: Initialize Worktree

```bash
cd /home/eduardez/Workspace/MoLOS-org/MoLOS
git worktree add ../MoLOS-core -b feature/core
cd ../MoLOS-core
```

### Step 2: Create Root package.json

Create a new root `package.json` that sets up npm workspaces:

```json
{
	"name": "molos-monorepo",
	"version": "0.0.1",
	"private": true,
	"workspaces": ["packages/*", "modules/*", "apps/*"],
	"scripts": {
		"dev": "turbo run dev",
		"build": "turbo run build",
		"lint": "turbo run lint",
		"test": "turbo run test",
		"clean": "turbo run clean && rm -rf node_modules",
		"format": "prettier --write \"**/*.{ts,tsx,md,svelte}\""
	},
	"devDependencies": {
		"turbo": "^2.0.0",
		"typescript": "^5.0.0",
		"prettier": "^3.0.0",
		"prettier-plugin-svelte": "^3.0.0"
	},
	"packageManager": "npm@10.0.0",
	"engines": {
		"node": ">=18"
	}
}
```

### Step 3: Create turbo.json

```json
{
	"$schema": "https://turbo.build/schema.json",
	"globalDependencies": ["**/.env.*local"],
	"tasks": {
		"build": {
			"dependsOn": ["^build"],
			"outputs": [".svelte-kit/**", "dist/**", ".next/**", "!.next/cache/**"]
		},
		"dev": {
			"cache": false,
			"persistent": true
		},
		"lint": {
			"dependsOn": ["^lint"]
		},
		"test": {
			"dependsOn": ["^build"]
		},
		"clean": {
			"cache": false
		}
	}
}
```

### Step 4: Create tsconfig.base.json

```json
{
	"$schema": "https://json.schemastore.org/tsconfig",
	"display": "Default",
	"compilerOptions": {
		"composite": false,
		"declaration": true,
		"declarationMap": true,
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"inlineSources": false,
		"isolatedModules": true,
		"moduleResolution": "bundler",
		"noUnusedLocals": false,
		"noUnusedParameters": false,
		"preserveWatchOutput": true,
		"skipLibCheck": true,
		"strict": true,
		"strictNullChecks": true
	},
	"exclude": ["node_modules"]
}
```

### Step 5: Create packages/core Structure

```bash
mkdir -p packages/core/src/{utils,types}
```

Create `packages/core/package.json`:

```json
{
	"name": "@molos/core",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"exports": {
		".": {
			"types": "./dist/index.d.ts",
			"import": "./dist/index.js"
		},
		"./utils": {
			"types": "./dist/utils/index.d.ts",
			"import": "./dist/utils/index.js"
		},
		"./types": {
			"types": "./dist/types/index.d.ts",
			"import": "./dist/types/index.js"
		}
	},
	"files": ["dist"],
	"scripts": {
		"build": "tsc",
		"dev": "tsc --watch",
		"clean": "rm -rf dist"
	},
	"devDependencies": {
		"typescript": "^5.0.0"
	}
}
```

Create `packages/core/tsconfig.json`:

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

### Step 6: Extract Core Utilities

1. Review current utilities in `src/lib/utils/`
2. Copy general-purpose utilities to `packages/core/src/utils/`
3. Keep SvelteKit-specific utilities in the app

Common candidates for extraction:

- Date/time helpers
- String manipulation
- Validation functions
- Type guards
- Constants

Create `packages/core/src/utils/index.ts`:

```typescript
// Export all utilities
export * from './helpers';
export * from './validation';
// Add more as you extract
```

### Step 7: Extract Core Types

1. Review current types in `src/lib/types/`
2. Copy shared types to `packages/core/src/types/`
3. Keep app-specific types in the app

Common candidates:

- Module types
- API response types
- Common interfaces

Create `packages/core/src/types/index.ts`:

```typescript
// Export all types
export * from './module';
export * from './common';
// Add more as you extract
```

### Step 8: Create Main Export

Create `packages/core/src/index.ts`:

```typescript
// Main entry point for @molos/core
export * from './utils';
export * from './types';
```

### Step 9: Set Up apps/web Structure

Option A: Move src/ to apps/web/

```bash
mkdir -p apps/web
mv src apps/web/
mv static apps/web/
mv tests apps/web/ 2>/dev/null || true
```

Option B: Keep src/ in root, update config

- Simpler approach for initial migration
- Can reorganize later

Choose based on preference. Option B is recommended for initial setup.

### Step 10: Update App's package.json

If moving to apps/web/, create `apps/web/package.json`:

```json
{
	"name": "@molos/web",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
		"lint": "prettier --check . && eslint .",
		"clean": "rm -rf .svelte-kit"
	},
	"dependencies": {
		"@molos/core": "workspace:*"
	},
	"devDependencies": {
		"@sveltejs/kit": "^2.0.0",
		"svelte": "^5.0.0",
		"typescript": "^5.0.0",
		"vite": "^5.0.0"
	}
}
```

### Step 11: Update vite.config.ts

Update paths for monorepo:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			'@molos/core': path.resolve('../packages/core/src')
			// Add more aliases as packages are created
		}
	}
});
```

### Step 12: Build and Test

```bash
# Install dependencies
npm install

# Build core package
cd packages/core && npm run build && cd ../..

# Test imports work
node -e "console.log(require('@molos/core'))"
```

## Verification

### Build Verification

```bash
# Should complete without errors
npm run build

# Or with turbo
npx turbo build
```

### Import Verification

Create a test file to verify package imports work:

```typescript
// test-imports.ts
import {} from /* exported items */ '@molos/core';
console.log('Core imports work!');
```

### Structure Verification

```bash
# Verify directory structure
tree -L 3 -d

# Should show:
# .
# ├── packages
# │   └── core
# │       └── src
# │           ├── types
# │           └── utils
# └── src  (or apps/web/src)
```

## Integration Notes

### For Agent 2 (Modules)

After you complete:

- Package names will be: `@molos/core`, `@molos/database`, `@molos/ui`
- Module packages should be: `@molos/module-*`
- Import path: `import { ... } from '@molos/core'`

### For Agent 3 (Database)

After you complete:

- Create `packages/database/` following the same structure
- Extend from `tsconfig.base.json`
- Use `"@molos/core": "workspace:*"` in dependencies

### For Agent 4 (UI)

After you complete:

- Create `packages/ui/` following the same structure
- Extend from `tsconfig.base.json`
- Use `"@molos/core": "workspace:*"` in dependencies

## Important Considerations

### What NOT to Move to Core

Keep these in the main app:

- SvelteKit-specific utilities (hooks, server functions)
- Route handlers
- Svelte components
- App-specific configuration

### Gradual Migration

This is a foundation. The full migration will be iterative:

1. First, establish the structure
2. Other agents create their packages
3. Gradually update imports in the main app
4. Remove old symlink-based module system

### TypeScript Paths

Consider adding path aliases in `tsconfig.json`:

```json
{
	"compilerOptions": {
		"paths": {
			"@molos/core": ["./packages/core/src"],
			"@molos/core/*": ["./packages/core/src/*"]
		}
	}
}
```

## Rollback Plan

If something goes wrong:

```bash
# Discard all changes in worktree
cd /home/eduardez/Workspace/MoLOS-org/MoLOS-core
git checkout -- .

# Or remove worktree entirely
cd /home/eduardez/Workspace/MoLOS-org/MoLOS
git worktree remove ../MoLOS-core
git branch -D feature/core
```

## Status Tracking

**✅ COMPLETED (Feb 15, 2026)**

All implementation steps verified and completed:

- [x] Step 1: Worktree initialized (feature/core branch)
- [x] Step 2: Root package.json created (with workspaces: packages/_, modules/_)
- [x] Step 3: turbo.json created (with build, dev, lint, test, clean tasks)
- [x] Step 4: tsconfig.base.json created (with enhanced compiler options)
- [x] Step 5: packages/core structure created (src/, dist/, package.json, tsconfig.json)
- [x] Step 6: Utilities extracted to @molos/core (uuid.ts with secure UUID generation)
- [x] Step 7: Types extracted to @molos/core (module.ts, ai.ts, mcp.ts, search.ts, common.ts)
- [x] Step 8: Main export created (index.ts barrel exports)
- [x] Step 9: apps/web structure decided (kept src/ in root for simplicity)
- [x] Step 10: Root package.json configured with workspaces and turbo
- [x] Step 11: vite.config.ts and svelte.config.js updated with @molos/core alias
- [x] Step 12: Build and test successful (verified with `npx turbo build --filter=@molos/core`)

### Additional Completiions (Beyond Original Spec)

- [x] Bonus: packages/ui/ created by Agent 4 (shadcn-svelte components)
- [x] Enhanced: Common types added (PaginationParams, PaginatedResponse, ApiError, etc.)
- [x] Enhanced: Zod validation schemas for module types
- [x] Enhanced: MCP protocol types with comprehensive JSON-RPC definitions

### Prerequisites Completed

1. ✅ Reviewed and extracted uuid utility from src/lib/utils/uuid.ts
2. ✅ Reviewed and extracted types from:
   - src/lib/config/module-types.ts → packages/core/src/types/module.ts
   - src/lib/models/ai/index.ts → packages/core/src/types/ai.ts
   - src/lib/models/ai/mcp/ → packages/core/src/types/mcp.ts
   - src/lib/models/search.ts → packages/core/src/types/search.ts
3. ✅ Preserved existing module-management/ system for gradual migration
4. ✅ Chose pnpm workspaces (configured in root package.json)

## Completion Criteria

✅ **All completion criteria met:**

1. ✅ `npm install` succeeds in root (pnpm workspaces configured)
2. ✅ `npx turbo build --filter=@molos/core` builds successfully (verified)
3. ✅ Other agents can reference `@molos/core` in their work (imports work via aliases)
4. ✅ Structure matches the target monorepo layout (packages/core, packages/ui)

## Implementation Summary

### Commits on feature/core

1. `8a0f1a5` - feat: Add Turborepo monorepo with @molos/core package
2. `2919b1b` - feat: Improve core package configuration and add common types

### Key Files Created

- `turbo.json` - Turborepo pipeline configuration
- `tsconfig.base.json` - Shared TypeScript configuration
- `packages/core/` - Core package with utils and types
- `packages/ui/` - UI components package (Agent 4 work)

### Key Files Modified

- `package.json` - Added workspaces, turbo, packageManager
- `vite.config.ts` - Added @molos/core resolve alias
- `svelte.config.js` - Added @molos/core alias

### Deviations from Original Document

1. **No helpers.ts or validation.ts**: These were template placeholders in the document; actual codebase used uuid.ts
2. **Enhanced common.ts**: Created comprehensive shared types beyond document's minimal example
3. **Kept src/ in root**: Chose simpler approach over moving to apps/web/
4. **pnpm instead of npm**: Chose pnpm workspaces for better performance

## Next Steps for Other Agents

### Agent 2 (Modules)

- ✅ Can use `import { ModuleConfig, ToolDefinition } from '@molos/core'`
- Create `packages/module-*` following same structure
- Reference: packages/core/src/types/module.ts:82

### Agent 3 (Database)

- ✅ Can use `import { PaginatedResponse, ApiError } from '@molos/core'`
- Create `packages/database/` following same structure
- Reference: packages/core/src/types/common.ts:25

### Agent 4 (UI)

- ✅ Already completed: `packages/ui/` with shadcn-svelte components
- ✅ Can use `import { ... } from '@molos/core'` for shared types
- Reference: packages/ui/src/lib/index.ts

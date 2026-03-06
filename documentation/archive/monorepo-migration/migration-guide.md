# Migration Guide: From Symlinks to Monorepo

This guide provides step-by-step instructions for migrating MoLOS from the current multi-repo + symlink architecture to a unified monorepo with npm workspaces.

## Prerequisites

Before starting the migration:

- [ ] Node.js 20+ installed
- [ ] npm 10+ or pnpm 9+ installed
- [ ] Git 2.40+ installed
- [ ] Backup of all databases
- [ ] All existing tests passing
- [ ] No uncommitted changes in any repository

## Phase 1: Repository Preparation

### Step 1.1: Create Monorepo Root

```bash
# Create a fresh directory for the monorepo
mkdir MoLOS-monorepo
cd MoLOS-monorepo

# Initialize git
git init
git branch -m main

# Create initial structure
mkdir -p apps packages modules tools docs
```

### Step 1.2: Initialize Root Package

```bash
# Create root package.json with workspaces
cat > package.json << 'EOF'
{
  "name": "molos-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "modules/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.9.0"
  },
  "packageManager": "npm@10.0.0"
}
EOF

# Create turbo.json
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".svelte-kit/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "clean": {
      "cache": false
    }
  }
}
EOF
```

### Step 1.3: Move Core Application

```bash
# Move existing MoLOS core to apps/web
mv /path/to/MoLOS apps/web

# Update apps/web/package.json
cd apps/web
# Change name to @molos/web
# Remove symlink-related scripts
# Update dependencies to use workspace: protocol
```

## Phase 2: Extract Shared Packages

### Step 2.1: Create Core Package

```bash
cd ../..  # Back to monorepo root
mkdir -p packages/core/src

# Extract core utilities
cp -r apps/web/src/lib/utils packages/core/src/
cp -r apps/web/src/lib/types packages/core/src/

# Create package.json
cat > packages/core/package.json << 'EOF'
{
  "name": "@molos/core",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./utils": "./src/utils/index.ts",
    "./types": "./src/types/index.ts"
  }
}
EOF

# Create index.ts
cat > packages/core/src/index.ts << 'EOF'
export * from './utils';
export * from './types';
EOF
```

### Step 2.2: Create Database Package

```bash
mkdir -p packages/database/src/schema

# Extract database schema and migrations
cp -r apps/web/src/lib/server/db/schema packages/database/src/
cp -r apps/web/drizzle packages/database/

cat > packages/database/package.json << 'EOF'
{
  "name": "@molos/database",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@molos/core": "workspace:*",
    "drizzle-orm": "^0.41.0",
    "better-sqlite3": "^12.5.0"
  },
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  }
}
EOF
```

### Step 2.3: Create UI Package

```bash
mkdir -p packages/ui/src/components

# Extract shared UI components
cp -r apps/web/src/lib/components/ui packages/ui/src/components/

cat > packages/ui/package.json << 'EOF'
{
  "name": "@molos/ui",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "peerDependencies": {
    "svelte": "^5.0.0",
    "@sveltejs/kit": "^2.0.0"
  },
  "dependencies": {
    "@molos/core": "workspace:*"
  }
}
EOF
```

## Phase 3: Migrate Modules

### Step 3.1: Module Conversion Checklist

For each module in `external_modules/`:

```markdown
## Module: [MODULE_NAME]

### Pre-migration

- [ ] Export all branches to backup
- [ ] Document any external dependencies
- [ ] Note any hardcoded paths

### Migration Steps

- [ ] Create modules/[module-name]/ directory
- [ ] Copy module files
- [ ] Create package.json with @molos/module-[name]
- [ ] Update import paths
- [ ] Create manifest.yaml (copy from external)
- [ ] Move database schema to lib/server/db/schema/
- [ ] Update AI tools imports
- [ ] Test module in isolation

### Post-migration

- [ ] Update module routes
- [ ] Verify AI tools work
- [ ] Check database migrations
- [ ] Run module tests
```

### Step 3.2: Convert a Module

```bash
# Example: Convert MoLOS-Product-Owner
MODULE_NAME="product-owner"
SRC_MODULE="MoLOS-Product-Owner"

# Create module directory
mkdir -p modules/$MODULE_NAME/src

# Copy module files (preserving structure)
cp -r apps/web/external_modules/$SRC_MODULE/lib modules/$MODULE_NAME/src/
cp -r apps/web/external_modules/$SRC_MODULE/routes modules/$MODULE_NAME/src/
cp apps/web/external_modules/$SRC_MODULE/manifest.yaml modules/$MODULE_NAME/
cp apps/web/external_modules/$SRC_MODULE/config.ts modules/$MODULE_NAME/src/

# Create package.json
cat > modules/$MODULE_NAME/package.json << EOF
{
  "name": "@molos/module-$MODULE_NAME",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@molos/core": "workspace:*",
    "@molos/database": "workspace:*",
    "@molos/ui": "workspace:*"
  }
}
EOF
```

### Step 3.3: Update Import Paths

Create a script to automate import path updates:

```bash
#!/bin/bash
# scripts/update-imports.sh

MODULE_DIR=$1

# Update imports in module files
find $MODULE_DIR -name "*.ts" -o -name "*.svelte" | while read file; do
  # Core imports
  sed -i 's|\$lib/utils|@molos/core/utils|g' $file
  sed -i 's|\$lib/types|@molos/core/types|g' $file

  # Database imports
  sed -i 's|\$lib/server/db|@molos/database|g' $file

  # UI component imports
  sed -i 's|\$lib/components/ui|@molos/ui|g' $file
done

echo "Updated imports in $MODULE_DIR"
```

### Step 3.4: Update Module Config

The module's `config.ts` should now export using standard ES modules:

```typescript
// modules/product-owner/src/config.ts

import type { ModuleConfig } from '@molos/core/types';

export const moduleConfig: ModuleConfig = {
	id: 'product-owner',
	name: 'Product Owner',
	href: '/ui/product-owner'
	// ... navigation config
};

export default moduleConfig;
```

## Phase 4: Database Migration

### Step 4.1: Consolidate Migrations

```bash
# Create unified migrations directory
mkdir -p packages/database/drizzle

# Copy core migrations
cp -r apps/web/drizzle/* packages/database/drizzle/

# For each module, rename and copy migrations
for module in modules/*/; do
  MODULE_ID=$(basename $module)
  if [ -d "$module/drizzle" ]; then
    for migration in $module/drizzle/*.sql; do
      MIGRATION_NAME=$(basename $migration)
      # Prefix with module name to avoid conflicts
      cp $migration packages/database/drizzle/${MODULE_ID}_${MIGRATION_NAME}
    done
  fi
done
```

### Step 4.2: Update Table Namespacing

Ensure all module tables use the `mod_{moduleId}_` prefix:

```typescript
// packages/database/src/utils/namespace.ts

export function getTableName(moduleId: string, tableName: string): string {
	return `mod_${moduleId}_${tableName}`;
}

export function getModuleTablePattern(moduleId: string): string {
	return `mod_${moduleId}_%`;
}
```

### Step 4.3: Create Migration Script

```typescript
// tools/scripts/migrate-tables.ts

import { db } from '@molos/database';
import { getTableName } from '@molos/database/utils';

const MODULE_TABLES: Record<string, string[]> = {
	'product-owner': ['projects', 'workflows', 'automation_rules', 'feedback'],
	tasks: ['tasks', 'categories', 'tags']
};

async function migrateModuleTables() {
	for (const [moduleId, tables] of Object.entries(MODULE_TABLES)) {
		for (const table of tables) {
			const oldName = table;
			const newName = getTableName(moduleId, table);

			try {
				await db.execute(`ALTER TABLE ${oldName} RENAME TO ${newName}`);
				console.log(`Renamed ${oldName} -> ${newName}`);
			} catch (e) {
				console.log(`Table ${oldName} not found or already renamed`);
			}
		}
	}
}

migrateModuleTables();
```

## Phase 5: Handling Existing Symlinks

### Step 5.1: Remove Symlink Infrastructure

```bash
# Remove symlink-related files
rm -rf apps/web/module-management/build/linker.ts
rm -rf apps/web/module-management/config/symlink-config.ts

# Remove symlinked directories
rm -rf apps/web/src/lib/config/external_modules
rm -rf apps/web/src/lib/components/external_modules
rm -rf apps/web/src/routes/ui/\(modules\)/\(external_modules\)
rm -rf apps/web/src/routes/api/\(external_modules\)
```

### Step 5.2: Update vite.config.ts

Remove symlink-related code from `vite.config.ts`:

```typescript
// apps/web/vite.config.ts (simplified)

import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],

	server: {
		fs: {
			allow: [
				process.cwd(),
				// Allow access to workspace packages
				'../..'
			]
		}
	}
});
```

### Step 5.3: Clean Module Management

Keep only the necessary module management files:

```
apps/web/src/lib/server/modules/
├── loader.ts          # Module discovery (updated)
├── registry.ts        # Module registry
├── types.ts           # Type definitions
└── events/            # Event bus
    ├── bus.ts
    └── types.ts
```

## Phase 6: Rollback Procedures

### Quick Rollback

If something goes wrong during migration:

```bash
# 1. Stop all running processes
npm run dev -- --stop 2>/dev/null || true

# 2. Restore database from backup
cp /backup/molos.db apps/web/molos.db

# 3. Revert to previous commit
git reset --hard HEAD~N  # N = number of commits to revert

# 4. Reinstall dependencies
rm -rf node_modules apps/*/node_modules packages/*/node_modules modules/*/node_modules
npm install

# 5. Rebuild
npm run build
```

### Partial Rollback

To rollback a specific module:

```bash
# 1. Disable the module in the database
sqlite3 apps/web/molos.db "UPDATE settings_external_modules SET status='disabled' WHERE id='product-owner'"

# 2. Remove the module package
rm -rf modules/product-owner

# 3. Reinstall and rebuild
npm install
npm run build
```

## Phase 7: Common Issues and Solutions

### Issue: Module Not Found

**Symptoms:**

```
Error: Cannot find module '@molos/module-product-owner'
```

**Solution:**

```bash
# Ensure workspace dependencies are linked
npm install

# Check package name matches
cat modules/product-owner/package.json | grep '"name"'

# Verify workspace configuration
cat package.json | grep -A5 workspaces
```

### Issue: TypeScript Path Errors

**Symptoms:**

```
error TS2307: Cannot find module '@molos/core' or its corresponding type declarations.
```

**Solution:**

```jsonc
// Add to tsconfig.json in the affected package
{
	"compilerOptions": {
		"paths": {
			"@molos/core": ["../../packages/core/src"],
			"@molos/database": ["../../packages/database/src"],
			"@molos/ui": ["../../packages/ui/src"]
		}
	}
}
```

### Issue: Database Migration Conflicts

**Symptoms:**

```
Error: Table "projects" already exists
```

**Solution:**

```bash
# Check current table names
sqlite3 apps/web/molos.db ".tables"

# Run migration in order
npm run db:migrate --filter=@molos/database

# Manually resolve conflicts if needed
sqlite3 apps/web/molos.db "DROP TABLE IF EXISTS projects;"
```

### Issue: SvelteKit Route Conflicts

**Symptoms:**

```
Error: Duplicate route /ui/product-owner
```

**Solution:**

1. Ensure each module's routes are unique
2. Check for leftover symlinks: `find apps/web/src/routes -type l`
3. Clean and rebuild: `npm run clean && npm run build`

### Issue: Build Order Problems

**Symptoms:**

```
Error: Package '@molos/core' is being built
```

**Solution:**

```bash
# Let Turborepo handle build order
npm run build

# Or build specific packages in order
npm run build --filter=@molos/core
npm run build --filter=@molos/database
npm run build --filter=@molos/module-product-owner
npm run build --filter=@molos/web
```

## Verification Checklist

After completing migration, verify:

- [ ] `npm install` completes without errors
- [ ] `npm run build` succeeds for all packages
- [ ] `npm run dev` starts the development server
- [ ] All modules appear in the navigation
- [ ] Module routes are accessible
- [ ] AI tools from modules are available
- [ ] Database queries work correctly
- [ ] All tests pass: `npm run test`
- [ ] No symlink artifacts remain: `find . -type l`

## Post-Migration Cleanup

```bash
# Remove old external_modules directory
rm -rf apps/web/external_modules

# Remove old symlink scripts
rm -rf apps/web/scripts/link-modules.ts
rm -rf apps/web/scripts/sync-modules.ts

# Remove old module management files
rm -rf apps/web/module-management/build
rm -rf apps/web/module-management/config/symlink-config.ts

# Update .gitignore
echo "
# Monorepo
packages/*/dist
modules/*/dist
apps/*/.svelte-kit
" >> .gitignore
```

## Next Steps

After successful migration:

1. **Update CI/CD pipelines** - See [06-deployment.md](./06-deployment.md)
2. **Update documentation** - Developer guides, API docs
3. **Archive old repositories** - Mark as read-only
4. **Team training** - Share migration guide with team

---

_Last Updated: 2025-02-15_
_Version: 1.0_

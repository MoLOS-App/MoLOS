# Module Installation Guide

How to install and manage MoLOS modules.

## One Command Setup

```bash
bun run dev
```

This automatically:

1. Discovers all modules in `modules/`
2. Adds them as workspace dependencies
3. Installs dependencies
4. Syncs routes
5. Starts the dev server

## Adding a New Module

```bash
# 1. Copy module to modules/ directory
cp -r /path/to/MoLOS-NewModule modules/

# 2. Start dev (auto-discovers new module)
bun run dev
```

## Installing from GitHub

```bash
# Add module from GitHub
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks

# Start dev
bun run dev
```

### From GitHub (Recommended for Development)

```bash
# Install module from GitHub
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks

# Sync routes
bun run module:sync

# Start dev server
bun run dev
```

### From npm (When Published)

```bash
bun add @molos/module-tasks
bun run module:sync
```

### Specific Version or Commit

```bash
# Specific commit
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks#abc123

# Specific tag
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks#v1.0.0

# Specific branch
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks#develop
```

## Installation Steps

### Step 1: Add Dependency

Edit `package.json` or run:

```bash
bun add @molos/module-name@github:MoLOS-App/MoLOS-Name
```

### Step 2: Install Dependencies

```bash
bun install
```

### Step 3: Sync Modules

```bash
bun run module:sync
```

This command:

- Discovers modules in `node_modules/@molos/module-*`
- Creates route symlinks
- Initializes module in the app

### Step 4: Run Migrations

```bash
# Navigate to installed module
cd node_modules/@molos/module-name

# Apply migrations
npx drizzle-kit migrate

# Return to project root
cd ../../..
```

### Step 5: Start Dev Server

```bash
bun run dev
```

## Updating Modules

### Update to Latest

```bash
# Update module
bun update @molos/module-tasks

# Re-sync
bun run module:sync

# Run new migrations if any
cd node_modules/@molos/module-tasks
npx drizzle-kit migrate
```

### Update to Specific Version

```bash
bun add @molos/module-tasks@github:MoLOS-App/MoLOS-Tasks#v1.2.0
bun run module:sync
```

## Removing Modules

```bash
# Remove package
bun remove @molos/module-name

# Clean up symlinks
bun run module:link

# Or manually remove symlink
rm -rf src/routes/ui/\(modules\)/\(external_modules\)/ModuleName
rm -rf src/routes/api/\(external_modules\)/ModuleName
```

## Environment Configuration

### Load All Modules (Default)

```bash
# .env
VITE_MOLOS_AUTOLOAD_MODULES=
```

### Load Specific Modules

```bash
# Only load these modules (dashboard and ai always load)
VITE_MOLOS_AUTOLOAD_MODULES=MoLOS-Tasks,MoLOS-Finance
```

## Verifying Installation

### Check Installed Modules

```bash
# List installed @molos packages
ls node_modules/@molos/

# Check route symlinks
ls -la src/routes/ui/\(modules\)/\(external_modules\)/
```

### Check Module API

```bash
# Start server
bun run dev

# Check modules endpoint
curl http://localhost:5173/api/modules
```

### Check Database Tables

```sql
-- List module tables
SELECT name FROM sqlite_master
WHERE type='table' AND name LIKE 'MoLOS-%';
```

## Troubleshooting

### Module Not Appearing in Sidebar

1. Check `config.ts` exists in module
2. Verify module ID matches package name
3. Run `bun run module:sync`
4. Check environment filter: `echo $VITE_MOLOS_AUTOLOAD_MODULES`

### 404 Errors on Routes

1. Verify symlink exists:
   ```bash
   ls -la src/routes/ui/\(modules\)/\(external_modules\)/
   ```
2. Re-link routes: `bun run module:link`

### Database Table Not Found

1. Create migration: `bun run db:migration:create --name add_table --module MoLOS-Name`
2. Edit the generated SQL file
3. Apply migration: `bun run db:migrate`

### Import Errors

External modules must use `$lib` alias:

```typescript
// ✅ Correct
import { db } from '$lib/server/db';

// ❌ Wrong - breaks in node_modules
import { db } from '../../../../../src/lib/server/db';
```

## Available Modules

| Module | Package               | Source                                             |
| ------ | --------------------- | -------------------------------------------------- |
| Tasks  | `@molos/module-tasks` | [GitHub](https://github.com/MoLOS-App/MoLOS-Tasks) |

## Installation Checklist

- [ ] Add dependency to package.json
- [ ] Run `bun install`
- [ ] Run `bun run module:sync`
- [ ] Run migrations if needed
- [ ] Verify module appears in sidebar
- [ ] Test module routes work

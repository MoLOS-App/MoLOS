# Module System Quick Reference

Quick guide for common module operations with the package-based module system.

## Commands

```bash
# Install dependencies (including workspace modules)
bun install

# Sync modules (with change detection - fast!)
bun run module:sync

# Force sync (bypass change detection)
bun run module:sync -- --force

# Link module routes manually
bun run module:link

# Create a new module
bun run module:create

# Validate a module
bun run module:validate

# Test a module
bun run module:test

# Clean up broken symlinks
bun run module:cleanup

# Module TUI (interactive interface)
bun run module:tui
```

## Database Operations

```bash
# Generate migration for schema changes
bun run db:generate

# Apply database migrations
bun run db:migrate

# Reset database (WARNING: deletes all data)
bun run db:reset

# Open Drizzle Studio (database GUI)
bun run db:studio
```

## Common Workflows

### Adding a New Module

```bash
# 1. Create the module
bun run module:create

# 2. Add to root package.json dependencies
# "@molos/module-your-module": "workspace:*"

# 3. Install dependencies
bun install

# 4. Validate the module
bun run module:validate -- --module=your-module

# 5. Link routes
bun run module:link

# 6. Sync to activate
bun run module:sync
```

### Updating a Module

```bash
# 1. Make changes to module files
cd modules/your-module
# ... edit files ...

# 2. Force sync to apply changes
bun run module:sync -- --force

# 3. Restart dev server
# Ctrl+C, then bun run dev
```

### Debugging Module Issues

```bash
# 1. Check module status in database
sqlite3 data/database.db "SELECT id, status, retry_count, last_error FROM settings_external_modules;"

# 2. View detailed logs
bun run module:sync -- --verbose

# 3. Check state files
cat .molo-sync-state.json
cat .molo-module-links.json

# 4. Clear cache and retry
rm .molo-*.json
bun run module:sync -- --force
```

### Switching Branches

```bash
# 1. Clean up module state
rm .molo-*.json

# 2. Run migrations if needed
bun run db:migrate

# 3. Sync modules
bun run module:sync

# 4. Restart dev server
bun run dev
```

## Environment Variables

```bash
# Module autoload filtering (comma-separated module IDs, empty = load all)
VITE_MOLOS_AUTOLOAD_MODULES=       # Client-exposed filter (e.g., "tasks,goals")
MOLOS_AUTOLOAD_MODULES=            # Server-only filter

# Note: "dashboard" and "ai" modules are mandatory and always load

# Parent directory access (dev only)
MOLOS_ALLOW_PARENT_MODULES=true    # Allow modules from parent dir (default: true in dev)

# Retry configuration
MOLOS_RETRY_MAX_RETRIES=3          # Max retry attempts
MOLOS_RETRY_DELAY=5000             # Initial delay (ms)
MOLOS_RETRY_GRACE_PERIOD=300000    # Grace period (ms)
MOLOS_RETRY_EXPONENTIAL_BACKOFF=true # Use exponential backoff

# Build configuration
NODE_ENV=production                # Set environment
FORCE_REBUILD=true                 # Force rebuild on startup
MOLOS_ENABLE_PROD_BUILD=true       # Allow builds in production
```

## File Locations

```
modules/                           # Package modules directory
  ├── your-module/
  │   ├── package.json            # @molos/module-your-module
  │   ├── manifest.yaml           # Module metadata
  │   └── src/
  │       ├── index.ts            # Module exports
  │       ├── config.ts           # Module config
  │       ├── lib/                # Module code
  │       │   ├── components/
  │       │   ├── models/
  │       │   ├── repositories/
  │       │   ├── stores/
  │       │   └── server/
  │       │       ├── ai/         # AI tools
  │       │       └── db/         # Database schema
  │       └── routes/             # SvelteKit routes
  │           ├── ui/
  │           └── api/

src/routes/ui/(modules)/(external_modules)/  # UI route symlinks
src/routes/api/(external_modules)/           # API route symlinks

.molo-sync-state.json              # Sync state cache
.molo-module-links.json            # Link state cache
module-retry.config.json           # Retry configuration (optional)
```

## Import Patterns

### Within a Module

```typescript
// From routes to lib - use relative imports with .js extension
import { MyModel } from '../../../lib/models/index.js';
import { MyRepository } from '../../../lib/repositories/my-repository.js';
import { MyComponent } from '../../../lib/components/my-component.svelte';

// Import from core app via $lib
import { db } from '$lib/server/db';
import { Button } from '$lib/components/ui/button';
```

### From Core App to Module

```typescript
// Import module config
import { moduleConfig } from '@molos/module-your-module/config';

// Import module types
import type { MyType } from '@molos/module-your-module';
```

## Troubleshooting

### Module stuck in "pending" status

```bash
# Check retry count
sqlite3 data/database.db "SELECT id, status, retry_count, last_error FROM settings_external_modules WHERE id='YourModule';"

# If retry_count < 3, wait for grace period (5 min) and re-sync
bun run module:sync

# If retry_count >= 3, fix the issue and force re-sync
# Edit module files...
bun run module:sync -- --force
```

### Import errors for module files

```bash
# Check that .js extensions are used for TS imports
# In routes: import { x } from '../../../lib/models/index.js';

# Re-link routes
bun run module:link -- --force

# Or full reset
rm .molo-*.json
bun run module:sync -- --force
```

### Changes not applying

```bash
# Clear state and force sync
rm .molo-sync-state.json
bun run module:sync -- --force
```

### Database errors

```bash
# Check if migration is needed
bun run db:generate
bun run db:migrate
```

## SQL Queries

### See all modules with status

```sql
SELECT
  id,
  status,
  retry_count,
  last_error,
  installed_at,
  updated_at
FROM settings_external_modules
ORDER BY installed_at DESC;
```

### See retryable modules

```sql
SELECT
  id,
  status,
  retry_count,
  last_retry_at,
  last_error
FROM settings_external_modules
WHERE status LIKE 'error_%' OR status = 'pending';
```

### See active modules

```sql
SELECT id, repo_url, installed_at
FROM settings_external_modules
WHERE status = 'active';
```

### Reset module retry count

```sql
UPDATE settings_external_modules
SET retry_count = 0,
    last_retry_at = NULL,
    status = 'pending'
WHERE id = 'YourModule';
```

### Force module re-initialization

```sql
UPDATE settings_external_modules
SET status = 'pending',
    retry_count = 0,
    last_error = NULL,
    error_details = NULL,
    error_type = NULL,
    recovery_steps = NULL
WHERE id = 'YourModule';
```

## Performance Tips

1. **Use change detection**: Normal `module:sync` is fast - only syncs when needed
2. **Avoid `--force`**: Only use when you know things changed
3. **Keep manifests small**: Large manifests slow down hashing
4. **Monitor retry counts**: High retry counts indicate persistent issues
5. **Clean up old modules**: Remove unused modules to improve startup time

## Getting Help

- Full documentation: `documentation/modules/README.md`
- Development guide: `documentation/modules/development.md`
- Migration changelog: `documentation/CHANGELOG-2026-02-16-package-module-migration.md`
- Repository issues: https://github.com/MoLOS-org/MoLOS/issues

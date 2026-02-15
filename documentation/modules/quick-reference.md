# Module System Quick Reference

Quick guide for common module operations.

## Commands

```bash
# Sync modules (with change detection - fast!)
npm run module:sync

# Force sync (bypass change detection)
npm run module:sync -- --force

# Link modules manually
npm run module:link

# Create a new module
npm run module:create

# Validate a module
npm run module:validate

# Test a module
npm run module:test

# Clean up broken symlinks
npm run module:cleanup

# Module TUI (interactive interface)
npm run module:tui
```

## Database Operations

```bash
# Generate migration for schema changes
npm run db:generate

# Apply database migrations
npm run db:migrate

# Reset database (WARNING: deletes all data)
npm run db:reset

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## Common Workflows

### Adding a New Module

```bash
# 1. Create the module
npm run module:create

# 2. Validate the module
npm run module:validate -- --module=YourModule

# 3. Test the module
npm run module:test -- --module=YourModule

# 4. Sync to activate
npm run module:sync
```

### Updating a Module

```bash
# 1. Make changes to module files
cd external_modules/YourModule
# ... edit files ...

# 2. Force sync to apply changes
npm run module:sync -- --force

# 3. Restart dev server
# Ctrl+C, then npm run dev
```

### Debugging Module Issues

```bash
# 1. Check module status in database
sqlite3 data/database.db "SELECT id, status, retry_count, last_error FROM settings_external_modules;"

# 2. View detailed logs
npm run module:sync -- --verbose

# 3. Check state files
cat .molo-sync-state.json
cat .molo-module-links.json

# 4. Clear cache and retry
rm .molo-*.json
npm run module:sync -- --force
```

### Switching Branches

```bash
# 1. Clean up module state
rm .molo-*.json

# 2. Run migrations if needed
npm run db:migrate

# 3. Sync modules
npm run module:sync

# 4. Restart dev server
npm run dev
```

## Environment Variables

```bash
# Module discovery
MOLOS_AUTOLOAD_MODULES=true        # Auto-discover local modules (default: true)

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
external_modules/                  # External modules directory
  ├── YourModule/
  │   ├── manifest.yaml           # Module metadata
  │   ├── config.ts               # Module config
  │   ├── drizzle/                # Database migrations
  │   ├── lib/                    # Module code
  │   └── routes/                 # SvelteKit routes

src/lib/config/external_modules/   # Module config symlinks
src/routes/ui/(modules)/(external_modules)/  # UI route symlinks
src/routes/api/(external_modules)/ # API route symlinks

.molo-sync-state.json              # Sync state cache
.molo-module-links.json            # Link state cache
module-retry.config.json           # Retry configuration (optional)
```

## Troubleshooting

### Module stuck in "pending" status

```bash
# Check retry count
sqlite3 data/database.db "SELECT id, status, retry_count, last_error FROM settings_external_modules WHERE id='YourModule';"

# If retry_count < 3, wait for grace period (5 min) and re-sync
npm run module:sync

# If retry_count >= 3, fix the issue and force re-sync
# Edit module files...
npm run module:sync -- --force
```

### Import errors for module files

```bash
# Re-link modules
npm run module:link -- --force

# Or full reset
rm .molo-*.json
npm run module:sync -- --force
```

### Changes not applying

```bash
# Clear state and force sync
rm .molo-sync-state.json
npm run module:sync -- --force
```

### Database errors

```bash
# Check if migration is needed
npm run db:generate
npm run db:migrate
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

- Full documentation: `documentation/module-improvements.md`
- Module system docs: `documentation/context/module-system.md`
- Repository issues: https://github.com/MoLOS-org/MoLOS/issues

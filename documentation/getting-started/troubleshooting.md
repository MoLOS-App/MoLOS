# Troubleshooting

Common issues and their solutions.

---

## General Issues

### Vite SSR runner closed during module clone

- Ensure Vite ignores external_modules/\*\*/svelte.config.js and tsconfig.json
- Restart dev server after a clone finishes

### Missing module imports

- Use $lib/\*/external_modules/<MODULE_ID> paths
- AI tools: $lib/server/ai/external_modules/<MODULE_ID>/ai-tools

### Module not loading

- Check manifest.yaml id matches folder name
- Run `bun run module:sync` and `bun run module:validate`

---

## Database Issues

### "table already exists" error

Migration was partially applied or tracking is out of sync.

**Solution:**

```bash
# Check what's tracked
sqlite3 molos.db "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;"

# If migration is tracked but tables don't exist, you may need to manually create them
# Or remove the migration entry and re-run:
sqlite3 molos.db "DELETE FROM __drizzle_migrations WHERE hash = '<hash>';"
bun run db:migrate
```

### Schema validation fails after migration

Migration was applied but journal not updated, or tables are missing.

**Solution:**

```bash
# Run audit to identify issues
bun run db:audit-modules

# Check which tables are missing
bun run db:validate
```

### Module tables not created

Module migration wasn't run or failed silently.

**Solution:**

```bash
# Run unified migration
bun run db:migrate:unified

# Check for errors in logs
cat logs/migrations.log | tail -20
```

### Migration fails with "statement-breakpoint" error

SQL file contains multiple statements without separators.

**Solution:**

Add `--> statement-breakpoint` between statements:

```sql
CREATE TABLE users (id TEXT PRIMARY KEY);

--> statement-breakpoint

CREATE INDEX idx_users_email ON users (email);
```

### Journal/SQL desync

`_journal.json` has different count than SQL files.

**Solution:**

1. Identify the orphaned file (SQL without journal entry or vice versa)
2. Either add the entry to `_journal.json` or remove the orphaned SQL file
3. Run `bun run db:audit-modules` to verify

### Database file not found

Database wasn't initialized.

**Solution:**

```bash
bun run db:init
```

---

## Rollback Issues

### Rollback doesn't work for complex migration

Auto-generated rollback only handles simple DDL.

**Solution:**

Create a manual `.down.sql` file:

```
drizzle/
├── 0016_complex_migration.sql
├── 0016_complex_migration.down.sql  # Manual rollback
```

### Cannot rollback data migration

DELETE/UPDATE/INSERT migrations cannot be auto-rolled back.

**Solution:**

1. Always backup before running data migrations
2. Create manual `.down.sql` with inverse operations
3. Or restore from backup:

```bash
cp molos.db.backup-2026-02-23T12-00-00 molos.db
```

---

## CI/CD Issues

### Migration tests fail in CI but pass locally

Database state differs or timing issues.

**Solution:**

1. Check the uploaded artifact (failed-migration-db)
2. Ensure tests use isolated databases
3. Check for environment variable differences

### Fresh database init fails in CI

Missing dependencies or schema issues.

**Solution:**

1. Check CI logs for specific error
2. Run `bun run db:audit-modules` locally first
3. Validate schema locally with `bun run db:validate`

---

## Health Check Issues

### Health endpoint returns "error" status

Database connection or migration tracking issue.

**Solution:**

```bash
# Check database exists and is readable
sqlite3 molos.db "SELECT COUNT(*) FROM sqlite_master;"

# Check migrations table exists
sqlite3 molos.db "SELECT COUNT(*) FROM __drizzle_migrations;"

# Check health endpoint directly
curl http://localhost:5173/api/health/migrations | jq
```

### "No database backup found" warning

No backup has been created yet.

**Solution:**

Backups are created automatically by `bun run db:init`. To create one manually:

```bash
cp molos.db "molos.db.backup-$(date +%Y-%m-%dT%H-%M-%S)"
```

---

## Getting Help

1. Check logs: `logs/migrations.log`
2. Run diagnostics: `bun run db:audit-modules && bun run db:validate`
3. Check health endpoint: `/api/health/migrations`
4. Review [Database Architecture](../architecture/database.md)
5. Review [Database Package](../packages/database.md)

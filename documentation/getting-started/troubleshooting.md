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
bun run db:migrate

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

### Randomly named migrations (auto-generated)

Migration files have names like `0003_dizzy_jane_foster.sql` or `0004_workable_titanium_man.sql`.

**Root Cause:** Someone ran `drizzle-kit generate` (FORBIDDEN command).

**Solution:**

1. **Do not commit these files** - They are auto-generated and unsafe
2. **Revert the changes:**

```bash
git checkout -- drizzle/*.sql
```

3. **Create proper migrations manually:**

```bash
bun run db:migration:create --name descriptive_name_here --module core
```

4. **Fix journal if needed:** Edit `drizzle/meta/_journal.json` and remove auto-generated entries

**Prevention:** See [ADR-003: Migration Auto-Generation Ban](../adr/003-migration-auto-generation-ban.md)

**Real example:** `modules/MoLOS-LLM-Council/drizzle/` had 0003 and 0004 auto-generated but never written to disk, creating journal/SQL desync.

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

## Database Initialization Issues

### Migration creation vs application

**Important:** Migrations are NOT auto-generated. Use `bun run db:migration:create` to create new migrations manually.

**Correct Workflow:**

**When developing (making schema changes):**

```bash
# 1. Modify schema in modules/{ModuleName}/src/server/database/schema.ts
# 2. Create NEW migration manually
bun run db:migration:create --name add_feature --module MoLOS-Tasks

# 3. Edit the generated SQL file
# 4. Apply migration
bun run db:migrate
```

**When initializing/updating database:**

```bash
# ONLY applies existing migrations - does NOT generate new ones
bun run db:init

# OR apply pending migrations directly
bun run db:migrate
```

**Key Commands:**
| Operation | Command | Purpose | When to Use |
| ---------------- | ---------------------------------- | ----------------------------- | ------------------------- |
| **Create** | `bun run db:migration:create` | Create new migration manually | After editing schema |
| **Apply** | `bun run db:migrate` | Run existing migrations | Initialize or update DB |
| **Initialize** | `bun run db:init` | First-time DB setup | New setup or fresh install |

---

## AI Agent Issues

### MissingToolResultsError

**Symptom:** Agent fails with `MissingToolResultsError: Tool result is missing for tool call` after tool execution completes successfully.

**Root Cause:** AI SDK uses `tool-call` (hyphen) format in content blocks, but older code checked for `tool_call` (underscore) format. This causes tool results to be incorrectly identified as "orphaned" and dropped.

**Solution:**

1. Ensure `@molos/agent` is updated to support both formats:

   ```typescript
   // hasToolCalls() should check for both:
   block.type === 'tool-call' || block.type === 'tool_call';
   ```

2. If using `MolosLLMProviderClient`, ensure history parsing handles JSON arrays:
   ```typescript
   // When loading history, parse JSON strings to arrays
   if (m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('[')) {
   	parsedContent = JSON.parse(m.content);
   }
   ```

### ZodError: Invalid input - expected object, received string

**Symptom:** `ZodError` at `path: ["output"]` when agent executes tools.

**Root Cause:** The AI SDK's `ToolResultPart.output` schema now requires `{ type: 'json' | 'text', value: any }` format, not raw strings.

**Solution:**

In `MolosLLMProviderClient`, format tool results properly:

```typescript
content = [
	{
		type: 'tool-result',
		toolCallId: msg.toolCallId || '',
		toolName: msg.name || '',
		output: {
			type: typeof resultContent === 'string' ? 'text' : 'json',
			value: resultContent
		}
	}
];
```

### Agent tool progress not showing in UI

**Symptom:** Agent executes tools but UI doesn't show progress or loading animation.

**Root Cause:** Frontend not handling `tool_start`, `tool_delta`, `tool_end` events properly.

**Solution:**

Ensure the frontend handles these event types in `handleStreamEvent`:

```typescript
case 'tool_start':
    // Set progress status to 'executing' with tool name
    currentProgress.status = 'executing';
    currentProgress.currentAction = { type: 'step_start', message: `Executing: ${data.toolName}` };
    break;

case 'tool_delta':
    // Update progress log with truncated args preview
    break;

case 'tool_end':
    // Update log with result or error
    break;
```

---

## Getting Help

1. Check logs: `logs/migrations.log`
2. Run diagnostics: `bun run db:audit-modules && bun run db:validate`
3. Check health endpoint: `/api/health/migrations`
4. Review [Database Architecture](../architecture/database.md)
5. Review [Database Package](../packages/database.md)

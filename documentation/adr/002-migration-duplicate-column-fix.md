# Migration Duplicate Column Error - Fixed

**Date**: 2026-03-03
**Severity**: Medium (caused false failures)
**Status**: ✅ Resolved

## Problem

When running `bun run dev`, the migration runner reported 7 core migration failures:

```
❌ Core: Failed to apply 0001_gifted_terrax.sql: duplicate column name: stream_enabled
❌ Core: Failed to apply 0002_light_rictor.sql: duplicate column name: retry_count
❌ Core: Failed to apply 0003_silky_squirrel_girl.sql: duplicate column name: git_ref
❌ Core: Failed to apply 0005_gray_quasimodo.sql: duplicate column name: webhook_url
❌ Core: Failed to apply 0006_woozy_thunderbolt_ross.sql: duplicate column name: ai_session_id
❌ Core: Failed to apply 0007_peaceful_venom.sql: duplicate column name: connection_mode
❌ Core: Failed to apply 0008_fearless_dakota_north.sql: duplicate column name: polling_interval
```

## Root Cause

### Database Creation Pattern

The database (`data/molos.db`) was created with a **complete schema** instead of being built incrementally through migrations. Evidence:

1. **Columns inline in CREATE TABLE**: Affected tables have columns like `stream_enabled`, `retry_count`, `webhook_url` defined inline
2. **Extra columns**: The `settings_external_modules` table has a `block_updates` column that doesn't exist in any migration file
3. **Timeline**: Database created after the migration runner refactor (March 2, 2026, commit 588e726)

### Error Handling Bug

In `packages/database/src/migrate-improved.ts`, the error handler only checked for "already exists" errors:

```typescript
if (errMsg.includes('already exists')) {
	// Treat as already applied
}
```

But ALTER TABLE failures produce "duplicate column name" errors, which weren't handled.

## Solution

**File Modified**: `packages/database/src/migrate-improved.ts`

**Change**:

```typescript
// Before:
if (errMsg.includes('already exists')) {

// After:
if (errMsg.includes('already exists') || errMsg.includes('duplicate column name')) {
```

This treats "duplicate column name" errors as "already applied" scenarios, allowing migrations to continue without failing.

## Verification

After applying the fix:

```bash
bun run dev
```

**Result**:

- ✅ All 7 previously failing migrations now recognized as "already applied"
- ✅ No migration failures reported
- ✅ Dev server starts successfully
- ✅ All 112 tables present and functional

## Impact

### Before Fix

- 7 migration failures reported (false positives)
- Confusing error messages for developers
- Unclear migration status

### After Fix

- 0 migration failures
- Clear migration status ("already applied")
- Proper migration tracking

## Prevention

To prevent similar issues:

1. **Use migrations for schema changes**: Avoid using `db:push` for production schema changes
2. **Consistent initialization**: Ensure all environments use the same migration-based initialization
3. **Monitor schema integrity**: Run `bun run db:validate` to detect schema drift
4. **Document schema changes**: Keep migration files in sync with schema evolution

## Related

- [ADR-001: Migration Tracking Strategy](./001-migration-tracking-strategy.md)
- [Database Architecture](./architecture/database.md)
- [Troubleshooting - Database Issues](../getting-started/troubleshooting.md#database-table-not-found)

---

_Last Updated: 2026-03-03_

# Database Migration Fix - Complete ✅

## Problem

Tests were failing with the error:

```
RangeError: The supplied SQL string contains no statements
```

This occurred because some migration files had comment-only sections after the last `--> statement-breakpoint` marker, which Drizzle ORM tried to execute as empty SQL statements.

## Root Cause

Drizzle's migration runner splits migration files on `--> statement-breakpoint` markers and executes each section as a separate SQL statement. When a file ends with:

```sql
ALTER TABLE some_table ADD COLUMN some_column TEXT;

--> statement-breakpoint

-- This is just a comment
-- With no actual SQL
```

Drizzle tries to execute the last section (which is only comments) as a SQL statement, causing the error because better-sqlite3 requires actual SQL statements.

## Files Fixed

### 1. `drizzle/0016_add_submodule_tool_permissions.sql`

**Before:**

```sql
-- Step 5: Add promptName column to ai_mcp_prompts
ALTER TABLE ai_mcp_prompts ADD COLUMN prompt_name TEXT;

--> statement-breakpoint

-- Note: This is a breaking change. Old API keys with module-level
-- permissions will need to be updated to use the new scope format.
-- New format: "module", "module:submodule", or "module:submodule:tool"
```

**After:**

```sql
-- Step 5: Add promptName column to ai_mcp_prompts
ALTER TABLE ai_mcp_prompts ADD COLUMN prompt_name TEXT;

-- Note: This is a breaking change. Old API keys with module-level
-- permissions will need to be updated to use the new scope format.
-- New format: "module", "module:submodule", or "module:submodule:tool"
```

### 2. `drizzle/0017_add_migration_tracking.sql`

**Before:**

```sql
INSERT INTO molos_migrations (...)
SELECT ... FROM __drizzle_migrations
WHERE NOT EXISTS (...);

--> statement-breakpoint

-- Note: We keep __drizzle_migrations for backward compatibility during transition
-- It will be deprecated in a future version
```

**After:**

```sql
-- Migrate existing data from __drizzle_migrations
-- Note: We can't calculate checksums retroactively, so we'll mark them as 'unknown'
-- Note: We keep __drizzle_migrations for backward compatibility during transition
-- It will be deprecated in a future version
INSERT INTO molos_migrations (...)
SELECT ... FROM __drizzle_migrations
WHERE NOT EXISTS (...);
```

## Solution

The fix was to remove the trailing `--> statement-breakpoint` markers after the last actual SQL statement and integrate the comments into the preceding statement block. This ensures Drizzle doesn't try to execute empty statements.

## Verification

### Before Fix

```
❯ server tests/core/database-connection.test.ts (17 tests | 6 failed)
❯ server tests/core/base-repository.test.ts (8 tests | 7 failed)
❯ server tests/core/settings-repository-extended.test.ts (18 tests | 18 failed)

Test Files  3 failed | 2 passed (5)
Tests       31 failed | 59 passed (90)
```

### After Fix

```
✓ server tests/core/module-config-types.test.ts (26 tests) 29ms
✓ server tests/core/database-connection.test.ts (17 tests) 248ms
✓ server tests/core/base-repository.test.ts (8 tests) 187ms
✓ server tests/core/settings-repository-extended.test.ts (18 tests) 432ms
✓ server tests/core/module-registry.test.ts (21 tests) 21ms

Test Files  5 passed (5)
Tests       90 passed (90)
```

## Best Practices for Future Migrations

### ✅ DO:

```sql
-- Good: Comment integrated with statement
-- Note: This is a breaking change
ALTER TABLE some_table ADD COLUMN some_column TEXT;

--> statement-breakpoint

-- Next statement
CREATE INDEX idx_some_column ON some_table(some_column);
```

### ❌ DON'T:

```sql
-- Bad: Trailing comment-only section
ALTER TABLE some_table ADD COLUMN some_column TEXT;

--> statement-breakpoint

-- This will cause an error because it's only comments
-- With no SQL statement
```

## Guidelines

1. **Never end migration files with `--> statement-breakpoint`** followed by only comments
2. **Place explanatory comments** before the SQL statement they describe
3. **Keep comments and their related SQL** in the same statement block
4. **Test migrations** with `bun run db:migrate:improved` before committing

## Impact

- ✅ All 90 core tests now pass
- ✅ Database migrations work correctly
- ✅ Test suite is fully functional
- ✅ CI/CD pipeline will work correctly

## Related

- [Comprehensive Test Suite Documentation](./documentation/getting-started/testing-comprehensive.md)
- [Test Implementation Report](./TESTING_IMPLEMENTATION_REPORT.md)

---

_Fixed: 2026-03-06_

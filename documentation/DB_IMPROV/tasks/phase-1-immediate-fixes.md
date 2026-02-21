# Phase 1: Immediate Fixes

> **Priority**: P0 (Critical)
> **Duration**: 2-3 days
> **Dependencies**: None
> **Status**: Not Started

---

## Overview

Critical fixes that must be applied before any other work. These address safety and correctness issues that could cause data loss or silent failures.

---

## Task 1.1: Assess Migration 0015 (Data Migration)

**Status**: Not Started
**Priority**: P0
**Estimated Time**: 2-4 hours

### Description

Migration 0015 (`cleanup_duplicate_ai_messages.sql`) is a **data migration** containing DELETE statements. Before adding it to the journal, we must verify it's safe to run.

### Steps

1. **Run diagnostic query** to check if duplicates exist:

   ```sql
   SELECT
       session_id,
       json_extract(context_metadata, '$.segmentId') as segment_id,
       COUNT(*) as duplicate_count
   FROM ai_messages
   WHERE context_metadata IS NOT NULL
     AND json_extract(context_metadata, '$.segmentId') IS NOT NULL
   GROUP BY session_id, segment_id
   HAVING duplicate_count > 1;
   ```

2. **If duplicates exist**:
   - [ ] Document the count of affected rows
   - [ ] Create database backup
   - [ ] Test migration on a copy of the database
   - [ ] Verify expected rows are deleted

3. **If no duplicates**:
   - [ ] Decide if migration is still needed
   - [ ] Consider removing the migration file instead of applying it

4. **If proceeding**:
   - [ ] Add migration to journal:
     ```json
     {
       "idx": 15,
       "version": "7",
       "when": <current_timestamp>,
       "tag": "0015_cleanup_duplicate_ai_messages",
       "breakpoints": true
     }
     ```
   - [ ] Run `bun run db:migrate`
   - [ ] Verify migration was applied

### Files to Modify

- `drizzle/meta/_journal.json` (add entry)
- Optional: `drizzle/0015_cleanup_duplicate_ai_messages.sql` (if removing)

### Verification

- [ ] Query confirms expected state after migration
- [ ] `__drizzle_migrations` table shows 0015 as applied
- [ ] No errors in migration log

### Risks

- **Data loss**: DELETE is irreversible
- **Mitigation**: Full database backup before applying

---

## Task 1.2: Fix Module Migration Error Handling

**Status**: Not Started
**Priority**: P0
**Estimated Time**: 1-2 hours

### Description

Module migration failures are currently treated as "non-critical" and only warn. This must be changed to fail fast and halt execution.

### Current Code (lines 114-119)

```typescript
} catch (error) {
    // Module migrations are less critical, warn but continue
    console.warn('[DB:init] Some module migrations failed (non-critical):', error);
    // Still try to apply missing migrations
    verifyAndApplyMissingMigrations();
}
```

### Required Changes

```typescript
} catch (error) {
    console.error('[DB:init] MODULE MIGRATIONS FAILED - Halting initialization.');
    console.error('[DB:init] Error:', error);
    console.error('[DB:init] Fix the failing migration and try again.');
    process.exit(1);
}
```

### Files to Modify

- `scripts/init-database.ts` (lines 114-119)

### Verification

- [ ] Intentionally corrupt a module migration
- [ ] Run `bun run db:init`
- [ ] Verify it exits with error code 1
- [ ] Verify error message is clear

---

## Task 1.3: Add Pre-Migration Backup

**Status**: Not Started
**Priority**: P0
**Estimated Time**: 2-3 hours

### Description

Add automatic SQLite database backup before any migration operations.

### Implementation

1. **Add backup function** to `scripts/init-database.ts`:

```typescript
import { copyFileSync, existsSync } from 'fs';

/**
 * Create a timestamped backup of the database file
 * @returns Path to backup file, or null if no database exists
 */
function backupDatabase(dbPath: string): string | null {
	if (!existsSync(dbPath)) {
		return null;
	}

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS

	const backupPath = `${dbPath}.backup-${timestamp}`;

	copyFileSync(dbPath, backupPath);
	console.log(`[DB:init] Database backed up to: ${backupPath}`);

	return backupPath;
}
```

2. **Call backup before migrations**:

```typescript
async function main() {
	// ... existing code ...

	// Backup existing database before any operations
	const backupPath = backupDatabase(dbPath);
	if (backupPath) {
		console.log(`[DB:init] Backup created at: ${backupPath}`);
	}

	// ... continue with migrations ...
}
```

3. **Add restore capability**:

```typescript
/**
 * Restore database from a backup file
 */
function restoreDatabase(backupPath: string, dbPath: string): void {
	if (!existsSync(backupPath)) {
		throw new Error(`Backup not found: ${backupPath}`);
	}
	copyFileSync(backupPath, dbPath);
	console.log(`[DB:init] Database restored from: ${backupPath}`);
}
```

### Files to Modify

- `scripts/init-database.ts`

### Verification

- [ ] Run `bun run db:init` with existing database
- [ ] Verify backup file is created with timestamp
- [ ] Verify backup contains same data as original
- [ ] Test restore function manually

### Cleanup Consideration

Add note about cleaning up old backups (or add `maxBackups` parameter).

---

## Task 1.4: Remove Bypass Mechanism (Optional)

**Status**: Not Started
**Priority**: P1
**Estimated Time**: 2-3 hours

### Description

The `verifyAndApplyMissingMigrations()` function bypasses Drizzle's tracking. Consider removing it or converting to diagnostic-only mode.

### Options

**Option A**: Remove entirely

- Pros: Simpler code, single source of truth
- Cons: May break existing databases that rely on bypass

**Option B**: Convert to diagnostic-only

- Pros: Still detects issues, doesn't silently fix
- Cons: Requires manual intervention

**Option C**: Keep but track properly

- Pros: Maintains current behavior
- Cons: More complex, still bypasses normal flow

### Recommendation

**Option B** - Convert to diagnostic that reports issues but doesn't auto-apply:

```typescript
function diagnoseMissingMigrations(): { module: string; missingTables: string[] }[] {
	// ... check for missing tables ...
	// Return report instead of auto-applying
}
```

### Decision Required

- [ ] Choose option (A, B, or C)
- [ ] Implement chosen option
- [ ] Update documentation

---

## Phase 1 Completion Checklist

- [ ] Task 1.1: Migration 0015 assessed and handled
- [ ] Task 1.2: Module migration failures halt execution
- [ ] Task 1.3: Pre-migration backup implemented
- [ ] Task 1.4: Bypass mechanism decision made and implemented
- [ ] All changes tested manually
- [ ] Documentation updated

---

## Notes

- Phase 1 can be deployed independently of other phases
- These are the minimum changes needed for production safety
- Consider creating a beads issue for tracking

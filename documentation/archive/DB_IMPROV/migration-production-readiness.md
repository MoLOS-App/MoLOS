# Migration System Production Readiness Plan

> **Status**: All Phases Completed
> **Last Updated**: 2026-02-23
> **Architect Review**: Completed - see recommendations below

---

## Executive Summary

The MoLOS project has a fragmented migration system with multiple critical issues that make it unsuitable for production deployment. This plan addresses the pain points and provides a roadmap to production readiness.

**Key Finding**: Migration 0015 is a **data migration** (DELETE statement), not a DDL migration. This is destructive and irreversible - it requires special handling before being added to the journal.

---

## Current State Analysis

### Architecture Overview

```
drizzle/                    # Core migrations (0015 EXISTS but NOT applied)
  ├── *.sql                # Migration files
  └── meta/
      └── _journal.json    # Only tracks up to 0014 (0015 is MISSING)

modules/MoLOS-*/drizzle/    # Per-module migrations (11 modules have these)
scripts/init-database.ts    # Initialization with fallback bypass
module-management/server/migration-manager.ts  # Module migration tracking

# Dual tracking systems:
__drizzle_migrations        # Drizzle's native tracking (core)
coreModuleMigrations        # Custom tracking table (modules)
```

### Modules with Migrations (11 total)

| Module              | Has Drizzle Dir | Risk Level |
| ------------------- | --------------- | ---------- |
| MoLOS-Tasks         | ✅              | Low        |
| MoLOS-Goals         | ✅              | Low        |
| MoLOS-Finance       | ✅              | Medium     |
| MoLOS-Health        | ✅              | Low        |
| MoLOS-Meals         | ✅              | Low        |
| MoLOS-Google        | ✅              | Medium     |
| MoLOS-AI-Knowledge  | ✅              | Medium     |
| MoLOS-Markdown      | ✅              | Low        |
| MoLOS-LLM-Council   | ✅              | Low        |
| MoLOS-Product-Owner | ✅              | Low        |
| MoLOS-Sample-Module | ✅              | Reference  |

### Critical Issues Identified

#### 1. **Journal/Migration Desync** (P0 - URGENT)

- **File**: `drizzle/0015_cleanup_duplicate_ai_messages.sql` exists but is NOT in `_journal.json`
- The journal only tracks migrations up to `0014_cute_rictor`
- **⚠️ CRITICAL**: Migration 0015 is a DATA MIGRATION with DELETE statements (lines 7-18)
- **Impact**: This migration is DESTRUCTIVE and IRREVERSIBLE
- **Required Action**:
  1. Backup database before applying
  2. Verify duplicates actually exist and need cleanup
  3. Only then add to journal

#### 2. **Silent Failures for Module Migrations** (P0)

- **Location**: `scripts/init-database.ts:114-119`
- Module migrations are marked "non-critical" - failures only warn, don't halt
- **Impact**: Incomplete database state can go undetected
- **Required Action**: Remove non-critical designation, fail fast

#### 3. **Bypass Mechanism Undermines Integrity** (P1)

- **Location**: `scripts/init-database.ts:175-254` - `verifyAndApplyMissingMigrations()`
- Direct SQL execution bypasses Drizzle's tracking entirely
- Creates database in `__drizzle_migrations` but not via proper migration
- **Impact**: Database can diverge from tracked state, checksums won't match

#### 4. **Dual Migration Tracking Confusion** (P1)

- Drizzle native: `__drizzle_migrations` table
- Custom: `coreModuleMigrations` table (migration-manager.ts)
- These are independent and can get out of sync
- **Impact**: Two sources of truth for migration state

#### 5. **No Transaction Support** (P1)

- **Location**: `packages/database/src/migrate.ts`
- Uses Drizzle's `migrate()` which doesn't wrap each migration in a transaction
- **Impact**: Partial migration states on failure

#### 6. **Limited Rollback Capability** (P2)

- **Location**: `module-management/server/migration-manager.ts:38-58`
- Only handles CREATE TABLE/INDEX, not ALTER TABLE or data transformations
- **Impact**: Cannot safely rollback complex migrations

#### 7. **MD5 Checksum Collision Risk** (P2)

- **Location**: `module-management/server/migration-manager.ts:64`
- MD5 is deprecated for security/collision resistance
- **Impact**: Potential false positives in migration verification

#### 8. **No Schema Validation After Migration** (P2)

- System tracks applied migrations but doesn't verify schema matches expectations
- **Impact**: Silent schema drift possible

#### 9. **No SQLite Backup Strategy** (P1 - NEW)

- SQLite is a single file - backup is trivial
- No automated backup before migrations
- **Impact**: Data loss risk in production

---

## Proposed Solution

### Phase 1: Immediate Fixes (P0 - Do First)

#### 1.1 Assess Migration 0015 Before Applying

**⚠️ DO NOT blindly add to journal - this is a destructive data migration**

**Steps**:

1. Run diagnostic query to check if duplicates exist:
   ```sql
   SELECT session_id, json_extract(context_metadata, '$.segmentId') as segment_id, COUNT(*) as cnt
   FROM ai_messages
   WHERE context_metadata IS NOT NULL
     AND json_extract(context_metadata, '$.segmentId') IS NOT NULL
   GROUP BY session_id, segment_id
   HAVING cnt > 1;
   ```
2. If duplicates exist: backup database, then add to journal
3. If no duplicates: consider if migration is still needed or should be removed

**Files**:

- `drizzle/0015_cleanup_duplicate_ai_messages.sql`
- `drizzle/meta/_journal.json`

#### 1.2 Fix Module Migration Error Handling

**File**: `scripts/init-database.ts`

**Changes**:

```typescript
// BEFORE (line 114-119):
} catch (error) {
    console.warn('[DB:init] Some module migrations failed (non-critical):', error);
    verifyAndApplyMissingMigrations();
}

// AFTER:
} catch (error) {
    console.error('[DB:init] Module migrations FAILED. Halting initialization.');
    console.error('[DB:init] Error:', error);
    process.exit(1);
}
```

**Why**: Silent failures lead to undetectable partial states.

#### 1.3 Add Pre-Migration Backup for SQLite

**File**: `scripts/init-database.ts` (new function)

**Implementation**:

```typescript
function backupDatabase(dbPath: string): string | null {
	if (!existsSync(dbPath)) return null;

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupPath = `${dbPath}.backup-${timestamp}`;

	copyFileSync(dbPath, backupPath);
	console.log(`[DB:init] Database backed up to: ${backupPath}`);

	return backupPath;
}
```

**Call before any migration operations**.

### Phase 2: Core Migration System Improvements (P1)

#### 2.1 Unify Migration Execution Paths

**Files**:

- `scripts/init-database.ts`
- `packages/database/src/migrate.ts`

**Action**: Create single migration runner that:

1. Backs up database first
2. Runs core migrations
3. Runs module migrations
4. Validates schema
5. Reports unified status

#### 2.2 Transaction Support for Migrations

**File**: `packages/database/src/migrate.ts`

**Implementation** (SQLite-specific):

```typescript
import Database from 'better-sqlite3';

function runMigrationWithTransaction(db: Database.Database, sql: string): void {
	const transaction = db.transaction(() => {
		db.exec(sql);
	});
	transaction();
}
```

Note: SQLite supports DDL in transactions, but some operations may still be partially applied on error.

#### 2.3 Clarify Dual Tracking Strategy

**Decision Required**: Should we:

- A) Use only `__drizzle_migrations` (Drizzle native)
- B) Use only `coreModuleMigrations` (custom)
- C) Keep both but synchronize them

**Recommendation**: Option A for simplicity - let Drizzle handle all tracking.

#### 2.4 Remove or Fix Bypass Mechanism

**File**: `scripts/init-database.ts:175-254`

**Options**:

1. **Remove entirely** - if Drizzle migrations work correctly, this is unnecessary
2. **Make it diagnostic only** - detect missing tables but don't auto-apply
3. **Keep but track** - record in `__drizzle_migrations` when bypass is used

**Recommendation**: Option 2 - make it a warning system, not an auto-fix.

### Phase 3: Module Migration Hardening (P1)

#### 3.1 Audit All Module Migrations

**Action**: For each of the 11 modules with drizzle directories:

1. Verify journal files are in sync
2. Check for orphaned migrations
3. Validate table prefixes match module ID

**Files to check**:

- `modules/*/drizzle/meta/_journal.json`
- `modules/*/drizzle/*.sql`

#### 3.2 Module Migration Validation Script

**New File**: `scripts/validate-module-migrations.ts`

**Features**:

- Check journal sync for all modules
- Verify table prefixes
- Report inconsistencies

#### 3.3 Enhance Rollback System

**File**: `module-management/server/migration-manager.ts`

**Improvements**:

- Support ALTER TABLE rollback (store original column definitions)
- Add manual rollback file support (`down.sql` pattern)
- Store pre-migration data snapshot for data migrations

### Phase 4: Observability & Safety (P2)

#### 4.1 Migration Health Endpoint

**New endpoint**: `/api/admin/migrations/health`

**Returns**:

```json
{
  "core": {
    "pending": ["0015_cleanup_duplicate_ai_messages"],
    "applied": [...],
    "lastApplied": "2026-02-14T..."
  },
  "modules": {
    "MoLOS-Tasks": { "pending": [], "applied": [...] },
    ...
  },
  "drift": [],
  "backupExists": true
}
```

#### 4.2 Replace MD5 with SHA256

**File**: `module-management/server/migration-manager.ts:64`

```typescript
// BEFORE
return crypto.createHash('md5').update(sql).digest('hex');

// AFTER
return crypto.createHash('sha256').update(sql).digest('hex');
```

#### 4.3 Structured Logging

**Implementation**:

- Log all migration operations to `migrations.log`
- Include: timestamp, migration name, duration, success/failure, checksum

### Phase 5: Testing & CI/CD (P2)

#### 5.1 Migration Test Suite

**New**: `tests/migrations/`

**Tests**:

```
tests/migrations/
├── core-migrations.test.ts    # Fresh DB migration, schema validation
├── module-migrations.test.ts  # Per-module migration tests
├── rollback.test.ts           # Rollback functionality
└── utils.ts                   # Test helpers
```

#### 5.2 CI Migration Validation

**Add to `.github/workflows/test.yml`**:

```yaml
- name: Validate migrations
  run: bun run db:validate-migrations

- name: Test fresh database init
  run: |
    rm -f molos.db
    bun run db:init
    bun run db:validate
```

---

## Implementation Tasks

Tasks are tracked in separate files:

- `documentation/DB_IMPROV/tasks/phase-1-immediate-fixes.md`
- `documentation/DB_IMPROV/tasks/phase-2-core-improvements.md`
- `documentation/DB_IMPROV/tasks/phase-3-module-hardening.md`
- `documentation/DB_IMPROV/tasks/phase-4-observability.md`
- `documentation/DB_IMPROV/tasks/phase-5-testing.md`

---

## Risk Register

| Risk                               | Likelihood | Impact   | Mitigation                          |
| ---------------------------------- | ---------- | -------- | ----------------------------------- |
| Migration 0015 deletes needed data | Medium     | High     | Run diagnostic first, backup DB     |
| Module migrations fail silently    | High       | Medium   | Fix in Phase 1.2                    |
| Dual tracking causes confusion     | Medium     | Medium   | Clarify strategy in Phase 2.3       |
| Production DB corruption           | Low        | Critical | Mandatory backups before migrations |
| Breaking existing deployments      | Medium     | High     | Test on copy of production DB first |

---

## Verification Checklist

### Before Each Migration:

- [ ] Database backed up
- [ ] Migration reviewed for destructive operations
- [ ] Rollback plan exists

### After Implementation:

- [ ] All migrations tracked in journal
- [ ] No silent failures - all errors halt execution
- [ ] Schema validation passes
- [ ] Pre-migration backups created automatically
- [ ] CI/CD prevents broken migrations from merging

---

## Timeline Estimate (Revised)

| Phase                      | Duration | Status      |
| -------------------------- | -------- | ----------- |
| Phase 1: Immediate Fixes   | 2-3 days | ✅ Complete |
| Phase 2: Core Improvements | 3-5 days | ✅ Complete |
| Phase 3: Module Hardening  | 3-4 days | ✅ Complete |
| Phase 4: Observability     | 2-3 days | ✅ Complete |
| Phase 5: Testing & CI      | 2-3 days | ✅ Complete |

**Actual**: ~12-18 days total for full production readiness

---

## Success Criteria

- [x] Migration 0015 assessed and handled appropriately
- [x] No silent failures - all errors halt execution
- [x] Database backed up before any migration
- [x] All module migrations validated
- [x] Single source of truth for migration tracking (ADR-001 created)
- [x] CI/CD prevents broken migrations from merging
- [x] Migration health endpoint operational
- [x] SHA256 checksums in use

---

## Architecture Decision Records

1. **ADR-001**: ✅ Created - Migration Tracking Strategy (Drizzle native selected)
   - See: `documentation/adr/001-migration-tracking-strategy.md`
2. **ADR-002**: Pending - Data Migration Handling Policy
3. **ADR-003**: Pending - Module Migration Isolation Requirements
4. **ADR-004**: Pending - Production Migration Rollback Procedure

---

## Open Questions

1. Should migration 0015 be applied to existing production databases or only fresh ones?
2. What is the expected downtime window for production migrations?
3. Should we support zero-downtime migrations for future changes?
4. How should we handle module version compatibility with core schema versions?

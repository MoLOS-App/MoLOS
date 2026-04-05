# Database Package Consolidation Plan

> **Status**: Complete ✅
> **Priority**: Medium
> **Estimated Effort**: 2-3 hours
> **Created**: 2026-03-09
> **Completed**: 2026-03-11

---

## Executive Summary

Consolidate all database schemas and utilities from `src/lib/server/db/schema/` into the `@molos/database` package to eliminate duplication, improve architecture, and establish a single source of truth.

---

## Current State

### Duplication Exists

#### OLD Location (still in use):

- `src/lib/server/db/schema/ai-schema.ts` (436 lines)
- `src/lib/server/db/schema/auth-schema.ts`
- `src/lib/server/db/schema/settings/`
- **~20+ files** importing from `$lib/server/db/schema`

#### NEW Location (more complete):

- `packages/database/src/schema/core/ai.ts` (462 lines, includes type exports)
- `packages/database/src/schema/core/auth.ts`
- `packages/database/src/schema/core/settings.ts`
- `packages/database/src/connection.ts`
- `packages/database/src/migrate-improved.ts`
- **Only 3 files** importing from `@molos/database`

### Problem

- Schemas exist in two places
- Different versions (new package has more type exports)
- Confusing for developers
- Risk of drift between locations
- Incomplete migration

---

## Why Keep `packages/database/`

### Benefits

#### 1. Better Architecture

```
packages/database/          ← Single source of truth
├── src/
│   ├── schema/core/       ← All schema definitions
│   ├── connection.ts      ← Database connection logic
│   ├── migrate-improved.ts ← Migration runner
│   ├── schema-validator.ts
│   ├── migration-logger.ts
│   └── utils/             ← Database utilities
```

#### 2. Separation of Concerns

- **Database logic** → Isolated in `@molos/database` package
- **Application logic** → Stays in `src/`
- **Module logic** → In `modules/`

#### 3. Type Safety & Clean Exports

```typescript
// Package exports
export { db, schema } from '@molos/database';
export * from '@molos/database/schema/core';
export type { AISettings, AIMessage } from '@molos/database';
```

#### 4. Reusability

- Can be used by multiple apps in the monorepo
- External modules can import from `@molos/database`
- Easier to test in isolation

#### 5. Already in Progress

The migration to `packages/database` is already started and the package is **more complete** than the old location.

---

## Migration Plan

### Phase 1: Update All Imports

**Goal**: Replace all `$lib/server/db/schema` imports with `@molos/database`

**Steps**:

1. **Find all old imports**

```bash
grep -r "from.*db/schema" src/ --include="*.ts" --include="*.svelte"
```

2. **Update import statements**

| Old Import                                 | New Import                                |
| ------------------------------------------ | ----------------------------------------- |
| `from '$lib/server/db/schema'`             | `from '@molos/database/schema'`           |
| `from '$lib/server/db/schema/ai-schema'`   | `from '@molos/database/schema/core/ai'`   |
| `from '$lib/server/db/schema/auth-schema'` | `from '@molos/database/schema/core/auth'` |

3. **Affected files** (estimated 20-30 files):
   - `src/routes/api/search/+server.ts`
   - `src/routes/api/ai/mcp/**/*.ts`
   - `src/routes/ui/(modules)/ai/**/*.ts`
   - `src/lib/server/auth.ts`
   - `src/lib/server/ai/**/*.ts`
   - `src/lib/repositories/**/*.ts`

4. **Run tests**

```bash
npm run test
npm run check
```

**Validation**:

- All imports resolve correctly
- No TypeScript errors
- All tests pass

---

### Phase 2: Remove Old Schemas

**Goal**: Clean up duplicated schema files

**Steps**:

1. **Verify all imports updated**

```bash
grep -r "from.*db/schema" src/ --include="*.ts"
# Should return 0 results
```

2. **Remove old schema directory**

```bash
rm -rf src/lib/server/db/schema/
```

3. **Update re-exports**

```typescript
// src/lib/server/db/index.ts
/**
 * Re-export from @molos/database package
 * This provides backward compatibility and convenience
 */
export * from '@molos/database';
export * from '@molos/database/schema';
```

4. **Remove old files**:
   - `src/lib/server/db/schema/ai-schema.ts`
   - `src/lib/server/db/schema/auth-schema.ts`
   - `src/lib/server/db/schema/settings/`
   - `src/lib/server/db/schema/index.ts`

**Validation**:

- Application still builds
- Database migrations still work
- All routes function correctly

---

### Phase 3: Update Documentation

**Goal**: Document the new structure

**Files to update**:

1. **AI-CONTEXT.md**
   - Update database schema locations
   - Update import patterns

2. **packages/database/README.md** (create if needed)
   - Document package purpose
   - Document exports
   - Document usage examples

3. **architecture/database.md** (if exists)
   - Update architecture diagrams
   - Document package structure

---

## Testing Checklist

### Before Migration

- [ ] Run full test suite: `npm run test`
- [ ] Check TypeScript: `npm run check`
- [ ] Build application: `npm run build`
- [ ] Verify database migrations: `npm run db:migrate`

### After Phase 1 (Import Updates)

- [ ] All imports resolve correctly
- [ ] No TypeScript errors
- [ ] Application builds successfully
- [ ] All tests pass
- [ ] Dev server starts without errors

### After Phase 2 (Schema Removal)

- [ ] No old schema files remain
- [ ] Re-exports work correctly
- [ ] Application runs in dev mode
- [ ] Database operations work
- [ ] Module system still functions

### After Phase 3 (Documentation)

- [ ] All docs updated
- [ ] Examples use new imports
- [ ] No references to old location

---

## Risk Assessment

| Risk                         | Severity | Mitigation                                         |
| ---------------------------- | -------- | -------------------------------------------------- |
| Import resolution fails      | Medium   | Test incrementally, keep old files until validated |
| Type errors                  | Low      | Package has better types, should improve           |
| Breaking changes for modules | Low      | Modules use their own schemas                      |
| Migration drift              | Low      | Package is already more complete                   |

---

## Rollback Plan

If issues arise:

1. **Revert import changes**

```bash
git checkout -- src/
```

2. **Restore old schemas** (if deleted)

```bash
git checkout -- src/lib/server/db/schema/
```

3. **Investigate issues**
   - Check import paths
   - Verify package exports
   - Review TypeScript errors

---

## Timeline

| Phase                   | Duration      | Dependencies     |
| ----------------------- | ------------- | ---------------- |
| Phase 1: Import Updates | 1-2 hours     | None             |
| Phase 2: Schema Removal | 30 min        | Phase 1 complete |
| Phase 3: Documentation  | 30 min        | Phase 2 complete |
| **Total**               | **2-3 hours** |                  |

---

## Success Criteria

- [x] Single source of truth for database schemas
- [x] All imports use `@molos/database`
- [x] No duplicate schema files
- [x] All tests pass
- [x] Documentation updated
- [x] Application builds and runs correctly
- [x] Module system unaffected

---

## Final Structure

After consolidation, the database layer is now fully centralized:

```
packages/database/
├── src/
│   ├── schema/
│   │   ├── core/           # Core tables (user, session, settings, ai)
│   │   │   ├── ai.ts       # AI-related tables
│   │   │   ├── auth.ts     # Authentication tables
│   │   │   └── settings.ts # Settings tables
│   │   └── external/       # External module tables (namespaced)
│   ├── connection.ts       # Database connection (db, sqlite exports)
│   ├── migrate-improved.ts  # Production migration runner (core + modules)
│   ├── schema-validator.ts # Schema validation utility
│   ├── migration-logger.ts # Structured logging
│   └── index.ts            # Main exports
├── drizzle/                # Core migrations (consolidated here)
│   ├── 0000_condemned_ultron.sql
│   ├── 0001_gifted_terrax.sql
│   ├── ...
│   └── meta/
│       └── _journal.json
├── drizzle.config.ts       # Canonical Drizzle config
└── package.json
```

### Key Changes Made

1. **Migrations consolidated**: `drizzle/` → `packages/database/drizzle/`
2. **Schema consolidated**: `src/lib/server/db/schema/` → `packages/database/src/schema/`
3. **Config consolidated**: Root `drizzle.config.ts` deleted, `packages/database/drizzle.config.ts` is canonical
4. **Imports unified**: All schema imports use `@molos/database/schema`
5. **Old schema directory removed**: `src/lib/server/db/schema/` deleted

### Import Pattern (Final)

```typescript
// ✅ Correct - Import from package
import { db } from '@molos/database';
import { users, sessions } from '@molos/database/schema';
import { aiSettings } from '@molos/database/schema/core/ai';

// ❌ Wrong - Old location (no longer exists)
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
```

---

## Commands Reference

```bash
# Find old imports
grep -r "from.*db/schema" src/ --include="*.ts" --include="*.svelte"

# Update imports (example with sed)
find src/ -name "*.ts" -exec sed -i "s|from '\$lib/server/db/schema'|from '@molos/database/schema'|g" {} \;

# Run tests
npm run test
npm run check

# Build
npm run build

# Clean old schemas (after validation)
rm -rf src/lib/server/db/schema/

# Verify package exports
cat packages/database/package.json | grep -A 20 "exports"
```

---

## Notes

- The `@molos/database` package is **already more complete** than the old location
- It includes proper type exports (`export type AISettings = ...`)
- It has migration utilities, validators, and logging
- The old location only exists because migration was incomplete
- This is a cleanup task, not a redesign

---

## Related Documentation

- [Database Architecture](../architecture/database.md)
- [AI Context Reference](../AI-CONTEXT.md)
- [Quick Reference](../QUICK-REFERENCE.md)
- [Module Development](../modules/development.md)

---

_Last Updated: 2026-03-11_

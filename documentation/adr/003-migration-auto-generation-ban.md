# Migration Auto-Generation Ban

**Date**: 2026-03-16
**Status**: ✅ Enforced
**Type**: Security/Safety

## Problem

Developers were running `drizzle-kit generate` to auto-create database migrations, which caused multiple serious issues:

### 1. Journal/SQL Desync

Auto-generation creates journal entries before writing SQL files. If the process fails, you get:

- Journal references non-existent migrations
- Migration runner fails trying to apply missing files
- Inconsistent database state

**Real example:** `modules/MoLOS-LLM-Council/drizzle/` has journal entries for `0003_dizzy_jane_foster.sql` and `0004_workable_titanium_man.sql`, but these files were never written to disk.

### 2. Random Migration Names

DrizzleKit generates random names like:

- `0003_dizzy_jane_foster.sql`
- `0004_workable_titanium_man.sql`
- `0005_dear_christian_walker.sql`

These names provide zero context about what the migration does, making debugging and maintenance impossible.

### 3. Naming Convention Violations

Auto-generation cannot enforce MoLOS naming conventions:

- Doesn't check `MoLOS-{Name}_{table}` table prefixes
- Doesn't validate core vs external module tables
- Creates migrations that violate module isolation rules

### 4. Loss of Manual Migrations

When auto-generating, DrizzleKit:

- Overwrites existing manual migrations
- Destroys carefully crafted rollback scripts
- Loses migration descriptions and dependencies
- Cannot detect that manual changes should be preserved

## Solution

**Ban `drizzle-kit generate` and `bun run db:generate` completely.**

### Implementation

1. **Removed from package.json**:

```json
// REMOVED - Do not restore
"db:generate": "drizzle-kit generate"
```

2. **Enforced in agent documentation**:
   - Database Specialist agent explicitly forbidden from running `drizzle-kit generate`
   - Module Specialist agent must use `db:migration:create`
   - Planner agent must never suggest auto-generation

3. **Documentation updated**:
   - Database.md includes critical safety warning
   - Module Development Guide enforces manual migration creation
   - ADR created documenting the ban

## Correct Migration Workflow

```bash
# 1. Edit schema file
# Edit src/server/database/schema.ts

# 2. Create migration manually
bun run db:migration:create --name descriptive_name_here --module core --reversible

# 3. Validate
bun run db:validate

# 4. Apply
bun run db:migrate:improved
```

### Migration File Structure

```sql
-- Migration: descriptive_name_here
-- Module: core
-- Created: 2026-03-16
-- Description: Add user preferences table

CREATE TABLE user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light' NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')) NOT NULL
);

--> statement-breakpoint

CREATE INDEX idx_user_preferences_theme ON user_preferences(theme);
```

## Enforcement

### Code Review Checklist

- [ ] Migration file uses descriptive name (not auto-generated)
- [ ] Migration manually created with `db:migration:create`
- [ ] No `drizzle-kit generate` or `db:generate` commands used
- [ ] Table naming follows conventions (`MoLOS-{Name}_{table}`)
- [ ] Journal entries match actual SQL files
- [ ] Migration validates with `db:validate`

### Automated Validation

The `bun run db:audit-modules` command checks for:

- Journal/SQL desync issues
- Randomly named migrations (auto-generated)
- Missing table prefixes
- Inconsistent migration numbering

## Related

- [ADR-001: Migration Tracking Strategy](./001-migration-tracking-strategy.md)
- [ADR-002: Migration Duplicate Column Fix](./002-migration-duplicate-column-fix.md)
- [Database Architecture](../architecture/database.md)
- [Migration System Overview](../archive/DB_IMPROV/IMPLEMENTATION_COMPLETE.md)
- [Real-world example](../../modules/MoLOS-LLM-Council/drizzle/)

---

_Last Updated: 2026-03-16_

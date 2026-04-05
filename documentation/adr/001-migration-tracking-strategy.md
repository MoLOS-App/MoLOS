# ADR-001: Migration Tracking Strategy

| Status    | Accepted         |
| --------- | ---------------- |
| Date      | 2026-02-21       |
| Deciders  | Development Team |
| Review By | 2026-03-21       |

## Context

MoLOS currently uses **two separate migration tracking systems**:

1. **Drizzle Native**: `__drizzle_migrations` table
   - Managed by drizzle-orm's built-in migrator
   - Stores: `id`, `hash`, `created_at`
   - Used by: `drizzle-orm/better-sqlite3/migrator`

2. **Custom**: `coreModuleMigrations` table (in `@molos/database/schema/core`)
   - Managed by `MigrationManager` class
   - Stores: `id`, `module_id`, `migration_name`, `checksum`, `rollback_sql`, `applied_at`, `rolled_back_at`
   - Used by: Module lifecycle (install/uninstall/rollback)

### Problems with Current Approach

1. **Synchronization Drift**: The two tables can get out of sync when migrations are applied outside of the normal flow
2. **Maintenance Burden**: Two systems to maintain and debug
3. **Confusion**: Developers don't know which table to check for migration status
4. **Redundancy**: Both tables store similar information (migration identity)

## Decision

**We will use Drizzle's native tracking (`__drizzle_migrations`) as the primary migration tracking system.**

The custom `coreModuleMigrations` table will be **deprecated and removed** after a transition period.

### Rationale

1. **Simplicity**: One source of truth reduces complexity
2. **Drizzle Alignment**: Using the ORM's native system means less custom code
3. **Battle-Tested**: Drizzle's migration tracking is used across many projects
4. **Automatic**: The migrator handles everything automatically

### Trade-offs

| Aspect                | Drizzle Native Only      | Custom Only             | Hybrid (Current)      |
| --------------------- | ------------------------ | ----------------------- | --------------------- |
| Simplicity            | ✅ High                  | Medium                  | ❌ Low                |
| Rollback Support      | Manual down.sql files    | ✅ Automatic generation | ✅ Automatic          |
| Module Lifecycle Hook | Add custom logic         | ✅ Built-in             | ✅ Built-in           |
| Maintenance           | ✅ Low (Drizzle handles) | Medium                  | ❌ High (two systems) |
| Debugging             | ✅ Single table to check | Single table            | ❌ Two tables         |

### Migration Path

1. **Phase 1** (Current): Stop writing to `coreModuleMigrations` in new migrations
2. **Phase 2**: Add rollback support via `.down.sql` files (see Task 3.3)
3. **Phase 3**: Create migration to sync existing data from `coreModuleMigrations` to `__drizzle_migrations` (if any discrepancies)
4. **Phase 4**: Remove `coreModuleMigrations` table and `MigrationManager` class

## Implementation

### For Core Migrations

No changes needed - already using Drizzle native tracking exclusively.

### For Module Migrations

1. Remove `MigrationManager.recordMigration()` calls from module initialization
2. Add optional `.down.sql` files for rollback support
3. Update module uninstall to use schema introspection for cleanup instead of `MigrationManager`

### Code Changes Required

| File                                             | Change                                     |
| ------------------------------------------------ | ------------------------------------------ |
| `module-management/server/migration-manager.ts`  | Deprecate, then remove                     |
| `packages/database/src/schema/core/migration.ts` | Remove `coreModuleMigrations` table schema |
| `scripts/init-database.ts`                       | Remove any `MigrationManager` usage        |
| Module `+layout.server.ts` files                 | Remove `MigrationManager` usage            |

## Consequences

### Positive

- Single source of truth for migration status
- Less code to maintain
- Easier debugging
- Aligns with Drizzle best practices

### Negative

- Lose automatic rollback SQL generation (mitigated by `.down.sql` files)
- Need to update module uninstall logic

### Neutral

- Migration files remain the same
- Database initialization flow remains the same

## Related

- [Phase 3 Task 3.3: Enhance Rollback System](../DB_IMPROV/tasks/phase-3-module-hardening.md#task-33-enhance-rollback-system)
- [Drizzle ORM Migrations Documentation](https://orm.drizzle.team/docs/migrations)

---

_This ADR will be reviewed after Phase 2 completion to validate the decision._

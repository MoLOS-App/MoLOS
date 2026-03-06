# Migration System Quick Start Guide

> **For**: Developers and DevOps
> **Updated**: 2026-03-06
> **Status**: ✅ Production Ready

---

## 🚀 Quick Commands

### Create a New Migration

```bash
# Core migration (no rollback)
bun run db:migration:create --name add_user_theme

# Module migration with rollback
bun run db:migration:create --name add_priority --module MoLOS-Tasks --reversible

# With description
bun run db:migration:create -n create_index -m core -r -d "Add performance index"
```

### Apply Migrations

```bash
# Apply all pending migrations (safe, transaction-wrapped)
bun run db:migrate:improved

# This will:
# 1. Create automatic backup
# 2. Validate all migrations
# 3. Apply each in a transaction
# 4. Record in tracking table
# 5. Validate final schema
```

### Validate & Check

```bash
# Check migration state
bun run db:repair

# Validate schema integrity
bun run db:validate

# Create manual backup
bun run db:backup
```

---

## 📝 Migration File Structure

### Forward Migration (`NNNN_description.sql`)

```sql
-- Migration: add_user_theme
-- Module: core
-- Created: 2026-03-06
-- Dependencies: (optional)

-- Add column
ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light';

--> statement-breakpoint

-- Add index
CREATE INDEX idx_users_theme ON users(theme);

--> statement-breakpoint

-- Add constraint
ALTER TABLE users ADD CONSTRAINT check_theme
  CHECK (theme IN ('light', 'dark', 'system'));
```

### Rollback Migration (`NNNN_description.down.sql`)

```sql
-- Rollback: add_user_theme
-- Module: core
-- Created: 2026-03-06

-- Remove constraint
ALTER TABLE users DROP CONSTRAINT check_theme;

--> statement-breakpoint

-- Remove index
DROP INDEX IF EXISTS idx_users_theme;

--> statement-breakpoint

-- Remove column
ALTER TABLE users DROP COLUMN theme;
```

---

## ⚠️ Important Rules

### DO ✅

1. **Always use transactions** - The system handles this automatically
2. **Add statement breakpoints** - Use `--> statement-breakpoint` between statements
3. **Test rollback** - Create `.down.sql` file and test it
4. **Use checksums** - System validates automatically
5. **Backup before migrations** - System does this automatically

### DON'T ❌

1. **Edit applied migrations** - Checksum validation will fail
2. **Skip statement breakpoints** - SQLite needs them for multi-statement migrations
3. **Run migrations without backup** - Always have a backup strategy
4. **Ignore validation errors** - Fix issues before applying

---

## 🔧 Common Scenarios

### Scenario 1: Add New Feature

```bash
# 1. Create migration
bun run db:migration:create -n add_notifications -m core -r

# 2. Edit files
vim drizzle/0018_add_notifications.sql
vim drizzle/0018_add_notifications.down.sql

# 3. Validate
bun run db:validate

# 4. Apply
bun run db:migrate:improved
```

### Scenario 2: Fix Failed Migration

```bash
# 1. Check what went wrong
bun run db:repair

# 2. If database is corrupted, restore backup
cp data/backups/molos-LAST_BACKUP.db data/molos.db

# 3. Fix migration SQL
vim drizzle/0018_add_notifications.sql

# 4. Retry
bun run db:migrate:improved
```

### Scenario 3: Add Module Migration

```bash
# 1. Create migration
bun run db:migration:create -n add_tags -m MoLOS-Tasks -r

# 2. Edit
vim modules/MoLOS-Tasks/drizzle/0005_add_tags.sql
vim modules/MoLOS-Tasks/drizzle/0005_add_tags.down.sql

# 3. Apply (handles both core and modules)
bun run db:migrate:improved
```

---

## 🐛 Troubleshooting

### Error: "Checksum mismatch"

**Problem**: Migration file was modified after being applied

**Solution**:

```bash
# Option 1: Revert changes
git checkout drizzle/0018_add_notifications.sql

# Option 2: Create new migration
bun run db:migration:create -n fix_notifications_v2
```

### Error: "Foreign key violation"

**Problem**: Referenced row doesn't exist

**Solution**:

```bash
# Check foreign keys
sqlite3 data/molos.db "PRAGMA foreign_key_check;"

# Fix data or adjust migration
```

### Error: "Table already exists"

**Problem**: Migration already applied but not tracked

**Solution**:

```bash
# Diagnose
bun run db:repair

# Manually mark as applied (if sure it's applied)
sqlite3 data/molos.db "INSERT INTO molos_migrations (...) VALUES (...);"
```

---

## 📊 Monitoring

### Check Migration Status

```sql
-- Recent migrations
SELECT * FROM molos_migrations
ORDER BY applied_at DESC
LIMIT 10;

-- Failed migrations
SELECT * FROM molos_migrations
WHERE success = 0;

-- Migration performance
SELECT
  module,
  COUNT(*) as total,
  AVG(execution_time_ms) as avg_time_ms,
  MAX(execution_time_ms) as max_time_ms
FROM molos_migrations
WHERE success = 1
GROUP BY module;
```

### Backup Management

```bash
# List backups
ls -lh data/backups/

# Restore from backup
cp data/backups/molos-2026-03-06T12:30:45.db data/molos.db
```

---

## 🎯 Best Practices Checklist

Before applying migrations to production:

- [ ] Created `.down.sql` file for rollback
- [ ] Tested migration in development
- [ ] Validated with `bun run db:validate`
- [ ] Reviewed SQL for performance issues
- [ ] Documented any manual steps needed
- [ ] Coordinated with team for downtime (if needed)
- [ ] Created backup with `bun run db:backup`
- [ ] Prepared rollback plan

---

## 📚 Additional Resources

- **Full Documentation**: `documentation/archive/DB_IMPROV/IMPLEMENTATION_COMPLETE.md`
- **System Analysis**: `documentation/archive/DB_IMPROV/tasks/01-system-analysis.md`
- **Implementation Guide**: `documentation/archive/DB_IMPROV/tasks/02-implementation-guide.md`
- **Testing Strategy**: `documentation/archive/DB_IMPROV/tasks/03-testing-strategy.md`
- **Production Deployment**: `documentation/archive/DB_IMPROV/tasks/04-production-deployment.md`
- **Troubleshooting**: `documentation/archive/DB_IMPROV/tasks/05-troubleshooting-guide.md`

---

## 🆘 Emergency Contacts

If you encounter critical issues:

1. **Stop application immediately**
2. **Create backup**: `bun run db:backup`
3. **Check logs**: `tail -f logs/migrations.log`
4. **Run diagnostics**: `bun run db:repair`
5. **Contact team lead**

---

_This guide covers 95% of common scenarios. For advanced topics, see the full documentation._

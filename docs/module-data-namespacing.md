# Module Data Namespacing - Implementation Plan

## Overview

Add a simple table prefixing convention to prevent database table name conflicts between modules. Each module gets its own namespace: `mod_{moduleId}_{tableName}`.

**Status:** Future Task
**Priority:** High
**Estimated Effort:** 1 day

---

## Problem Statement

Currently, modules can create any database table they want. This leads to:

1. **Table name collisions** - If Module A creates a `projects` table and Module B also creates `projects`, they conflict
2. **No clear ownership** - It's unclear which tables belong to which module
3. **Unsafe cleanup** - When uninstalling a module, it's hard to know which tables to drop
4. **No migration isolation** - Module migrations could conflict or accidentally modify other modules' tables

### Real Example

```
external_modules/
├── MoLOS-Product-Owner/
│   └── migrations/
│       └── 001_create_projects.sql  -- Creates table "projects"
├── MoLOS-Agile-Coach/
│   └── migrations/
│       └── 001_create_projects.sql  -- Creates table "projects" ← CONFLICT!
```

---

## Proposed Solution

A **simple naming convention** enforced through helper functions:

1. All module tables are prefixed: `mod_{moduleId}_{tableName}`
2. Helper function to generate prefixed table names
3. Migration system automatically applies prefixes
4. Module uninstall safely drops only its own tables

### What This Is NOT

- ❌ **Not a security sandbox** - Modules can still access other tables if they try
- ❌ **Not tenant isolation** - That's a separate concern
- ❌ **Not access control** - This is just namespacing

### What This IS

- ✅ **Collision prevention** - No two modules can have the same table name
- ✅ **Clear ownership** - Easy to see which tables belong to which module
- ✅ **Safe cleanup** - Can drop all `mod_{moduleId}_*` tables on uninstall

---

## Implementation

### File 1: Table Namespace Helper

**Path:** `src/lib/server/modules/data/namespace.ts`

```typescript
/**
 * Get the prefixed table name for a module
 *
 * @param moduleId - Module ID (e.g., "MoLOS-Product-Owner")
 * @param tableName - Base table name (e.g., "projects")
 * @returns Prefixed table name (e.g., "mod_MoLOS-Product-Owner_projects")
 *
 * @example
 * getTableName("MoLOS-Tasks", "projects")
 * // => "mod_MoLOS-Tasks_projects"
 */
export function getTableName(moduleId: string, tableName: string): string {
    // Sanitize table name to prevent SQL injection
    const sanitized = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    return `mod_${moduleId}_${sanitized}`;
}

/**
 * Check if a table name belongs to a specific module
 *
 * @param fullTableName - Full table name from database
 * @param moduleId - Module ID to check
 * @returns true if table belongs to module
 */
export function isModuleTable(fullTableName: string, moduleId: string): boolean {
    return fullTableName.startsWith(`mod_${moduleId}_`);
}

/**
 * Extract the base table name from a prefixed table
 *
 * @param fullTableName - Full table name (e.g., "mod_MoLOS-Tasks_projects")
 * @returns Base table name (e.g., "projects") or original if not prefixed
 */
export function getBaseTableName(fullTableName: string): string {
    const match = fullTableName.match(/^mod_[^_]+_(.+)$/);
    return match ? match[1] : fullTableName;
}

/**
 * Get all table names for a module (pattern for DROP queries)
 *
 * @param moduleId - Module ID
 * @returns SQL LIKE pattern for matching module tables
 */
export function getModuleTablePattern(moduleId: string): string {
    return `mod_${moduleId}_%`;
}

/**
 * Validate a table name is safe
 * Throws if table name contains dangerous characters
 */
export function validateTableName(tableName: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        throw new Error(
            `Invalid table name "${tableName}". ` +
            `Table names must start with letter/underscore and contain only letters, numbers, and underscores.`
        );
    }
}
```

---

### File 2: Module Data Access Helper

**Path:** `src/lib/server/modules/data/access.ts`

```typescript
import { getTableName, validateTableName } from './namespace';
import type { Database } from '$lib/server/db';

/**
 * Data access helper for a module
 * Provides prefixed table names and safe table operations
 */
export class ModuleData {
    constructor(
        private readonly moduleId: string,
        private readonly db: Database
    ) {}

    /**
     * Get the prefixed table name for this module
     *
     * @param tableName - Base table name
     * @returns Prefixed table name
     */
    table(tableName: string): string {
        validateTableName(tableName);
        return getTableName(this.moduleId, tableName);
    }

    /**
     * Get the raw database connection
     * Use with caution - queries are not automatically namespaced
     */
    get db(): Database {
        return this.db;
    }

    /**
     * Create a table for this module
     *
     * @param tableName - Base table name (will be prefixed)
     * @param definition - Table definition callback
     *
     * @example
     * await data.createTable('projects', (table) => {
     *     table.text('id').primary();
     *     table.text('name').notNull();
     * });
     */
    async createTable(
        tableName: string,
        definition: (table: any) => void
    ): Promise<void> {
        const prefixedTable = this.table(tableName);

        // Use Drizzle schema builder
        // Note: This is pseudo-code - adapt to your ORM
        await this.db.schema.createTable(prefixedTable, definition);
    }

    /**
     * Drop a table for this module
     *
     * @param tableName - Base table name (will be prefixed)
     */
    async dropTable(tableName: string): Promise<void> {
        const prefixedTable = this.table(tableName);
        await this.db.schema.dropTable(prefixedTable);
    }

    /**
     * Check if a table exists for this module
     *
     * @param tableName - Base table name
     */
    async tableExists(tableName: string): Promise<boolean> {
        const prefixedTable = this.table(tableName);
        const result = await this.db.execute(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name = ?
        `, [prefixedTable]);
        return result.rows.length > 0;
    }

    /**
     * Get all tables for this module
     */
    async getTables(): Promise<string[]> {
        const pattern = getModuleTablePattern(this.moduleId);
        const result = await this.db.execute(`
            SELECT name FROM sqlite_master
            WHERE type='table' AND name LIKE ?
        `, [pattern]);
        return result.rows.map((r: any) => r.name);
    }

    /**
     * Drop all tables for this module
     * Use with caution - this is destructive
     */
    async dropAllTables(): Promise<void> {
        const tables = await this.getTables();
        for (const table of tables) {
            await this.db.schema.dropTable(table);
        }
    }

    /**
     * Execute a query with table name auto-prefixing
     * Parses SQL and replaces table references with prefixed names
     *
     * WARNING: This uses simple regex - only use with simple queries
     * For complex queries, use prefixed table names directly
     *
     * @example
     * await data.query(`
     *     INSERT INTO projects (id, name) VALUES (?, ?)
     * `, [1, 'My Project'])
     * // Becomes: INSERT INTO mod_MyModule_projects ...
     */
    async query(sql: string, params: unknown[] = []): Promise<unknown> {
        // Simple regex-based table name replacement
        // This is basic - for production, consider using a proper SQL parser
        const prefixedSql = sql.replace(
            /\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
            (match, keyword, table) => {
                // Don't prefix sqlite_ tables or already prefixed tables
                if (table.startsWith('sqlite_') || table.startsWith('mod_')) {
                    return `${keyword} ${table}`;
                }
                return `${keyword} ${this.table(table)}`;
            }
        );

        return this.db.execute(prefixedSql, params);
    }
}

/**
 * Create a ModuleData instance for a specific module
 */
export function createModuleData(moduleId: string, db: Database): ModuleData {
    return new ModuleData(moduleId, db);
}
```

---

### File 3: Migration Integration

**Path:** `src/lib/server/modules/data/migration.ts`

```typescript
import { getTableName } from './namespace';
import type { Database } from '$lib/server/db';

/**
 * Module migration context
 * Provides helpers for writing module migrations
 */
export class ModuleMigrationContext {
    constructor(
        private readonly moduleId: string,
        private readonly db: Database
    ) {}

    /**
     * Get prefixed table name
     */
    table(tableName: string): string {
        return getTableName(this.moduleId, tableName);
    }

    /**
     * Execute raw SQL
     */
    async sql(sql: string, params: unknown[] = []): Promise<unknown> {
        return this.db.execute(sql, params);
    }

    /**
     * Run a migration callback
     */
    async up(callback: (ctx: ModuleMigrationContext) => Promise<void>): Promise<void> {
        await callback(this);
    }

    /**
     * Rollback a migration callback
     */
    async down(callback: (ctx: ModuleMigrationContext) => Promise<void>): Promise<void> {
        await callback(this);
    }
}

/**
 * Create a migration context for a module
 */
export function createMigrationContext(
    moduleId: string,
    db: Database
): ModuleMigrationContext {
    return new ModuleMigrationContext(moduleId, db);
}
```

---

### File 4: Module Context Integration

**Path:** `src/lib/server/modules/context.ts`

```typescript
import { createModuleData } from './data/access';
import type { Database } from '$lib/server/db';

/**
 * Context given to a module
 */
export interface ModuleContext {
    /** Module ID */
    readonly id: string;
    /** Data access helper */
    readonly data: {
        /** Get prefixed table name */
        table(tableName: string): string;
        /** Create a table */
        createTable(tableName: string, definition: (table: any) => void): Promise<void>;
        /** Drop a table */
        dropTable(tableName: string): Promise<void>;
        /** Check if table exists */
        tableExists(tableName: string): Promise<boolean>;
        /** Get all tables for this module */
        getTables(): Promise<string[]>;
        /** Execute query with auto-prefixing */
        query(sql: string, params?: unknown[]): Promise<unknown>;
    };
}

/**
 * Create module context
 */
export function createModuleContext(
    moduleId: string,
    db: Database,
    eventBus: ModuleEventBus
): ModuleContext {
    const data = createModuleData(moduleId, db);

    return {
        id: moduleId,
        events: { /* ... */ },
        data: {
            table: (tableName: string) => data.table(tableName),
            createTable: (tableName: string, def: any) => data.createTable(tableName, def),
            dropTable: (tableName: string) => data.dropTable(tableName),
            tableExists: (tableName: string) => data.tableExists(tableName),
            getTables: () => data.getTables(),
            query: (sql: string, params?: unknown[]) => data.query(sql, params)
        }
    };
}
```

---

## Module Usage Examples

### Example 1: Creating Tables with Prefixing

```typescript
// external_modules/MoLOS-Tasks/module.ts

import type { ModuleDefinition, ModuleContext } from '$lib/server/modules/types';

export const module: ModuleDefinition = {
    async onInstall(context: ModuleContext) {
        // Creates: mod_MoLOS-Tasks_projects
        await context.data.createTable('projects', (table) => {
            table.text('id').primary();
            table.text('name').notNull();
            table.timestamps();
        });

        // Creates: mod_MoLOS-Tasks_tasks
        await context.data.createTable('tasks', (table) => {
            table.text('id').primary();
            table.text('project_id').references('mod_MoLOS-Tasks_projects.id');
            table.text('title').notNull();
            table.timestamps();
        });
    },

    async onUninstall(context: ModuleContext) {
        // Drops only this module's tables
        await context.data.dropTable('tasks');
        await context.data.dropTable('projects');
    }
};
```

### Example 2: Using Prefixed Tables in Queries

```typescript
// external_modules/MoLOS-Tasks/routes/api/tasks/+server.ts

import { db } from '$lib/server/db';
import { getTableName } from '$lib/server/modules/data/namespace';

const moduleId = 'MoLOS-Tasks';

export async function GET({ url }) {
    // Use prefixed table name directly
    const tasksTable = getTableName(moduleId, 'tasks');

    const tasks = await db
        .select()
        .from(tasksTable)
        .all();

    return json(tasks);
}

export async function POST({ request }) {
    const { title, projectId } = await request.json();

    const tasksTable = getTableName(moduleId, 'tasks');

    await db
        .insert(tasksTable)
        .values({ id: crypto.randomUUID(), title, project_id: projectId });

    return json({ success: true });
}
```

### Example 3: Module Migrations

```typescript
// external_modules/MoLOS-Tasks/migrations/001_initial.ts

import type { ModuleMigrationContext } from '$lib/server/modules/data/migration';

export async function up(ctx: ModuleMigrationContext): Promise<void> {
    // ctx.table() automatically applies prefix
    await ctx.sql(`
        CREATE TABLE ${ctx.table('projects')} (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
}

export async function down(ctx: ModuleMigrationContext): Promise<void> {
    await ctx.sql(`DROP TABLE ${ctx.table('projects')}`);
}
```

### Example 4: Safe Cleanup on Uninstall

```typescript
// Module management system - when uninstalling a module

import { getModuleTablePattern } from '$lib/server/modules/data/namespace';

export async function uninstallModule(moduleId: string) {
    // Get all tables for this module
    const pattern = getModuleTablePattern(moduleId);

    const tables = await db.execute(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name LIKE ?
    `, [pattern]);

    // Drop them all
    for (const table of tables.rows) {
        await db.schema.dropTable(table.name);
    }

    // Delete module from registry
    await db.delete(settingsExternalModules)
        .where(eq(settingsExternalModules.id, moduleId));
}
```

---

## Drizzle ORM Integration

If using Drizzle ORM, you can create schema helpers:

```typescript
// external_modules/MoLOS-Tasks/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { getTableName } from '$lib/server/modules/data/namespace';

const MODULE_ID = 'MoLOS-Tasks';

// Create tables with prefix
export const projects = sqliteTable(
    getTableName(MODULE_ID, 'projects'),
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        createdAt: integer('created_at').notNull()
    }
);

export const tasks = sqliteTable(
    getTableName(MODULE_ID, 'tasks'),
    {
        id: text('id').primaryKey(),
        projectId: text('project_id').references(
            () => projects.id  // References are fine with prefixes
        ),
        title: text('title').notNull(),
        createdAt: integer('created_at').notNull()
    }
);

// Export a schema object
export const schema = { projects, tasks };
```

---

## Database Schema Changes

**New table for tracking module tables:**

```sql
-- Track which tables belong to which module
CREATE TABLE module_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    table_name TEXT NOT NULL,  -- Base name (without prefix)
    full_name TEXT NOT NULL,   -- Prefixed name
    created_at INTEGER NOT NULL,
    UNIQUE(module_id, table_name)
);
CREATE INDEX idx_module_tables_module ON module_tables(module_id);
```

---

## Testing

```typescript
// tests/modules/data-namespace.test.ts

import { describe, it, expect } from 'vitest';
import { getTableName, isModuleTable, getBaseTableName } from '$lib/server/modules/data/namespace';

describe('Module Data Namespace', () => {
    describe('getTableName', () => {
        it('should prefix table names', () => {
            expect(getTableName('MyModule', 'projects'))
                .toBe('mod_MyModule_projects');
        });

        it('should sanitize table names', () => {
            expect(getTableName('MyModule', 'pro;jects'))
                .toBe('mod_MyModule_projects');
        });

        it('should handle multiple words', () => {
            expect(getTableName('MyModule', 'user_settings'))
                .toBe('mod_MyModule_user_settings');
        });
    });

    describe('isModuleTable', () => {
        it('should identify module tables', () => {
            expect(isModuleTable('mod_MyModule_projects', 'MyModule'))
                .toBe(true);
            expect(isModuleTable('mod_OtherModule_projects', 'MyModule'))
                .toBe(false);
            expect(isModuleTable('projects', 'MyModule'))
                .toBe(false);
        });
    });

    describe('getBaseTableName', () => {
        it('should extract base name', () => {
            expect(getBaseTableName('mod_MyModule_projects'))
                .toBe('projects');
            expect(getBaseTableName('projects'))
                .toBe('projects');
        });
    });
});
```

---

## Migration Path

### Phase 1: Implementation (1 day)
1. Create namespace helper functions
2. Create ModuleData class
3. Write tests
4. Update module context

### Phase 2: Migration (1-2 days)
1. Audit existing module tables
2. Rename existing tables to use prefix
3. Update all module code to use helper
4. Update migrations to use helper

### Phase 3: Cleanup (1 day)
1. Drop old (non-prefixed) tables
2. Update documentation
3. Update module development CLI

---

## Handling Existing Tables

If you already have modules with tables, you'll need to migrate them:

```typescript
// Migration script

import { getTableName } from '$lib/server/modules/data/namespace';

async function migrateModuleTables(moduleId: string, tables: string[]) {
    for (const tableName of tables) {
        const prefixedTable = getTableName(moduleId, tableName);

        // Rename table
        await db.execute(`ALTER TABLE ${tableName} RENAME TO ${prefixedTable}`);

        // Track the change
        await db.insert(moduleTables).values({
            moduleId,
            tableName,
            fullName: prefixedTable,
            createdAt: Date.now()
        });
    }
}

// Example usage for existing modules
await migrateModuleTables('MoLOS-Product-Owner', ['projects', 'workflows']);
await migrateModuleTables('MoLOS-Tasks', ['tasks', 'categories']);
```

---

## Success Criteria

- [x] Helper functions generate correct prefixed table names
- [x] Table name collisions are prevented
- [x] Modules can create/drop their own tables
- [x] Uninstall safely removes only module's tables
- [x] Tests pass
- [x] Existing modules migrated

---

## Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/server/modules/data/namespace.ts` | ~80 | Table name helpers |
| `src/lib/server/modules/data/access.ts` | ~150 | ModuleData class |
| `src/lib/server/modules/data/migration.ts` | ~60 | Migration context |
| `src/lib/server/modules/context.ts` (update) | ~20 | Integrate into context |
| `tests/modules/data-namespace.test.ts` | ~80 | Tests |

**Total:** ~400 lines of code

---

## FAQ

**Q: Is this a security sandbox?**
A: No. Modules can still access other tables if they know the names. This is just naming convention to prevent accidents.

**Q: What about tenant isolation?**
A: That's a separate concern. This is just about preventing table name collisions between modules.

**Q: Can modules still use raw SQL?**
A: Yes, but they should use the `context.data.query()` helper which auto-prefixes, or prefix manually.

**Q: What if a module needs to share data with another module?**
A: They shouldn't directly. Use the event system to notify, and let the core coordinate data access.

**Q: Does this work with foreign keys?**
A: Yes, foreign keys work fine with prefixed names. Just reference the full prefixed table name.

---

*Last Updated: 2025-02-09*
*Status: Ready for Implementation*

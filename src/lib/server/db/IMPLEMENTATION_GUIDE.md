# Database Schema Structure

This directory contains all database table definitions organized by module. Each module has its own folder with prefixed table names to maintain clear separation and avoid naming conflicts.

## Organization

```
src/lib/server/db/schema/
├── tasks/                      # Tasks module
│   └── tables.ts               # tasks_tasks
├── index.ts                    # Central export point
└── auth-schema.ts              # Auth schema (special, no need to standarize)
```

## Naming Convention

### Database Table Names

All table names follow the pattern: `{module}_{tableName}`

**Examples:**

- Auth module: `user`, `session`, `account`, `verification`
- Tasks module: `tasks_tasks`

### Exported Names (TypeScript)

All exports use camelCase with module prefix: `{module}TableName`

**Examples:**

```typescript
export const authUser = sqliteTable("user", { ... });
export const authSession = sqliteTable("session", { ... });
export const tasksTasks = sqliteTable("tasks_tasks", { ... });
```

### Backward Compatibility

Legacy non-prefixed exports are maintained for existing code:

```typescript
// Modern (recommended)
import { authUser, tasksTasks } from '$lib/server/db/schema';

// Legacy (still works)
import { user, tasks } from '$lib/server/db/schema';
```

## Module Structure

### Tasks Module (`tasks/tables.ts`)

Database tables for task management:

| Table         | Prefix   | Export       | Purpose      |
| ------------- | -------- | ------------ | ------------ |
| `tasks_tasks` | `tasks_` | `tasksTasks` | Task records |

**Fields:**

- `id`: Unique identifier
- `title`: Task title
- `description`: Optional description
- `dueDate`: Optional due date
- `priority`: Priority level (1-3)
- `completed`: Completion status
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## Usage Examples

### Querying with Modern Names

```typescript
import { authUser, tasksTasks } from '$lib/server/db/schema';
import { db } from '$lib/server/db';

// Get all users
const users = await db.select().from(authUser);

// Get all tasks
const tasks = await db.select().from(tasksTasks);

// Get completed tasks
const completed = await db.select().from(tasksTasks).where(eq(tasksTasks.completed, true));
```

### Querying with Legacy Names (Still Works)

```typescript
import { user, tasks } from '$lib/server/db/schema';
import { db } from '$lib/server/db';

// Old code still works
const allUsers = await db.select().from(user);
const allTasks = await db.select().from(tasks);
```

### Using in Better-Auth

```typescript
import * as schema from '$lib/server/db/schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema // Automatically discovers auth tables by name
	})
});
```

## Adding a New Module

Follow this step-by-step guide to add a new module to the database schema:

### 1. Create Module Folder

```bash
mkdir -p src/lib/server/db/schema/your-module
```

### 2. Create Table Definitions

**File**: `src/lib/server/db/schema/your-module/tables.ts`

```typescript
import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Your Module - Main Table
 * Add description of what this table stores
 */
export const yourModuleTable = sqliteTable('your_module_table', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * Your Module - Relations
 */
export const yourModuleTableRelations = relations(yourModuleTable, ({ many }) => ({
	// Define relationships here
}));

/**
 * Legacy export for backward compatibility
 * @deprecated Use yourModuleTable instead
 */
export const yourTable = yourModuleTable;
```

### 3. Register in Central Export

**File**: `src/lib/server/db/schema/index.ts`

Add this line:

```typescript
export * from './your-module/tables';
```

### 4. Update Routes/API

Use the new table in your routes and API endpoints:

```typescript
import { yourModuleTable } from '$lib/server/db/schema';
import { db } from '$lib/server/db';

// Your queries here
const records = await db.select().from(yourModuleTable);
```

### 5. Run Database Migration

```bash
npm run db:generate
npm run db:migrate
```

## Naming Guidelines

### Do ✅

- Use lowercase snake_case for table names: `your_module_table`
- Use module prefix consistently: `{module}_`
- Use camelCase for exports: `yourModuleTable`
- Provide both modern and legacy exports during transition
- Document table purpose in comments

### Don't ❌

- Mix naming conventions in one table
- Forget the module prefix
- Create tables without the standardized structure
- Remove legacy exports without updating all code

## Best Practices

### 1. Always Include Timestamps

```typescript
createdAt: integer("created_at", { mode: "timestamp_ms" })
  .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
  .notNull(),
updatedAt: integer("updated_at", { mode: "timestamp_ms" })
  .$onUpdate(() => new Date())
  .notNull(),
```

### 2. Use Proper ID Strategy

```typescript
// For user-facing IDs, use text
id: text("id").primaryKey(),  // Generate with cuid or similar

// For internal relationships, use serial integers
userId: integer("user_id").references(() => authUser.id),
```

### 3. Define Relations

```typescript
export const yourModuleTableRelations = relations(yourModuleTable, ({ one, many }) => ({
	author: one(authUser, {
		fields: [yourModuleTable.authorId],
		references: [authUser.id]
	}),
	items: many(yourModuleItem)
}));
```

### 4. Use Indexes for Performance

```typescript
export const yourModuleTable = sqliteTable(
	'your_module_table',
	{
		/* ... fields ... */
	},
	(table) => [index('idx_user_id').on(table.userId), index('idx_created_at').on(table.createdAt)]
);
```

## Verification Checklist

Before deploying a new module schema:

- [ ] Table names use module prefix: `{module}_tableName`
- [ ] Exports use camelCase: `{module}TableName`
- [ ] Legacy exports provided for backward compatibility
- [ ] TypeScript compiles without errors
- [ ] Tables have proper timestamps (`createdAt`, `updatedAt`)
- [ ] Relations are properly defined
- [ ] Comments document table purpose
- [ ] Exported from `schema/index.ts`
- [ ] Database migration runs successfully (`npm run db:generate;npm run db:migrate`)

## Related Documentation

- [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Detailed implementation reference
- [Database Schema Quick Reference](../../../../../../SCHEMA_REFERENCE.md) - Quick table reference
- [Configuration Guide](../../config/README.md) - Application configuration

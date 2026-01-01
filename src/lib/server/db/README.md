# Database Schema

This directory contains all database table definitions organized by module, following a standardized pattern where each module has its own folder with prefixed table names.

## Structure

```
schema/
├── tasks/                  # Tasks module
│   └── tables.ts           # tasks_tasks
├── index.ts                # Central export point
├── README.md               # This file
├── IMPLEMENTATION_GUIDE.md # Detailed guide for adding modules
└── auth-schema.ts
```

## Key Principles

### 1. Modular Organization

- Each module has its own folder: `schema/{module}/`
- Contains `tables.ts` with all module-related tables
- Promotes clear separation and easy navigation

### 2. Consistent Naming

- **Database Tables**: `{module}_{tableName}` (e.g., `auth_user`, `tasks_tasks`)
- **TypeScript Exports**: `{module}TableName` (e.g., `authUser`, `tasksTasks`)
- **Backward Compatibility**: Legacy non-prefixed exports maintained

### 3. Backward Compatibility

- All existing code continues to work without changes
- New code should use modern prefixed names
- Legacy exports available during migration period

## Current Modules

### Auth Module (Special, no standarization needed)

**Tables**: `user`, `session`, `account`, `verification`

### Tasks Module

**Tables**: `tasks_tasks`

```typescript
import { tasksTasks } from '$lib/server/db/schema';

// Modern usage
const allTasks = await db.select().from(tasksTasks);

// Legacy usage (still works)
import { tasks } from '$lib/server/db/schema';
const legacyTasks = await db.select().from(tasks);
```

## Adding a New Module

For detailed step-by-step instructions, see [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).

Quick overview:

1. **Create folder**: `schema/your-module/`
2. **Create file**: `schema/your-module/tables.ts` with table definitions
3. **Add exports**: Include both modern and legacy exports
4. **Register**: Add export to `schema/index.ts`
5. **Migrate**: Run `npm run db:push`

Example:

```typescript
// schema/your-module/tables.ts
export const yourModuleTable = sqliteTable('your_module_table', {
	id: text('id').primaryKey()
	// ... fields ...
});

// Legacy export for backward compatibility
export const yourTable = yourModuleTable;
```

## Usage in Code

### Direct Import

```typescript
import { authUser, tasksTasks } from '$lib/server/db/schema';
import { db } from '$lib/server/db';

const users = await db.select().from(authUser);
const tasks = await db.select().from(tasksTasks);
```

### Bulk Import

```typescript
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';

const users = await db.select().from(schema.authUser);
const tasks = await db.select().from(schema.tasksTasks);

// Legacy names also available
const legacyUsers = await db.select().from(schema.user);
const legacyTasks = await db.select().from(schema.tasks);
```

### In Better-Auth

```typescript
import * as schema from '$lib/server/db/schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema // All tables automatically discovered
	})
});
```

## Naming Reference

| Module    | Database Table | Export       | Legacy     |
| --------- | -------------- | ------------ | ---------- |
| **Tasks** | `tasks_tasks`  | `tasksTasks` | `tasks` ✅ |

✅ = Legacy export available for backward compatibility

## Verification

After making changes:

```bash
# Check for TypeScript errors
npm run build

# Run database migration (if schema changed)
npm run db:push

# View schema in browser (if using studio)
npm run db:studio
```

## Best Practices

- ✅ Always use module prefix in table names
- ✅ Export both modern and legacy names during transition
- ✅ Include `createdAt` and `updatedAt` timestamps
- ✅ Define relations between tables
- ✅ Document table purpose in comments
- ✅ Use indexes for frequently queried columns

## Troubleshooting

### Tables not appearing in queries

- Check if table is exported from `schema/index.ts`
- Verify module prefix matches database table name
- Ensure TypeScript compilation succeeds

### Better-auth not finding tables

- Make sure table names exactly match expected names
- Verify legacy exports are available if needed
- Check that `schema` object is passed to `drizzleAdapter`

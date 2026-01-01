# Database Schema Standardization - Quick Reference

## Directory Structure

```
src/lib/server/db/schema/
├── tasks/
│   └── tables.ts           # ✅ Already modular
├── index.ts                # ✅ Updated exports
├── auth-schema.ts          # Top important module
└── README.md               # ✅ Documentation
```

## Table Names

### Auth Module

| Old Name       | Database Name  | Export         |
| -------------- | -------------- | -------------- |
| `user`         | `user`         | `user`         |
| `session`      | `session`      | `session`      |
| `account`      | `account`      | `account`      |
| `verification` | `verification` | `verification` |

### Tasks Module

| Old Name | Database Name           | Export       |
| -------- | ----------------------- | ------------ |
| `tasks`  | `tasks` → `tasks_tasks` | `tasksTasks` |

## Import Changes

```typescript
import { tasksTasks } from '$lib/server/db/schema/tasks/tables';
import { user, session } from '$lib/server/db/schema';
```

### Bulk Import (Always Works)

```typescript
import * as schema from '$lib/server/db/schema';

// Has both modern and legacy names:
schema.tasksTasks; // Modern
schema.user; // Modern
```

## To Add a New Module

1. Create folder: `schema/{module}/`
2. Create file: `schema/{module}/tables.ts`
3. Define tables with prefix:
   ```typescript
   export const {module}Table = sqliteTable('{module}_table', {
     // ...
   });
   ```
4. Update `schema/index.ts`:
   ```typescript
   export * from './{module}/tables';
   ```

## Verification

- ✅ No TypeScript errors
- ✅ No import errors
- ✅ Better-auth compatible
- ✅ All queries functional
- ✅ Backward compatible

# 1. Database Schema Setup

This section details the process of defining database schemas for new modules using Drizzle ORM, following the patterns established by the Tasks module.

## Location and Naming Conventions

- **Location**: Database schema files are located in `src/lib/server/db/schema/{module-name}/tables.ts`.
- **Naming**: Table names should follow the `module_entity` convention (e.g., `tasks_tasks`, `finance_expenses`).

## Table Definitions

Each entity within a module should have its own table defined using `sqliteTable` from `drizzle-orm/sqlite-core`.

### Example: Tasks Module - `tasks_tasks` table

```typescript
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from '../auth-schema';
import { textEnum } from '../../utils';
import { TaskStatus, TaskPriority } from '../../../../models/tasks';

export const tasksTasks = sqliteTable('tasks_tasks', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id'),
	title: text('title').notNull(),
	description: text('description'),
	status: textEnum('status', TaskStatus).notNull().default(TaskStatus.TO_DO),
	priority: textEnum('priority', TaskPriority).notNull().default(TaskPriority.MEDIUM),
	dueDate: integer('due_date'),
	doDate: integer('do_date'),
	effort: integer('effort'),
	context: text('context'),
	isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
	projectId: text('project_id'),
	areaId: text('area_id'),
	createdAt: integer('created_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`),
	updatedAt: integer('updated_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`)
});
```

### Example: Finance Module - `finance_expenses` table

```typescript
import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from '../auth-schema';
import { textEnum } from '../../utils';

export const FinanceCategory = {
	RENT: 'rent',
	GROCERIES: 'groceries',
	ENTERTAINMENT: 'entertainment',
	SAVINGS: 'savings',
	OTHER: 'other'
} as const;

export const FinancePaymentMethod = {
	CASH: 'cash',
	CARD: 'card',
	TRANSFER: 'transfer',
	OTHER: 'other'
} as const;

// ... other enums like FinanceFrequency, FinanceStatus, FinanceAccountType, FinanceBudgetPeriod

export const financeExpenses = sqliteTable('finance_expenses', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	amount: real('amount').notNull(),
	currency: text('currency').notNull().default('USD'),
	category: textEnum('category', FinanceCategory).notNull(),
	description: text('description'),
	date: integer('date').notNull(),
	transactionDate: integer('transaction_date'),
	paymentMethod: textEnum('payment_method', FinancePaymentMethod),
	notes: text('notes'),
	createdAt: integer('created_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`),
	updatedAt: integer('updated_at')
		.notNull()
		.default(sql`(strftime('%s','now'))`)
});
```

## Key Rules for Schema Design

- **Primary Keys**: Use `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` for UUID primary keys.
- **User ID**: Include `userId: text('user_id').notNull()` for user-specific data, linking to the `user.id` from `auth-schema`.
- **Timestamps**: `createdAt` and `updatedAt` fields should be `integer` (Unix timestamp) with `notNull()` and `default(sql`(strftime('%s','now'))`)`.
- **Enums**: Use `textEnum('column_name', YourEnum)` for columns that represent a fixed set of string values.
- **Foreign Keys**: Define foreign keys using `.references(() => otherTable.id, { onDelete: 'cascade' })` where applicable.
- **Deprecations**: Clearly mark deprecated tables or fields with comments.

## Schema Exports

Export all table definitions and any enums defined directly in the schema file. For example, in the finance module, enums like `FinanceCategory` are defined and exported here. In the tasks module, enums are imported from the models file and then re-exported for convenience.

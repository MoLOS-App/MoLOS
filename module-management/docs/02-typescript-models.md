# 2. TypeScript Models

This section outlines the structure and best practices for defining TypeScript interfaces and types for your module's data, based on the patterns found in the Tasks and Finance modules.

## Interface Definitions

Each major entity in your module should have a corresponding TypeScript interface that accurately reflects its structure, including all properties and their types. These interfaces are typically defined in `src/lib/models/{module-name}/index.ts`.

### Example: Tasks Module - `Task` interface

```typescript
export interface Task {
	id: string;
	userId: string;
	title: string;
	description?: string;
	status: (typeof TaskStatus)[keyof typeof TaskStatus];
	priority: (typeof TaskPriority)[keyof typeof TaskPriority];
	dueDate?: number; // Unix timestamp
	doDate?: number; // Unix timestamp - when to execute
	effort?: number; // Minutes or story points
	context?: string[]; // JSON array
	isCompleted: boolean;
	projectId?: string;
	areaId?: string;
	createdAt: number; // Unix timestamp
	updatedAt: number; // Unix timestamp
}
```

### Example: Finance Module - `Expense` interface

```typescript
import {
	FinanceCategory,
	FinanceFrequency,
	FinanceStatus,
	FinanceAccountType,
	FinanceBudgetPeriod,
	FinancePaymentMethod
} from '$lib/server/db/schema/finance/tables';

export interface Expense {
	id: string;
	userId: string;
	amount: number;
	currency: string;
	category: (typeof FinanceCategory)[keyof typeof FinanceCategory];
	description?: string;
	date: number; // Unix timestamp
	transactionDate?: number; // Unix timestamp
	paymentMethod?: (typeof FinancePaymentMethod)[keyof typeof FinancePaymentMethod];
	notes?: string;
	createdAt: number; // Unix timestamp
	updatedAt: number; // Unix timestamp
}
```

## Type Aliases

Use type aliases for enums and for creating `Create` and `Update` input types, which are typically `Omit` or `Partial<Omit>` of the main interface.

### Example: Tasks Module - Type Aliases

```typescript
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
export type TaskContext = 'deep_work' | 'phone' | 'errands' | 'fill_in' | 'admin';

export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'userId'>>;
```

### Example: Finance Module - Type Aliases

```typescript
export type ExpenseCategory = (typeof FinanceCategory)[keyof typeof FinanceCategory];

export type CreateExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateExpenseInput = Partial<
	Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;
```

## Model Patterns

- **Consistency**: Ensure your TypeScript models accurately reflect your database schema. Use the same field names and types.
- **Enums**: For fields with a fixed set of values, define them as `typeof YourEnum[keyof typeof YourEnum]` to ensure type safety and consistency with the database schema.
- **Input Types**: Always define `Create` and `Update` input types to facilitate clear and type-safe data manipulation.
- **Timestamps**: Include `createdAt` and `updatedAt` as `number` (Unix timestamp) in all relevant interfaces.
- **Optional Fields**: Use `?` for optional fields.

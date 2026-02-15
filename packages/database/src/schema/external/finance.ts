import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '../../utils/index.js';
import { user } from '../core/auth.js';
import { namespaceTableName } from '../../utils/index.js';

const MODULE_NAME = 'MoLOS-Finance';

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

export const FinanceFrequency = {
	MONTHLY: 'monthly',
	YEARLY: 'yearly',
	WEEKLY: 'weekly'
} as const;

export const FinanceStatus = {
	ACTIVE: 'active',
	CANCELLED: 'cancelled',
	PAUSED: 'paused'
} as const;

export const FinanceAccountType = {
	CHECKING: 'checking',
	SAVINGS: 'savings',
	CREDIT: 'credit',
	INVESTMENT: 'investment',
	CASH: 'cash'
} as const;

export const FinanceBudgetPeriod = {
	MONTHLY: 'monthly',
	QUARTERLY: 'quarterly',
	YEARLY: 'yearly'
} as const;

export const financeExpenses = sqliteTable(namespaceTableName(MODULE_NAME, 'expenses'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	amount: real('amount').notNull(),
	currency: text('currency').notNull().default('USD'),
	category: textEnum('category', FinanceCategory).notNull(),
	description: text('description'),
	date: integer('date').notNull(),
	transactionDate: integer('transaction_date'),
	paymentMethod: textEnum('payment_method', FinancePaymentMethod),
	notes: text('notes'),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const financeSubscriptions = sqliteTable(namespaceTableName(MODULE_NAME, 'subscriptions'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	cost: real('cost').notNull(),
	currency: text('currency').notNull().default('USD'),
	frequency: textEnum('frequency', FinanceFrequency).notNull(),
	renewalDate: integer('renewal_date'),
	startDate: integer('start_date'),
	endDate: integer('end_date'),
	status: textEnum('status', FinanceStatus).notNull().default(FinanceStatus.ACTIVE),
	category: text('category'),
	notes: text('notes'),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const financeAccounts = sqliteTable(namespaceTableName(MODULE_NAME, 'accounts'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	type: textEnum('type', FinanceAccountType).notNull(),
	balance: real('balance').notNull().default(0),
	currency: text('currency').notNull().default('USD'),
	accountNumber: text('account_number'),
	institution: text('institution'),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const financeSettings = sqliteTable(namespaceTableName(MODULE_NAME, 'settings'), {
	userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
	defaultCurrency: text('default_currency').notNull().default('USD'),
	autoCategorize: integer('auto_categorize', { mode: 'boolean' }).notNull().default(true),
	budgetThreshold: integer('budget_threshold').notNull().default(80),
	showAccountsOnDashboard: integer('show_accounts_on_dashboard', { mode: 'boolean' }).notNull().default(true),
	notifications: integer('notifications', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const financeBudget = sqliteTable(namespaceTableName(MODULE_NAME, 'budget'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	category: text('category').notNull(),
	limit: real('limit').notNull(),
	currency: text('currency').notNull().default('USD'),
	period: textEnum('period', FinanceBudgetPeriod).notNull(),
	startDate: integer('start_date'),
	endDate: integer('end_date'),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

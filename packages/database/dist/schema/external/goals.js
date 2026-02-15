import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '../../utils/index.js';
import { user } from '../core/auth.js';
import { namespaceTableName } from '../../utils/index.js';
const MODULE_NAME = 'MoLOS-Goals';
export const GoalResourceType = {
    ARTICLE: 'article',
    VIDEO: 'video',
    PODCAST: 'podcast',
    BOOK: 'book',
    COURSE: 'course'
};
export const GoalConsumptionStatus = {
    INBOX: 'inbox',
    READING: 'reading',
    SUMMARIZING: 'summarizing',
    COMPLETED: 'completed'
};
export const GoalQuarter = {
    Q1: 'Q1',
    Q2: 'Q2',
    Q3: 'Q3',
    Q4: 'Q4'
};
export const GoalStatus = {
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    ABANDONED: 'abandoned'
};
export const goalsResources = sqliteTable(namespaceTableName(MODULE_NAME, 'resources'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    url: text('url'),
    type: textEnum('type', GoalResourceType).notNull(),
    consumptionStatus: textEnum('consumption_status', GoalConsumptionStatus).notNull().default(GoalConsumptionStatus.INBOX),
    topics: text('topics'),
    description: text('description'),
    notes: text('notes'),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const goalsTracker = sqliteTable(namespaceTableName(MODULE_NAME, 'tracker'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    quarter: textEnum('quarter', GoalQuarter).notNull(),
    year: integer('year').notNull(),
    targetValue: real('target_value').notNull(),
    currentValue: real('current_value').notNull().default(0),
    unit: text('unit'),
    category: text('category'),
    status: textEnum('status', GoalStatus).notNull().default(GoalStatus.IN_PROGRESS),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const goalsProgressHistory = sqliteTable(namespaceTableName(MODULE_NAME, 'progress_history'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    goalId: text('goal_id').notNull(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    value: real('value').notNull(),
    notes: text('notes'),
    recordedAt: integer('recorded_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const goalsSettings = sqliteTable(namespaceTableName(MODULE_NAME, 'settings'), {
    userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
    showCompleted: integer('show_completed', { mode: 'boolean' }).notNull().default(true),
    showAbandoned: integer('show_abandoned', { mode: 'boolean' }).notNull().default(false),
    currentQuarterOnly: integer('current_quarter_only', { mode: 'boolean' }).notNull().default(true),
    notifications: integer('notifications', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});

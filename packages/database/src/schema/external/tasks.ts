import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '../../utils/index.js';
import { user } from '../core/auth.js';
import { namespaceTableName } from '../../utils/index.js';

const MODULE_NAME = 'MoLOS-Tasks';

export const TaskStatus = {
	TO_DO: 'to_do',
	IN_PROGRESS: 'in_progress',
	DONE: 'done',
	CANCELLED: 'cancelled'
} as const;

export const TaskPriority = {
	LOW: 'low',
	MEDIUM: 'medium',
	HIGH: 'high'
} as const;

export const ProjectStatus = {
	PLANNING: 'planning',
	ACTIVE: 'active',
	ON_HOLD: 'on_hold',
	COMPLETED: 'completed',
	CANCELLED: 'cancelled'
} as const;

export const tasksTasks = sqliteTable(namespaceTableName(MODULE_NAME, 'tasks'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
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
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const tasksProjects = sqliteTable(namespaceTableName(MODULE_NAME, 'projects'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	status: textEnum('status', ProjectStatus).notNull().default(ProjectStatus.PLANNING),
	description: text('description'),
	startDate: integer('start_date'),
	endDate: integer('end_date'),
	areaId: text('area_id'),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const tasksAreas = sqliteTable(namespaceTableName(MODULE_NAME, 'areas'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	themeColor: text('theme_color'),
	description: text('description'),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const tasksDailyLog = sqliteTable(namespaceTableName(MODULE_NAME, 'daily_log'), {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	logDate: integer('log_date').notNull(),
	mood: text('mood'),
	sleepHours: real('sleep_hours'),
	morningRoutine: integer('morning_routine', { mode: 'boolean' }).default(false),
	eveningRoutine: integer('evening_routine', { mode: 'boolean' }).default(false),
	notes: text('notes'),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

export const tasksSettings = sqliteTable(namespaceTableName(MODULE_NAME, 'settings'), {
	userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
	showCompleted: integer('show_completed', { mode: 'boolean' }).notNull().default(false),
	compactMode: integer('compact_mode', { mode: 'boolean' }).notNull().default(false),
	notifications: integer('notifications', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
	updatedAt: integer('updated_at').notNull().default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
});

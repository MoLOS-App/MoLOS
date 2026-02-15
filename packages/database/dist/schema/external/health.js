import { integer, sqliteTable, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { textEnum } from '../../utils/index.js';
import { user } from '../core/auth.js';
import { namespaceTableName } from '../../utils/index.js';
const MODULE_NAME = 'MoLOS-Health';
export const HealthSex = {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other'
};
export const HealthUnits = {
    METRIC: 'metric',
    IMPERIAL: 'imperial'
};
export const HealthActivityType = {
    CARDIO: 'cardio',
    STRENGTH: 'strength',
    FLEXIBILITY: 'flexibility',
    SPORTS: 'sports',
    WALKING: 'walking',
    RUNNING: 'running',
    CYCLING: 'cycling',
    SWIMMING: 'swimming',
    OTHER: 'other'
};
export const healthUserProfile = sqliteTable(namespaceTableName(MODULE_NAME, 'user_profile'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
    heightCm: real('height_cm').notNull(),
    age: integer('age').notNull(),
    sex: textEnum('sex', HealthSex).notNull(),
    units: textEnum('units', HealthUnits).notNull().default(HealthUnits.METRIC),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const healthWeightLog = sqliteTable(namespaceTableName(MODULE_NAME, 'weight_log'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    timestamp: integer('timestamp').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    weightKg: real('weight_kg').notNull(),
    notes: text('notes'),
    bodyFatPct: real('body_fat_pct'),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const healthMeasurementLog = sqliteTable(namespaceTableName(MODULE_NAME, 'measurement_log'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    timestamp: integer('timestamp').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    waistCm: real('waist_cm'),
    hipCm: real('hip_cm'),
    chestCm: real('chest_cm'),
    bicepCm: real('bicep_cm'),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const healthActivityLog = sqliteTable(namespaceTableName(MODULE_NAME, 'activity_log'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    timestamp: integer('timestamp').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    activityType: textEnum('activity_type', HealthActivityType).notNull(),
    durationMin: integer('duration_min').notNull(),
    distanceKm: real('distance_km'),
    setsReps: text('sets_reps'),
    estimatedCalories: real('estimated_calories'),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const healthGoal = sqliteTable(namespaceTableName(MODULE_NAME, 'goal'), {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    targetWeightKg: real('target_weight_kg').notNull(),
    startDate: integer('start_date').notNull(),
    targetDate: integer('target_date').notNull(),
    description: text('description'),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});
export const healthSettings = sqliteTable(namespaceTableName(MODULE_NAME, 'settings'), {
    userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
    notifications: integer('notifications', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer('updated_at').notNull().default(sql `(cast(unixepoch('subsecond') * 1000 as integer))`)
});

import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { textEnum } from "@molos/database/utils";
import {
  TaskStatus,
  TaskPriority,
  ProjectStatus,
} from "../../models";

/**
 * Tasks module table schema
 * Stores all task-related data: Tasks, Projects, Areas, and Daily Log
 *
 * Fields follow naming convention: tasks_{entity_type}
 * All timestamps are stored as unix timestamps (seconds)
 */

/**
 * All Tasks - Master task list (Phase 1.1)
 */
export const tasksTasks = sqliteTable("MoLOS-Tasks_tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id"),
  title: text("title").notNull(), // Task Name
  description: text("description"),
  status: textEnum("status", TaskStatus).notNull().default(TaskStatus.TO_DO),
  priority: textEnum("priority", TaskPriority)
    .notNull()
    .default(TaskPriority.MEDIUM),
  dueDate: integer("due_date"), // Unix timestamp in seconds
  doDate: integer("do_date"), // Unix timestamp in seconds - for planning when to execute
  effort: integer("effort"), // Number: Minutes or Story Points
  context: text("context"), // JSON array: deep_work, phone, errands, fill_in, admin
  isCompleted: integer("is_completed", { mode: "boolean" })
    .notNull()
    .default(false), // Checkbox: "Done"
  projectId: text("project_id"), // Foreign key to tasks_projects
  areaId: text("area_id"), // Foreign key to tasks_areas
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

/**
 * Projects - Active work (Phase 1.2)
 */
export const tasksProjects = sqliteTable("MoLOS-Tasks_projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(), // Project Name
  status: textEnum("status", ProjectStatus)
    .notNull()
    .default(ProjectStatus.PLANNING),
  description: text("description"),
  startDate: integer("start_date"), // Unix timestamp
  endDate: integer("end_date"), // Unix timestamp
  areaId: text("area_id"), // Foreign key to tasks_areas
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

/**
 * Areas - Life Pillars (Phase 1.3)
 * High-level categories that never "end" (e.g., Health, Finance)
 */
export const tasksAreas = sqliteTable("MoLOS-Tasks_areas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(), // Area Name
  themeColor: text("theme_color"), // For visual coding
  description: text("description"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

/**
 * Daily Log - Tracking table (Phase 1.4)
 * One row per day
 */
export const tasksDailyLog = sqliteTable("MoLOS-Tasks_daily_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  logDate: integer("log_date").notNull(), // Unix timestamp for the day (Journal Date)
  mood: text("mood"), // 1-5 Stars or Emojis
  sleepHours: real("sleep_hours"), // Number
  morningRoutine: integer("morning_routine", { mode: "boolean" }).default(
    false,
  ), // Checkbox
  eveningRoutine: integer("evening_routine", { mode: "boolean" }).default(
    false,
  ), // Checkbox
  notes: text("notes"), // Free-form notes
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

/**
 * Tasks Settings - User preferences for the tasks module
 */
export const tasksSettings = sqliteTable("MoLOS-Tasks_settings", {
  userId: text("user_id").primaryKey(),
  showCompleted: integer("show_completed", { mode: "boolean" })
    .notNull()
    .default(false),
  compactMode: integer("compact_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  notifications: integer("notifications", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(strftime('%s','now'))`),
});

/**
 * Legacy export for backward compatibility
 * @deprecated Use tasksTasks instead
 */
export const tasks = tasksTasks;
export { TaskStatus, TaskPriority, ProjectStatus };

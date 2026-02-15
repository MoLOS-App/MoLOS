/**
 * Task Types - Master task list
 */

export const TaskStatus = {
  TO_DO: "to_do",
  IN_PROGRESS: "in_progress",
  WAITING: "waiting",
  DONE: "done",
  ARCHIVED: "archived",
} as const;

export const TaskPriority = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const ProjectStatus = {
  PLANNING: "planning",
  ACTIVE: "active",
  PAUSED: "paused",
  DONE: "done",
} as const;

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

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
export type TaskContext =
  | "deep_work"
  | "phone"
  | "errands"
  | "fill_in"
  | "admin";

export type CreateTaskInput = Omit<Task, "id" | "createdAt" | "updatedAt">;
export type UpdateTaskInput = Partial<Omit<CreateTaskInput, "userId">>;

/**
 * Project Types - Active work
 */
export interface Project {
  id: string;
  userId: string;
  name: string;
  status: (typeof ProjectStatus)[keyof typeof ProjectStatus];
  description?: string;
  startDate?: number; // Unix timestamp
  endDate?: number; // Unix timestamp
  areaId?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export type CreateProjectInput = Omit<
  Project,
  "id" | "createdAt" | "updatedAt"
>;
export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "userId">>;

/**
 * Area Types - Life Pillars
 */
export interface Area {
  id: string;
  userId: string;
  name: string;
  themeColor?: string; // For visual coding
  description?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export type CreateAreaInput = Omit<Area, "id" | "createdAt" | "updatedAt">;
export type UpdateAreaInput = Partial<Omit<CreateAreaInput, "userId">>;

/**
 * Daily Log Types - Tracking table
 */
export interface DailyLog {
  id: string;
  userId: string;
  logDate: number; // Unix timestamp for the day
  mood?: string; // 1-5 Stars or Emojis
  sleepHours?: number;
  morningRoutine: boolean;
  eveningRoutine: boolean;
  notes?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export type CreateDailyLogInput = Omit<
  DailyLog,
  "id" | "createdAt" | "updatedAt"
>;
export type UpdateDailyLogInput = Partial<
  Omit<CreateDailyLogInput, "userId" | "logDate">
>;

/**
 * Tasks Settings
 */
export interface TasksSettings {
  userId: string;
  showCompleted: boolean;
  compactMode: boolean;
  notifications: boolean;
  createdAt: number;
  updatedAt: number;
}

export type UpdateTasksSettingsInput = Partial<
  Omit<TasksSettings, "userId" | "createdAt" | "updatedAt">
>;

/**
 * AI Tool Types
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (params: any) => Promise<any>;
}

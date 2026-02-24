# MoLOS-Tasks Module - PRD Implementation Plan (MoLOS-Adapted)

## Executive Summary

This plan adapts the enterprise-grade task management PRD requirements to the current MoLOS architecture, which uses **SQLite**, **SvelteKit**, **Drizzle ORM**, and a **privacy-first, modular design**.

**Current State:** Basic task management with 5 tables (tasks, projects, areas, daily_log, settings) and simple CRUD operations.

**Target State:** Full-featured task management platform with workflows, automation, dependencies, time tracking, RBAC, and module-integrated events.

---

## Key Adaptations from Original PRD

| Aspect            | Original PRD      | MoLOS Adaptation                        | Rationale                           |
| ----------------- | ----------------- | --------------------------------------- | ----------------------------------- |
| **Database**      | Postgres          | SQLite (better-sqlite3)                 | Align with MoLOS stack, self-hosted |
| **Search Engine** | Typesense/Elastic | SQLite FTS5 or minimal external service | Simpler deployment, privacy-first   |
| **Job Queue**     | Redis (BullMQ)    | SQLite-based queue or memory queue      | No external service requirement     |
| **Realtime**      | WebSocket         | SSE or polling (v1), WebSocket (v2)     | Simpler initial implementation      |
| **Event System**  | Custom            | MoLOS Module Event Bus                  | Planned architecture integration    |
| **UI**            | Not implemented   | Not in scope (per PRD)                  | UI handled by separate agent        |
| **Deployment**    | SaaS-first        | Self-hosted + SaaS (hybrid)             | Privacy-first design                |
| **RBAC**          | Custom            | Integrated with MoLOS team system       | Reuse existing SaaS strategy        |

---

## Phase 1: Database Schema Expansion (Priority: P0)

### 1.1 New Tables to Create

**File:** `modules/MoLOS-Tasks/src/server/database/schema.ts`

```typescript
// Table names MUST follow: MoLOS-{ModuleName}_{table_name}
// All timestamps are Unix timestamps (integer)

// ==============================
// Task Types (Global Types)
// ==============================
export const tasksTaskTypes = sqliteTable('MoLOS-Tasks_task_types', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  description: text('description'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  createdBy: text('created_by').notNull()
});

// ==============================
// Project Task Types (Mapping with Defaults)
// ==============================
export const tasksProjectTaskTypes = sqliteTable('MoLOS-Tasks_project_task_types', {
  projectId: text('project_id').notNull().references(() => tasksProjects.id, { onDelete: 'cascade' }),
  taskTypeId: text('task_type_id').notNull().references(() => tasksTaskTypes.id, { onDelete: 'cascade' }),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
}, (table) => ({
  pk: primaryKey({ columns: [table.projectId, table.taskTypeId] })
}));

// ==============================
// Workflow Definitions (Per Project)
// ==============================
export const tasksWorkflows = sqliteTable('MoLOS-Tasks_workflows', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().unique().references(() => tasksProjects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  createdBy: text('created_by').notNull()
});

// ==============================
// Workflow Status Definitions
// ==============================
export const tasksWorkflowStatuses = sqliteTable('MoLOS-Tasks_workflow_statuses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workflowId: text('workflow_id').notNull().references(() => tasksWorkflows.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  key: text('key').notNull(),
  position: integer('position').notNull(),
  category: text('category', { enum: ['backlog', 'todo', 'in_progress', 'done', 'cancelled'] }).notNull(),
  color: text('color'),
  icon: text('icon'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
}, (table) => ({
  uniqueWorkflowKey: unique('unique_workflow_key').on(table.workflowId, table.key)
}));

// ==============================
// Workflow Transitions
// ==============================
export const tasksWorkflowTransitions = sqliteTable('MoLOS-Tasks_workflow_transitions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workflowId: text('workflow_id').notNull().references(() => tasksWorkflows.id, { onDelete: 'cascade' }),
  fromStatusId: text('from_status_id').notNull().references(() => tasksWorkflowStatuses.id, { onDelete: 'cascade' }),
  toStatusId: text('to_status_id').notNull().references(() => tasksWorkflowStatuses.id, { onDelete: 'cascade' }),
  isAllowed: integer('is_allowed', { mode: 'boolean' }).notNull().default(true),
  requiresComment: integer('requires_comment', { mode: 'boolean' }).notNull().default(false),
  autoTransition: integer('auto_transition', { mode: 'boolean' }).notNull().default(false),
  conditionExpression: text('condition_expression'), // JSON path or expression
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
}, (table) => ({
  uniqueTransition: unique('unique_transition').on(table.workflowId, table.fromStatusId, table.toStatusId)
}));

// ==============================
// Comments
// ==============================
export const tasksComments = sqliteTable('MoLOS-Tasks_comments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  taskId: text('task_id').notNull().references(() => tasksTasks.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parentId: text('parent_id').references(() => tasksComments.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

// ==============================
// Attachments
// ==============================
export const tasksAttachments = sqliteTable('MoLOS-Tasks_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  taskId: text('task_id').notNull().references(() => tasksTasks.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  fileType: text('file_type').notNull(),
  storagePath: text('storage_path').notNull(),
  uploadUrl: text('upload_url'), // Signed URL for upload
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

// ==============================
// Audit Log
// ==============================
export const tasksAuditLog = sqliteTable('MoLOS-Tasks_audit_log', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  taskId: text('task_id').references(() => tasksTasks.id, { onDelete: 'set null' }),
  action: text('action', { enum: ['create', 'update', 'delete', 'transition', 'complete', 'archive', 'unarchive', 'block', 'unblock'] }).notNull(),
  entityType: text('entity_type').notNull(), // 'task', 'comment', 'attachment', etc.
  entityId: text('entity_id').notNull(),
  changes: text('changes'), // JSON diff of changes
  oldValue: text('old_value'), // JSON
  newValue: text('new_value'), // JSON
  metadata: text('metadata'), // JSON (ip, user_agent, etc.)
  reason: text('reason'), // For overrides
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

// ==============================
// Automation Rules
// ==============================
export const tasksAutomationRules = sqliteTable('MoLOS-Tasks_automation_rules', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => tasksProjects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  eventType: text('event_type').notNull(), // 'task.created', 'task.updated', 'task.transitioned', etc.
  conditionExpression: text('condition_expression').notNull(), // JSON path or expression
  actions: text('actions').notNull(), // JSON array of actions
  priority: integer('priority').notNull().default(0), // Execution order
  lastTriggeredAt: integer('last_triggered_at'),
  triggerCount: integer('trigger_count').notNull().default(0),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  createdBy: text('created_by').notNull()
});

// ==============================
// Automation Execution Log
// ==============================
export const tasksAutomationExecutions = sqliteTable('MoLOS-Tasks_automation_executions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ruleId: text('rule_id').notNull().references(() => tasksAutomationRules.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasksTasks.id, { onDelete: 'set null' }),
  userId: text('user_id').notNull(),
  eventPayload: text('event_payload').notNull(), // JSON
  evaluationResult: text('evaluation_result'), // 'matched', 'not_matched', 'error'
  errorMessage: text('error_message'),
  actionsExecuted: text('actions_executed'), // JSON
  executionTimeMs: integer('execution_time_ms'),
  status: text('status', { enum: ['success', 'failed', 'retrying'] }).notNull(),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))')
});

// ==============================
// Epics (Optional - High-level Grouping)
// ==============================
export const tasksEpics = sqliteTable('MoLOS-Tasks_epics', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull().references(() => tasksProjects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['planning', 'active', 'completed', 'cancelled'] }).notNull().default('planning'),
  startDate: integer('start_date'),
  endDate: integer('end_date'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`)
});

// ==============================
// Sprints (Optional - Time-boxed Iterations)
// ==============================
export const tasksSprints = sqliteTable('MoLOS-Tasks_sprints', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  projectId: text('project_id').notNull().references(() => tasksProjects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  startDate: integer('start_date').notNull(),
  endDate: integer('end_date').notNull(),
  status: text('status', { enum: ['planning', 'active', 'completed', 'cancelled'] }).notNull().default('planning'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(strftime('%s','now'))')
});

// ==============================
// Webhooks (for External Integrations)
// ==============================
export const tasksWebhooks = sqliteTable('MoLOS-Tasks_webhooks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => tasksProjects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  url: text('url').notNull(),
  events: text('events').notNull(), // JSON array of event types
  secret: text('secret').notNull(), // HMAC signing secret
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastDeliveredAt: integer('last_delivered_at'),
  deliveryCount: integer('delivery_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))'),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(strftime('%s','now'))')
});

// ==============================
// Webhook Delivery Log
// ==============================
export const tasksWebhookDeliveries = sqliteTable('MoLOS-Tasks_webhook_deliveries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  webhookId: text('webhook_id').notNull().references(() => tasksWebhooks.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull(), // Reference to audit_log or event payload
  payload: text('payload').notNull(), // JSON
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  durationMs: integer('duration_ms'),
  status: text('status', { enum: ['success', 'failed', 'retrying'] }).notNull(),
  retryCount: integer('retry_count').notNull().default(0),
  scheduledAt: integer('scheduled_at').notNull(),
  attemptedAt: integer('attempted_at'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))')
});
```

### 1.2 Alter Existing Tables

```typescript
// Update existing tasksTasks table
// Note: In SQLite, ALTER TABLE is limited. We'll create a migration that:
// 1. Creates a new table with all columns
// 2. Copies data from old table
// 3. Drops old table
// 4. Renames new table to tasksTasks

// New columns to add:
export const tasksTasks = sqliteTable('MoLOS-Tasks_tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),
  title: text('title').notNull(),
  description: text('description'),

  // NEW: Task type reference
  taskTypeId: text('task_type_id').references(() => tasksTaskTypes.id, { onDelete: 'set null' }),

  // NEW: Workflow status reference (replaces legacy status)
  statusId: text('status_id').references(() => tasksWorkflowStatuses.id, { onDelete: 'set null' }),

  // Keep legacy status for migration compatibility
  legacyStatus: text('legacy_status', { enum: ['to_do', 'in_progress', 'waiting', 'done', 'archived'] }),

  // NEW: Fractional position for ordering
  position: integer('position').notNull().default(0),

  // NEW: Multiple assignees (JSON array)
  assigneeIds: text('assignee_ids'), // JSON: ["user1", "user2"]

  // NEW: Parent task for subtasks
  parentId: text('parent_id').references(() => id, { onDelete: 'cascade' }),

  // NEW: Epic grouping
  epicId: text('epic_id').references(() => tasksEpics.id, { onDelete: 'set null' }),

  // NEW: Sprint grouping
  sprintId: text('sprint_id').references(() => tasksSprints.id, { onDelete: 'set null' }),

  // NEW: Time tracking fields
  estimateHours: integer('estimate_hours'),
  timeSpentHours: integer('time_spent_hours').notNull().default(0),

  // NEW: Dependency blocking
  blockedByIds: text('blocked_by_ids'), // JSON: ["task1", "task2"]

  // NEW: Flexible labels
  labels: text('labels'), // JSON: ["bug", "feature"]

  // NEW: Custom fields (flexible JSON)
  customFields: text('custom_fields'), // JSON: { "custom1": "value", "custom2": 123 }

  // NEW: Start date
  startDate: integer('start_date'),

  dueDate: integer('due_date'),

  // NEW: Soft delete
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),

  // NEW: Optimistic concurrency version
  version: integer('version').notNull().default(1),

  // NEW: Creator tracking
  createdBy: text('created_by'),

  // Existing fields
  priority: text('priority', { enum: ['high', 'medium', 'low'] }).notNull().default('medium'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  projectId: text('project_id').references(() => tasksProjects.id, { onDelete: 'set null' }),
  areaId: text('area_id').references(() => tasksAreas.id, { onDelete: 'set null' }),
  effort: integer('effort'),
  context: text('context'), // JSON array
  doDate: integer('do_date'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(strftime('%s','now'))')
});

// Create indexes for performance
// Note: These will be created in the migration
// CREATE INDEX idx_tasks_position ON MoLOS-Tasks_tasks(project_id, position);
// CREATE INDEX idx_tasks_status_id ON MoLOS-Tasks_tasks(status_id);
// CREATE INDEX idx_tasks_parent_id ON MoLOS-Tasks_tasks(parent_id);
// CREATE INDEX idx_tasks_project_id ON MoLOS-Tasks_tasks(project_id);
// CREATE INDEX idx_tasks_archived ON MoLOS-Tasks_tasks(archived);
// CREATE INDEX idx_tasks_created_by ON MoLOS-Tasks_tasks(created_by);
```

### 1.3 Migration Strategy

**File:** `modules/MoLOS-Tasks/drizzle/0002_enhanced_task_features.sql`

```sql
-- ========================================================
-- Migration: Enhanced Task Features
-- Author: MoLOS-Tasks Module
-- Date: 2026-02-24
-- ========================================================

-- Step 1: Create new tables
CREATE TABLE MoLOS-Tasks_task_types_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE MoLOS-Tasks_project_task_types_new (
  project_id TEXT NOT NULL REFERENCES MoLOS-Tasks_projects(id) ON DELETE CASCADE,
  task_type_id TEXT NOT NULL REFERENCES MoLOS-Tasks_task_types_new(id) ON DELETE CASCADE,
  is_default INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, task_type_id)
);

-- ... (create all other new tables) ...

--> statement-breakpoint

-- Step 2: Create backup of existing tasks table
CREATE TABLE MoLOS-Tasks_tasks_backup AS SELECT * FROM MoLOS-Tasks_tasks;

--> statement-breakpoint

-- Step 3: Drop old tasks table
DROP TABLE MoLOS-Tasks_tasks;

--> statement-breakpoint

-- Step 4: Create new tasks table with all columns
CREATE TABLE MoLOS-Tasks_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  description TEXT,

  -- New fields
  task_type_id TEXT REFERENCES MoLOS-Tasks_task_types_new(id) ON DELETE SET NULL,
  status_id TEXT,
  legacy_status TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  assignee_ids TEXT,
  parent_id TEXT REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE,
  epic_id TEXT,
  sprint_id TEXT,
  estimate_hours INTEGER,
  time_spent_hours INTEGER NOT NULL DEFAULT 0,
  blocked_by_ids TEXT,
  labels TEXT,
  custom_fields TEXT,
  start_date INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,

  -- Existing fields
  priority TEXT NOT NULL DEFAULT 'medium',
  is_completed INTEGER NOT NULL DEFAULT 0,
  project_id TEXT REFERENCES MoLOS-Tasks_projects(id) ON DELETE SET NULL,
  area_id TEXT REFERENCES MoLOS-Tasks_areas(id) ON DELETE SET NULL,
  effort INTEGER,
  context TEXT,
  do_date INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

--> statement-breakpoint

-- Step 5: Restore data from backup
INSERT INTO MoLOS-Tasks_tasks (
  id, user_id, title, description,
  legacy_status, priority, is_completed,
  project_id, area_id, effort, context, do_date,
  created_at, updated_at
)
SELECT
  id, user_id, title, description,
  status AS legacy_status, priority, is_completed,
  project_id, area_id, effort, context, do_date,
  created_at, updated_at
FROM MoLOS-Tasks_tasks_backup;

--> statement-breakpoint

-- Step 6: Create indexes
CREATE INDEX idx_tasks_position ON MoLOS-Tasks_tasks(project_id, position);
CREATE INDEX idx_tasks_status_id ON MoLOS-Tasks_tasks(status_id);
CREATE INDEX idx_tasks_task_type_id ON MoLOS-Tasks_tasks(task_type_id);
CREATE INDEX idx_tasks_parent_id ON MoLOS-Tasks_tasks(parent_id);
CREATE INDEX idx_tasks_epic_id ON MoLOS-Tasks_tasks(epic_id);
CREATE INDEX idx_tasks_sprint_id ON MoLOS-Tasks_tasks(sprint_id);
CREATE INDEX idx_tasks_archived ON MoLOS-Tasks_tasks(archived);
CREATE INDEX idx_tasks_created_by ON MoLOS-Tasks_tasks(created_by);

--> statement-breakpoint

-- Step 7: Create default workflow and statuses
-- Default workflow statuses
INSERT INTO MoLOS-Tasks_workflows (id, project_id, name, description, is_default, created_at, created_by)
SELECT
  'default-' || project_id AS id,
  project_id,
  'Default Workflow' AS name,
  'Default workflow for project' AS description,
  1 AS is_default,
  strftime('%s', 'now') AS created_at,
  'system' AS created_by
FROM MoLOS-Tasks_projects;

-- Default statuses
INSERT INTO MoLOS-Tasks_workflow_statuses (id, workflow_id, name, key, position, category, color, icon, created_at)
SELECT
  'status-backlog-' || w.id AS id,
  w.id AS workflow_id,
  'Backlog' AS name,
  'backlog' AS key,
  0 AS position,
  'backlog' AS category,
  '#6B7280' AS color,
  'Circle' AS icon,
  strftime('%s', 'now') AS created_at
FROM MoLOS-Tasks_workflows w;

INSERT INTO MoLOS-Tasks_workflow_statuses (id, workflow_id, name, key, position, category, color, icon, created_at)
SELECT
  'status-todo-' || w.id AS id,
  w.id AS workflow_id,
  'To Do' AS name,
  'todo' AS key,
  1 AS position,
  'todo' AS category,
  '#3B82F6' AS color,
  'Circle' AS icon,
  strftime('%s', 'now') AS created_at
FROM MoLOS-Tasks_workflows w;

INSERT INTO MoLOS-Tasks_workflow_statuses (id, workflow_id, name, key, position, category, color, icon, created_at)
SELECT
  'status-inprogress-' || w.id AS id,
  w.id AS workflow_id,
  'In Progress' AS name,
  'in_progress' AS key,
  2 AS position,
  'in_progress' AS category,
  '#F59E0B' AS color,
  'Circle' AS icon,
  strftime('%s', 'now') AS created_at
FROM MoLOS-Tasks_workflows w;

INSERT INTO MoLOS-Tasks_workflow_statuses (id, workflow_id, name, key, position, category, color, icon, created_at)
SELECT
  'status-done-' || w.id AS id,
  w.id AS workflow_id,
  'Done' AS name,
  'done' AS key,
  3 AS position,
  'done' AS category,
  '#10B981' AS color,
  'Circle' AS icon,
  strftime('%s', 'now') AS created_at
FROM MoLOS-Tasks_workflows w;

INSERT INTO MoLOS-Tasks_workflow_statuses (id, workflow_id, name, key, position, category, color, icon, created_at)
SELECT
  'status-cancelled-' || w.id AS id,
  w.id AS workflow_id,
  'Cancelled' AS name,
  'cancelled' AS key,
  4 AS position,
  'cancelled' AS category,
  '#EF4444' AS color,
  'Circle' AS icon,
  strftime('%s', 'now') AS created_at
FROM MoLOS-Tasks_workflows w;

--> statement-breakpoint

-- Step 8: Migrate legacy status to workflow status
-- Map: to_do -> todo, in_progress -> in_progress, waiting -> backlog, done -> done, archived -> cancelled
UPDATE MoLOS-Tasks_tasks
SET status_id = (
  SELECT id FROM MoLOS-Tasks_workflow_statuses
  WHERE workflow_id = 'default-' || project_id
  AND key = CASE legacy_status
    WHEN 'to_do' THEN 'todo'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'waiting' THEN 'backlog'
    WHEN 'done' THEN 'done'
    WHEN 'archived' THEN 'cancelled'
  END
  LIMIT 1
)
WHERE legacy_status IS NOT NULL;

--> statement-breakpoint

-- Step 9: Cleanup
DROP TABLE MoLOS-Tasks_tasks_backup;
```

---

## Phase 2: Domain Services Layer (Priority: P0)

### 2.1 Service Layer Architecture

**New directory:** `modules/MoLOS-Tasks/src/server/services/`

```
modules/MoLOS-Tasks/src/server/services/
├── index.ts
├── task-service.ts
├── workflow-service.ts
├── automation-service.ts
├── dependency-service.ts
├── audit-service.ts
└── integration-service.ts
```

### 2.2 Task Service

**File:** `modules/MoLOS-Tasks/src/server/services/task-service.ts`

```typescript
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type {
	Task,
	CreateTaskInput,
	UpdateTaskInput
} from '$lib/models/external_modules/MoLOS-Tasks';
import { TaskRepository } from '$lib/repositories/external_modules/MoLOS-Tasks';
import { WorkflowService } from './workflow-service.js';
import { AuditService } from './audit-service.js';
import { AutomationService } from './automation-service.js';
import { DependencyService } from './dependency-service.js';
import { getEventBus } from '$lib/server/modules/events/bus';

export class TaskService {
	constructor(
		private taskRepo: TaskRepository,
		private workflowService: WorkflowService,
		private auditService: AuditService,
		private automationService: AutomationService,
		private dependencyService: DependencyService,
		private eventBus = getEventBus()
	) {}

	/**
	 * Create a new task with validation
	 */
	async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
		// Validate task type is enabled for project (if provided)
		if (input.projectId && input.taskTypeId) {
			const isValid = await this.workflowService.validateTaskTypeForProject(
				input.taskTypeId,
				input.projectId
			);
			if (!isValid) {
				throw new Error(
					`Task type ${input.taskTypeId} is not enabled for project ${input.projectId}`
				);
			}
		}

		// Set default status if not provided
		if (!input.statusId && input.projectId) {
			const defaultStatus = await this.workflowService.getDefaultStatus(input.projectId);
			input.statusId = defaultStatus.id;
		}

		// Set initial fractional position if not provided
		if (!input.position) {
			// Get max position in project and add 1
			const maxPosition = await this.taskRepo.getMaxPosition(input.projectId);
			input.position = maxPosition ? maxPosition + 1000 : 1000; // Use 1000 for fragmentation buffer
		}

		// Create task
		const task = await this.taskRepo.create({
			...input,
			userId,
			version: 1,
			archived: false,
			createdAt: Math.floor(Date.now() / 1000),
			updatedAt: Math.floor(Date.now() / 1000),
			createdBy: userId
		});

		// Create audit log entry
		await this.auditService.logAction({
			userId,
			taskId: task.id,
			action: 'create',
			entityType: 'task',
			entityId: task.id,
			newValue: JSON.stringify(task),
			createdAt: Math.floor(Date.now() / 1000)
		});

		// Publish event for module communication
		this.eventBus.publish('MoLOS-Tasks', 'task.created', { taskId: task.id, userId });

		// Trigger automations
		await this.automationService.evaluateRules({
			type: 'task.created',
			source: 'MoLOS-Tasks',
			data: task,
			timestamp: Date.now()
		});

		return task;
	}

	/**
	 * Update task with optimistic concurrency check
	 */
	async updateTask(
		id: string,
		userId: string,
		updates: Partial<UpdateTaskInput>,
		version: number,
		reason?: string
	): Promise<Task> {
		// Check version matches (optimistic concurrency)
		const existing = await this.taskRepo.getById(id, userId);
		if (!existing) {
			throw new Error('Task not found');
		}

		if (existing.version !== version) {
			throw new Error(`Version mismatch: expected ${existing.version}, got ${version}`);
		}

		// Calculate changes for audit log
		const changes = this.calculateChanges(existing, updates);

		// Validate changes against domain rules
		await this.validateUpdate(existing, updates, userId);

		// Update task (auto-increment version)
		const task = await this.taskRepo.update(id, userId, {
			...updates,
			version: version + 1,
			updatedAt: Math.floor(Date.now() / 1000)
		});

		if (!task) {
			throw new Error('Failed to update task');
		}

		// Create audit log entry
		await this.auditService.logAction({
			userId,
			taskId: task.id,
			action: 'update',
			entityType: 'task',
			entityId: task.id,
			changes: JSON.stringify(changes),
			oldValue: JSON.stringify(existing),
			newValue: JSON.stringify(task),
			reason,
			createdAt: Math.floor(Date.now() / 1000)
		});

		// Publish event for module communication
		this.eventBus.publish('MoLOS-Tasks', 'task.updated', { taskId: task.id, userId, changes });

		// Trigger automations
		await this.automationService.evaluateRules({
			type: 'task.updated',
			source: 'MoLOS-Tasks',
			data: task,
			changes,
			timestamp: Date.now()
		});

		return task;
	}

	/**
	 * Delete task (soft delete via archive)
	 */
	async deleteTask(id: string, userId: string): Promise<void> {
		const task = await this.taskRepo.getById(id, userId);
		if (!task) {
			throw new Error('Task not found');
		}

		// Check if has subtasks (reject if yes)
		const hasSubtasks = await this.taskRepo.hasSubtasks(id);
		if (hasSubtasks) {
			throw new Error('Cannot delete task with subtasks. Delete or reassign subtasks first.');
		}

		// Check if has open dependencies
		const hasBlockingDependencies = await this.dependencyService.hasBlockingDependencies(id);
		if (hasBlockingDependencies) {
			throw new Error(
				'Cannot delete task that is blocking other tasks. Resolve dependencies first.'
			);
		}

		// Soft delete (archive)
		await this.taskRepo.archive(id, userId);

		// Create audit log entry
		await this.auditService.logAction({
			userId,
			taskId: task.id,
			action: 'delete',
			entityType: 'task',
			entityId: task.id,
			oldValue: JSON.stringify(task),
			createdAt: Math.floor(Date.now() / 1000)
		});

		// Publish event
		this.eventBus.publish('MoLOS-Tasks', 'task.deleted', { taskId: task.id, userId });
	}

	/**
	 * Reorder task with fractional position algorithm
	 */
	async reorderTask(
		id: string,
		userId: string,
		newPosition: number,
		insertAfterId?: string,
		insertBeforeId?: string
	): Promise<Task> {
		const task = await this.taskRepo.getById(id, userId);
		if (!task) {
			throw new Error('Task not found');
		}

		let calculatedPosition: number;

		if (insertAfterId || insertBeforeId) {
			// Calculate position based on neighbors
			const neighbor = insertAfterId
				? await this.taskRepo.getById(insertAfterId, userId)
				: await this.taskRepo.getById(insertBeforeId, userId);

			if (!neighbor) {
				throw new Error('Neighbor task not found');
			}

			if (insertAfterId) {
				// Position after neighbor (neighbor.position + 1000)
				calculatedPosition = neighbor.position + 1000;
			} else {
				// Position before neighbor (neighbor.position - 1000)
				calculatedPosition = neighbor.position - 1000;
			}
		} else {
			// Use provided position
			calculatedPosition = newPosition;
		}

		// Update position
		const updated = await this.taskRepo.updatePosition(id, calculatedPosition, userId);
		if (!updated) {
			throw new Error('Failed to reorder task');
		}

		// Check for fragmentation and trigger reindexing if needed
		await this.checkFragmentationAndReindex(task.projectId);

		// Create audit log entry
		await this.auditService.logAction({
			userId,
			taskId: task.id,
			action: 'update',
			entityType: 'task',
			entityId: task.id,
			changes: JSON.stringify({ position: { old: task.position, new: calculatedPosition } }),
			createdAt: Math.floor(Date.now() / 1000)
		});

		// Publish event
		this.eventBus.publish('MoLOS-Tasks', 'task.reordered', {
			taskId: task.id,
			userId,
			newPosition: calculatedPosition
		});

		return updated;
	}

	/**
	 * Create subtask
	 */
	async createSubtask(parentId: string, input: CreateTaskInput, userId: string): Promise<Task> {
		const parent = await this.taskRepo.getById(parentId, userId);
		if (!parent) {
			throw new Error('Parent task not found');
		}

		// Validate parent and child share same project
		if (input.projectId && input.projectId !== parent.projectId) {
			throw new Error('Parent and child tasks must belong to the same project');
		}

		// Ensure child has same project as parent
		input.projectId = parent.projectId;
		input.parentId = parentId;

		// Create subtask
		const subtask = await this.createTask(input, userId);

		return subtask;
	}

	/**
	 * Complete task with blocker validation
	 */
	async completeTask(
		id: string,
		userId: string,
		override: boolean = false,
		reason?: string
	): Promise<Task> {
		const task = await this.taskRepo.getById(id, userId);
		if (!task) {
			throw new Error('Task not found');
		}

		// Check for unresolved blockers
		const hasUnresolvedBlockers = await this.dependencyService.hasUnresolvedBlockers(id);
		if (hasUnresolvedBlockers && !override) {
			throw new Error(
				'Cannot complete task with unresolved blockers. Use override=true to bypass.'
			);
		}

		// Get "done" status from workflow
		const doneStatus = await this.workflowService.getDoneStatus(task.projectId);
		if (!doneStatus) {
			throw new Error('No "done" status found in project workflow');
		}

		// Update task
		const updated = await this.taskRepo.update(id, userId, {
			statusId: doneStatus.id,
			isCompleted: true,
			version: task.version + 1,
			updatedAt: Math.floor(Date.now() / 1000)
		});

		if (!updated) {
			throw new Error('Failed to complete task');
		}

		// If override was used, log reason
		if (hasUnresolvedBlockers && override) {
			await this.auditService.logAction({
				userId,
				taskId: task.id,
				action: 'complete',
				entityType: 'task',
				entityId: task.id,
				reason: reason || 'Completed task with unresolved blockers (override)',
				createdAt: Math.floor(Date.now() / 1000)
			});
		}

		// Publish event
		this.eventBus.publish('MoLOS-Tasks', 'task.completed', { taskId: task.id, userId });

		return updated;
	}

	/**
	 * Get tasks with cursor pagination
	 */
	async getTasksPaginated(
		userId: string,
		projectId?: string,
		cursor?: string,
		limit: number = 50,
		filters?: TaskFilters
	): Promise<CursorPaginatedResult<Task>> {
		return this.taskRepo.getByCursor(userId, projectId, cursor, limit, filters);
	}

	// ==============================
	// Private Helper Methods
	// ==============================

	private calculateChanges(
		existing: Task,
		updates: Partial<UpdateTaskInput>
	): Record<string, { old: any; new: any }> {
		const changes: Record<string, { old: any; new: any }> = {};

		for (const [key, value] of Object.entries(updates)) {
			if (existing[key as keyof Task] !== value) {
				changes[key] = { old: existing[key as keyof Task], new: value };
			}
		}

		return changes;
	}

	private async validateUpdate(
		existing: Task,
		updates: Partial<UpdateTaskInput>,
		userId: string
	): Promise<void> {
		// Validate task type change is allowed
		if (updates.taskTypeId && existing.projectId) {
			const isValid = await this.workflowService.validateTaskTypeForProject(
				updates.taskTypeId,
				existing.projectId
			);
			if (!isValid) {
				throw new Error(
					`Task type ${updates.taskTypeId} is not enabled for project ${existing.projectId}`
				);
			}
		}

		// Validate parent-child same project if changing parent
		if (updates.parentId !== undefined) {
			if (updates.parentId) {
				const parent = await this.taskRepo.getById(updates.parentId, userId);
				if (parent && parent.projectId !== existing.projectId) {
					throw new Error('Parent and child tasks must belong to the same project');
				}
			}
		}

		// Validate dates (start_date <= due_date)
		const startDate = updates.startDate ?? existing.startDate;
		const dueDate = updates.dueDate ?? existing.dueDate;
		if (startDate && dueDate && startDate > dueDate) {
			throw new Error('Start date must be before or equal to due date');
		}
	}

	private async checkFragmentationAndReindex(projectId?: string): Promise<void> {
		// Check if positions are fragmented (too small gaps)
		// If fragmentation > threshold, trigger reindexing
		// This is a simplified version - production would be more sophisticated
		const threshold = 1000; // If gaps < 1000, it's fragmented

		// For now, skip reindexing (would be a background job)
		// TODO: Implement background reindexing job
	}
}

// Type definitions
export interface TaskFilters {
	statusId?: string;
	assigneeId?: string;
	labels?: string[];
	epicId?: string;
	sprintId?: string;
	archived?: boolean;
	searchQuery?: string;
}

export interface CursorPaginatedResult<T> {
	items: T[];
	nextCursor?: string;
	hasMore: boolean;
}
```

### 2.3 Workflow Service

**File:** `modules/MoLOS-Tasks/src/server/services/workflow-service.ts`

```typescript
import { eq } from 'drizzle-orm';
import type {
	Workflow,
	WorkflowStatus,
	WorkflowTransition,
	CreateWorkflowInput,
	CreateStatusInput
} from '$lib/models/external_modules/MoLOS-Tasks';
import { WorkflowRepository } from '$lib/repositories/external_modules/MoLOS-Tasks';
import { AuditService } from './audit-service.js';

export class WorkflowService {
	constructor(
		private workflowRepo: WorkflowRepository,
		private auditService: AuditService
	) {}

	/**
	 * Get or create default workflow for project
	 */
	async getProjectWorkflow(projectId: string): Promise<Workflow> {
		let workflow = await this.workflowRepo.getByProjectId(projectId);

		if (!workflow) {
			// Create default workflow
			workflow = await this.createDefaultWorkflow(projectId);
		}

		return workflow;
	}

	/**
	 * Create default workflow with standard statuses
	 */
	async createDefaultWorkflow(projectId: string): Promise<Workflow> {
		const workflowId = `default-${projectId}`;

		// Create workflow
		const workflow = await this.workflowRepo.create({
			id: workflowId,
			projectId,
			name: 'Default Workflow',
			description: 'Default workflow for project',
			isDefault: true,
			createdAt: Math.floor(Date.now() / 1000),
			createdBy: 'system'
		});

		// Create default statuses: backlog, todo, in_progress, done, cancelled
		const statuses = await Promise.all([
			this.workflowRepo.createStatus({
				id: `status-backlog-${workflowId}`,
				workflowId,
				name: 'Backlog',
				key: 'backlog',
				position: 0,
				category: 'backlog',
				color: '#6B7280',
				icon: 'Circle',
				createdAt: Math.floor(Date.now() / 1000)
			}),
			this.workflowRepo.createStatus({
				id: `status-todo-${workflowId}`,
				workflowId,
				name: 'To Do',
				key: 'todo',
				position: 1,
				category: 'todo',
				color: '#3B82F6',
				icon: 'Circle',
				createdAt: Math.floor(Date.now() / 1000)
			}),
			this.workflowRepo.createStatus({
				id: `status-inprogress-${workflowId}`,
				workflowId,
				name: 'In Progress',
				key: 'in_progress',
				position: 2,
				category: 'in_progress',
				color: '#F59E0B',
				icon: 'Circle',
				createdAt: Math.floor(Date.now() / 1000)
			}),
			this.workflowRepo.createStatus({
				id: `status-done-${workflowId}`,
				workflowId,
				name: 'Done',
				key: 'done',
				position: 3,
				category: 'done',
				color: '#10B981',
				icon: 'Circle',
				createdAt: Math.floor(Date.now() / 1000)
			}),
			this.workflowRepo.createStatus({
				id: `status-cancelled-${workflowId}`,
				workflowId,
				name: 'Cancelled',
				key: 'cancelled',
				position: 4,
				category: 'cancelled',
				color: '#EF4444',
				icon: 'Circle',
				createdAt: Math.floor(Date.now() / 1000)
			})
		]);

		// Create allowed transitions (can move forward/backward)
		for (const fromStatus of statuses) {
			for (const toStatus of statuses) {
				if (fromStatus.id !== toStatus.id) {
					await this.workflowRepo.createTransition({
						workflowId,
						fromStatusId: fromStatus.id,
						toStatusId: toStatus.id,
						isAllowed: true,
						requiresComment: false,
						autoTransition: false,
						createdAt: Math.floor(Date.now() / 1000)
					});
				}
			}
		}

		return workflow;
	}

	/**
	 * Validate task type is enabled for project
	 */
	async validateTaskTypeForProject(taskTypeId: string, projectId: string): Promise<boolean> {
		const projectTaskType = await this.workflowRepo.getProjectTaskType(projectId, taskTypeId);
		return !!projectTaskType;
	}

	/**
	 * Get default status for project
	 */
	async getDefaultStatus(projectId: string): Promise<WorkflowStatus> {
		const workflow = await this.getProjectWorkflow(projectId);
		const status = await this.workflowRepo.getStatusByKey(workflow.id, 'todo');
		return status;
	}

	/**
	 * Get done status for project
	 */
	async getDoneStatus(projectId: string): Promise<WorkflowStatus | null> {
		const workflow = await this.getProjectWorkflow(projectId);
		return this.workflowRepo.getStatusByKey(workflow.id, 'done');
	}

	/**
	 * Validate transition
	 */
	async validateTransition(
		taskId: string,
		fromStatusId: string,
		toStatusId: string,
		userId: string
	): Promise<TransitionValidation> {
		const transition = await this.workflowRepo.getTransition(fromStatusId, toStatusId);
		if (!transition || !transition.isAllowed) {
			return {
				allowed: false,
				reason: `Transition from ${fromStatusId} to ${toStatusId} is not allowed`
			};
		}

		// Check for blockers if transitioning to done
		const toStatus = await this.workflowRepo.getStatusById(toStatusId);
		if (toStatus?.category === 'done') {
			// Would check blockers here (via dependency service)
			// For now, just allow
		}

		return {
			allowed: true,
			reason: null
		};
	}

	/**
	 * Execute transition
	 */
	async executeTransition(
		taskId: string,
		toStatusId: string,
		userId: string,
		comment?: string,
		override: boolean = false,
		reason?: string
	): Promise<Task> {
		const task = await this.taskRepo.getById(taskId, userId);
		if (!task) {
			throw new Error('Task not found');
		}

		const currentStatusId = task.statusId;
		if (!currentStatusId) {
			throw new Error('Task has no status');
		}

		// Validate transition
		const validation = await this.validateTransition(taskId, currentStatusId, toStatusId, userId);
		if (!validation.allowed) {
			throw new Error(validation.reason);
		}

		// Check for blockers (invariant - must be synchronous)
		const toStatus = await this.workflowRepo.getStatusById(toStatusId);
		if (toStatus?.category === 'done') {
			const hasUnresolvedBlockers = await this.dependencyService.hasUnresolvedBlockers(taskId);
			if (hasUnresolvedBlockers && !override) {
				throw new Error(
					'Cannot transition to "done" with unresolved blockers. Use override=true to bypass.'
				);
			}
		}

		// Execute synchronous side-effects (clear blockers if configured)
		// TODO: Implement side-effect execution

		// Update task status
		const updated = await this.taskRepo.update(taskId, userId, {
			statusId: toStatusId,
			isCompleted: toStatus?.category === 'done',
			version: task.version + 1,
			updatedAt: Math.floor(Date.now() / 1000)
		});

		if (!updated) {
			throw new Error('Failed to execute transition');
		}

		// Create audit log entry
		await this.auditService.logAction({
			userId,
			taskId: task.id,
			action: 'transition',
			entityType: 'task',
			entityId: task.id,
			changes: JSON.stringify({ statusId: { old: currentStatusId, new: toStatusId } }),
			oldValue: JSON.stringify({ statusId: currentStatusId }),
			newValue: JSON.stringify({ statusId: toStatusId }),
			reason,
			createdAt: Math.floor(Date.now() / 1000)
		});

		// Publish event
		this.eventBus.publish('MoLOS-Tasks', 'task.transitioned', {
			taskId: task.id,
			userId,
			fromStatusId: currentStatusId,
			toStatusId
		});

		return updated;
	}
}

export interface TransitionValidation {
	allowed: boolean;
	reason: string | null;
}
```

---

## Phase 3: API Layer Updates (Priority: P0)

### 3.1 REST API Endpoints

**File:** `modules/MoLOS-Tasks/src/routes/api/tasks/[id]/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TaskService } from '$lib/modules/MoLOS-Tasks/services/task-service.js';
import { db } from '$lib/server/db';

// GET /api/MoLOS-Tasks/tasks/:id
export const GET: RequestHandler = async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const taskService = new TaskService(/*...*/);
	const task = await taskService.getTaskById(params.id, userId);

	if (!task) {
		throw error(404, 'Task not found');
	}

	return json(task);
};

// PATCH /api/MoLOS-Tasks/tasks/:id - Partial update with version checking
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const version = request.headers.get('if-match');
	if (!version) {
		throw error(400, 'Missing If-Match header with version');
	}

	const updates = await request.json();
	const taskService = new TaskService(/*...*/);

	try {
		const task = await taskService.updateTask(params.id, userId, updates, parseInt(version));
		return json(task);
	} catch (err) {
		if (err.message.includes('Version mismatch')) {
			throw error(409, 'Version mismatch. Task was modified by another user.');
		}
		throw error(400, err.message);
	}
};

// DELETE /api/MoLOS-Tasks/tasks/:id
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const taskService = new TaskService(/*...*/);
	await taskService.deleteTask(params.id, userId);

	return json({ success: true });
};
```

**File:** `modules/MoLOS-Tasks/src/routes/api/tasks/[id]/transition/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { WorkflowService } from '$lib/modules/MoLOS-Tasks/services/workflow-service.js';

// POST /api/MoLOS-Tasks/tasks/:id/transition
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const { toStatusId, comment, override, reason } = await request.json();

	const workflowService = new WorkflowService(/*...*/);

	try {
		const task = await workflowService.executeTransition(
			params.id,
			toStatusId,
			userId,
			comment,
			override,
			reason
		);
		return json(task);
	} catch (err) {
		if (err.message.includes('blockers')) {
			throw error(400, err.message);
		}
		throw error(400, err.message);
	}
};
```

---

## Phase 4: Background Jobs (Priority: P1)

### 4.1 SQLite-Based Job Queue

**File:** `modules/MoLOS-Tasks/src/server/jobs/job-queue.ts`

```typescript
import { betterSqlite3 } from 'better-sqlite3';
import { open } from 'better-sqlite3';
import path from 'path';

export enum JobType {
	INDEX_TASK = 'index_task',
	DELIVER_WEBHOOK = 'deliver_webhook',
	EXECUTE_AUTOMATION = 'execute_automation',
	RETRY_AUTOMATION = 'retry_automation',
	ROLLUP_METRICS = 'rollup_metrics',
	SEND_NOTIFICATION = 'send_notification'
}

export interface Job {
	id: string;
	type: JobType;
	payload: Record<string, any>;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	retryCount: number;
	maxRetries: number;
	nextRunAt: number;
	createdAt: number;
	processedAt?: number;
	error?: string;
}

export class JobQueue {
	private db: betterSqlite3.Database;
	private isProcessing: boolean = false;

	constructor(dbPath?: string) {
		const pathToDb = dbPath || path.join(process.cwd(), 'molos-jobs.db');
		this.db = open(pathToDb);
		this.initializeTables();
	}

	private initializeTables() {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        next_run_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        processed_at INTEGER,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON jobs(next_run_at);
    `);
	}

	/**
	 * Add job to queue
	 */
	async addJob(type: JobType, payload: Record<string, any>, delayMs: number = 0): Promise<string> {
		const id = crypto.randomUUID();
		const nextRunAt = Math.floor(Date.now() / 1000) + Math.floor(delayMs / 1000);

		this.db
			.prepare(
				`
      INSERT INTO jobs (id, type, payload, status, next_run_at, created_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `
			)
			.run(id, type, JSON.stringify(payload), nextRunAt, Math.floor(Date.now() / 1000));

		return id;
	}

	/**
	 * Process pending jobs
	 */
	async processJobs(): Promise<void> {
		if (this.isProcessing) return;
		this.isProcessing = true;

		try {
			const now = Math.floor(Date.now() / 1000);
			const jobs = this.db
				.prepare(
					`
        SELECT * FROM jobs
        WHERE status = 'pending' AND next_run_at <= ?
        ORDER BY next_run_at ASC
        LIMIT 10
      `
				)
				.all(now) as Job[];

			for (const job of jobs) {
				await this.processJob(job);
			}
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Process a single job
	 */
	private async processJob(job: Job): Promise<void> {
		// Mark as processing
		this.db
			.prepare(
				`
      UPDATE jobs SET status = 'processing', processed_at = ? WHERE id = ?
    `
			)
			.run(Math.floor(Date.now() / 1000), job.id);

		try {
			// Execute job based on type
			switch (job.type) {
				case JobType.INDEX_TASK:
					await this.executeIndexTask(job);
					break;
				case JobType.DELIVER_WEBHOOK:
					await this.executeDeliverWebhook(job);
					break;
				case JobType.EXECUTE_AUTOMATION:
					await this.executeAutomation(job);
					break;
				case JobType.SEND_NOTIFICATION:
					await this.executeSendNotification(job);
					break;
			}

			// Mark as completed
			this.db
				.prepare(
					`
        UPDATE jobs SET status = 'completed' WHERE id = ?
      `
				)
				.run(job.id);
		} catch (err) {
			const newRetryCount = job.retryCount + 1;

			if (newRetryCount >= job.maxRetries) {
				// Mark as failed (exceeded max retries)
				this.db
					.prepare(
						`
          UPDATE jobs SET status = 'failed', error = ?, retry_count = ? WHERE id = ?
        `
					)
					.run(err.message, newRetryCount, job.id);
			} else {
				// Retry with exponential backoff
				const backoffMs = Math.pow(2, newRetryCount) * 1000;
				const nextRunAt = Math.floor(Date.now() / 1000) + Math.floor(backoffMs / 1000);

				this.db
					.prepare(
						`
          UPDATE jobs SET status = 'pending', retry_count = ?, next_run_at = ?, error = ? WHERE id = ?
        `
					)
					.run(newRetryCount, nextRunAt, err.message, job.id);
			}
		}
	}

	// ==============================
	// Job Executors
	// ==============================

	private async executeIndexTask(job: Job): Promise<void> {
		const { taskId } = job.payload;
		// TODO: Implement search indexing
		console.log(`Indexing task: ${taskId}`);
	}

	private async executeDeliverWebhook(job: Job): Promise<void> {
		const { webhookId, payload } = job.payload;
		// TODO: Implement webhook delivery
		console.log(`Delivering webhook: ${webhookId}`, payload);
	}

	private async executeAutomation(job: Job): Promise<void> {
		const { ruleId, event } = job.payload;
		// TODO: Implement automation execution
		console.log(`Executing automation rule: ${ruleId}`, event);
	}

	private async executeSendNotification(job: Job): Promise<void> {
		const { userId, message } = job.payload;
		// TODO: Implement notification delivery
		console.log(`Sending notification to user: ${userId}`, message);
	}

	/**
	 * Get failed jobs (for DLQ)
	 */
	getFailedJobs(limit: number = 100): Job[] {
		return this.db
			.prepare(
				`
      SELECT * FROM jobs
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT ?
    `
			)
			.all(limit) as Job[];
	}

	/**
	 * Retry failed job
	 */
	async retryFailedJob(jobId: string): Promise<void> {
		this.db
			.prepare(
				`
      UPDATE jobs SET status = 'pending', retry_count = 0, error = NULL WHERE id = ?
    `
			)
			.run(jobId);
	}

	/**
	 * Clean up old completed jobs
	 */
	cleanupOldJobs(olderThanDays: number = 7): void {
		const cutoff = Math.floor(Date.now() / 1000) - olderThanDays * 24 * 60 * 60;
		this.db
			.prepare(
				`
      DELETE FROM jobs WHERE status = 'completed' AND processed_at < ?
    `
			)
			.run(cutoff);
	}
}

// Singleton instance
let jobQueue: JobQueue | null = null;

export function getJobQueue(): JobQueue {
	if (!jobQueue) {
		jobQueue = new JobQueue();
		// Start job processor
		setInterval(() => jobQueue?.processJobs(), 5000); // Check every 5 seconds
	}
	return jobQueue;
}
```

---

## Phase 5: Search Integration (Priority: P1)

### 5.1 SQLite FTS5 Integration

**File:** `modules/MoLOS-Tasks/src/server/services/search-service.ts`

```typescript
import { betterSqlite3 } from 'better-sqlite3';
import { open } from 'better-sqlite3';
import { eq } from 'drizzle-orm';

export interface SearchFilters {
	statusId?: string;
	assigneeId?: string;
	labels?: string[];
	epicId?: string;
	sprintId?: string;
	archived?: boolean;
}

export interface SearchResult<T> {
	items: T[];
	total: number;
	nextCursor?: string;
}

export class SearchService {
	private ftsDb: betterSqlite3.Database;

	constructor(dbPath?: string) {
		const pathToDb = dbPath || path.join(process.cwd(), 'molos-search.db');
		this.ftsDb = open(pathToDb);
		this.initializeFTSTable();
	}

	/**
	 * Initialize FTS5 table
	 */
	private initializeFTSTable() {
		this.ftsDb.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        id,
        title,
        description,
        labels,
        content='tasks_content',
        content_rowid='rowid'
      );

      CREATE TABLE IF NOT EXISTS tasks_content (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        status_id TEXT,
        assignee_ids TEXT,
        epic_id TEXT,
        sprint_id TEXT,
        archived INTEGER,
        created_at INTEGER
      );
    `);
	}

	/**
	 * Index a task for search
	 */
	async indexTask(task: Task): Promise<void> {
		const labelsStr = task.labels ? task.labels.join(' ') : '';

		// Insert into content table
		this.ftsDb
			.prepare(
				`
      INSERT OR REPLACE INTO tasks_content
      (id, project_id, status_id, assignee_ids, epic_id, sprint_id, archived, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
			)
			.run(
				task.id,
				task.projectId,
				task.statusId,
				task.assigneeIds ? JSON.stringify(task.assigneeIds) : '[]',
				task.epicId,
				task.sprintId,
				task.archived ? 1 : 0,
				task.createdAt
			);

		// Insert into FTS table
		this.ftsDb
			.prepare(
				`
      INSERT OR REPLACE INTO tasks_fts
      (id, title, description, labels)
      VALUES (?, ?, ?, ?)
    `
			)
			.run(task.id, task.title, task.description || '', labelsStr);
	}

	/**
	 * Search tasks
	 */
	async searchTasks(
		query: string,
		userId: string,
		filters?: SearchFilters,
		cursor?: string,
		limit: number = 50
	): Promise<SearchResult<Task>> {
		let sql = `
      SELECT c.*, fts.rank
      FROM tasks_content c
      INNER JOIN tasks_fts fts ON c.id = fts.id
      WHERE tasks_fts MATCH ?
    `;

		const params: any[] = [query];

		// Apply filters
		if (filters?.statusId) {
			sql += ` AND c.status_id = ?`;
			params.push(filters.statusId);
		}

		if (filters?.assigneeId) {
			sql += ` AND json_each(c.assignee_ids) = ?`;
			params.push(filters.assigneeId);
		}

		if (filters?.epicId) {
			sql += ` AND c.epic_id = ?`;
			params.push(filters.epicId);
		}

		if (filters?.sprintId) {
			sql += ` AND c.sprint_id = ?`;
			params.push(filters.sprintId);
		}

		if (filters?.archived !== undefined) {
			sql += ` AND c.archived = ?`;
			params.push(filters.archived ? 1 : 0);
		}

		// Apply cursor
		if (cursor) {
			sql += ` AND c.id > ?`;
			params.push(cursor);
		}

		// Order by rank and limit
		sql += ` ORDER BY fts.rank, c.id LIMIT ?`;
		params.push(limit + 1); // +1 to check if there are more results

		const results = this.ftsDb.prepare(sql).all(...params) as any[];

		const hasMore = results.length > limit;
		const items = hasMore ? results.slice(0, limit) : results;

		return {
			items,
			total: items.length,
			nextCursor: hasMore ? items[items.length - 1].id : undefined
		};
	}

	/**
	 * Remove task from index
	 */
	async removeTaskFromIndex(taskId: string): Promise<void> {
		this.ftsDb.prepare(`DELETE FROM tasks_fts WHERE id = ?`).run(taskId);
		this.ftsDb.prepare(`DELETE FROM tasks_content WHERE id = ?`).run(taskId);
	}

	/**
	 * Queue task for indexing (background job)
	 */
	async enqueueTaskForIndexing(taskId: string, operation: 'index' | 'delete'): Promise<void> {
		const jobQueue = getJobQueue();
		await jobQueue.addJob(JobType.INDEX_TASK, { taskId, operation }, 1000); // Delay 1s
	}
}
```

---

## Phase 6: Testing Strategy (Priority: P0)

### 6.1 Acceptance Test Suite

**File:** `modules/MoLOS-Tasks/tests/acceptance/task-workflow.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TaskService } from '$lib/modules/MoLOS-Tasks/services/task-service.js';
import { WorkflowService } from '$lib/modules/MoLOS-Tasks/services/workflow-service.js';
import { DependencyService } from '$lib/modules/MoLOS-Tasks/services/dependency-service.js';

describe('Task Workflow Acceptance Tests', () => {
	let taskService: TaskService;
	let workflowService: WorkflowService;
	let dependencyService: DependencyService;
	let userId: string;
	let projectId: string;

	beforeAll(() => {
		// Initialize services with test DB
		taskService = new TaskService(/*...*/);
		workflowService = new WorkflowService(/*...*/);
		dependencyService = new DependencyService(/*...*/);
		userId = 'test-user-id';
		projectId = 'test-project-id';
	});

	afterAll(async () => {
		// Cleanup test data
	});

	describe('Given/When/Then Scenarios', () => {
		it('Given a project with workflow, When creating a task, Then it has default status', async () => {
			// Arrange
			const workflow = await workflowService.getProjectWorkflow(projectId);
			const defaultStatus = await workflowService.getDefaultStatus(projectId);

			// Act
			const task = await taskService.createTask(
				{
					title: 'Test Task',
					projectId,
					userId
				},
				userId
			);

			// Assert
			expect(task.statusId).toBe(defaultStatus.id);
		});

		it('Given a task with blockers, When transitioning to done, Then it should fail without override', async () => {
			// Arrange
			const task = await taskService.createTask(
				{
					title: 'Test Task',
					projectId,
					userId
				},
				userId
			);

			const blocker = await taskService.createTask(
				{
					title: 'Blocker Task',
					projectId,
					userId
				},
				userId
			);

			await dependencyService.addBlocker(task.id, blocker.id, userId);

			const doneStatus = await workflowService.getDoneStatus(projectId);

			// Act & Assert
			await expect(
				workflowService.executeTransition(task.id, doneStatus.id, userId)
			).rejects.toThrow('Cannot transition to "done" with unresolved blockers');
		});

		it('Given a task with blockers, When transitioning to done with override, Then it should succeed and log reason', async () => {
			// Arrange
			const task = await taskService.createTask(
				{
					title: 'Test Task',
					projectId,
					userId
				},
				userId
			);

			const blocker = await taskService.createTask(
				{
					title: 'Blocker Task',
					projectId,
					userId
				},
				userId
			);

			await dependencyService.addBlocker(task.id, blocker.id, userId);

			const doneStatus = await workflowService.getDoneStatus(projectId);

			// Act
			const result = await workflowService.executeTransition(
				task.id,
				doneStatus.id,
				userId,
				undefined,
				true,
				'Blocker approved by manager'
			);

			// Assert
			expect(result.statusId).toBe(doneStatus.id);
			const auditLogs = await auditService.getTaskHistory(task.id, userId);
			expect(auditLogs.some((log) => log.reason === 'Blocker approved by manager')).toBe(true);
		});
	});
});
```

---

## Implementation Priorities

### MVP (Must Have - Phase 1-2)

1. ✅ Database schema expansion (11 new tables + updates to tasks table)
2. ✅ Core domain services (TaskService, WorkflowService, AuditService)
3. ✅ Optimistic concurrency (version field)
4. ✅ Task CRUD with validation
5. ✅ Workflow transitions
6. ✅ Basic automation skeleton (SQLite job queue + executor)
7. ✅ Comments and attachments (signed upload)
8. ✅ Cursor pagination
9. ✅ Acceptance tests

### Important (Should Have - Phase 3-4)

1. ⚠️ Subtasks with rollups
2. ⚠️ Dependencies with cycle detection
3. ⚠️ Fractional positioning and reordering
4. ⚠️ Bulk operations
5. ⚠️ Search indexing (SQLite FTS5)
6. ⚠️ Realtime broadcasting (SSE)
7. ⚠️ RBAC integration with MoLOS team system
8. ⚠️ Automation rules engine
9. ⚠️ Background jobs and workers (SQLite queue)
10. ⚠️ Integration tests

### Nice to Have (Could Have - Phase 5-6)

1. 🔹 Advanced reports (velocity, cycle time)
2. 🔹 External integrations (Slack, VCS, Calendar)
3. 🔹 SSO/OIDC integration (via MoLOS SaaS strategy)
4. 🔹 Webhooks for external systems
5. 🔹 Epics and Sprints
6. 🔹 Time tracking with granular logs
7. 🔹 Resource allocation metadata

---

## Technology Decisions (Aligned with MoLOS)

| Aspect             | Choice                                   | Alignment with MoLOS                |
| ------------------ | ---------------------------------------- | ----------------------------------- |
| **Database**       | SQLite (better-sqlite3)                  | ✅ Matches MoLOS stack              |
| **Job Queue**      | SQLite-based queue                       | ✅ No external service, self-hosted |
| **Search**         | SQLite FTS5 (v1), optional external (v2) | ✅ Privacy-first, offline-capable   |
| **Realtime**       | SSE (v1), WebSocket (v2)                 | ✅ Simpler initial, scalable later  |
| **Event System**   | MoLOS Module Event Bus                   | ✅ Planned architecture integration |
| **RBAC**           | Integrated with MoLOS team system        | ✅ Reuse existing SaaS strategy     |
| **API Versioning** | No versioning (single API)               | ✅ Matches current approach         |
| **Authentication** | better-auth (existing)                   | ✅ Reuse existing auth system       |
| **Type Safety**    | TypeScript + Drizzle                     | ✅ Matches MoLOS conventions        |

---

## Migration Strategy

### Step 1: Database Migration

1. Generate migration using drizzle-kit
2. Run migration: `bun run db:migrate`
3. Validate schema: `bun run db:validate`
4. Test with sample data

### Step 2: Service Layer Introduction

1. Implement services without breaking existing code
2. Gradually migrate repositories to use services
3. Keep old API endpoints for backward compatibility (temporarily)
4. Add new API endpoints alongside old ones

### Step 3: API Migration

1. Keep existing endpoints working
2. Add new endpoints with enhanced functionality
3. Update documentation
4. UI team can migrate gradually

### Step 4: Feature Rollout

1. Enable new features via feature flags
2. Test with beta users
3. Gradual rollout to all users
4. Monitor metrics and errors

---

## Success Metrics

### Technical Metrics

- API response time p95 < 200ms for paginated lists
- Search index latency < 1s for eventual consistency
- Background job processing time < 5s for most operations
- Test coverage > 80% for core domain logic

### Business Metrics

- Task creation/update/delete success rate > 99.9%
- Automation rule execution success rate > 95%
- Webhook delivery success rate > 98%
- User-reported errors < 0.1%

---

## Next Steps

1. **Review and approve** this implementation plan
2. **Set up development environment** for background jobs and search
3. **Begin Phase 1** - Database schema expansion
4. **Create detailed task breakdown** for each phase with sub-tasks

---

**Document Version:** 2.0 (MoLOS-Adapted)
**Last Updated:** 2026-02-24
**Author:** AI Assistant

# MoLOS-Tasks Module - PRD Implementation Plan

## Executive Summary

This plan outlines the adaptation of the MoLOS-Tasks module to implement a comprehensive enterprise-grade task management system with workflows, automation, and advanced features.

**Current State:** Basic task management with 5 tables (tasks, projects, areas, daily_log, settings) and simple CRUD operations.

**Target State:** Full-featured task management platform with workflows, automation, dependencies, time tracking, RBAC, search, and integrations.

---

## Phase 1: Core Data Model Expansion (Priority: P0)

### 1.1 Database Schema Changes

**New Tables to Create:**

```sql
-- Task Types (global types)
CREATE TABLE MoLOS-Tasks_task_types (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX idx_task_types_user ON MoLOS-Tasks_task_types(user_id);
CREATE INDEX idx_task_types_key ON MoLOS-Tasks_task_types(key);

-- Project Task Types (mapping with defaults)
CREATE TABLE MoLOS-Tasks_project_task_types (
  project_id TEXT NOT NULL,
  task_type_id TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, task_type_id),
  FOREIGN KEY (project_id) REFERENCES MoLOS-Tasks_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_type_id) REFERENCES MoLOS-Tasks_task_types(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_task_types_project ON MoLOS-Tasks_project_task_types(project_id);

-- Workflow Definitions (per project)
CREATE TABLE MoLOS-Tasks_workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES MoLOS-Tasks_projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflows_project ON MoLOS-Tasks_workflows(project_id);

-- Workflow Status Definitions
CREATE TABLE MoLOS-Tasks_workflow_statuses (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  position INTEGER NOT NULL,
  category TEXT NOT NULL, -- 'backlog', 'todo', 'in_progress', 'done', 'cancelled'
  color TEXT,
  icon TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES MoLOS-Tasks_workflows(id) ON DELETE CASCADE,
  UNIQUE (workflow_id, key)
);

CREATE INDEX idx_workflow_statuses_workflow ON MoLOS-Tasks_workflow_statuses(workflow_id);

-- Workflow Transitions
CREATE TABLE MoLOS-Tasks_workflow_transitions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  from_status_id TEXT NOT NULL,
  to_status_id TEXT NOT NULL,
  is_allowed INTEGER NOT NULL DEFAULT 1,
  requires_comment INTEGER NOT NULL DEFAULT 0,
  auto_transition INTEGER NOT NULL DEFAULT 0,
  condition_expression TEXT, -- Expression for conditional transitions
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES MoLOS-Tasks_workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (from_status_id) REFERENCES MoLOS-Tasks_workflow_statuses(id) ON DELETE CASCADE,
  FOREIGN KEY (to_status_id) REFERENCES MoLOS-Tasks_workflow_statuses(id) ON DELETE CASCADE,
  UNIQUE (workflow_id, from_status_id, to_status_id)
);

CREATE INDEX idx_workflow_transitions_workflow ON MoLOS-Tasks_workflow_transitions(workflow_id);
CREATE INDEX idx_workflow_transitions_from ON MoLOS-Tasks_workflow_transitions(from_status_id);

-- Comments
CREATE TABLE MoLOS-Tasks_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id TEXT, -- For nested comments
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES MoLOS-Tasks_comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_comments_task ON MoLOS-Tasks_comments(task_id);
CREATE INDEX idx_comments_user ON MoLOS-Tasks_comments(user_id);
CREATE INDEX idx_comments_parent ON MoLOS-Tasks_comments(parent_id);

-- Attachments
CREATE TABLE MoLOS-Tasks_attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  upload_url TEXT, -- Signed URL for upload
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_task ON MoLOS-Tasks_attachments(task_id);
CREATE INDEX idx_attachments_user ON MoLOS-Tasks_attachments(user_id);

-- Audit Log
CREATE TABLE MoLOS-Tasks_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'transition', 'complete', 'archive'
  entity_type TEXT NOT NULL, -- 'task', 'comment', 'attachment', etc.
  entity_id TEXT NOT NULL,
  changes JSON, -- JSON diff of changes
  old_value JSON,
  new_value JSON,
  metadata JSON, -- Additional context (ip, user_agent, etc.)
  reason TEXT, -- For overrides
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_log_task ON MoLOS-Tasks_audit_log(task_id);
CREATE INDEX idx_audit_log_user ON MoLOS-Tasks_audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON MoLOS-Tasks_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON MoLOS-Tasks_audit_log(created_at);

-- Automation Rules
CREATE TABLE MoLOS-Tasks_automation_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  event_type TEXT NOT NULL, -- 'task.created', 'task.updated', 'task.transitioned', etc.
  condition_expression TEXT NOT NULL, -- JSON path or expression
  actions JSON NOT NULL, -- Array of actions to execute
  priority INTEGER NOT NULL DEFAULT 0, -- Execution order
  last_triggered_at INTEGER,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES MoLOS-Tasks_projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_automation_rules_project ON MoLOS-Tasks_automation_rules(project_id);
CREATE INDEX idx_automation_rules_active ON MoLOS-Tasks_automation_rules(is_active);
CREATE INDEX idx_automation_rules_event ON MoLOS-Tasks_automation_rules(event_type);

-- Automation Execution Log
CREATE TABLE MoLOS-Tasks_automation_executions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  task_id TEXT,
  user_id TEXT NOT NULL,
  event_payload JSON NOT NULL,
  evaluation_result TEXT, -- 'matched', 'not_matched', 'error'
  error_message TEXT,
  actions_executed JSON,
  execution_time_ms INTEGER,
  status TEXT NOT NULL, -- 'success', 'failed', 'retrying'
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (rule_id) REFERENCES MoLOS-Tasks_automation_rules(id) ON DELETE CASCADE
);

CREATE INDEX idx_automation_executions_rule ON MoLOS-Tasks_automation_executions(rule_id);
CREATE INDEX idx_automation_executions_task ON MoLOS-Tasks_automation_executions(task_id);
CREATE INDEX idx_automation_executions_created ON MoLOS-Tasks_automation_executions(created_at);

-- Epics (optional - high-level grouping)
CREATE TABLE MoLOS-Tasks_epics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'active', 'completed', 'cancelled'
  start_date INTEGER,
  end_date INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES MoLOS-Tasks_projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_epics_project ON MoLOS-Tasks_epics(project_id);
CREATE INDEX idx_epics_user ON MoLOS-Tasks_epics(user_id);

-- Sprints (optional - time-boxed iterations)
CREATE TABLE MoLOS-Tasks_sprints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'active', 'completed', 'cancelled'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES MoLOS-Tasks_projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_sprints_project ON MoLOS-Tasks_sprints(project_id);
CREATE INDEX idx_sprints_dates ON MoLOS-Tasks_sprints(start_date, end_date);
```

**Alter Existing Tables:**

```sql
-- Add new columns to tasks table
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN task_type_id TEXT;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN status_id TEXT; -- Reference to workflow_statuses
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN position REAL NOT NULL DEFAULT 0;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN assignee_ids TEXT; -- JSON array of user IDs
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN parent_id TEXT; -- For subtasks
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN epic_id TEXT;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN estimate_hours REAL;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN time_spent_hours REAL NOT NULL DEFAULT 0;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN blocked_by_ids TEXT; -- JSON array of task IDs
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN labels TEXT; -- JSON array of labels
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN custom_fields TEXT; -- JSON object for custom fields
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN start_date INTEGER;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN created_by TEXT;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN sprint_id TEXT;

-- Create indexes for performance
CREATE INDEX idx_tasks_position ON MoLOS-Tasks_tasks(project_id, position);
CREATE INDEX idx_tasks_status_id ON MoLOS-Tasks_tasks(status_id);
CREATE INDEX idx_tasks_task_type_id ON MoLOS-Tasks_tasks(task_type_id);
CREATE INDEX idx_tasks_parent ON MoLOS-Tasks_tasks(parent_id);
CREATE INDEX idx_tasks_epic ON MoLOS-Tasks_tasks(epic_id);
CREATE INDEX idx_tasks_sprint ON MoLOS-Tasks_tasks(sprint_id);
CREATE INDEX idx_tasks_archived ON MoLOS-Tasks_tasks(archived);
CREATE INDEX idx_tasks_created_by ON MoLOS-Tasks_tasks(created_by);

-- Add foreign keys
ALTER TABLE MoLOS-Tasks_tasks ADD FOREIGN KEY (task_type_id) REFERENCES MoLOS-Tasks_task_types(id) ON DELETE SET NULL;
ALTER TABLE MoLOS-Tasks_tasks ADD FOREIGN KEY (status_id) REFERENCES MoLOS-Tasks_workflow_statuses(id) ON DELETE SET NULL;
ALTER TABLE MoLOS-Tasks_tasks ADD FOREIGN KEY (parent_id) REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE;
ALTER TABLE MoLOS-Tasks_tasks ADD FOREIGN KEY (epic_id) REFERENCES MoLOS-Tasks_epics(id) ON DELETE SET NULL;
ALTER TABLE MoLOS-Tasks_tasks ADD FOREIGN KEY (sprint_id) REFERENCES MoLOS-Tasks_sprints(id) ON DELETE SET NULL;

-- Rename status column to legacy_status (for migration)
ALTER TABLE MoLOS-Tasks_tasks RENAME COLUMN status TO legacy_status;
```

**Data Migration Script:**

```sql
-- Migrate existing tasks to new schema
UPDATE MoLOS-Tasks_tasks
SET status_id = (
  SELECT id FROM MoLOS-Tasks_workflow_statuses
  WHERE key = 'todo' -- Map legacy status to workflow status
  LIMIT 1
)
WHERE legacy_status IS NOT NULL;

-- Set initial fractional positions for ordering
-- This would be a more complex query in production
UPDATE MoLOS-Tasks_tasks
SET position = CAST(rowid AS REAL)
WHERE position = 0;

-- Set version to 1 for all existing tasks
UPDATE MoLOS-Tasks_tasks
SET version = 1
WHERE version = 0;
```

### 1.2 Model/Type Updates

**Files to update:**

- `src/models/types.ts` - Expand with new interfaces
- New files for workflow, automation, audit models

**New Type Interfaces:**

```typescript
// Task Types
export interface TaskType {
	id: string;
	userId: string;
	name: string;
	key: string;
	description?: string;
	archived: boolean;
	createdAt: number;
	createdBy: string;
}

export interface ProjectTaskType {
	projectId: string;
	taskTypeId: string;
	isDefault: boolean;
	position: number;
	createdAt: number;
}

// Workflows
export interface Workflow {
	id: string;
	projectId: string;
	name: string;
	description?: string;
	isDefault: boolean;
	createdAt: number;
	createdBy: string;
}

export interface WorkflowStatus {
	id: string;
	workflowId: string;
	name: string;
	key: string;
	position: number;
	category: StatusCategory;
	color?: string;
	icon?: string;
	createdAt: number;
}

export type StatusCategory = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface WorkflowTransition {
	id: string;
	workflowId: string;
	fromStatusId: string;
	toStatusId: string;
	isAllowed: boolean;
	requiresComment: boolean;
	autoTransition: boolean;
	conditionExpression?: string;
	createdAt: number;
}

// Updated Task interface
export interface Task {
	id: string;
	userId: string;
	title: string;
	description?: string;
	legacyStatus?: TaskStatus; // Kept for migration compatibility
	taskTypeId?: string;
	statusId?: string;
	position: number;
	assigneeIds: string[];
	parentId?: string | null;
	epicId?: string | null;
	sprintId?: string | null;
	estimateHours?: number;
	timeSpentHours: number;
	blockedByIds: string[];
	labels: string[];
	customFields: Record<string, any>;
	dueDate?: number;
	startDate?: number;
	archived: boolean;
	version: number;
	projectId?: string;
	areaId?: string;
	priority: TaskPriority;
	context: TaskContext[];
	isCompleted: boolean;
	effort?: number;
	doDate?: number;
	createdBy?: string;
	createdAt: number;
	updatedAt: number;
}

// Comments
export interface Comment {
	id: string;
	userId: string;
	taskId: string;
	content: string;
	parentId?: string;
	createdAt: number;
	updatedAt: number;
}

// Attachments
export interface Attachment {
	id: string;
	userId: string;
	taskId: string;
	fileName: string;
	fileSize: number;
	fileType: string;
	storagePath: string;
	uploadUrl?: string;
	createdAt: number;
}

// Audit Log
export interface AuditLog {
	id: string;
	userId: string;
	taskId?: string;
	action: AuditAction;
	entityType: string;
	entityId: string;
	changes?: Record<string, { old: any; new: any }>;
	oldValue?: any;
	newValue?: any;
	metadata?: Record<string, any>;
	reason?: string;
	createdAt: number;
}

export type AuditAction =
	| 'create'
	| 'update'
	| 'delete'
	| 'transition'
	| 'complete'
	| 'archive'
	| 'unarchive'
	| 'block'
	| 'unblock';

// Automation
export interface AutomationRule {
	id: string;
	projectId: string;
	userId: string;
	name: string;
	description?: string;
	isActive: boolean;
	eventType: AutomationEventType;
	conditionExpression: string;
	actions: AutomationAction[];
	priority: number;
	lastTriggeredAt?: number;
	triggerCount: number;
	createdAt: number;
	createdBy: string;
}

export type AutomationEventType =
	| 'task.created'
	| 'task.updated'
	| 'task.transitioned'
	| 'task.reordered'
	| 'task.completed'
	| 'task.blocked'
	| 'comment.created'
	| 'attachment.created';

export interface AutomationAction {
	type:
		| 'update_field'
		| 'add_comment'
		| 'send_notification'
		| 'create_task'
		| 'transition'
		| 'webhook';
	config: Record<string, any>;
}

export interface AutomationExecution {
	id: string;
	ruleId: string;
	taskId?: string;
	userId: string;
	eventPayload: Record<string, any>;
	evaluationResult: 'matched' | 'not_matched' | 'error';
	errorMessage?: string;
	actionsExecuted: AutomationAction[];
	executionTimeMs: number;
	status: 'success' | 'failed' | 'retrying';
	retryCount: number;
	createdAt: number;
}

// Epics and Sprints
export interface Epic {
	id: string;
	userId: string;
	projectId: string;
	name: string;
	description?: string;
	status: 'planning' | 'active' | 'completed' | 'cancelled';
	startDate?: number;
	endDate?: number;
	createdAt: number;
	updatedAt: number;
}

export interface Sprint {
	id: string;
	userId: string;
	projectId: string;
	name: string;
	description?: string;
	startDate: number;
	endDate: number;
	status: 'planning' | 'active' | 'completed' | 'cancelled';
	createdAt: number;
	updatedAt: number;
}
```

---

## Phase 2: Domain Services Layer (Priority: P0)

### 2.1 Service Layer Architecture

**Create new service layer directory:**

```
src/server/services/
├── index.ts
├── task-service.ts
├── workflow-service.ts
├── automation-service.ts
├── dependency-service.ts
├── search-service.ts
├── audit-service.ts
├── notification-service.ts
├── integration-service.ts
└── validation-service.ts
```

### 2.2 Task Service

**File:** `src/server/services/task-service.ts`

**Responsibilities:**

- Task CRUD with optimistic concurrency
- Position reordering (fractional algorithm)
- Subtask management with rollups
- Task type validation
- Archive/unarchive operations

**Key Methods:**

```typescript
export class TaskService {
	constructor(
		private taskRepo: TaskRepository,
		private auditService: AuditService,
		private workflowService: WorkflowService,
		private automationService: AutomationService,
		private searchService: SearchService
	) {}

	// CRUD with version checking
	async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
		// Validate task type is enabled for project
		// Set initial fractional position
		// Create audit log entry
		// Trigger automation
		// Enqueue for search indexing
	}

	async updateTask(
		id: string,
		userId: string,
		updates: Partial<UpdateTaskInput>,
		version: number,
		reason?: string
	): Promise<Task> {
		// Check version matches (optimistic concurrency)
		// Validate changes against domain rules
		// Calculate diffs for audit log
		// Check blocker dependencies
		// Trigger automation
		// Enqueue for search indexing
	}

	async deleteTask(id: string, userId: string): Promise<void> {
		// Check if has subtasks (reject if yes)
		// Check if has open dependencies
		// Soft delete (archive)
		// Create audit log entry
	}

	// Reordering with fractional positions
	async reorderTask(
		id: string,
		userId: string,
		newPosition: number,
		insertAfterId?: string,
		insertBeforeId?: string
	): Promise<Task> {
		// Calculate fractional position based on neighbors
		// Minimize writes (only update reordered task)
		// Trigger reindexing if fragmentation threshold exceeded
		// Create audit log entry
		// Trigger automation event 'task.reordered'
	}

	// Subtask management
	async createSubtask(parentId: string, input: CreateTaskInput, userId: string): Promise<Task> {
		// Validate parent exists and belongs to user
		// Ensure parent and child share same project
		// Set parent_id
		// Rollup calculations
	}

	async getSubtasks(parentId: string, userId: string): Promise<Task[]> {
		// Recursive fetch with depth limit
	}

	// Task completion with blocker checks
	async completeTask(
		id: string,
		userId: string,
		override: boolean = false,
		reason?: string
	): Promise<Task> {
		// Check for unresolved blockers
		// If blockers exist and !override, throw error
		// If override, log to audit log
		// Transition to done status
		// Trigger automation
	}
}
```

### 2.3 Workflow Service

**File:** `src/server/services/workflow-service.ts`

**Responsibilities:**

- Workflow management
- Status transition validation
- Side-effect execution (synchronous for invariants, async for others)

**Key Methods:**

```typescript
export class WorkflowService {
	constructor(
		private workflowRepo: WorkflowRepository,
		private auditService: AuditService,
		private automationService: AutomationService
	) {}

	async createWorkflow(
		projectId: string,
		workflow: CreateWorkflowInput,
		userId: string
	): Promise<Workflow> {
		// Validate project exists
		// Create default workflow with standard statuses (backlog, todo, in_progress, done, cancelled)
		// Set is_default true
	}

	async getProjectWorkflow(projectId: string): Promise<Workflow> {
		// Get workflow for project
		// If none exists, return default global workflow
	}

	async addStatus(workflowId: string, status: CreateStatusInput): Promise<WorkflowStatus> {
		// Add status to workflow
		// Update positions of existing statuses
	}

	async defineTransition(
		workflowId: string,
		fromStatusId: string,
		toStatusId: string,
		options?: TransitionOptions
	): Promise<WorkflowTransition> {
		// Define allowed transition
		// Set condition expression if provided
		// Set requires_comment flag
	}

	async validateTransition(
		taskId: string,
		fromStatusId: string,
		toStatusId: string,
		userId: string
	): Promise<TransitionValidation> {
		// Check if transition is allowed in workflow
		// Evaluate condition expressions
		// Check for blockers (if transitioning to done)
		// Return validation result with reason
	}

	async executeTransition(
		taskId: string,
		toStatusId: string,
		userId: string,
		comment?: string,
		override: boolean = false,
		reason?: string
	): Promise<Task> {
		// Validate transition
		// Check for blockers (invariant - must be synchronous)
		// If blockers exist and !override, throw error
		// If override, log to audit log
		// Update task status_id
		// Execute synchronous side-effects (clear blockers if configured)
		// Queue asynchronous side-effects (automations, notifications)
		// Create audit log entry
		// Trigger automation event 'task.transitioned'
	}

	async getDefaultWorkflowStatuses(): Promise<WorkflowStatus[]> {
		// Return standard statuses: backlog, todo, in_progress, done, cancelled
		// With positions: 0, 1, 2, 3, 4
		// With categories and colors
	}
}
```

### 2.4 Dependency Service

**File:** `src/server/services/dependency-service.ts`

**Responsibilities:**

- Dependency validation (acyclic graph)
- Blocker checking
- Dependency visualization data

**Key Methods:**

```typescript
export class DependencyService {
	constructor(private taskRepo: TaskRepository) {}

	async addBlocker(taskId: string, blockerId: string, userId: string): Promise<Task> {
		// Check both tasks exist and belong to user
		// Check if would create cycle using graph algorithm (DFS)
		// Add blocker to blocked_by_ids array
		// Create audit log entry
	}

	async removeBlocker(taskId: string, blockerId: string, userId: string): Promise<Task> {
		// Remove blocker from blocked_by_ids array
		// Create audit log entry
	}

	async checkForCycles(taskId: string, newBlockerId: string): Promise<boolean> {
		// Build dependency graph
		// Run DFS to detect cycle
		// Return true if cycle exists
	}

	async hasUnresolvedBlockers(taskId: string): Promise<boolean> {
		// Check if any blockers are not in done status
		// Return true if any blocker is not done
	}

	async getDependencyGraph(taskId: string, userId: string): Promise<DependencyGraph> {
		// Build upstream and downstream dependencies
		// Return for visualization
	}

	async getTaskChain(taskId: string, userId: string): Promise<Task[]> {
		// Get all tasks in dependency chain
		// Ordered topologically
	}
}
```

### 2.5 Automation Service

**File:** `src/server/services/automation-service.ts`

**Responsibilities:**

- Rule evaluation
- Action execution (idempotent)
- Event handling
- Retry logic with dead-letter queue

**Key Methods:**

```typescript
export class AutomationService {
	constructor(
		private automationRuleRepo: AutomationRuleRepository,
		private automationExecutionRepo: AutomationExecutionRepository,
		private taskService: TaskService,
		private notificationService: NotificationService,
		private integrationService: IntegrationService
	) {}

	async createRule(rule: CreateAutomationRule, userId: string): Promise<AutomationRule> {
		// Validate condition expression
		// Validate action config
		// Create rule
	}

	async evaluateRules(event: AutomationEvent): Promise<void> {
		// Get active rules matching event_type
		// Evaluate condition expressions
		// Execute matched rules asynchronously
		// Create execution logs
	}

	async executeRule(ruleId: string, event: AutomationEvent): Promise<AutomationExecution> {
		// Mark rule as triggered (update last_triggered_at, increment trigger_count)
		// Execute each action
		// Log results
		// Handle errors with retry logic
	}

	async executeAction(action: AutomationAction, context: AutomationContext): Promise<ActionResult> {
		switch (action.type) {
			case 'update_field':
			// Update task field (idempotent: check current value before updating)
			case 'add_comment':
			// Add comment to task (idempotent: check if comment already exists)
			case 'send_notification':
			// Send notification (idempotent: use deduplication key)
			case 'create_task':
			// Create task (idempotent: check for duplicate by name/timestamp)
			case 'transition':
			// Execute workflow transition (idempotent: check current status)
			case 'webhook':
			// Send webhook (idempotent: use idempotency key)
		}
	}

	async retryFailedExecutions(): Promise<void> {
		// Get failed executions with retry_count < max_retries
		// Re-execute with exponential backoff
		// Move to dead-letter queue if max retries exceeded
	}

	async getDeadLetterQueue(): Promise<AutomationExecution[]> {
		// Get executions that failed after max retries
	}

	async reprocessDeadLetter(executionId: string): Promise<void> {
		// Mark as retrying
		// Re-execute
	}
}
```

### 2.6 Search Service

**File:** `src/server/services/search-service.ts`

**Responsibilities:**

- Search indexing (eventual consistency)
- Search queries with filters
- Cursor pagination

**Key Methods:**

```typescript
export class SearchService {
	constructor(
		private taskRepo: TaskRepository,
		private searchIndex: SearchIndexClient // Typesense/Elastic
	) {}

	async indexTask(task: Task): Promise<void> {
		// Build search document
		// Send to search index
		// Handle errors gracefully
	}

	async removeTaskFromIndex(taskId: string): Promise<void> {
		// Delete from search index
	}

	async searchTasks(
		query: string,
		filters: SearchFilters,
		cursor?: string,
		limit: number = 50
	): Promise<SearchResult<Task>> {
		// Build search query
		// Apply filters
		// Paginate with cursor
		// Return results with next cursor
	}

	async enqueueTaskForIndexing(taskId: string, operation: 'index' | 'delete'): Promise<void> {
		// Add to indexing queue (background job)
	}

	async bulkIndexTasks(taskIds: string[]): Promise<void> {
		// Batch index tasks
		// Handle rate limits
	}
}
```

### 2.7 Audit Service

**File:** `src/server/services/audit-service.ts`

**Responsibilities:**

- Audit log creation
- Audit trail queries
- Change history

**Key Methods:**

```typescript
export class AuditService {
	constructor(private auditLogRepo: AuditLogRepository) {}

	async logAction(input: AuditLogInput): Promise<AuditLog> {
		// Calculate changes diff
		// Store in audit log
	}

	async calculateChanges(
		oldValue: any,
		newValue: any
	): Promise<Record<string, { old: any; new: any }>> {
		// Deep diff calculation
	}

	async getTaskHistory(taskId: string, userId: string, limit: number = 100): Promise<AuditLog[]> {
		// Get audit log entries for task
	}

	async getUserActivity(userId: string, startDate: number, endDate: number): Promise<AuditLog[]> {
		// Get user's activity in date range
	}

	async getProjectActivity(
		projectId: string,
		startDate: number,
		endDate: number
	): Promise<AuditLog[]> {
		// Get project activity in date range
	}
}
```

### 2.8 Notification Service

**File:** `src/server/services/notification-service.ts`

**Responsibilities:**

- Realtime event broadcasting
- Notification delivery
- Presence management

**Key Methods:**

```typescript
export class NotificationService {
	constructor(private wsServer: WebSocketServer) {}

	async broadcastEvent(event: RealtimeEvent): Promise<void> {
		// Send to connected clients subscribed to project_id
		// Use diff payloads for efficiency
	}

	async subscribeToProject(userId: string, projectId: string, socketId: string): Promise<void> {
		// Add socket to project subscription list
	}

	async unsubscribeFromProject(userId: string, projectId: string, socketId: string): Promise<void> {
		// Remove socket from project subscription list
	}

	async broadcastTaskUpdate(
		task: Task,
		changes: Record<string, { old: any; new: any }>
	): Promise<void> {
		// Build diff payload
		// Broadcast to project subscribers
	}

	async broadcastTaskReorder(taskId: string, newPosition: number): Promise<void> {
		// Broadcast reorder event
	}

	async sendNotification(userId: string, notification: Notification): Promise<void> {
		// Send to user's notification channel
	}
}
```

### 2.9 Integration Service

**File:** `src/server/services/integration-service.ts`

**Responsibilities:**

- External integrations (Slack, VCS, Calendar)
- Webhook delivery with retries
- Webhook signing

**Key Methods:**

```typescript
export class IntegrationService {
	constructor(private webhookRepo: WebhookRepository) {}

	async createWebhook(webhook: CreateWebhookInput, userId: string): Promise<Webhook> {
		// Validate URL
		// Generate signing secret
		// Store webhook
	}

	async deliverWebhook(webhookId: string, payload: any): Promise<void> {
		// Sign payload with secret
		// Send to webhook URL
		// Handle failures with exponential backoff
		// Log delivery attempts
	}

	async verifyWebhookSignature(
		payload: string,
		signature: string,
		secret: string
	): Promise<boolean> {
		// Verify HMAC signature
	}

	async handleVCSEvent(event: VCSEvent): Promise<void> {
		// Parse VCS event (PR/commit)
		// Find task by smart-link (e.g., TASK-123) or commit message
		// Link event to task
		// Create comment or update task
	}

	async handleSlackEvent(event: SlackEvent): Promise<void> {
		// Parse Slack event
		// Find relevant task
		// Create comment or update task
	}

	async syncToCalendar(task: Task, calendarId: string): Promise<void> {
		// Create calendar event for task
		// Handle task updates
	}
}
```

### 2.10 Validation Service

**File:** `src/server/services/validation-service.ts`

**Responsibilities:**

- Cross-field validation
- Business rule enforcement
- Schema validation

**Key Methods:**

```typescript
export class ValidationService {
	async validateTaskTypeForProject(taskTypeId: string, projectId: string): Promise<boolean> {
		// Check if task type is enabled for project
		// Fall back to project default
	}

	async validateParentChildSameProject(parentId: string, childProjectId: string): Promise<boolean> {
		// Ensure parent and child share same project
	}

	async validateTransition(
		task: Task,
		toStatusId: string,
		workflow: Workflow
	): Promise<ValidationResult> {
		// Validate transition is allowed
		// Check for blockers
		// Validate conditions
	}

	async validateDates(startDate?: number, dueDate?: number): Promise<ValidationResult> {
		// Validate date ranges
		// Ensure start_date <= due_date
	}
}
```

---

## Phase 3: Repository Layer Updates (Priority: P0)

### 3.1 New Repository Classes

**Files to create:**

- `src/server/repositories/workflow-repository.ts`
- `src/server/repositories/automation-rule-repository.ts`
- `src/server/repositories/automation-execution-repository.ts`
- `src/server/repositories/comment-repository.ts`
- `src/server/repositories/attachment-repository.ts`
- `src/server/repositories/audit-log-repository.ts`
- `src/server/repositories/epic-repository.ts`
- `src/server/repositories/sprint-repository.ts`
- `src/server/repositories/task-type-repository.ts`

### 3.2 Update Existing Repositories

**Task Repository Updates:**

```typescript
export class TaskRepository extends BaseRepository {
	// Add new methods for new features
	async getByCursor(
		projectId: string,
		userId: string,
		cursor?: string,
		limit: number = 50,
		filters?: TaskFilters
	): Promise<CursorPaginatedResult<Task>> {
		// Cursor-based pagination
		// Filter by project_id, position
		// Apply filters (status, assignee, labels, etc.)
	}

	async getByStatusId(statusId: string, userId: string, limit: number = 50): Promise<Task[]> {
		// Get tasks by workflow status
	}

	async getByParentId(parentId: string, userId: string): Promise<Task[]> {
		// Get subtasks
	}

	async getByEpicId(epicId: string, userId: string): Promise<Task[]> {
		// Get tasks in epic
	}

	async getBySprintId(sprintId: string, userId: string): Promise<Task[]> {
		// Get tasks in sprint
	}

	async getBlockedTasks(taskId: string, userId: string): Promise<Task[]> {
		// Get tasks blocked by this task
	}

	async getBlockingTasks(taskId: string, userId: string): Promise<Task[]> {
		// Get tasks that block this task
	}

	async updatePosition(id: string, position: number, userId: string): Promise<Task> {
		// Update position for reordering
	}

	async incrementVersion(id: string, userId: string): Promise<Task> {
		// Increment version field
	}

	async archive(id: string, userId: string): Promise<Task> {
		// Soft delete
	}

	async unarchive(id: string, userId: string): Promise<Task> {
		// Restore archived task
	}

	async addBlocker(taskId: string, blockerId: string, userId: string): Promise<Task> {
		// Add blocker to blocked_by_ids array
	}

	async removeBlocker(taskId: string, blockerId: string, userId: string): Promise<Task> {
		// Remove blocker from blocked_by_ids array
	}

	async updateTimeSpent(id: string, hours: number, userId: string): Promise<Task> {
		// Update time_spent_hours
	}
}
```

---

## Phase 4: API Layer Updates (Priority: P0)

### 4.1 REST API Endpoints

**Update `/api/MoLOS-Tasks/+server.ts`**

**New Endpoints:**

```typescript
// GET /api/MoLOS-Tasks - Cursor paginated with filters
export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const projectId = url.searchParams.get('project_id');
	const cursor = url.searchParams.get('cursor');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const filters = parseFilters(url.searchParams);

	const taskService = new TaskService(/*...*/);
	const result = await taskService.getTasksPaginated(userId, projectId, cursor, limit, filters);

	return json(result);
};

// POST /api/MoLOS-Tasks - Create task with template support
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const body = await request.json();

	// Support bulk creation
	if (Array.isArray(body)) {
		const tasks = await taskService.bulkCreateTasks(body, userId);
		return json({ tasks }, { status: 201 });
	}

	// Single creation with template
	const task = await taskService.createTask(body, userId, body.template_id, body.auto_assign);
	return json(task, { status: 201 });
};

// PATCH /api/MoLOS-Tasks - Partial updates with version checking
// (This would be separate endpoint for better semantics)
```

**New Endpoints to Create:**

`/api/MoLOS-Tasks/tasks/[id]/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/tasks/:id
export const GET: RequestHandler = async ({ locals, params }) => {
	// Get single task
};

// PATCH /api/MoLOS-Tasks/tasks/:id - Partial update with version header
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const version = request.headers.get('if-match');
	if (!version) throw error(400, 'Missing version header');

	const updates = await request.json();
	const task = await taskService.updateTask(params.id, userId, updates, parseInt(version));
	return json(task);
};

// DELETE /api/MoLOS-Tasks/tasks/:id
export const DELETE: RequestHandler = async ({ locals, params }) => {
	await taskService.deleteTask(params.id, userId);
	return json({ success: true });
};
```

`/api/MoLOS-Tasks/tasks/[id]/transition/+server.ts`

```typescript
// POST /api/MoLOS-Tasks/tasks/:id/transition
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const { toStatusId, comment, override, reason } = await request.json();

	const task = await workflowService.executeTransition(
		params.id,
		toStatusId,
		userId,
		comment,
		override,
		reason
	);

	return json(task);
};
```

`/api/MoLOS-Tasks/tasks/[id]/reorder/+server.ts`

```typescript
// POST /api/MoLOS-Tasks/tasks/:id/reorder
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const { newPosition, insertAfterId, insertBeforeId } = await request.json();

	const task = await taskService.reorderTask(
		params.id,
		userId,
		newPosition,
		insertAfterId,
		insertBeforeId
	);

	return json(task);
};
```

`/api/MoLOS-Tasks/tasks/[id]/subtasks/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/tasks/:id/subtasks
export const GET: RequestHandler = async ({ locals, params }) => {
	const subtasks = await taskService.getSubtasks(params.id, userId);
	return json(subtasks);
};

// POST /api/MoLOS-Tasks/tasks/:id/subtasks
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const input = await request.json();
	const subtask = await taskService.createSubtask(params.id, input, userId);
	return json(subtask, { status: 201 });
};
```

`/api/MoLOS-Tasks/tasks/[id]/comments/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/tasks/:id/comments
export const GET: RequestHandler = async ({ locals, params }) => {
	const comments = await commentRepo.getByTaskId(params.id, userId);
	return json(comments);
};

// POST /api/MoLOS-Tasks/tasks/:id/comments
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const { content, parentId } = await request.json();
	const comment = await commentService.create(params.id, userId, content, parentId);
	return json(comment, { status: 201 });
};
```

`/api/MoLOS-Tasks/tasks/[id]/attachments/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/tasks/:id/attachments
export const GET: RequestHandler = async ({ locals, params }) => {
	const attachments = await attachmentRepo.getByTaskId(params.id, userId);
	return json(attachments);
};

// POST /api/MoLOS-Tasks/tasks/:id/attachments
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const { fileName, fileSize, fileType } = await request.json();

	// Create attachment record
	const attachment = await attachmentService.create(
		params.id,
		userId,
		fileName,
		fileSize,
		fileType
	);

	// Generate signed upload URL
	const uploadUrl = await storageService.generateSignedUploadUrl(attachment.id, fileName);

	return json({ ...attachment, uploadUrl }, { status: 201 });
};
```

`/api/MoLOS-Tasks/tasks/[id]/blockers/+server.ts`

```typescript
// POST /api/MoLOS-Tasks/tasks/:id/blockers
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const { blockerId } = await request.json();
	const task = await dependencyService.addBlocker(params.id, blockerId, userId);
	return json(task);
};

// DELETE /api/MoLOS-Tasks/tasks/:id/blockers/[blockerId]/+server.ts
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const task = await dependencyService.removeBlocker(params.id, params.blockerId, userId);
	return json(task);
};
```

`/api/MoLOS-Tasks/bulk/+server.ts`

```typescript
// POST /api/MoLOS-Tasks/bulk
export const POST: RequestHandler = async ({ locals, request }) => {
	const { operations } = await request.json();

	// Atomic-ish bulk operations
	const results = await taskService.bulkOperations(operations, userId);

	return json({ results });
};
```

`/api/MoLOS-Tasks/workflows/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/workflows - Get workflows for projects
export const GET: RequestHandler = async ({ locals, url }) => {
	const projectId = url.searchParams.get('project_id');
	const workflows = await workflowService.getProjectWorkflows(userId, projectId);
	return json(workflows);
};

// POST /api/MoLOS-Tasks/workflows - Create workflow
export const POST: RequestHandler = async ({ locals, request }) => {
	const workflow = await request.json();
	const result = await workflowService.createWorkflow(workflow.projectId, workflow, userId);
	return json(result, { status: 201 });
};
```

`/api/MoLOS-Tasks/workflows/[id]/transitions/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/workflows/:id/transitions
export const GET: RequestHandler = async ({ locals, params }) => {
	const transitions = await workflowService.getTransitions(params.id);
	return json(transitions);
};

// POST /api/MoLOS-Tasks/workflows/:id/transitions - Define transition
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const transition = await request.json();
	const result = await workflowService.defineTransition(params.id, transition);
	return json(result, { status: 201 });
};
```

`/api/MoLOS-Tasks/task-types/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/task-types
export const GET: RequestHandler = async ({ locals, url }) => {
	const projectId = url.searchParams.get('project_id');
	const taskTypes = await taskTypeService.getTaskTypes(userId, projectId);
	return json(taskTypes);
};

// POST /api/MoLOS-Tasks/task-types
export const POST: RequestHandler = async ({ locals, request }) => {
	const taskType = await request.json();
	const result = await taskTypeService.createTaskType(taskType, userId);
	return json(result, { status: 201 });
};
```

`/api/MoLOS-Tasks/automation-rules/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/automation-rules
export const GET: RequestHandler = async ({ locals, url }) => {
	const projectId = url.searchParams.get('project_id');
	const rules = await automationService.getRules(userId, projectId);
	return json(rules);
};

// POST /api/MoLOS-Tasks/automation-rules
export const POST: RequestHandler = async ({ locals, request }) => {
	const rule = await request.json();
	const result = await automationService.createRule(rule, userId);
	return json(result, { status: 201 });
};
```

`/api/MoLOS-Tasks/reports/+server.ts`

```typescript
// GET /api/MoLOS-Tasks/reports/velocity
export const GET: RequestHandler = async ({ locals, url }) => {
	const projectId = url.searchParams.get('project_id');
	const report = await reportService.getVelocityReport(userId, projectId);
	return json(report);
};

// GET /api/MoLOS-Tasks/reports/cycle-time
export const GET: RequestHandler = async ({ locals, url }) => {
	const projectId = url.searchParams.get('project_id');
	const report = await reportService.getCycleTimeReport(userId, projectId);
	return json(report);
};
```

### 4.2 WebSocket Endpoint

**File:** `/api/MoLOS-Tasks/realtime/+server.ts` (using SSE or WebSocket)

```typescript
// WebSocket endpoint for realtime updates
export const GET: RequestHandler = async ({ locals, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const upgradeHeader = request.headers.get('Upgrade');
	if (upgradeHeader !== 'websocket') {
		throw error(426, 'Upgrade Required');
	}

	// Upgrade to WebSocket
	const { socket, response } = Deno.upgradeWebSocket(request);

	socket.addEventListener('open', () => {
		console.log(`WebSocket opened for user ${userId}`);
	});

	socket.addEventListener('message', async (event) => {
		const data = JSON.parse(event.data);
		switch (data.type) {
			case 'subscribe':
				await notificationService.subscribeToProject(userId, data.projectId, socket.id);
				break;
			case 'unsubscribe':
				await notificationService.unsubscribeFromProject(userId, data.projectId, socket.id);
				break;
		}
	});

	socket.addEventListener('close', () => {
		console.log(`WebSocket closed for user ${userId}`);
	});

	return response;
};
```

---

## Phase 5: Background Jobs & Workers (Priority: P1)

### 5.1 Job Queue Setup

**Technology Choice:** Use BullMQ or similar for Redis-backed job queues, or SQLite-based queue for simplicity.

**Job Types:**

```typescript
export enum JobType {
	INDEX_TASK = 'index_task',
	DELETE_FROM_INDEX = 'delete_from_index',
	SEND_WEBHOOK = 'send_webhook',
	EXECUTE_AUTOMATION = 'execute_automation',
	RETRY_AUTOMATION = 'retry_automation',
	ROLLUP_METRICS = 'rollup_metrics',
	CLEANUP_OLD_AUDIT_LOGS = 'cleanup_old_audit_logs',
	SEND_NOTIFICATION = 'send_notification'
}
```

### 5.2 Worker Implementation

**File:** `src/server/workers/index.ts`

```typescript
import { Queue, Worker } from 'bullmq';

// Job queues
export const searchIndexQueue = new Queue(JobType.INDEX_TASK);
export const webhookQueue = new Queue(JobType.SEND_WEBHOOK);
export const automationQueue = new Queue(JobType.EXECUTE_AUTOMATION);

// Workers
export const searchWorker = new Worker(JobType.INDEX_TASK, async (job) => {
	const { taskId } = job.data;
	await searchService.indexTask(taskId);
});

export const webhookWorker = new Worker(
	JobType.SEND_WEBHOOK,
	async (job) => {
		const { webhookId, payload } = job.data;
		await integrationService.deliverWebhook(webhookId, payload);
	},
	{
		connection: redisConnection,
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 1000
		}
	}
);

export const automationWorker = new Worker(
	JobType.EXECUTE_AUTOMATION,
	async (job) => {
		const { ruleId, event } = job.data;
		await automationService.executeRule(ruleId, event);
	},
	{
		connection: redisConnection,
		attempts: 3,
		backoff: {
			type: 'exponential',
			delay: 1000
		}
	}
);
```

### 5.3 Scheduled Jobs

**File:** `src/server/workers/scheduler.ts`

```typescript
// Schedule periodic jobs
export function scheduleJobs() {
	// Retry failed automation executions every 5 minutes
	schedule.scheduleJob('*/5 * * * *', async () => {
		await automationService.retryFailedExecutions();
	});

	// Roll up metrics every hour
	schedule.scheduleJob('0 * * * *', async () => {
		await reportService.rollupMetrics();
	});

	// Cleanup old audit logs (keep 90 days)
	schedule.scheduleJob('0 2 * * *', async () => {
		const cutoffDate = Date.now() - 90 * 24 * 60 * 60 * 1000;
		await auditService.cleanupOldLogs(cutoffDate);
	});
}
```

---

## Phase 6: Search Integration (Priority: P1)

### 6.1 Typesense/Elasticsearch Integration

**File:** `src/server/services/search-index.ts`

```typescript
import typesense from 'typesense';

export const searchClient = new typesense.Client({
	nodes: [
		{
			host: process.env.TYPESENSE_HOST,
			port: 8108,
			protocol: 'http'
		}
	],
	apiKey: process.env.TYPESENSE_API_KEY,
	connectionTimeoutSeconds: 2
});

export async function setupSearchIndex() {
	const schema = {
		name: 'tasks',
		fields: [
			{ name: 'id', type: 'string' },
			{ name: 'title', type: 'string', infix: true },
			{ name: 'description', type: 'string' },
			{ name: 'status', type: 'string', facet: true },
			{ name: 'priority', type: 'string', facet: true },
			{ name: 'assignee_ids', type: 'string[]', facet: true },
			{ name: 'labels', type: 'string[]', facet: true },
			{ name: 'project_id', type: 'string', facet: true },
			{ name: 'task_type_id', type: 'string', facet: true },
			{ name: 'created_at', type: 'int64' },
			{ name: 'updated_at', type: 'int64' },
			{ name: 'due_date', type: 'int64' },
			{ name: 'user_id', type: 'string' }
		],
		default_sorting_field: 'created_at'
	};

	await searchClient.collections().create(schema);
}
```

---

## Phase 7: Testing Strategy (Priority: P0)

### 7.1 Acceptance Test Suite

**File:** `tests/acceptance/task-workflow.spec.ts`

```typescript
describe('Task Workflow Acceptance Tests', () => {
	describe('Given/When/Then Scenarios', () => {
		it('Given a project with workflow, When creating a task, Then it has default status', async () => {
			// Arrange
			const project = await createProject(userId);
			const workflow = await createDefaultWorkflow(project.id);

			// Act
			const task = await taskService.createTask(
				{
					title: 'Test Task',
					projectId: project.id
				},
				userId
			);

			// Assert
			expect(task.statusId).toBe(workflow.defaultStatusId);
		});

		it('Given a task with blockers, When transitioning to done, Then it should fail without override', async () => {
			// Arrange
			const task = await createTask(userId);
			const blocker = await createTask(userId);
			await dependencyService.addBlocker(task.id, blocker.id, userId);

			// Act & Assert
			await expect(
				workflowService.executeTransition(task.id, doneStatusId, userId)
			).rejects.toThrow('Cannot complete task with unresolved blockers');
		});

		it('Given a task with blockers, When transitioning to done with override, Then it should succeed and log reason', async () => {
			// Arrange
			const task = await createTask(userId);
			const blocker = await createTask(userId);
			await dependencyService.addBlocker(task.id, blocker.id, userId);

			// Act
			const result = await workflowService.executeTransition(
				task.id,
				doneStatusId,
				userId,
				undefined,
				true,
				'Blocker approved by manager'
			);

			// Assert
			expect(result.statusId).toBe(doneStatusId);
			const auditLog = await auditService.getLatestForTask(task.id);
			expect(auditLog.reason).toBe('Blocker approved by manager');
		});
	});
});
```

**File:** `tests/acceptance/bulk-operations.spec.ts`

```typescript
describe('Bulk Operations Acceptance Tests', () => {
	it('Given multiple tasks, When performing bulk status change, Then all tasks are updated atomically', async () => {
		// Arrange
		const tasks = await createMultipleTasks(userId, 5);

		// Act
		const results = await taskService.bulkOperations(
			[
				{ type: 'update', id: tasks[0].id, updates: { statusId: inProgressStatusId } },
				{ type: 'update', id: tasks[1].id, updates: { statusId: inProgressStatusId } },
				{ type: 'update', id: tasks[2].id, updates: { statusId: inProgressStatusId } }
			],
			userId
		);

		// Assert
		expect(results.success).toBe(3);
		expect(results.failed).toBe(0);
	});
});
```

**File:** `tests/acceptance/automation.spec.ts`

```typescript
describe('Automation Acceptance Tests', () => {
	it('Given an automation rule, When task is created, Then action is executed', async () => {
		// Arrange
		const rule = await createAutomationRule({
			eventType: 'task.created',
			condition: { field: 'priority', operator: 'equals', value: 'high' },
			actions: [{ type: 'add_comment', content: 'High priority task created' }]
		});

		// Act
		const task = await taskService.createTask(
			{
				title: 'High Priority Task',
				priority: 'high'
			},
			userId
		);

		// Assert
		const comments = await commentService.getByTaskId(task.id, userId);
		expect(comments.some((c) => c.content.includes('High priority task created'))).toBe(true);
	});

	it('Given automation fails, When retrying, Then it should be idempotent', async () => {
		// Arrange
		const rule = await createAutomationRule({
			/*...*/
		});
		const task = await createTask(userId);

		// Act - simulate failure and retry
		await automationService.executeRule(rule.id, { taskId: task.id });
		await automationService.retryFailedExecutions();

		// Assert
		const executions = await automationExecutionRepo.getByRuleId(rule.id);
		expect(executions[executions.length - 1].status).toBe('success');
	});
});
```

### 7.2 Concurrency Tests

**File:** `tests/concurrency/version-conflict.spec.ts`

```typescript
describe('Optimistic Concurrency Tests', () => {
	it('Given two users updating same task, When using version check, Then second update should fail', async () => {
		// Arrange
		const task = await createTask(userId);
		const v1 = task.version;

		// Act - User 1 updates
		await taskService.updateTask(task.id, userId, { title: 'Updated by User 1' }, v1);

		// User 2 tries to update with stale version
		await expect(
			taskService.updateTask(task.id, userId, { title: 'Updated by User 2' }, v1)
		).rejects.toThrow('Version mismatch');
	});

	it('Given conflicting updates, When resolving, Then audit log should show both versions', async () => {
		// Arrange
		const task = await createTask(userId);

		// Act - Simulate concurrent updates
		const [update1, update2] = await Promise.allSettled([
			taskService.updateTask(task.id, userId, { title: 'Update 1' }, task.version),
			taskService.updateTask(task.id, userId, { title: 'Update 2' }, task.version)
		]);

		// Assert
		expect(update1.status).toBe('fulfilled');
		expect(update2.status).toBe('rejected');
		const auditLogs = await auditService.getTaskHistory(task.id, userId);
		expect(auditLogs.length).toBeGreaterThan(1);
	});
});
```

### 7.3 Performance Tests

**File:** `tests/performance/read-latency.spec.ts`

```typescript
describe('Performance Tests', () => {
	it('Given 10k tasks in project, When fetching paginated list, Then p95 latency < 200ms', async () => {
		// Arrange
		const project = await createProject(userId);
		await createTasksForProject(project.id, userId, 10000);

		// Act
		const start = Date.now();
		const results: number[] = [];
		for (let i = 0; i < 100; i++) {
			const pageStart = Date.now();
			await taskService.getTasksPaginated(userId, project.id, undefined, 50);
			results.push(Date.now() - pageStart);
		}

		// Assert
		const p95 = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];
		expect(p95).toBeLessThan(200);
	});
});
```

### 7.4 Integration Tests

**File:** `tests/integrations/webhook.spec.ts`

```typescript
describe('Webhook Integration Tests', () => {
	it('Given a webhook subscription, When task is updated, Then webhook is delivered with retry', async () => {
		// Arrange
		const webhook = await createWebhook(userId, 'https://example.com/webhook');
		const task = await createTask(userId);

		// Act
		await taskService.updateTask(task.id, userId, { title: 'Updated' }, task.version);

		// Wait for webhook delivery
		await waitFor(() => webhookDeliveryLogs.length > 0, 5000);

		// Assert
		expect(webhookDeliveryLogs[0].success).toBe(true);
		expect(webhookDeliveryLogs[0].retryCount).toBeLessThanOrEqual(1);
	});

	it('Given invalid webhook signature, When receiving webhook, Then it should be rejected', async () => {
		// Arrange
		const payload = { taskId: '123', changes: { title: { old: 'Old', new: 'New' } } };
		const signature = 'invalid-signature';

		// Act & Assert
		const isValid = await integrationService.verifyWebhookSignature(
			JSON.stringify(payload),
			signature,
			webhook.secret
		);
		expect(isValid).toBe(false);
	});
});
```

---

## Phase 8: Security & RBAC (Priority: P1)

### 8.1 RBAC Implementation

**File:** `src/server/services/rbac-service.ts`

```typescript
export class RBACService {
	async checkPermission(userId: string, projectId: string, action: string): Promise<boolean> {
		// Check user's role on project
		// Check if role has permission for action
	}

	async checkFieldAccess(userId: string, projectId: string, field: string): Promise<boolean> {
		// Check field-level ACL configuration for project
		// Return true/false based on user's role
	}

	async enforcePermission(userId: string, projectId: string, action: string): Promise<void> {
		if (!(await this.checkPermission(userId, projectId, action))) {
			throw error(403, 'Forbidden');
		}
	}

	async enforceFieldAccess(userId: string, projectId: string, fields: string[]): Promise<string[]> {
		// Return fields that user has access to
		// Filter out restricted fields
	}
}
```

### 8.2 Apply RBAC to API

```typescript
// Example in API endpoint
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const userId = locals.user?.id;
	const task = await taskRepo.getById(params.id, userId);

	// Check permission
	await rbacService.enforcePermission(userId, task.projectId, 'task.update');

	// Filter fields based on ACL
	const updates = await request.json();
	const allowedFields = await rbacService.enforceFieldAccess(
		userId,
		task.projectId,
		Object.keys(updates)
	);
	const filteredUpdates = pick(updates, allowedFields);

	// Proceed with update
	const result = await taskService.updateTask(params.id, userId, filteredUpdates, version);
	return json(result);
};
```

---

## Implementation Priorities

### MVP (Must Have - Phase 1-2)

1. ✅ Database schema expansion (Task, TaskType, Workflow, Comment, Attachment, AuditLog)
2. ✅ Core domain services (TaskService, WorkflowService, AuditService)
3. ✅ Optimistic concurrency (version field)
4. ✅ Task CRUD with validation
5. ✅ Workflow transitions
6. ✅ Basic automation skeleton (queue + executor)
7. ✅ Comments and attachments (signed upload)
8. ✅ Cursor pagination
9. ✅ Acceptance tests

### Important (Should Have - Phase 3-4)

1. ⚠️ Subtasks with rollups
2. ⚠️ Dependencies with cycle detection
3. ⚠️ Fractional positioning and reordering
4. ⚠️ Bulk operations
5. ⚠️ Search indexing (Typesense)
6. ⚠️ Realtime broadcasting (WebSocket)
7. ⚠️ RBAC and field-level ACL
8. ⚠️ Automation rules engine
9. ⚠️ Background jobs and workers
10. ⚠️ Integration tests

### Nice to Have (Could Have - Phase 5-6)

1. 🔹 Advanced reports (velocity, cycle time)
2. 🔹 External integrations (Slack, VCS, Calendar)
3. 🔹 SSO/OIDC and SCIM
4. 🔹 Webhooks for external systems
5. 🔹 Epics and Sprints
6. 🔹 Time tracking with granular logs
7. 🔹 Resource allocation metadata

---

## Migration Strategy

### Step 1: Database Migration

1. Run migration scripts in order
2. Migrate existing data to new schema
3. Validate data integrity
4. Create rollback script (if needed)

### Step 2: Service Layer Introduction

1. Introduce services without breaking existing code
2. Gradually migrate repositories to use services
3. Keep old API endpoints as-is initially
4. Add new API endpoints alongside old ones

### Step 3: API Migration

1. Add version header to new API (`/api/v1/...`)
2. Keep old endpoints for backward compatibility
3. Add deprecation warnings to old endpoints
4. Update UI to use new endpoints
5. Remove old endpoints after grace period

### Step 4: Feature Rollout

1. Enable new features behind feature flags
2. Test with beta users
3. Gradual rollout to all users
4. Monitor metrics and errors

---

## Open Questions & Trade-offs

1. **Database Choice:** Current implementation uses SQLite with better-sqlite3. The PRD mentions Postgres. Should we:
   - Stay with SQLite (simpler deployment, good for self-hosting)
   - Migrate to Postgres (better for large scale, complex queries)
   - Support both with abstraction layer

2. **Search Engine:** Typesense vs Elasticsearch vs Postgres Full Text Search:
   - Typesense: Fast, open-source, easier setup
   - Elasticsearch: Industry standard, more features
   - Postgres FTS: No external service, good enough for basic needs

3. **Job Queue:** Redis-based (BullMQ) vs SQLite-based:
   - Redis: Better performance, requires external service
   - SQLite: Simpler deployment, slower but adequate for most use cases

4. **WebSocket vs SSE:** Realtime implementation:
   - WebSocket: Bidirectional, more complex
   - SSE: Simpler, unidirectional (server to client)
   - Could use SSE for events and HTTP for client to server

5. **Fractional Positioning Algorithm:** Multiple approaches:
   - Simple: Average of neighbors
   - Advanced: Base-62 encoding, variable precision
   - Reindex: Periodic reindexing when fragmentation exceeds threshold

---

## Success Metrics

### Technical Metrics

- API response time p95 < 200ms for paginated lists
- Search index latency < 1s for eventual consistency
- Worker job processing time < 5s for most operations
- Test coverage > 80% for core domain logic

### Business Metrics

- Task creation/update/delete success rate > 99.9%
- Automation rule execution success rate > 95%
- Webhook delivery success rate > 98%
- User-reported errors < 0.1%

---

## Estimated Timeline

### Phase 1: Data Model Expansion (2 weeks)

- Database schema design and migrations
- Model/type definitions
- Repository layer updates

### Phase 2: Domain Services (3 weeks)

- Core service implementations
- Workflow and transition logic
- Dependency and cycle detection
- Audit logging

### Phase 3: API Layer (2 weeks)

- REST API endpoints
- Cursor pagination
- Request validation
- Error handling

### Phase 4: Background Jobs (1 week)

- Job queue setup
- Worker implementations
- Scheduled jobs

### Phase 5: Search & Realtime (1 week)

- Search index integration
- WebSocket/SSE implementation
- Event broadcasting

### Phase 6: Testing (2 weeks)

- Acceptance tests
- Concurrency tests
- Performance tests
- Integration tests

### Phase 7: RBAC & Security (1 week)

- RBAC implementation
- Field-level ACL
- Security audits

### Phase 8: Documentation & Polish (1 week)

- API documentation
- Deployment guides
- Performance tuning

**Total: ~13 weeks**

---

## Next Steps

1. **Clarify technology choices** with user (SQLite vs Postgres, search engine, job queue)
2. **Approve implementation plan** and prioritize phases
3. **Set up development environment** for background jobs and search
4. **Begin Phase 1** - Database schema expansion
5. **Create detailed task breakdown** for each phase with sub-tasks

---

**Document Version:** 1.0
**Last Updated:** 2026-02-24
**Author:** AI Assistant

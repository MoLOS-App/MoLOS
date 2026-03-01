# MoLOS-Tasks Module - Simplified Linear-Style Implementation

## Executive Summary

A clean, powerful task manager inspired by Linear - minimal automation, maximum clarity. Focus on core task management features with beautiful UI components.

**Core Principles:**

- Simple but powerful task management
- Linear-like workflow (Backlog → Todo → In Progress → Done)
- Clean UI components
- No complex automation or background jobs
- Direct, predictable interactions

---

## Technology Stack (Simplified)

| Component | Technology                   | Notes                      |
| --------- | ---------------------------- | -------------------------- |
| Database  | SQLite (better-sqlite3)      | Simple, self-hosted        |
| ORM       | Drizzle ORM                  | Type-safe queries          |
| Search    | SQLite basic queries         | No external service needed |
| Backend   | SvelteKit API                | Server-side data loading   |
| Frontend  | Svelte 5 (Runes)             | Reactive components        |
| Styling   | Tailwind CSS + shadcn-svelte | Consistent UI library      |

---

## Phase 1: Database Schema (Simplified)

### 1.1 Tables to Create

```typescript
// Table naming: MoLOS-{ModuleName}_{table_name}

// ==============================
// Tasks (Enhanced)
// ==============================
export const tasksTasks = sqliteTable('MoLOS-Tasks_tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),

  // Core fields
  title: text('title').notNull(),
  description: text('description'),

  // Project and hierarchy
  projectId: text('project_id').references(() => tasksProjects.id, { onDelete: 'set null' }),
  parentId: text('parent_id').references(() => id, { onDelete: 'cascade' }),

  // Status (Linear-style: backlog, todo, in_progress, done, cancelled)
  status: text('status', {
    enum: ['backlog', 'todo', 'in_progress', 'done', 'cancelled']
  }).notNull().default('backlog'),

  // Priority (Linear-style: urgent, high, medium, low, no_priority)
  priority: text('priority', {
    enum: ['urgent', 'high', 'medium', 'low', 'no_priority']
  }).notNull().default('no_priority'),

  // Ordering (simple integer)
  position: integer('position').notNull().default(0),

  // Labels (simple JSON array)
  labels: text('labels'), // JSON: ["bug", "feature"]

  // Time tracking
  estimateHours: integer('estimate_hours'),
  timeSpentHours: integer('time_spent_hours').notNull().default(0),

  // Dates
  dueDate: integer('due_date'),
  startDate: integer('start_date'),

  // Completion
  completedAt: integer('completed_at'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),

  // Meta
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`)
});

// ==============================
// Projects
// ==============================
export const tasksProjects = sqliteTable('MoLOS-Tasks_projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),

  name: text('name').notNull(),
  description: text('description'),

  // Project color/icon (Linear-style)
  color: text('color'),
  icon: text('icon'),

  // Status
  status: text('status', {
    enum: ['active', 'archived']
  }).notNull().default('active'),

  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s','now'))`)
});

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
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))`)
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
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))')
});

// ==============================
// Views (Saved Filters)
// ==============================
export const tasksViews = sqliteTable('MoLOS-Tasks_views', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  projectId: text('project_id').references(() => tasksProjects.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),

  // Filter config (JSON)
  filters: text('filters').notNull(), // JSON: { status: ['todo', 'in_progress'], priority: 'high' }
  sortBy: text('sort_by'), // 'position', 'due_date', 'priority', 'created_at'
  sortOrder: text('sort_order'), // 'asc', 'desc'

  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at').notNull().default(sql`(strftime('%s','now'))')
});
```

### 1.2 Migration

**File:** `modules/MoLOS-Tasks/drizzle/0002_simplified_enhancement.sql`

```sql
-- ========================================================
-- Migration: Simplified Task Enhancement
-- Author: MoLOS-Tasks Module
-- Date: 2026-02-24
-- ========================================================

-- Backup existing tasks table
CREATE TABLE MoLOS-Tasks_tasks_backup AS SELECT * FROM MoLOS-Tasks_tasks;

--> statement-breakpoint

-- Drop old tables (they'll be recreated)
DROP TABLE MoLOS-Tasks_tasks;

--> statement-breakpoint

-- Create new tasks table with simplified schema
CREATE TABLE MoLOS-Tasks_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,

  -- Project and hierarchy
  project_id TEXT REFERENCES MoLOS-Tasks_projects(id) ON DELETE SET NULL,
  parent_id TEXT REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE,

  -- Status (Linear-style)
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK(status IN ('backlog', 'todo', 'in_progress', 'done', 'cancelled')),

  -- Priority (Linear-style)
  priority TEXT NOT NULL DEFAULT 'no_priority'
    CHECK(priority IN ('urgent', 'high', 'medium', 'low', 'no_priority')),

  -- Ordering
  position INTEGER NOT NULL DEFAULT 0,

  -- Labels (JSON array)
  labels TEXT,

  -- Time tracking
  estimate_hours INTEGER,
  time_spent_hours INTEGER NOT NULL DEFAULT 0,

  -- Dates
  due_date INTEGER,
  start_date INTEGER,

  -- Completion
  completed_at INTEGER,
  is_completed INTEGER NOT NULL DEFAULT 0,

  -- Meta
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

--> statement-breakpoint

-- Restore data from backup with mapping
INSERT INTO MoLOS-Tasks_tasks (
  id, user_id, title, description, project_id,
  status, priority, position, due_date,
  is_completed, created_at, updated_at
)
SELECT
  id, user_id, title, description, project_id,
  CASE legacy_status
    WHEN 'to_do' THEN 'todo'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'waiting' THEN 'backlog'
    WHEN 'done' THEN 'done'
    WHEN 'archived' THEN 'cancelled'
    ELSE 'backlog'
  END AS status,
  CASE legacy_priority
    WHEN 'high' THEN 'high'
    WHEN 'medium' THEN 'medium'
    WHEN 'low' THEN 'low'
    ELSE 'no_priority'
  END AS priority,
  position, due_date,
  is_completed, created_at, updated_at
FROM MoLOS-Tasks_tasks_backup;

--> statement-breakpoint

-- Create new tables
CREATE TABLE MoLOS-Tasks_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE MoLOS-Tasks_attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE MoLOS-Tasks_views (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT REFERENCES MoLOS-Tasks_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters TEXT NOT NULL,
  sort_by TEXT,
  sort_order TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX idx_tasks_project ON MoLOS-Tasks_tasks(project_id);
CREATE INDEX idx_tasks_parent ON MoLOS-Tasks_tasks(parent_id);
CREATE INDEX idx_tasks_status ON MoLOS-Tasks_tasks(status);
CREATE INDEX idx_tasks_position ON MoLOS-Tasks_tasks(project_id, position);
CREATE INDEX idx_comments_task ON MoLOS-Tasks_comments(task_id);
CREATE INDEX idx_attachments_task ON MoLOS-Tasks_attachments(task_id);

--> statement-breakpoint

-- Cleanup
DROP TABLE MoLOS-Tasks_tasks_backup;
```

---

## Phase 2: Domain Services (Simplified)

### 2.1 Task Service

**File:** `modules/MoLOS-Tasks/src/server/services/task-service.ts`

```typescript
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type {
	Task,
	CreateTaskInput,
	UpdateTaskInput
} from '$lib/models/external_modules/MoLOS-Tasks';
import { TaskRepository } from '$lib/repositories/external_modules/MoLOS-Tasks';

export class TaskService {
	constructor(private taskRepo: TaskRepository) {}

	async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
		// Set default status and position
		if (!input.status) input.status = 'backlog';
		if (!input.priority) input.priority = 'no_priority';

		// Calculate position if in project
		if (input.projectId && !input.position) {
			const maxPosition = await this.taskRepo.getMaxPosition(input.projectId);
			input.position = (maxPosition || 0) + 1000;
		}

		const task = await this.taskRepo.create({
			...input,
			userId,
			createdAt: Math.floor(Date.now() / 1000),
			updatedAt: Math.floor(Date.now() / 1000)
		});

		return task;
	}

	async updateTask(id: string, userId: string, updates: Partial<UpdateTaskInput>): Promise<Task> {
		const task = await this.taskRepo.update(id, userId, {
			...updates,
			updatedAt: Math.floor(Date.now() / 1000)
		});

		// Auto-update is_completed when status is done
		if (updates.status === 'done') {
			await this.taskRepo.update(id, userId, {
				isCompleted: true,
				completedAt: Math.floor(Date.now() / 1000)
			});
		}

		return task;
	}

	async deleteTask(id: string, userId: string): Promise<void> {
		// Check if has subtasks (reject if yes)
		const hasSubtasks = await this.taskRepo.hasSubtasks(id);
		if (hasSubtasks) {
			throw new Error('Cannot delete task with subtasks. Reassign or delete subtasks first.');
		}

		await this.taskRepo.delete(id, userId);
	}

	async moveTask(id: string, userId: string, newPosition: number): Promise<Task> {
		return await this.taskRepo.updatePosition(id, userId, newPosition);
	}

	async completeTask(id: string, userId: string): Promise<Task> {
		return await this.taskRepo.update(id, userId, {
			status: 'done',
			isCompleted: true,
			completedAt: Math.floor(Date.now() / 1000),
			updatedAt: Math.floor(Date.now() / 1000)
		});
	}

	async getTasks(
		userId: string,
		filters?: TaskFilters,
		sortBy: string = 'position',
		sortOrder: 'asc' | 'desc' = 'asc'
	): Promise<Task[]> {
		return await this.taskRepo.getFiltered(userId, filters, sortBy, sortOrder);
	}

	async getTaskTree(userId: string, projectId?: string): Promise<TaskTree> {
		const tasks = await this.getTasks(userId, { projectId });
		return this.buildTree(tasks);
	}

	private buildTree(tasks: Task[]): TaskTree {
		const map = new Map<string, TaskNode>();
		const roots: TaskNode[] = [];

		// Create nodes
		for (const task of tasks) {
			map.set(task.id, { ...task, children: [] });
		}

		// Build hierarchy
		for (const task of tasks) {
			const node = map.get(task.id)!;
			if (task.parentId) {
				const parent = map.get(task.parentId);
				if (parent) parent.children.push(node);
			} else {
				roots.push(node);
			}
		}

		return { roots, map };
	}
}

export interface TaskFilters {
	projectId?: string;
	status?: string[];
	priority?: string[];
	labels?: string[];
	parentId?: string | null;
	searchQuery?: string;
}

export interface TaskNode extends Task {
	children: TaskNode[];
}

export interface TaskTree {
	roots: TaskNode[];
	map: Map<string, TaskNode>;
}
```

### 2.2 Comment & Attachment Services

**File:** `modules/MoLOS-Tasks/src/server/services/comment-service.ts`

```typescript
import type { Comment } from '$lib/models/external_modules/MoLOS-Tasks';
import { CommentRepository } from '$lib/repositories/external_modules/MoLOS-Tasks';

export class CommentService {
	constructor(private commentRepo: CommentRepository) {}

	async addComment(taskId: string, userId: string, content: string): Promise<Comment> {
		return await this.commentRepo.create({
			taskId,
			userId,
			content,
			createdAt: Math.floor(Date.now() / 1000)
		});
	}

	async getTaskComments(taskId: string, userId: string): Promise<Comment[]> {
		return await this.commentRepo.getByTaskId(taskId, userId);
	}

	async deleteComment(id: string, userId: string): Promise<void> {
		await this.commentRepo.delete(id, userId);
	}
}
```

**File:** `modules/MoLOS-Tasks/src/server/services/attachment-service.ts`

```typescript
import type { Attachment } from '$lib/models/external_modules/MoLOS-Tasks';
import { AttachmentRepository } from '$lib/repositories/external_modules/MoLOS-Tasks';

export class AttachmentService {
	constructor(private attachmentRepo: AttachmentRepository) {}

	async createAttachment(
		taskId: string,
		userId: string,
		fileName: string,
		fileSize: number,
		fileType: string,
		storagePath: string
	): Promise<Attachment> {
		return await this.attachmentRepo.create({
			taskId,
			userId,
			fileName,
			fileSize,
			fileType,
			storagePath,
			createdAt: Math.floor(Date.now() / 1000)
		});
	}

	async getTaskAttachments(taskId: string, userId: string): Promise<Attachment[]> {
		return await this.attachmentRepo.getByTaskId(taskId, userId);
	}

	async deleteAttachment(id: string, userId: string): Promise<void> {
		await this.attachmentRepo.delete(id, userId);
	}

	/**
	 * Generate simple file path (no signed URLs for simplicity)
	 */
	getFilePath(attachmentId: string): string {
		return `/uploads/tasks/${attachmentId}`;
	}
}
```

### 2.3 View Service (Saved Filters)

**File:** `modules/MoLOS-Tasks/src/server/services/view-service.ts`

```typescript
import type { View } from '$lib/models/external_modules/MoLOS-Tasks';
import { ViewRepository } from '$lib/repositories/external_modules/MoLOS-Tasks';

export class ViewService {
	constructor(private viewRepo: ViewRepository) {}

	async createView(
		userId: string,
		name: string,
		filters: TaskFilters,
		sortBy: string,
		sortOrder: 'asc' | 'desc',
		projectId?: string,
		isDefault: boolean = false
	): Promise<View> {
		return await this.viewRepo.create({
			userId,
			name,
			projectId,
			filters: JSON.stringify(filters),
			sortBy,
			sortOrder,
			isDefault,
			createdAt: Math.floor(Date.now() / 1000)
		});
	}

	async getViews(userId: string, projectId?: string): Promise<View[]> {
		return await this.viewRepo.getByUserId(userId, projectId);
	}

	async updateView(id: string, userId: string, updates: Partial<View>): Promise<View> {
		return await this.viewRepo.update(id, userId, updates);
	}

	async deleteView(id: string, userId: string): Promise<void> {
		await this.viewRepo.delete(id, userId);
	}
}
```

---

## Phase 3: API Layer (Simplified)

### 3.1 Task API

**File:** `modules/MoLOS-Tasks/src/routes/api/tasks/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TaskService } from '$lib/modules/MoLOS-Tasks/services/task-service.js';
import { db } from '$lib/server/db';

// GET /api/MoLOS-Tasks/tasks
export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const projectId = url.searchParams.get('projectId');
	const status = url.searchParams.get('status');
	const priority = url.searchParams.get('priority');
	const searchQuery = url.searchParams.get('q');
	const sortBy = url.searchParams.get('sortBy') || 'position';
	const sortOrder = (url.searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';

	const taskService = new TaskService(/*...*/);
	const tasks = await taskService.getTasks(
		userId,
		{
			projectId: projectId || undefined,
			status: status ? [status] : undefined,
			priority: priority ? [priority] : undefined,
			searchQuery: searchQuery || undefined
		},
		sortBy,
		sortOrder
	);

	return json(tasks);
};

// POST /api/MoLOS-Tasks/tasks
export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const body = await request.json();

	const taskService = new TaskService(/*...*/);
	const task = await taskService.createTask(body, userId);

	return json(task, { status: 201 });
};
```

**File:** `modules/MoLOS-Tasks/src/routes/api/tasks/[id]/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET /api/MoLOS-Tasks/tasks/:id
export const GET: RequestHandler = async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const taskService = new TaskService(/*...*/);
	const task = await taskService.getTaskById(params.id, userId);

	if (!task) throw error(404, 'Task not found');

	return json(task);
};

// PATCH /api/MoLOS-Tasks/tasks/:id
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const updates = await request.json();
	const taskService = new TaskService(/*...*/);

	const task = await taskService.updateTask(params.id, userId, updates);

	return json(task);
};

// DELETE /api/MoLOS-Tasks/tasks/:id
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const taskService = new TaskService(/*...*/);
	await taskService.deleteTask(params.id, userId);

	return json({ success: true });
};

// POST /api/MoLOS-Tasks/tasks/:id/complete
export const POST: RequestHandler = async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const taskService = new TaskService(/*...*/);
	const task = await taskService.completeTask(params.id, userId);

	return json(task);
};
```

### 3.2 Comments & Attachments API

**File:** `modules/MoLOS-Tasks/src/routes/api/tasks/[id]/comments/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CommentService } from '$lib/modules/MoLOS-Tasks/services/comment-service.js';

// GET /api/MoLOS-Tasks/tasks/:id/comments
export const GET: RequestHandler = async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const commentService = new CommentService(/*...*/);
	const comments = await commentService.getTaskComments(params.id, userId);

	return json(comments);
};

// POST /api/MoLOS-Tasks/tasks/:id/comments
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const { content } = await request.json();
	const commentService = new CommentService(/*...*/);
	const comment = await commentService.addComment(params.id, userId, content);

	return json(comment, { status: 201 });
};
```

**File:** `modules/MoLOS-Tasks/src/routes/api/tasks/[id]/attachments/+server.ts`

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AttachmentService } from '$lib/modules/MoLOS-Tasks/services/attachment-service.js';

// GET /api/MoLOS-Tasks/tasks/:id/attachments
export const GET: RequestHandler = async ({ locals, params }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const attachmentService = new AttachmentService(/*...*/);
	const attachments = await attachmentService.getTaskAttachments(params.id, userId);

	return json(attachments);
};

// POST /api/MoLOS-Tasks/tasks/:id/attachments
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const userId = locals.user?.id;
	if (!userId) throw error(401, 'Unauthorized');

	const { fileName, fileSize, fileType } = await request.json();
	const storagePath = `/uploads/tasks/${crypto.randomUUID()}-${fileName}`;

	const attachmentService = new AttachmentService(/*...*/);
	const attachment = await attachmentService.createAttachment(
		params.id,
		userId,
		fileName,
		fileSize,
		fileType,
		storagePath
	);

	return json(attachment, { status: 201 });
};
```

---

## Phase 4: UI Components (Linear-Style)

### 4.1 Core Task Components

**File:** `modules/MoLOS-Tasks/src/lib/components/task-list.svelte`

```svelte
<script lang="ts">
	import { Task } from '$lib/models/external_modules/MoLOS-Tasks';

	export let tasks: Task[] = [];
	export let onTaskClick: (task: Task) => void = () => {};
	export let onTaskComplete: (taskId: string) => void = () => {};
	export let showProject = (boolean = true);
	export let showStatus: boolean = true;
	export let draggable: boolean = false;

	// Status colors (Linear-style)
	const statusColors: Record<string, string> = {
		backlog: '#6B7280',
		todo: '#3B82F6',
		in_progress: '#F59E0B',
		done: '#10B981',
		cancelled: '#EF4444'
	};

	// Priority colors
	const priorityColors: Record<string, string> = {
		urgent: '#EF4444',
		high: '#F97316',
		medium: '#F59E0B',
		low: '#6B7280',
		no_priority: '#9CA3AF'
	};

	const priorityOrder = ['urgent', 'high', 'medium', 'low', 'no_priority'];

	function getPriorityBadge(task: Task) {
		return task.priority === 'no_priority' ? '' : task.priority;
	}
</script>

<div class="task-list">
	{#each tasks as task (task.id)}
		<div
			class="task-item {draggable ? 'draggable' : ''}"
			{draggable}
			on:click={() => onTaskClick(task)}
			on:dragstart={() => console.log('Drag start', task.id)}
		>
			<!-- Priority indicator -->
			{#if getPriorityBadge(task)}
				<div class="priority-badge" style="background-color: {priorityColors[task.priority]}">
					{getPriorityBadge(task)}
				</div>
			{/if}

			<!-- Title -->
			<div class="task-title">
				{task.title}
				{#if task.description}
					<span class="task-description">{task.description}</span>
				{/if}
			</div>

			<!-- Status -->
			{#if showStatus}
				<div class="status-indicator" style="background-color: {statusColors[task.status]}">
					{task.status.replace('_', ' ')}
				</div>
			{/if}

			<!-- Project -->
			{#if showProject && task.projectId}
				<span class="task-project">{task.projectId}</span>
			{/if}

			<!-- Due date -->
			{#if task.dueDate}
				<span class="task-due-date">
					{new Date(task.dueDate * 1000).toLocaleDateString()}
				</span>
			{/if}

			<!-- Complete button -->
			{#if !task.isCompleted}
				<button
					class="complete-btn"
					on:click|stopPropagation={() => onTaskComplete(task.id)}
					aria-label="Complete task"
				>
					✓
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	.task-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.task-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.task-item:hover {
		border-color: #d1d5db;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.task-item.draggable {
		cursor: grab;
	}

	.task-item.draggable:active {
		cursor: grabbing;
	}

	.priority-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		color: white;
		white-space: nowrap;
	}

	.task-title {
		flex: 1;
		font-size: 0.875rem;
		font-weight: 500;
		color: #1f2937;
	}

	.task-description {
		color: #6b7280;
		margin-left: 0.5rem;
	}

	.status-indicator {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 500;
		color: white;
		text-transform: capitalize;
	}

	.task-project {
		padding: 0.25rem 0.5rem;
		background: #f3f4f6;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		color: #4b5563;
	}

	.task-due-date {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.complete-btn {
		padding: 0.375rem;
		background: #10b981;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 1rem;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.task-item:hover .complete-btn {
		opacity: 1;
	}
</style>
```

### 4.2 Task Board (Kanban)

**File:** `modules/MoLOS-Tasks/src/lib/components/task-board.svelte`

```svelte
<script lang="ts">
	import { Task } from '$lib/models/external_modules/MoLOS-Tasks';
	import TaskList from './task-list.svelte';

	export let tasks: Task[] = [];
	export let onTaskClick: (task: Task) => void = () => {};
	export let onTaskComplete: (taskId: string) => void = () => {};
	export let onTaskMove: (taskId: string, newStatus: string) => void = () => {};

	const statuses = [
		{ key: 'backlog', label: 'Backlog', color: '#6B7280' },
		{ key: 'todo', label: 'To Do', color: '#3B82F6' },
		{ key: 'in_progress', label: 'In Progress', color: '#F59E0B' },
		{ key: 'done', label: 'Done', color: '#10B981' }
	];

	$: tasksByStatus = statuses.map((status) => ({
		...status,
		tasks: tasks.filter((t) => t.status === status.key)
	}));

	function handleDrop(event: DragEvent, status: string) {
		event.preventDefault();
		const taskId = event.dataTransfer.getData('text/plain');
		if (taskId) {
			onTaskMove(taskId, status);
		}
	}
</script>

<div class="task-board">
	{#each tasksByStatus as column (column.key)}
		<div
			class="board-column"
			on:drop={(e) => handleDrop(e, column.key)}
			on:dragover={(e) => e.preventDefault()}
		>
			<div class="column-header" style="background-color: {column.color}">
				<span class="column-title">{column.label}</span>
				<span class="column-count">{column.tasks.length}</span>
			</div>

			<div class="column-tasks">
				<TaskList tasks={column.tasks} {onTaskClick} {onTaskComplete} draggable={true} />
			</div>
		</div>
	{/each}
</div>

<style>
	.task-board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
		height: 100%;
	}

	.board-column {
		display: flex;
		flex-direction: column;
		background: #f9fafb;
		border-radius: 0.5rem;
		border: 1px solid #e5e7eb;
		overflow: hidden;
	}

	.column-header {
		padding: 0.75rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: white;
		font-weight: 600;
	}

	.column-title {
		font-size: 0.875rem;
		text-transform: capitalize;
	}

	.column-count {
		background: rgba(0, 0, 0, 0.2);
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
	}

	.column-tasks {
		flex: 1;
		padding: 0.75rem;
		overflow-y: auto;
	}
</style>
```

### 4.3 Task Detail View

**File:** `modules/MoLOS-Tasks/src/lib/components/task-detail.svelte`

```svelte
<script lang="ts">
	import { Task, Comment, Attachment } from '$lib/models/external_modules/MoLOS-Tasks';
	import { onMount } from 'svelte';

	export let task: Task;
	export let onClose: () => void = () => {};

	let comments: Comment[] = [];
	let attachments: Attachment[] = [];
	let newComment = $state('');
	let isLoading = $state(false);

	const statusColors: Record<string, string> = {
		backlog: '#6B7280',
		todo: '#3B82F6',
		in_progress: '#F59E0B',
		done: '#10B981',
		cancelled: '#EF4444'
	};

	onMount(async () => {
		// Load comments and attachments
		// In real implementation, this would call API
	});

	async function addComment() {
		if (!newComment.trim()) return;

		isLoading = true;
		try {
			// API call to add comment
			comments = [
				...comments,
				{
					id: crypto.randomUUID(),
					userId: task.userId,
					taskId: task.id,
					content: newComment,
					createdAt: Math.floor(Date.now() / 1000)
				}
			];
			newComment = '';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString();
	}
</script>

<div class="task-detail">
	<!-- Header -->
	<div class="task-header">
		<div class="task-title-section">
			<h1 class="task-title">{task.title}</h1>
			<div class="task-meta">
				<span class="status-badge" style="background-color: {statusColors[task.status]}">
					{task.status.replace('_', ' ')}
				</span>
				<span class="priority-badge">{task.priority}</span>
				{#if task.projectId}
					<span class="project-badge">{task.projectId}</span>
				{/if}
			</div>
		</div>
		<button class="close-btn" on:click={onClose}>✕</button>
	</div>

	<!-- Description -->
	{#if task.description}
		<div class="task-description">
			<h2>Description</h2>
			<p>{task.description}</p>
		</div>
	{/if}

	<!-- Meta information -->
	<div class="task-meta-section">
		<div class="meta-row">
			<span class="meta-label">Created:</span>
			<span class="meta-value">{formatDate(task.createdAt)}</span>
		</div>
		{#if task.dueDate}
			<div class="meta-row">
				<span class="meta-label">Due Date:</span>
				<span class="meta-value">{formatDate(task.dueDate)}</span>
			</div>
		{/if}
		{#if task.estimateHours}
			<div class="meta-row">
				<span class="meta-label">Estimate:</span>
				<span class="meta-value">{task.estimateHours}h</span>
			</div>
		{/if}
	</div>

	<!-- Labels -->
	{#if task.labels}
		<div class="task-labels">
			{#each JSON.parse(task.labels) as string[] as label}
				<span class="label">{label}</span>
			{/each}
		</div>
	{/if}

	<!-- Attachments -->
	{#if attachments.length > 0}
		<div class="task-attachments">
			<h2>Attachments</h2>
			<div class="attachments-list">
				{#each attachments as attachment}
					<div class="attachment-item">
						<span class="attachment-name">{attachment.fileName}</span>
						<span class="attachment-size">{(attachment.fileSize / 1024).toFixed(1)} KB</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Comments -->
	<div class="task-comments">
		<h2>Comments</h2>
		<div class="comments-list">
			{#each comments as comment}
				<div class="comment-item">
					<div class="comment-header">
						<span class="comment-author">{comment.userId}</span>
						<span class="comment-date">{formatDate(comment.createdAt)}</span>
					</div>
					<p class="comment-content">{comment.content}</p>
				</div>
			{/each}
		</div>

		<!-- Add comment form -->
		<div class="comment-form">
			<textarea bind:value={newComment} placeholder="Add a comment..." rows={3} />
			<button class="submit-btn" on:click={addComment} disabled={!newComment.trim() || isLoading}>
				{isLoading ? 'Sending...' : 'Add Comment'}
			</button>
		</div>
	</div>
</div>

<style>
	.task-detail {
		position: fixed;
		top: 0;
		right: 0;
		width: 450px;
		height: 100%;
		background: white;
		border-left: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
	}

	.task-header {
		padding: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.task-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1f2937;
		margin: 0 0 0.5rem 0;
	}

	.task-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.status-badge,
	.priority-badge,
	.project-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 600;
		color: white;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		color: #6b7280;
	}

	.task-description,
	.task-meta-section,
	.task-labels,
	.task-attachments,
	.task-comments {
		padding: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.task-description h2,
	.task-attachments h2,
	.task-comments h2 {
		font-size: 0.875rem;
		font-weight: 600;
		color: #6b7280;
		margin: 0 0 1rem 0;
		text-transform: uppercase;
	}

	.meta-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.meta-label {
		font-weight: 500;
		color: #6b7280;
	}

	.meta-value {
		color: #1f2937;
	}

	.task-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.label {
		padding: 0.25rem 0.75rem;
		background: #f3f4f6;
		border-radius: 9999px;
		font-size: 0.75rem;
		color: #4b5563;
	}

	.attachment-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.attachment-name {
		font-weight: 500;
		color: #1f2937;
	}

	.attachment-size {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.comment-form {
		padding: 1.5rem;
	}

	.comment-form textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.375rem;
		resize: vertical;
		margin-bottom: 0.75rem;
		font-family: inherit;
	}

	.submit-btn {
		width: 100%;
		padding: 0.75rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
```

### 4.4 Task Form (Create/Edit)

**File:** `modules/MoLOS-Tasks/src/lib/components/task-form.svelte`

```svelte
<script lang="ts">
	import type { Task } from '$lib/models/external_modules/MoLOS-Tasks';

	export let task: Task | null = null; // null = create mode
	export let onSubmit: (data: Partial<Task>) => void = () => {};
	export let onCancel: () => void = () => {};

	const priorities = ['urgent', 'high', 'medium', 'low', 'no_priority'];
	const statuses = ['backlog', 'todo', 'in_progress', 'done', 'cancelled'];

	let formData = $state({
		title: task?.title || '',
		description: task?.description || '',
		status: task?.status || 'backlog',
		priority: task?.priority || 'no_priority',
		projectId: task?.projectId || '',
		dueDate: task?.dueDate ? new Date(task.dueDate * 1000).toISOString().split('T')[0] : '',
		estimateHours: task?.estimateHours || 0
	});

	function handleSubmit() {
		onSubmit({
			...formData,
			dueDate: formData.dueDate
				? Math.floor(new Date(formData.dueDate).getTime() / 1000)
				: undefined
		});
	}
</script>

<div class="task-form">
	<h2>{task ? 'Edit Task' : 'New Task'}</h2>

	<form on:submit|preventDefault={handleSubmit}>
		<!-- Title -->
		<div class="form-group">
			<label for="title">Title *</label>
			<input
				id="title"
				type="text"
				bind:value={formData.title}
				placeholder="Enter task title"
				required
			/>
		</div>

		<!-- Description -->
		<div class="form-group">
			<label for="description">Description</label>
			<textarea
				id="description"
				bind:value={formData.description}
				placeholder="Enter task description"
				rows={4}
			/>
		</div>

		<!-- Status & Priority -->
		<div class="form-row">
			<div class="form-group">
				<label for="status">Status</label>
				<select id="status" bind:value={formData.status}>
					{#each statuses as status}
						<option value={status}>{status.replace('_', ' ')}</option>
					{/each}
				</select>
			</div>

			<div class="form-group">
				<label for="priority">Priority</label>
				<select id="priority" bind:value={formData.priority}>
					{#each priorities as priority}
						<option value={priority}>{priority.replace('_', ' ')}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Due Date & Estimate -->
		<div class="form-row">
			<div class="form-group">
				<label for="dueDate">Due Date</label>
				<input id="dueDate" type="date" bind:value={formData.dueDate} />
			</div>

			<div class="form-group">
				<label for="estimate">Estimate (hours)</label>
				<input id="estimate" type="number" bind:value={formData.estimateHours} min="0" step="0.5" />
			</div>
		</div>

		<!-- Actions -->
		<div class="form-actions">
			<button type="button" class="btn-secondary" on:click={onCancel}> Cancel </button>
			<button type="submit" class="btn-primary">
				{task ? 'Update Task' : 'Create Task'}
			</button>
		</div>
	</form>
</div>

<style>
	.task-form {
		padding: 1.5rem;
		max-width: 600px;
		background: white;
		border-radius: 0.5rem;
	}

	.task-form h2 {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0 0 1.5rem 0;
		color: #1f2937;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.375rem;
	}

	input[type='text'],
	input[type='number'],
	input[type='date'],
	textarea,
	select {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-family: inherit;
		transition: border-color 0.15s ease;
	}

	input:focus,
	textarea:focus,
	select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	textarea {
		resize: vertical;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}

	.btn-secondary,
	.btn-primary {
		padding: 0.625rem 1.25rem;
		border-radius: 0.375rem;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		border: none;
		transition: all 0.15s ease;
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover {
		background: #2563eb;
	}
</style>
```

### 4.5 Project List

**File:** `modules/MoLOS-Tasks/src/lib/components/project-list.svelte`

```svelte
<script lang="ts">
	import type { Project } from '$lib/models/external_modules/MoLOS-Tasks';

	export let projects: Project[] = [];
	export let onProjectClick: (project: Project) => void = () => {};
	export let onProjectCreate: () => void = () => {};

	let showCreateModal = $state(false);
	let newProjectName = $state('');
</script>

<div class="project-list">
	<div class="project-header">
		<h2>Projects</h2>
		<button class="create-btn" on:click={onProjectCreate}> + New Project </button>
	</div>

	<div class="projects-grid">
		{#each projects as project}
			<div
				class="project-card"
				on:click={() => onProjectClick(project)}
				style="border-left: 4px solid {project.color || '#3b82f6'}"
			>
				<h3 class="project-name">{project.name}</h3>
				{#if project.description}
					<p class="project-description">{project.description}</p>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.project-list {
		padding: 1.5rem;
	}

	.project-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.project-header h2 {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0;
		color: #1f2937;
	}

	.create-btn {
		padding: 0.5rem 1rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
	}

	.projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.project-card {
		padding: 1.25rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.project-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.project-name {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: #1f2937;
	}

	.project-description {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0;
	}
</style>
```

---

## Phase 5: Pages (Simplified)

### 5.1 Main Dashboard Page

**File:** `modules/MoLOS-Tasks/src/routes/ui/+page.svelte`

```svelte
<script lang="ts">
	import type { Task, Project } from '$lib/models/external_modules/MoLOS-Tasks';
	import { onMount } from 'svelte';
	import TaskBoard from '$lib/modules/MoLOS-Tasks/components/task-board.svelte';
	import ProjectList from '$lib/modules/MoLOS-Tasks/components/project-list.svelte';
	import TaskDetail from '$lib/modules/MoLOS-Tasks/components/task-detail.svelte';

	let tasks: Task[] = [];
	let projects: Project[] = [];
	let selectedTask: Task | null = null;
	let selectedProject: Project | null = null;
	let view: 'tasks' | 'projects' = $state('tasks');
	let isLoading = $state(true);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		isLoading = true;
		try {
			// Fetch tasks and projects from API
			const [tasksResponse, projectsResponse] = await Promise.all([
				fetch('/api/MoLOS-Tasks/tasks'),
				fetch('/api/MoLOS-Tasks/projects')
			]);

			tasks = await tasksResponse.json();
			projects = await projectsResponse.json();
		} finally {
			isLoading = false;
		}
	}

	function handleTaskClick(task: Task) {
		selectedTask = task;
	}

	function handleTaskComplete(taskId: string) {
		// Update task status to done
		const task = tasks.find((t) => t.id === taskId);
		if (task) {
			task.status = 'done';
			task.isCompleted = true;
		}
	}

	function handleTaskMove(taskId: string, newStatus: string) {
		const task = tasks.find((t) => t.id === taskId);
		if (task) {
			task.status = newStatus as any;
		}
	}

	function handleProjectClick(project: Project) {
		selectedProject = project;
		view = 'tasks';
		// Filter tasks by project
	}
</script>

{#if isLoading}
	<div class="loading">Loading...</div>
{:else}
	<div class="dashboard">
		<!-- Sidebar/Navigation -->
		<aside class="sidebar">
			<div class="nav-header">
				<h1>Tasks</h1>
				<button class="new-task-btn">+ New Task</button>
			</div>

			<nav class="nav-menu">
				<button class:active={view === 'tasks'} on:click={() => (view = 'tasks')}>
					My Tasks
				</button>
				<button class:active={view === 'projects'} on:click={() => (view = 'projects')}>
					Projects
				</button>
			</nav>

			{#if selectedProject}
				<div class="active-project">
					<span class="project-label">Active Project:</span>
					<span class="project-name">{selectedProject.name}</span>
					<button on:click={() => (selectedProject = null)}>✕</button>
				</div>
			{/if}
		</aside>

		<!-- Main Content -->
		<main class="main-content">
			{#if view === 'tasks'}
				<TaskBoard
					{tasks}
					onTaskClick={handleTaskClick}
					onTaskComplete={handleTaskComplete}
					onTaskMove={handleTaskMove}
				/>
			{:else if view === 'projects'}
				<ProjectList
					{projects}
					onProjectClick={handleProjectClick}
					onProjectCreate={() => console.log('Create project')}
				/>
			{/if}
		</main>

		<!-- Task Detail Sidebar -->
		{#if selectedTask}
			<TaskDetail task={selectedTask} onClose={() => (selectedTask = null)} />
		{/if}
	</div>
{/if}

<style>
	.dashboard {
		display: flex;
		height: 100vh;
	}

	.sidebar {
		width: 280px;
		background: white;
		border-right: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
	}

	.nav-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: #1f2937;
	}

	.new-task-btn {
		width: 100%;
		padding: 0.75rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
	}

	.nav-menu {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 2rem 0;
	}

	.nav-menu button {
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		border-radius: 0.375rem;
		text-align: left;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #4b5563;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.nav-menu button:hover {
		background: #f3f4f6;
	}

	.nav-menu button.active {
		background: #dbeafe;
		color: #1e40af;
	}

	.active-project {
		margin-top: auto;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 0.375rem;
	}

	.project-label {
		font-size: 0.75rem;
		color: #6b7280;
		display: block;
		margin-bottom: 0.25rem;
	}

	.project-name {
		font-weight: 600;
		color: #1f2937;
	}

	.active-project button {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: #6b7280;
		padding: 0;
	}

	.main-content {
		flex: 1;
		overflow: auto;
		background: #f9fafb;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100vh;
		font-size: 1.125rem;
		color: #6b7280;
	}
</style>
```

---

## Implementation Phases (Simplified)

### Phase 1: Database & Models (1 week)

- [ ] Create new database schema (4 tables)
- [ ] Write migration script
- [ ] Update TypeScript models
- [ ] Test migration

### Phase 2: Backend Services (1 week)

- [ ] TaskService implementation
- [ ] CommentService implementation
- [ ] AttachmentService implementation
- [ ] ViewService implementation
- [ ] Repository updates

### Phase 3: API Layer (3 days)

- [ ] Tasks API endpoints
- [ ] Comments API endpoints
- [ ] Attachments API endpoints
- [ ] Views API endpoints

### Phase 4: UI Components (1 week)

- [ ] TaskList component
- [ ] TaskBoard component
- [ ] TaskDetail component
- [ ] TaskForm component
- [ ] ProjectList component

### Phase 5: Pages Integration (3 days)

- [ ] Main dashboard page
- [ ] Project detail page
- [ ] Task detail page
- [ ] Settings page

### Phase 6: Testing (3 days)

- [ ] Write acceptance tests
- [ ] Write component tests
- [ ] Manual testing

---

## Total Timeline

**Estimated: 4-5 weeks**

| Phase                | Duration | Deliverable         |
| -------------------- | -------- | ------------------- |
| 1. Database & Models | 1 week   | Working migrations  |
| 2. Backend Services  | 1 week   | CRUD operations     |
| 3. API Layer         | 3 days   | REST endpoints      |
| 4. UI Components     | 1 week   | Reusable components |
| 5. Pages Integration | 3 days   | Working UI          |
| 6. Testing           | 3 days   | Test coverage       |

---

## Success Criteria

- ✅ Clean, Linear-like UI
- ✅ Simple task CRUD
- ✅ Project-based organization
- ✅ Task status workflow (Backlog → Todo → In Progress → Done)
- ✅ Priority levels
- ✅ Comments and attachments
- ✅ Responsive design
- ✅ Fast performance (< 100ms p95)
- ✅ No complex automation

---

## Key Features

### What's Included

- Task management (create, edit, delete, complete)
- Projects with color/icon
- Status workflow (Linear-style)
- Priority levels
- Labels
- Comments
- Attachments
- Due dates
- Time estimates
- Saved views/filters
- Drag-and-drop (kanban)
- Task hierarchy (subtasks)

### What's Excluded

- Automation rules
- Webhooks
- Background jobs
- Complex search (use basic filtering)
- Realtime (use simple polling if needed)
- Dependencies
- Epics/Sprints
- Time tracking (basic estimates only)
- RBAC (simple user ownership)

---

**Document Version:** 3.0 (Simplified Linear-Style)
**Last Updated:** 2026-02-24
**Author:** AI Assistant

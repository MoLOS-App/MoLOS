# Database Schema Update Plan

> **Phase:** 01  
> **Duration:** 1 week  
> **Status:** ⏳ Pending

---

## Overview

Update existing MoLOS-Tasks database schema to support Linear-style features and new functionality.

**Key Changes:**

- Add 3 new tables (comments, attachments, views)
- Alter tasks table (subtasks, labels, time tracking, position, version)
- Alter projects table (color, icon)
- Migrate existing data to new schema
- Update TypeScript models

---

## New Tables

### 1. Comments Table

**Purpose:** Store task comments for collaboration

```sql
CREATE TABLE MoLOS-Tasks_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_comments_task ON MoLOS-Tasks_comments(task_id);
```

**Columns:**

- `id` - Primary key (UUID)
- `user_id` - Comment author
- `task_id` - Associated task
- `content` - Comment text
- `created_at` - Creation timestamp (Unix seconds)

---

### 2. Attachments Table

**Purpose:** Store file attachments for tasks

```sql
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

CREATE INDEX idx_attachments_task ON MoLOS-Tasks_attachments(task_id);
```

**Columns:**

- `id` - Primary key (UUID)
- `user_id` - Upload user
- `task_id` - Associated task
- `file_name` - Original filename
- `file_size` - Size in bytes
- `file_type` - MIME type
- `storage_path` - File storage path
- `created_at` - Upload timestamp

---

### 3. Views Table

**Purpose:** Store saved view filters for quick access

```sql
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
```

**Columns:**

- `id` - Primary key (UUID)
- `user_id` - View owner
- `project_id` - Associated project (optional)
- `name` - View display name
- `filters` - JSON filter configuration
- `sort_by` - Sort field
- `sort_order` - Sort direction (asc/desc)
- `is_default` - Default view flag
- `created_at` - Creation timestamp

---

## Table Alterations

### Tasks Table Updates

**New Columns:**

```sql
-- Subtask support
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN parent_id TEXT REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE;

-- Labels (JSON array)
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN labels TEXT;

-- Time tracking
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN estimate_hours INTEGER;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN time_spent_hours INTEGER NOT NULL DEFAULT 0;

-- Ordering
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- Optimistic concurrency
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Create indexes
CREATE INDEX idx_tasks_parent ON MoLOS-Tasks_tasks(parent_id);
CREATE INDEX idx_tasks_position ON MoLOS-Tasks_tasks(project_id, position);
```

---

### Projects Table Updates

**New Columns:**

```sql
-- Visual customization
ALTER TABLE MoLOS-Tasks_projects ADD COLUMN color TEXT;
ALTER TABLE MoLOS-Tasks_projects ADD COLUMN icon TEXT;
```

---

## Migration Script

**File:** `modules/MoLOS-Tasks/drizzle/0002_add_linear_features.sql`

### Step 1: Create New Tables

```sql
--> statement-breakpoint

-- Create comments table
CREATE TABLE MoLOS-Tasks_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

--> statement-breakpoint

-- Create attachments table
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

--> statement-breakpoint

-- Create views table
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
```

### Step 2: Alter Tasks Table

```sql
--> statement-breakpoint

-- Add new columns to tasks
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN parent_id TEXT;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN labels TEXT;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN estimate_hours INTEGER;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN time_spent_hours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

### Step 3: Alter Projects Table

```sql
--> statement-breakpoint

-- Add visual columns to projects
ALTER TABLE MoLOS-Tasks_projects ADD COLUMN color TEXT;
ALTER TABLE MoLOS-Tasks_projects ADD COLUMN icon TEXT;
```

### Step 4: Create Indexes

```sql
--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX idx_comments_task ON MoLOS-Tasks_comments(task_id);
CREATE INDEX idx_attachments_task ON MoLOS-Tasks_attachments(task_id);
CREATE INDEX idx_tasks_parent ON MoLOS-Tasks_tasks(parent_id);
CREATE INDEX idx_tasks_position ON MoLOS-Tasks_tasks(project_id, position);
```

### Step 5: Migrate Existing Data

```sql
--> statement-breakpoint

-- Set initial positions based on rowid
UPDATE MoLOS-Tasks_tasks SET position = rowid WHERE position = 0;

-- Migrate status to Linear-style (mapping: to_do → todo, waiting → backlog, archived → cancelled)
UPDATE MoLOS-Tasks_tasks
SET status = CASE status
  WHEN 'to_do' THEN 'todo'
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'waiting' THEN 'backlog'
  WHEN 'done' THEN 'done'
  WHEN 'archived' THEN 'cancelled'
  ELSE status
END;
```

---

## TypeScript Model Updates

**File:** `modules/MoLOS-Tasks/src/models/types.ts`

### New Interfaces

```typescript
// Comments
export interface Comment {
	id: string;
	userId: string;
	taskId: string;
	content: string;
	createdAt: number;
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
	createdAt: number;
}

// Views
export interface View {
	id: string;
	userId: string;
	projectId?: string;
	name: string;
	filters: ViewFilters;
	sortBy: string;
	sortOrder: 'asc' | 'desc';
	isDefault: boolean;
	createdAt: number;
}

export interface ViewFilters {
	status?: string[];
	priority?: string[];
	labels?: string[];
	parentId?: string | null;
	searchQuery?: string;
	projectId?: string;
}
```

### Updated Task Interface

```typescript
export interface Task {
	id: string;
	userId: string;
	title: string;
	description?: string;

	// Updated status enum
	status: TaskStatus;

	// Keep existing priority (compatible)
	priority: TaskPriority;

	dueDate?: number;
	doDate?: number;
	effort?: number;
	context?: TaskContext[];

	isCompleted: boolean;
	projectId?: string;
	areaId?: string;

	// New fields
	parentId?: string | null;
	labels?: string[];
	estimateHours?: number;
	timeSpentHours: number;
	position: number;
	version: number;

	createdAt: number;
	updatedAt: number;
}
```

### Updated Enums

```typescript
// Linear-style status (new)
export const TaskStatus = {
	BACKLOG: 'backlog',
	TODO: 'todo',
	IN_PROGRESS: 'in_progress',
	DONE: 'done',
	CANCELLED: 'cancelled'
} as const;

// Linear-style priority (new)
export const TaskPriority = {
	URGENT: 'urgent',
	HIGH: 'high',
	MEDIUM: 'medium',
	LOW: 'low',
	NO_PRIORITY: 'no_priority'
} as const;
```

---

## Checklist

### Week 1 Tasks

- [ ] Review existing database schema
- [ ] Write migration SQL script
- [ ] Create migration file: `0002_add_linear_features.sql`
- [ ] Test migration on development database
- [ ] Test migration on production database copy
- [ ] Update TypeScript models
- [ ] Update Drizzle schema definitions
- [ ] Generate Drizzle migration
- [ ] Run migration: `bun run db:migrate`
- [ ] Validate schema: `bun run db:validate`
- [ ] Test data access with new columns
- [ ] Document migration rollback procedure

---

## Rollback Plan

**If migration fails:**

1. Stop application
2. Backup current database
3. Restore from pre-migration backup
4. Investigate failure
5. Fix migration script
6. Retry migration

**Rollback SQL:**

```sql
-- Drop new columns from tasks
ALTER TABLE MoLOS-Tasks_tasks DROP COLUMN parent_id;
ALTER TABLE MoLOS-Tasks_tasks DROP COLUMN labels;
ALTER TABLE MoLOS-Tasks_tasks DROP COLUMN estimate_hours;
ALTER TABLE MoLOS-Tasks_tasks DROP COLUMN time_spent_hours;
ALTER TABLE MoLOS-Tasks_tasks DROP COLUMN position;
ALTER TABLE MoLOS-Tasks_tasks DROP COLUMN version;

-- Drop new columns from projects
ALTER TABLE MoLOS-Tasks_projects DROP COLUMN color;
ALTER TABLE MoLOS-Tasks_projects DROP COLUMN icon;

-- Drop new tables
DROP TABLE MoLOS-Tasks_comments;
DROP TABLE MoLOS-Tasks_attachments;
DROP TABLE MoLOS-Tasks_views;

-- Drop new indexes
DROP INDEX idx_comments_task;
DROP INDEX idx_attachments_task;
DROP INDEX idx_tasks_parent;
DROP INDEX idx_tasks_position;
```

---

## Validation

After migration, verify:

- [ ] All 3 new tables created
- [ ] All new columns added to tasks table
- [ ] All new columns added to projects table
- [ ] All indexes created
- [ ] Existing data preserved
- [ ] Status values migrated correctly
- [ ] Position values initialized
- [ ] No data loss

---

**Next:** Proceed to Phase 02 - Backend Services

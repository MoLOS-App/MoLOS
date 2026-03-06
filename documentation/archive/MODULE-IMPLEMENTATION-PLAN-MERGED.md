# MoLOS-Tasks Module - Merged Implementation Plan

## Executive Summary

Merge existing MoLOS-Tasks features with simplified Linear-style enhancements and AI integration points.

**Current State:** 5 tables, 10 AI tools, Kanban UI, basic CRUD
**Target State:** Linear-style workflow + AI-powered task intelligence

---

## Feature Matrix: Current vs. New

### Database Tables

| Table         | Current     | New Fields                                                                              | Action     |
| ------------- | ----------- | --------------------------------------------------------------------------------------- | ---------- |
| `tasks`       | ✅ Existing | Add: `parent_id`, `labels`, `estimate_hours`, `time_spent_hours`, `position`, `version` | **ALTER**  |
| `projects`    | ✅ Existing | Add: `color`, `icon`                                                                    | **ALTER**  |
| `areas`       | ✅ Existing | Keep as-is                                                                              | **KEEP**   |
| `daily_log`   | ✅ Existing | Keep as-is                                                                              | **KEEP**   |
| `settings`    | ✅ Existing | Keep as-is                                                                              | **KEEP**   |
| `comments`    | ❌ New      | Create fresh                                                                            | **CREATE** |
| `attachments` | ❌ New      | Create fresh                                                                            | **CREATE** |
| `views`       | ❌ New      | Create fresh                                                                            | **CREATE** |

### Status & Priority Enums

| Feature  | Current                                               | New (Linear-style)                                    | Action      |
| -------- | ----------------------------------------------------- | ----------------------------------------------------- | ----------- |
| Status   | `to_do`, `in_progress`, `waiting`, `done`, `archived` | `backlog`, `todo`, `in_progress`, `done`, `cancelled` | **REPLACE** |
| Priority | `high`, `medium`, `low`                               | `urgent`, `high`, `medium`, `low`, `no_priority`      | **REPLACE** |

### AI Tools

| Tool                        | Current     | Enhancement Needed                 |
| --------------------------- | ----------- | ---------------------------------- |
| `get_tasks`                 | ✅ Existing | Add: AI context suggestions        |
| `bulk_create_tasks`         | ✅ Existing | Add: Smart defaults from patterns  |
| `bulk_update_tasks`         | ✅ Existing | Keep as-is                         |
| `bulk_delete_tasks`         | ✅ Existing | Keep as-is                         |
| `get_projects`              | ✅ Existing | Keep as-is                         |
| `create_project`            | ✅ Existing | Add: AI-suggested name/description |
| `get_areas`                 | ✅ Existing | Keep as-is                         |
| `get_note_hierarchy`        | ✅ Existing | Keep as-is                         |
| `update_daily_log`          | ✅ Existing | Keep as-is                         |
| `global_search`             | ✅ Existing | Add: AI relevance scoring          |
| **NEW: `suggest_tasks`**    | ❌ None     | Add: AI-powered task suggestions   |
| **NEW: `summarize_task`**   | ❌ None     | Add: Summarize task + comments     |
| **NEW: `prioritize_tasks`** | ❌ None     | Add: AI priority recommendations   |

### UI Components

| Component               | Current     | New                                  | Action     |
| ----------------------- | ----------- | ------------------------------------ | ---------- |
| `KanbanBoard`           | ✅ Existing | Enhance with Linear-style columns    | **UPDATE** |
| `TaskItem`              | ✅ Existing | Add: subtask indicator, label badges | **UPDATE** |
| `ProjectDetailPanel`    | ✅ Existing | Keep as-is                           | **KEEP**   |
| **NEW: TaskBoard**      | ❌ None     | Create (Linear-style list view)      | **CREATE** |
| **NEW: TaskDetail**     | ❌ None     | Create (comments sidebar)            | **CREATE** |
| **NEW: TaskForm**       | ❌ None     | Create (create/edit modal)           | **CREATE** |
| **NEW: ProjectList**    | ❌ None     | Create (grid with colors)            | **CREATE** |
| **NEW: CommentList**    | ❌ None     | Create (threaded)                    | **CREATE** |
| **NEW: AttachmentList** | ❌ None     | Create (file uploads)                | **CREATE** |

---

## Phase 1: Database Schema Updates

### 1.1 Add New Tables

**Comments Table:**

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

**Attachments Table:**

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

**Views Table (Saved Filters):**

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

### 1.2 Alter Existing Tables

**Add columns to tasks table:**

```sql
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN parent_id TEXT REFERENCES MoLOS-Tasks_tasks(id) ON DELETE CASCADE;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN labels TEXT; -- JSON array
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN estimate_hours INTEGER;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN time_spent_hours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

**Add columns to projects table:**

```sql
ALTER TABLE MoLOS-Tasks_projects ADD COLUMN color TEXT;
ALTER TABLE MoLOS-Tasks_projects ADD COLUMN icon TEXT;
```

### 1.3 Migration Script

Data migration approach:

1. Add new columns with defaults
2. Update existing tasks: set position = rowid (for ordering)
3. Update existing tasks: migrate status values:
   - `to_do` → `todo`
   - `waiting` → `backlog`
   - `archived` → `cancelled`
   - `in_progress` → `in_progress` (same)
   - `done` → `done` (same)
4. Update existing tasks: migrate priority values (same, no change needed)
5. Create default views for existing users

---

## Phase 2: Backend Services (Merge & Enhance)

### 2.1 Enhanced TaskService

**New capabilities:**

```typescript
class TaskService {
	// Existing (keep)
	async createTask(input, userId): Promise<Task>;
	async updateTask(id, userId, updates): Promise<Task>;
	async deleteTask(id, userId): Promise<void>;

	// New (add)
	async addSubtask(parentId, input, userId): Promise<Task>;
	async getTaskTree(userId, projectId): Promise<TaskTree>;
	async updateTimeSpent(id, userId, hours): Promise<Task>;
	async moveTask(id, userId, position): Promise<Task>;
	async addLabel(id, userId, label): Promise<Task>;
	async removeLabel(id, userId, label): Promise<Task>;
}
```

### 2.2 New Services

**CommentService:**

```typescript
class CommentService {
	async addComment(taskId, userId, content): Promise<Comment>;
	async getTaskComments(taskId, userId): Promise<Comment[]>;
	async deleteComment(id, userId): Promise<void>;
}
```

**AttachmentService:**

```typescript
class AttachmentService {
	async createAttachment(taskId, userId, file): Promise<Attachment>;
	async getTaskAttachments(taskId, userId): Promise<Attachment[]>;
	async deleteAttachment(id, userId): Promise<void>;
	getFilePath(attachmentId): string;
}
```

**ViewService:**

```typescript
class ViewService {
	async createView(userId, name, filters, sortBy): Promise<View>;
	async getViews(userId): Promise<View[]>;
	async deleteView(id, userId): Promise<void>;
	async applyView(viewId, userId): Promise<Task[]>;
}
```

### 2.3 AI Service Enhancements

**Add to existing AI tools:**

1. **suggest_tasks** - AI-powered task suggestions
   - Analyze user's task patterns
   - Suggest tasks based on projects, due dates, context
   - Return: suggested tasks with confidence scores

2. **summarize_task** - Summarize task + comments
   - Input: taskId
   - Output: AI summary of task and all comments
   - Use for quick overview without reading all comments

3. **prioritize_tasks** - AI priority recommendations
   - Input: list of tasks or project ID
   - Output: reordered tasks with AI priority suggestions
   - Factors: due dates, estimates, labels, dependencies

**Enhance existing tools:**

- `get_tasks`: Add context parameter for AI understanding
- `bulk_create_tasks`: Add AI-suggested defaults based on patterns
- `global_search`: Add AI relevance scoring for results

---

## Phase 3: API Layer Updates

### 3.1 New Endpoints

```typescript
// Comments
GET    /api/MoLOS-Tasks/tasks/:id/comments
POST   /api/MoLOS-Tasks/tasks/:id/comments
DELETE /api/MoLOS-Tasks/comments/:id

// Attachments
GET    /api/MoLOS-Tasks/tasks/:id/attachments
POST   /api/MoLOS-Tasks/tasks/:id/attachments
DELETE /api/MoLOS-Tasks/attachments/:id
GET    /api/MoLOS-Tasks/attachments/:id/download

// Subtasks
GET    /api/MoLOS-Tasks/tasks/:id/subtasks
POST   /api/MoLOS-Tasks/tasks/:id/subtasks

// Views
GET    /api/MoLOS-Tasks/views
POST   /api/MoLOS-Tasks/views
DELETE /api/MoLOS-Tasks/views/:id
GET    /api/MoLOS-Tasks/views/:id/tasks

// Time tracking
PATCH  /api/MoLOS-Tasks/tasks/:id/time-spent

// Task operations
POST   /api/MoLOS-Tasks/tasks/:id/move
PATCH  /api/MoLOS-Tasks/tasks/:id/labels
```

### 3.2 Enhanced Endpoints

Update existing endpoints to support new features:

- `/api/MoLOS-Tasks` (GET): Add filters for parent_id, labels, search
- `/api/MoLOS-Tasks` (POST): Accept parent_id, labels, position
- `/api/MoLOS-Tasks/tasks/:id` (PATCH): Support new fields

---

## Phase 4: AI Integration Strategy

### 4.1 AI Context Enrichment

**Task context for AI:**

```typescript
interface TaskAIContext {
	taskId: string;
	task: Task;
	subtasks?: Task[];
	comments: Comment[];
	attachments: Attachment[];
	project?: Project;
	relatedTasks?: Task[]; // Tasks in same project/status
	userPatterns?: {
		commonLabels: string[];
		typicalPriority: string;
		averageTimeSpent: number;
	};
}
```

**Add to AI tool `get_tasks`:**

```typescript
{
  name: "get_tasks",
  description: "Retrieve tasks with AI context for intelligent analysis",
  parameters: {
    userId: "User ID",
    filters: "Optional filters",
    includeContext: "Include AI-relevant context (default: true)"
  },
  returns: {
    tasks: "Task list",
    context: "AI context with patterns and relationships"
  }
}
```

### 4.2 AI-Powered Features

**1. Smart Task Creation:**

```typescript
interface SmartTaskSuggestion {
	title: string;
	description?: string;
	suggestedPriority: string;
	suggestedDueDate?: number;
	suggestedLabels: string[];
	suggestedProject?: string;
	confidence: number; // 0-1
	reason: string; // AI explanation
}
```

**2. Task Summarization:**

```typescript
interface TaskSummary {
	taskId: string;
	summary: string;
	keyPoints: string[]; // Bullet points
	openQuestions: string[]; // Unresolved items mentioned
	actionItems: string[]; // Actionable items
	estimatedEffort?: string; // AI estimate based on complexity
}
```

**3. Priority Recommendations:**

```typescript
interface PriorityRecommendation {
	taskId: string;
	suggestedPriority: string;
	factors: {
		dueDateProximity: number; // 0-1
		projectImportance: number; // 0-1
		dependenciesCount: number;
		timeEstimate: number;
	};
	confidence: number;
	explanation: string;
}
```

### 4.3 AI Tool Updates

**Update existing AI tools file:**

```typescript
// New tool
export const suggestTasks: ToolDefinition = {
	name: 'suggest_tasks',
	description: 'AI-powered task suggestions based on user patterns and project context',
	parameters: {
		userId: { type: 'string', required: true },
		projectContext: { type: 'string', required: false },
		count: { type: 'number', default: 5 }
	},
	execute: async (params) => {
		// Analyze user patterns
		// Generate suggestions
		// Return structured results
	}
};

// Enhanced existing tool
export const getTasks: ToolDefinition = {
	// ...existing code...
	execute: async (params) => {
		const tasks = await taskRepo.getFiltered(params.userId, params.filters);

		// NEW: Build AI context
		if (params.includeContext !== false) {
			const context = await buildAIContext(tasks, params.userId);
			return { tasks, context };
		}

		return { tasks };
	}
};
```

---

## Phase 5: UI Component Strategy

### 5.1 Component Hierarchy

```
App Layout
├── Sidebar (existing)
│   ├── Navigation (existing)
│   └── Project Filter (enhance)
│
├── Main Content
│   ├── TaskBoard (NEW - Linear-style list)
│   │   ├── TaskList (existing, enhance)
│   │   ├── TaskDetailPanel (NEW - slide-out)
│   │   │   ├── Comments (NEW)
│   │   │   ├── Attachments (NEW)
│   │   │   ├── Subtasks (NEW)
│   │   │   └── TimeLog (NEW)
│   │   └── TaskFormModal (NEW)
│   │
│   ├── KanbanBoard (existing, enhance columns)
│   │   └── Column: Backlog, Todo, In Progress, Done, Cancelled
│   │
│   ├── Projects (existing)
│   │   ├── ProjectList (NEW - grid with colors)
│   │   └── ProjectDetailPanel (existing)
│   │
│   └── Dashboard (existing, add AI insights)
│       ├── Quick Stats
│       ├── AI Suggestions (NEW)
│       └── Recent Activity
│
└── Modals/Overlays
    ├── CreateTaskModal (NEW)
    ├── EditTaskModal (NEW)
    ├── AddCommentModal (NEW)
    └── UploadAttachmentModal (NEW)
```

### 5.2 Key Component Responsibilities

**TaskBoard (NEW):**

- Linear-style list view
- Group by status (columns or inline sections)
- Show subtasks nested under parent
- Drag-and-drop for reordering
- Inline task creation
- Filter/sort controls
- AI suggestion indicator

**TaskDetailPanel (NEW):**

- Slide-out panel (right side)
- Task header with status, priority, labels
- Description
- Subtasks section (nested list)
- Comments thread (newest first)
- Attachments list
- Time tracking (add hours)
- AI summary button (call summarize_task tool)

**TaskFormModal (NEW):**

- Create/Edit modal
- Fields: title, description, status, priority, project, labels, due date, estimate
- Smart defaults: AI suggests based on context
- Subtask creation checkbox
- Parent task selector (if creating subtask)

**CommentList (NEW):**

- Threaded display
- Timestamp formatting
- User avatar/name
- Reply functionality
- AI summarize button (summarize thread)

---

## Implementation Phases

### Phase 1: Database (1 week)

- [ ] Add comments table
- [ ] Add attachments table
- [ ] Add views table
- [ ] Alter tasks table (parent_id, labels, etc.)
- [ ] Alter projects table (color, icon)
- [ ] Create migration script
- [ ] Test migration with sample data
- [ ] Update TypeScript models

### Phase 2: Backend Services (1 week)

- [ ] Implement CommentService
- [ ] Implement AttachmentService
- [ ] Implement ViewService
- [ ] Enhance TaskService (subtasks, labels, position)
- [ ] Update all repositories
- [ ] Add unit tests for new services

### Phase 3: API Layer (3 days)

- [ ] Add comments endpoints
- [ ] Add attachments endpoints
- [ ] Add views endpoints
- [ ] Add subtasks endpoints
- [ ] Add time tracking endpoint
- [ ] Update existing endpoints
- [ ] Add API tests

### Phase 4: AI Integration (3 days)

- [ ] Implement `suggest_tasks` tool
- [ ] Implement `summarize_task` tool
- [ ] Implement `prioritize_tasks` tool
- [ ] Enhance `get_tasks` with AI context
- [ ] Add AI context builders
- [ ] Test AI tools

### Phase 5: UI Components (1 week)

- [ ] Create TaskBoard component (Linear-style)
- [ ] Create TaskDetailPanel component
- [ ] Create TaskFormModal component
- [ ] Create CommentList component
- [ ] Create AttachmentList component
- [ ] Enhance existing TaskItem component
- [ ] Enhance existing KanbanBoard (new columns)
- [ ] Add AI suggestion indicators
- [ ] Add drag-and-drop improvements

### Phase 6: Pages Integration (2 days)

- [ ] Update dashboard page (add AI insights)
- [ ] Update my tasks page (new features)
- [ ] Update kanban page (new status columns)
- [ ] Add task detail route
- [ ] Test navigation and state

### Phase 7: Testing & Polish (2 days)

- [ ] Write acceptance tests
- [ ] Write component tests
- [ ] Test AI tool integrations
- [ ] Manual testing
- [ ] Performance testing

---

## Total Timeline

**Estimated: 4 weeks**

| Week | Phases | Focus                       |
| ---- | ------ | --------------------------- |
| 1    | 1-2    | Database + Backend Services |
| 2    | 3-4    | API + AI Integration        |
| 3    | 5      | UI Components               |
| 4    | 6-7    | Pages Integration + Testing |

---

## Key Deliverables

### Database

- [ ] Migration script (0002_add_linear_features.sql)
- [ ] Updated schema definitions
- [ ] Updated TypeScript models

### Backend

- [ ] 3 new services (Comment, Attachment, View)
- [ ] Enhanced TaskService
- [ ] 3 new AI tools
- [ ] 4 enhanced AI tools

### API

- [ ] 6 new API endpoint groups
- [ ] Updated existing endpoints
- [ ] API documentation

### AI

- [ ] AI context enrichment layer
- [ ] Task suggestion engine
- [ ] Summarization capability
- [ ] Priority recommendation engine

### UI

- [ ] 6 new components (no code details in plan)
- [ ] 3 enhanced components
- [ ] 2 updated pages

---

## Success Criteria

### Functional

- [ ] Tasks can have subtasks (nested)
- [ ] Tasks can have labels (multiple)
- [ ] Tasks can have comments
- [ ] Tasks can have attachments
- [ ] Tasks can be ordered by position
- [ ] Users can save and apply view filters
- [ ] Status workflow matches Linear (5 states)
- [ ] Priority matches Linear (5 levels)
- [ ] Projects can have colors/icons

### AI Integration

- [ ] AI can suggest tasks based on patterns
- [ ] AI can summarize tasks + comments
- [ ] AI can recommend task priorities
- [ ] AI tools return enriched context
- [ ] AI suggestions displayed in UI

### Performance

- [ ] API p95 < 200ms for paginated lists
- [ ] UI renders < 100ms for task lists
- [ ] AI tool response < 2s for single operations
- [ ] Database queries indexed properly

---

## AI Integration Architecture

### Data Flow

```
User Action → API → Service → AI Tool → AI Model → Result → UI

Example: Create Task
1. User clicks "New Task" button
2. UI opens TaskFormModal with context
3. AI tool `suggest_tasks` called with user patterns
4. AI returns 3-5 task suggestions
5. UI displays suggestions as "Smart suggestions"
6. User can click to autofill or type manually
```

### AI Context Sources

**For task suggestions:**

- User's recent tasks (last 50)
- Tasks in same project
- Tasks with same labels
- Overdue tasks
- Project goals/descriptions

**For summarization:**

- Task title + description
- All comments
- Attachments (filenames)
- Related tasks

**For priority:**

- Task due date proximity
- Project importance (based on other tasks)
- Dependencies (blocking others)
- Time estimate vs spent
- User's priority patterns

---

## Risk Mitigation

### Technical Risks

- **Risk:** Migration breaks existing data
  - **Mitigation:** Test migration on copy of production DB first
- **Risk:** Performance degradation with subtasks
  - **Mitigation:** Limit depth to 3 levels, add indexes on parent_id
- **Risk:** AI tools slow down UI
  - **Mitigation:** Run AI tools asynchronously, show loading state, cache results

### UX Risks

- **Risk:** Too many features confuse users
  - **Mitigation:** Progressive disclosure, keep defaults simple
- **Risk:** AI suggestions irrelevant
  - **Mitigation:** User feedback loop, learn from rejections, confidence threshold

---

## Next Steps

1. **Review plan** with team
2. **Prioritize features** if timeline is tight
3. **Set up development environment** for AI tool testing
4. **Begin Phase 1** - Database updates

---

**Document Version:** 1.0 (Merged Plan)
**Last Updated:** 2026-02-24
**Author:** AI Assistant

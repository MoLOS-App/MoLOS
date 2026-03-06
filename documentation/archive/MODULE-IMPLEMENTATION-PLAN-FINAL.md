# MoLOS-Tasks Module - Merged Implementation Plan (Revised)

## Executive Summary

Merge existing MoLOS-Tasks features with Linear-style enhancements, keeping Kanban board. Provide MCP-accessible data structures for external AI agents - no direct AI API calls.

**Core Principles:**

- Keep existing Kanban board + add new views
- External AI agents consume data via MCP (not internal AI calls)
- Data structures optimized for AI understanding
- Linear-style workflow enhancements
- Simple, powerful task management

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

### AI/MCP Integration Strategy

| Aspect         | Approach                                                           |
| -------------- | ------------------------------------------------------------------ |
| Data Access    | External AI agents call MCP tools to read/write task data          |
| Tools Provided | Existing 10 tools enhanced + 3 new data-structure tools            |
| No Internal AI | Module does NOT call external AI APIs directly                     |
| MCP-Ready      | Data structures and tools optimized for external agent consumption |

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
ALTER TABLE MoLOS-Tasks_tasks ADD COLUMN labels TEXT;
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
3. Update existing tasks: migrate status values
4. Create default views for existing users
5. Migrate existing task data to new schema

---

## Phase 2: Backend Services (Merge & Enhance)

### 2.1 Enhanced TaskService

**Keep existing, add new:**

```typescript
class TaskService {
	// Existing (keep)
	async createTask(input, userId): Promise<Task>;
	async updateTask(id, userId, updates): Promise<Task>;
	async deleteTask(id, userId): Promise<void>;
	async completeTask(id, userId): Promise<Task>;

	// New (add)
	async addSubtask(parentId, input, userId): Promise<Task>;
	async getTaskTree(userId, projectId): Promise<TaskTree>;
	async updateTimeSpent(id, userId, hours): Promise<Task>;
	async moveTask(id, userId, position): Promise<Task>;
	async addLabel(id, userId, label): Promise<Task>;
	async removeLabel(id, userId, label): Promise<Task>;
	async getTaskWithContext(id, userId): Promise<TaskWithContext>;
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

---

## Phase 3: AI/MCP Integration

### 3.1 MCP-Ready Data Structures

**TaskWithContext for AI Agents:**

```typescript
interface TaskWithContext {
	task: Task;
	subtasks?: Task[];
	comments?: Comment[];
	attachments?: Attachment[];
	project?: Project;
	relatedTasks?: Task[];
	userContext?: {
		recentTasks: Task[];
		commonLabels: string[];
		priorityPatterns: Record<string, number>;
	};
}
```

### 3.2 Enhanced AI Tools (MCP-Accessible)

**Update existing tools to be MCP-friendly:**

1. **get_tasks** - Enhanced
   - Keep existing functionality
   - Add: `includeContext` parameter
   - When true, return TaskWithContext (enriched data for AI)
   - AI agents can request full context for analysis

2. **bulk_create_tasks** - Keep
   - No changes needed
   - AI agents can create multiple tasks at once

3. **bulk_update_tasks** - Keep
   - No changes needed
   - AI agents can update multiple tasks

4. **bulk_delete_tasks** - Keep
   - No changes needed

5. **get_projects** - Keep
   - No changes needed

6. **create_project** - Keep
   - No changes needed

7. **get_areas** - Keep
   - No changes needed

8. **get_note_hierarchy** - Keep
   - No changes needed

9. **update_daily_log** - Keep
   - No changes needed

10. **global_search** - Enhanced
    - Keep existing search
    - Add: AI-relevant metadata (entity type, relationships)

**New MCP tools (data structure focused):**

11. **get_task_with_context** - NEW
    - Input: taskId, userId, contextDepth
    - Output: TaskWithContext (task + subtasks + comments + attachments + project + related tasks)
    - Purpose: Give AI agents full context for analysis

12. **get_project_overview** - NEW
    - Input: projectId, userId
    - Output: Project + all tasks grouped by status + analytics (counts, completion rate)
    - Purpose: AI agents get project-level understanding

13. **get_user_patterns** - NEW
    - Input: userId, timeframe
    - Output: User behavior patterns (common labels, priority distribution, average time spent, etc.)
    - Purpose: AI agents understand user habits for better suggestions

### 3.3 AI Tool Implementation Notes

**Key principles:**

- Tools are MCP-accessible (defined in ai-tools.ts)
- Tools do NOT call external AI APIs
- External AI agents call these tools via MCP
- Tools provide structured, type-safe data
- All tools authenticate via userId parameter

---

## Phase 4: API Layer Updates

### 4.1 New Endpoints

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

### 4.2 Enhanced Endpoints

Update existing endpoints:

- `/api/MoLOS-Tasks` (GET): Add filters for parent_id, labels, search
- `/api/MoLOS-Tasks` (POST): Accept parent_id, labels, position
- `/api/MoLOS-Tasks/tasks/:id` (PATCH): Support new fields
- `/api/MoLOS-Tasks/search`: Keep, enhance with context option

---

## Phase 5: UI Components (Keep Kanban + Add New Views)

### 5.1 Component Hierarchy

```
App Layout
├── Sidebar (existing)
│   ├── Navigation (existing)
│   └── Project Filter (enhance)
│
├── Main Content
│   ├── Multiple View Modes (NEW - View switcher)
│   │   ├── TaskBoard (NEW - Linear-style list view)
│   │   │   ├── TaskList (existing, enhance)
│   │   │   ├── Subtask nesting (NEW)
│   │   │   └── Quick actions (NEW)
│   │   │
│   │   ├── KanbanBoard (existing - KEEP)
│   │   │   ├── Columns: Backlog, Todo, In Progress, Done, Cancelled (NEW status)
│   │   │   ├── Drag-and-drop (existing)
│   │   │   └── Enhanced with subtask support
│   │   │
│   │   ├── TaskDetailPanel (NEW - slide-out)
│   │   │   ├── Comments (NEW)
│   │   │   ├── Attachments (NEW)
│   │   │   ├── Subtasks (NEW)
│   │   │   └── TimeLog (NEW)
│   │   │
│   │   └── TaskFormModal (NEW)
│   │
│   ├── Projects (existing)
│   │   ├── ProjectList (NEW - grid with colors)
│   │   └── ProjectDetailPanel (existing)
│   │
│   └── Dashboard (existing)
│       ├── Quick Stats (keep)
│       └── Recent Activity (keep)
│
└── Modals/Overlays
    ├── CreateTaskModal (NEW)
    ├── EditTaskModal (NEW)
    ├── AddCommentModal (NEW)
    └── UploadAttachmentModal (NEW)
```

### 5.2 Component Responsibilities

**View Switcher (NEW):**

- Toggle between Linear-style list, Kanban board
- Save user preference
- Optional: Compact/Detailed mode toggle

**TaskBoard (NEW) - Linear-style:**

- Clean list view with sections
- Group by status (inline sections or columns)
- Show subtasks nested under parent (indent)
- Drag-and-drop for reordering
- Inline task creation (press Enter in last task)
- Filter/sort controls
- AI indicator (if AI has analyzed this task)

**KanbanBoard (existing - KEEP):**

- Enhanced with new status columns
- Keep all existing functionality
- Add subtask indicator on task cards
- Add label badges

**TaskDetailPanel (NEW):**

- Slide-out panel (right side)
- Task header with status, priority, labels
- Description
- Subtasks section (nested list, can add subtask)
- Comments thread (newest first)
- Attachments list
- Time tracking (add hours)
- Related tasks (same project)
- MCP/AI context indicator (shows if external AI has analyzed)

**TaskFormModal (NEW):**

- Create/Edit modal
- Fields: title, description, status, priority, project, labels, due date, estimate
- Subtask creation checkbox
- Parent task selector (if creating subtask)

**CommentList (NEW):**

- Threaded display
- Timestamp formatting
- User avatar/name
- Reply functionality
- MCP/AI summary indicator

---

## Phase 6: Pages Integration

### 6.1 Page Updates

**Dashboard:**

- Keep existing layout
- Add view switcher (List vs Kanban)
- Add AI/MCP context indicators

**My Tasks:**

- Replace single view with multi-view approach
- Keep existing filters
- Add subtask support

**Kanban:**

- KEEP existing page
- Update status columns to match Linear style
- Add subtask support

**Projects:**

- Add ProjectList component (grid with colors)
- Keep ProjectDetailPanel

**Task Detail:**

- Create dedicated page (`/ui/MoLOS-Tasks/tasks/[id]`)
- Use TaskDetailPanel as main content
- Add comments, attachments, subtasks

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
- [ ] Add MCP context builders
- [ ] Add unit tests for new services

### Phase 3: AI/MCP Integration (3 days)

- [ ] Implement get_task_with_context tool
- [ ] Implement get_project_overview tool
- [ ] Implement get_user_patterns tool
- [ ] Enhance existing get_tasks with context option
- [ ] Test MCP tool accessibility
- [ ] Document MCP tool schemas

### Phase 4: API Layer (3 days)

- [ ] Add comments endpoints
- [ ] Add attachments endpoints
- [ ] Add views endpoints
- [ ] Add subtasks endpoints
- [ ] Add time tracking endpoint
- [ ] Update existing endpoints
- [ ] Add API tests

### Phase 5: UI Components (1 week)

- [ ] Create ViewSwitcher component
- [ ] Create TaskBoard component (Linear-style)
- [ ] Create TaskDetailPanel component
- [ ] Create TaskFormModal component
- [ ] Create CommentList component
- [ ] Create AttachmentList component
- [ ] Enhance TaskItem component (subtasks, labels)
- [ ] Enhance KanbanBoard (new status columns)
- [ ] Add drag-and-drop improvements

### Phase 6: Pages Integration (2 days)

- [ ] Update dashboard page (add view switcher)
- [ ] Update my tasks page (new features, subtasks)
- [ ] Update kanban page (new status columns)
- [ ] Create task detail route
- [ ] Test navigation and state

### Phase 7: Testing & Polish (2 days)

- [ ] Write acceptance tests
- [ ] Write component tests
- [ ] Test MCP tool integration
- [ ] Manual testing
- [ ] Performance testing

---

## Total Timeline

**Estimated: 4 weeks**

| Week | Phases | Focus                                   |
| ---- | ------ | --------------------------------------- |
| 1    | 1-2    | Database + Backend Services             |
| 2    | 3-4    | API + AI/MCP Integration                |
| 3    | 5      | UI Components (Keep Kanban + add views) |
| 4    | 6-7    | Pages Integration + Testing             |

---

## Key Deliverables

### Database

- [ ] Migration script (0002_add_linear_features.sql)
- [ ] Updated schema definitions
- [ ] Updated TypeScript models

### Backend

- [ ] 3 new services (Comment, Attachment, View)
- [ ] Enhanced TaskService
- [ ] 3 new MCP tools
- [ ] 4 enhanced MCP tools
- [ ] MCP context builders

### API

- [ ] 6 new API endpoint groups
- [ ] Updated existing endpoints
- [ ] API documentation

### MCP/AI

- [ ] 13 MCP-accessible tools
- [ ] Context enrichment data structures
- [ ] MCP tool schema documentation
- [ ] No internal AI API calls (external agents only)

### UI

- [ ] ViewSwitcher (toggle between views)
- [ ] TaskBoard (Linear-style list)
- [ ] TaskDetailPanel (comments/subtasks/attachments)
- [ ] TaskFormModal (create/edit)
- [ ] CommentList (threaded)
- [ ] AttachmentList (file uploads)
- [ ] Enhanced KanbanBoard (existing + new columns)
- [ ] Enhanced TaskItem (subtasks, labels)

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
- [ ] **Kanban board view is preserved and functional**

### MCP/AI Integration

- [ ] 13 MCP tools accessible to external AI agents
- [ ] get_task_with_context returns full context
- [ ] get_project_overview provides project-level data
- [ ] get_user_patterns provides behavioral data
- [ ] Enhanced tools support context parameter
- [ ] **Module does NOT call external AI APIs**

### UI

- [ ] Multiple view modes available (List, Kanban)
- [ ] User can switch between views
- [ ] Task detail panel with all features
- [ ] Subtasks visible and manageable
- [ ] Labels visible and editable
- [ ] **Kanban view works with new status columns**

### Performance

- [ ] API p95 < 200ms for paginated lists
- [ ] UI renders < 100ms for task lists
- [ ] MCP tool response < 1s for single operations
- [ ] Database queries indexed properly

---

## MCP Tool Inventory

### Existing Tools (10) - Keep + Enhance

1. get_tasks - Add context option
2. bulk_create_tasks - No changes
3. bulk_update_tasks - No changes
4. bulk_delete_tasks - No changes
5. get_projects - No changes
6. create_project - No changes
7. get_areas - No changes
8. get_note_hierarchy - No changes
9. update_daily_log - No changes
10. global_search - Add context metadata

### New Tools (3) - Add

11. get_task_with_context - Full context for AI
12. get_project_overview - Project-level data
13. get_user_patterns - User behavior patterns

---

## Risk Mitigation

### Technical Risks

- **Risk:** Migration breaks existing data
  - **Mitigation:** Test migration on copy of production DB first
- **Risk:** Performance degradation with subtasks
  - **Mitigation:** Limit depth to 3 levels, add indexes on parent_id
- **Risk:** MCP tools slow down UI
  - **Mitigation:** MCP tools for external agents only, UI uses direct API

### UX Risks

- **Risk:** Too many view modes confuse users
  - **Mitigation:** Keep defaults simple, progressive disclosure
- **Risk:** Kanban changes disrupt existing users
  - **Mitigation:** Keep Kanban as default, add new status columns smoothly

### MCP Risks

- **Risk:** External AI agents overwhelmed by data
  - **Mitigation:** Add pagination, limit context depth
- **Risk:** MCP tools return too much data
  - **Mitigation:** Provide granular parameters, default to reasonable limits

---

## Next Steps

1. Review plan with team
2. Prioritize features if timeline is tight
3. Set up development environment for MCP tool testing
4. Begin Phase 1 - Database updates

---

**Document Version:** 2.0 (Revised - Keep Kanban + MCP-Only)
**Last Updated:** 2026-02-24
**Author:** AI Assistant

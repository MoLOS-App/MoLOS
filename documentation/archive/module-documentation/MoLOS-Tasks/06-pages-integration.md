# Pages Integration Plan

> **Phase:** 06  
> **Duration:** 2 days  
> **Status:** ⏳ Pending

---

## Overview

Integrate new UI components into existing pages and add new routes. Keep existing pages functional while adding new capabilities.

**Pages to Update:**

1. Dashboard - Add view switcher and AI insights
2. My Tasks - Replace single view with multi-view approach
3. Kanban - Update status columns to match Linear style
4. Projects - Add ProjectList component
5. Task Detail - Create dedicated route with TaskDetailPanel

**Pages to Keep As-Is:**

- Areas - No changes needed
- Daily Log - No changes needed
- Settings - No changes needed

---

## Page Updates

### 1. Dashboard (/ui/MoLOS-Tasks)

**File:** `modules/MoLOS-Tasks/src/routes/ui/+page.svelte` (update existing)

**Changes:**

- Add ViewSwitcher component in sidebar
- Add AI insights section (optional, if AI has analyzed)
- Keep existing stats and activity

**Layout:**

```
┌─────────────────────────────────────┐
│ Sidebar                            │
│ ├── Logo/Brand                   │
│ ├── Navigation (existing)          │
│ ├── View Switcher (NEW)           │
│ ├── User Profile (existing)        │
└─────────────────────────────────────┤
┌─────────────────────────────────────┐
│ Main Content                      │
│ ├── Welcome Section (keep)        │
│ ├── Quick Stats (keep)           │
│ ├── AI Insights (NEW, optional)   │
│ ├── Recent Activity (keep)         │
│ └── Active Projects (keep)       │
└─────────────────────────────────────┘
```

**AI Insights Section:**

- Show if AI agent has analyzed tasks today
- Display summary of analysis
- Quick actions based on insights
- Dismissible by user

---

### 2. My Tasks (/ui/MoLOS-Tasks/my)

**File:** `modules/MoLOS-Tasks/src/routes/ui/my/+page.svelte` (replace existing)

**Changes:**

- Replace single view with ViewSwitcher
- Use TaskBoard (Linear-style) by default
- Use KanbanBoard when Kanban view selected
- Keep existing filters
- Add subtask support
- Add label filtering

**View State:**

```typescript
let viewMode: 'list' | 'kanban' = $state('list');
let filters = $state({
	status: [],
	priority: [],
	labels: [],
	searchQuery: ''
});
```

**Layout:**

```
┌─────────────────────────────────────┐
│ Sidebar (existing)                │
├─────────────────────────────────────┤
│ Top Bar                          │
│ ├── View Switcher (NEW)           │
│ ├── Search (keep)                │
│ ├── Filter Button (keep)           │
│ ├── New Task Button (keep)        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Task Content                     │
│ ├── TaskBoard (if view=list)      │
│ ├── KanbanBoard (if view=kanban)  │
│ └── Task Detail Panel (if task clicked)
└─────────────────────────────────────┘
```

---

### 3. Kanban (/ui/MoLOS-Tasks/kanban)

**File:** `modules/MoLOS-Tasks/src/routes/ui/kanban/+page.svelte` (update existing)

**Changes:**

- Update columns to Linear-style: Backlog, Todo, In Progress, Done, Cancelled
- Add subtask indicator to task cards
- Add label badges to task cards
- Keep existing drag-and-drop

**Columns:**

- Backlog (new) - Default position 0
- Todo (was "To Do") - New status
- In Progress (existing)
- Done (existing)
- Cancelled (new) - Replaces "Archived"

**Column Config:**

```typescript
const columns = [
	{ key: 'backlog', label: 'Backlog', color: '#6B7280' },
	{ key: 'todo', label: 'To Do', color: '#3B82F6' },
	{ key: 'in_progress', label: 'In Progress', color: '#F59E0B' },
	{ key: 'done', label: 'Done', color: '#10B981' },
	{ key: 'cancelled', label: 'Cancelled', color: '#EF4444' }
];
```

---

### 4. Projects (/ui/MoLOS-Tasks/projects)

**File:** `modules/MoLOS-Tasks/src/routes/ui/projects/+page.svelte` (update existing)

**Changes:**

- Replace existing list with ProjectList component (grid view)
- Keep existing ProjectDetailPanel for detail view
- Keep search and filter functionality

**Layout:**

```
┌─────────────────────────────────────┐
│ Sidebar (existing)                │
├─────────────────────────────────────┤
│ Top Bar                          │
│ ├── Search (keep)                │
│ ├── Create Project Button (keep)    │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ Projects Content                  │
│ ├── ProjectList (NEW, grid)      │
│ ├── Project Filter (keep)         │
│ └── ProjectDetailPanel (when project clicked)
└─────────────────────────────────────┘
```

---

## New Page

### 5. Task Detail (/ui/MoLOS-Tasks/tasks/[id])

**File:** `modules/MoLOS-Tasks/src/routes/ui/tasks/[id]/+page.svelte` (new)

**Purpose:** Dedicated page for viewing task details

**Components Used:**

- TaskDetailPanel (slide-out or full page on mobile)
- CommentList
- AttachmentList
- SubtaskList
- TimeLog

**Layout:**

```
┌─────────────────────────────────────┐
│ Task Detail Panel                 │
│ (Full page content)             │
│ ├── Task Header                  │
│ ├── Description                  │
│ ├── Subtasks                    │
│ ├── Comments                    │
│ ├── Attachments                 │
│ ├── Time Tracking                │
│ └── Related Tasks               │
└─────────────────────────────────────┘
```

**Server Load:**

```typescript
export const load: PageServerLoad = async ({ params, fetch }) => {
	const [task, comments, attachments, subtasks] = await Promise.all([
		fetch(`/api/MoLOS-Tasks/tasks/${params.id}`).then((r) => r.json()),
		fetch(`/api/MoLOS-Tasks/tasks/${params.id}/comments`).then((r) => r.json()),
		fetch(`/api/MoLOS-Tasks/tasks/${params.id}/attachments`).then((r) => r.json()),
		fetch(`/api/MoLOS-Tasks/tasks/${params.id}/subtasks`).then((r) => r.json())
	]);

	return {
		task,
		comments,
		attachments,
		subtasks
	};
};
```

---

## Route Updates

**New Routes:**

```
src/routes/ui/
├── tasks/
│   └── [id]/
│       ├── +page.svelte (NEW)
│       └── +page.server.ts (NEW)
└── (existing routes remain)
```

**Existing Routes to Keep:**

- `/ui/MoLOS-Tasks/dashboard`
- `/ui/MoLOS-Tasks/my`
- `/ui/MoLOS-Tasks/kanban`
- `/ui/MoLOS-Tasks/projects`
- `/ui/MoLOS-Tasks/areas`
- `/ui/MoLOS-Tasks/daily-log`
- `/ui/MoLOS-Tasks/settings`

---

## Component Integration Points

### Dashboard

- Import ViewSwitcher from components
- Import AIInsights component (create)
- Keep existing stats components

### My Tasks

- Import ViewSwitcher from components
- Import TaskBoard from components
- Import KanbanBoard from components (existing, enhance)
- Import TaskDetailPanel from components
- Conditionally render based on viewMode

### Kanban

- Import KanbanBoard from components
- Pass new columns configuration
- Add subtask indicator prop

### Projects

- Import ProjectList from components
- Import ProjectDetailPanel (components, existing)
- Keep existing project filter

---

## State Management

### Page-level State

**Dashboard:**

```typescript
let viewMode = $state('list');
let showAIInsights = $state(false);
let aiInsights = $state(null);
```

**My Tasks:**

```typescript
let viewMode = $state('list'); // list | kanban
let selectedTaskId = $state<string | null>(null);
let filters = $state({
	/*...*/
});
```

### Shared Stores

**View State Store (NEW):**

```typescript
// modules/MoLOS-Tasks/src/stores/view.store.ts

export const viewStore = writable({
  tasksView: 'list', // list | kanban
  kanbanColumns: [...],
  preferences: {
    compactMode: false,
    showSubtasks: true,
    showLabels: true
  }
});

export const setTasksView = (view: 'list' | 'kanban') => {
  viewStore.update(state => ({ ...state, tasksView: view }));
};

export const updatePreferences = (prefs) => {
  viewStore.update(state => ({ ...state, preferences: { ...state.preferences, ...prefs } }));
};
```

---

## Checklist

### Day 1 Tasks

**Dashboard:**

- [ ] Create ViewSwitcher component
- [ ] Create AIInsights component
- [ ] Update dashboard page
- [ ] Add view switcher to sidebar
- [ ] Add AI insights section
- [ ] Test dashboard functionality

**My Tasks:**

- [ ] Create TaskBoard component (Linear-style)
- [ ] Update my tasks page
- [ ] Add ViewSwitcher to page
- [ ] Implement view switching (list ↔ kanban)
- [ ] Add subtask support to task display
- [ ] Add label filtering
- [ ] Test both views

**Kanban:**

- [ ] Update kanban columns configuration
- [ ] Add subtask indicator to KanbanBoard component
- [ ] Add label badges to task cards
- [ ] Test kanban with new columns
- [ ] Test drag-and-drop with subtasks

**Projects:**

- [ ] Create ProjectList component (grid view)
- [ ] Update projects page
- [ ] Replace list with grid
- [ ] Test project selection
- [ ] Test ProjectDetailPanel integration

### Day 2 Tasks

**Task Detail Page:**

- [ ] Create task detail route structure
- [ ] Create +page.svelte
- [ ] Create +page.server.ts
- [ ] Implement TaskDetailPanel integration
- [ ] Add CommentList section
- [ ] Add AttachmentList section
- [ ] Add SubtaskList section
- [ ] Add TimeLog section
- [ ] Add Related Tasks section
- [ ] Test page navigation
- [ ] Test all sections

**Shared:**

- [ ] Create view.store.ts
- [ ] Integrate view state across pages
- [ ] Persist user view preferences
- [ ] Test view switching

**Testing:**

- [ ] Test navigation between pages
- [ ] Test view state persistence
- [ ] Test responsive design
- [ ] Test keyboard navigation
- [ ] Test accessibility

---

## Validation

After implementation, verify:

- [ ] All existing pages still functional
- [ ] New features work on all pages
- [ ] Kanban board works with new status columns
- [ ] List view displays correctly with subtasks
- [ ] Task detail page loads correctly
- [ ] View switching works smoothly
- [ ] State is properly managed
- [ ] No routing conflicts
- [ ] Responsive design works
- [ ] Accessibility standards met

---

## File Structure After Updates

```
src/routes/ui/
├── +page.svelte (update)
├── my/
│   └── +page.svelte (replace)
├── kanban/
│   └── +page.svelte (update)
├── projects/
│   └── +page.svelte (update)
├── tasks/
│   └── [id]/
│       ├── +page.svelte (NEW)
│       └── +page.server.ts (NEW)
├── areas/ (keep)
├── daily-log/ (keep)
└── settings/ (keep)
```

---

**Next:** Proceed to Phase 07 - Testing & Polish

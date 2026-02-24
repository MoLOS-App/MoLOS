# UI Components Strategy

> **Phase:** 05  
> **Duration:** 1 week  
> **Status:** ⏳ Pending

---

## Overview

Define UI component strategy for Linear-style task management. Keep existing Kanban board and add new views.

**Principles:**

- Keep Kanban board functional (don't break existing)
- Add Linear-style list view
- Add task detail panel (slide-out)
- Support multiple view modes
- No code in documentation (component descriptions only)

---

## Component Hierarchy

```
Main Layout
├── Sidebar (existing)
│   ├── Navigation (existing)
│   └── View Switcher (NEW)
│
├── Main Content
│   ├── View Mode (NEW)
│   │   ├── TaskBoard (Linear-style list)
│   │   ├── KanbanBoard (existing, preserve)
│   │   └── Compact/List Toggle
│   │
│   ├── Task Content
│   │   ├── TaskList (enhanced existing)
│   │   ├── TaskDetailPanel (slide-out)
│   │   │   ├── Comments (NEW)
│   │   │   ├── Attachments (NEW)
│   │   │   ├── Subtasks (NEW)
│   │   │   └── TimeLog (NEW)
│   │   │
│   │   └── TaskFormModal (NEW)
│   │
│   └── Projects
│       ├── ProjectList (NEW)
│       └── ProjectDetailPanel (existing)
│
└── Modals/Overlays
    ├── CreateTaskModal (NEW)
    ├── EditTaskModal (NEW)
    ├── AddCommentModal (NEW)
    └── UploadAttachmentModal (NEW)
```

---

## Component Descriptions

### 1. ViewSwitcher (NEW)

**Purpose:** Toggle between different view modes

**Location:** `modules/MoLOS-Tasks/src/lib/components/view-switcher.svelte`

**Features:**

- Display available view modes (List, Kanban, Board)
- Show current active view
- Persist user preference
- Quick switch between views

**Props:**

- `views` - Array of available views
- `activeView` - Currently selected view
- `onViewChange` - Callback when view changes

**Visual Design:**

- Tab-like interface
- Icons for each view type
- Active state indicator
- Smooth transitions

---

### 2. TaskBoard (NEW - Linear-Style List)

**Purpose:** Linear-style list view with subtask nesting and quick actions

**Location:** `modules/MoLOS-Tasks/src/lib/components/task-board.svelte`

**Features:**

- Group tasks by status (Backlog, Todo, In Progress, Done, Cancelled)
- Nested subtasks with indent
- Drag-and-drop for reordering
- Inline task creation (press Enter)
- Expand/collapse subtasks
- Quick actions (complete, edit, delete)
- Filter and sort controls
- Labels display as badges
- AI analysis indicator (if AI has analyzed this task)

**Props:**

- `tasks` - Array of tasks to display
- `onTaskClick` - Callback when task is clicked
- `onTaskComplete` - Callback when task is completed
- `onTaskMove` - Callback when task is moved
- `onTaskEdit` - Callback when task is edited
- `onTaskDelete` - Callback when task is deleted
- `onSubtaskCreate` - Callback to create subtask
- `filters` - Current filter state
- `sortBy` - Current sort field
- `sortOrder` - Current sort direction

**Visual Design:**

- Clean, minimal design
- Color-coded status badges
- Indentation for subtasks (4 levels max)
- Hover actions
- Smooth expand/collapse animations

---

### 3. KanbanBoard (EXISTING - Enhance)

**Purpose:** Preserved Kanban board with new Linear-style columns

**Location:** `modules/MoLOS-Tasks/src/lib/components/kanban-board.svelte` (existing, enhance)

**Enhancements:**

- Update status columns to Linear-style: Backlog, Todo, In Progress, Done, Cancelled
- Add subtask indicator on task cards
- Add label badges to task cards
- Keep drag-and-drop functionality
- Keep column collapse/expand

**Props:** (existing)

- Add `showSubtasks` prop (default: true)
- Add `showLabels` prop (default: true)

---

### 4. TaskDetailPanel (NEW)

**Purpose:** Slide-out panel showing task details with comments, attachments, subtasks

**Location:** `modules/MoLOS-Tasks/src/lib/components/task-detail-panel.svelte`

**Features:**

- Slide-out from right side
- Task header with status, priority, labels
- Description display
- Subtasks section (nested list, add new subtask)
- Comments thread (add new comment, reply to comments)
- Attachments list (upload new attachment, download existing)
- Time tracking (add hours worked)
- Related tasks section (same project, similar context)
- Close button

**Props:**

- `task` - Task object to display
- `onClose` - Callback when panel should close
- `onAddComment` - Callback to add comment
- `onAddSubtask` - Callback to add subtask
- `onAddAttachment` - Callback to add attachment
- `onUpdateTimeSpent` - Callback to update time spent
- `onTaskUpdate` - Callback when task is updated

**Visual Design:**

- Fixed width (400px)
- Scrollable content area
- Tabbed sections (Comments, Subtasks, Attachments, Time)
- Smooth slide-in animation
- Responsive (overlay on mobile)

---

### 5. TaskFormModal (NEW)

**Purpose:** Create/Edit task modal with all new fields

**Location:** `modules/MoLOS-Tasks/src/lib/components/task-form-modal.svelte`

**Features:**

- Form fields: title, description, status, priority, project, labels, due date, estimate, parent task
- Validation for required fields
- Subtask creation checkbox
- Parent task selector (if creating subtask)
- Save and Cancel buttons
- Form state persistence (if validation error)

**Props:**

- `task` - Task object if editing, null if creating
- `parentTask` - Parent task if creating subtask
- `availableProjects` - Array of available projects
- `availableParents` - Array of potential parent tasks
- `onSave` - Callback to save task
- `onCancel` - Callback to cancel

**Visual Design:**

- Centered modal with backdrop
- Clean form layout
- Required field indicators
- Error message display
- Loading state during save

---

### 6. CommentList (NEW)

**Purpose:** Threaded comment display

**Location:** `modules/MoLOS-Tasks/src/lib/components/comment-list.svelte`

**Features:**

- Chronological comment display
- User avatar/name
- Timestamp formatting (relative time)
- Reply functionality
- Delete comment (own comments only)
- Edit comment (own comments only)
- AI summary indicator (if AI has summarized this thread)

**Props:**

- `comments` - Array of comments to display
- `onAddComment` - Callback to add comment
- `onEditComment` - Callback to edit comment
- `onDeleteComment` - Callback to delete comment
- `currentUserId` - Current logged-in user

**Visual Design:**

- Clean thread layout
- Comment bubbles with user avatar
- Timestamp below each comment
- Action buttons on hover
- Highlight for own comments

---

### 7. AttachmentList (NEW)

**Purpose:** File attachment display

**Location:** `modules/MoLOS-Tasks/src/lib/components/attachment-list.svelte`

**Features:**

- File type icons
- File size display
- Download button
- Delete button
- Preview for images
- Upload progress indicator

**Props:**

- `attachments` - Array of attachments to display
- `onDownload` - Callback to download attachment
- `onDelete` - Callback to delete attachment
- `currentUserId` - Current logged-in user

**Visual Design:**

- Grid or list layout
- File icons by type (PDF, image, doc, etc.)
- File size in human-readable format
- Action buttons on hover

---

### 8. ProjectList (NEW)

**Purpose:** Grid view of projects with colors and icons

**Location:** `modules/MoLOS-Tasks/src/lib/components/project-list.svelte`

**Features:**

- Grid card layout
- Project color/icon display
- Task count per project
- Completion progress bar
- Hover effects
- Click to view project

**Props:**

- `projects` - Array of projects to display
- `onProjectClick` - Callback when project is clicked
- `onProjectCreate` - Callback to create new project

**Visual Design:**

- Card-based grid
- Color-coded borders
- Icon display
- Progress indicators
- Hover lift effect

---

## Enhanced Existing Components

### TaskItem (Enhance)

**Location:** `modules/MoLOS-Tasks/src/lib/components/task-item.svelte` (existing, enhance)

**Enhancements:**

- Add subtask indicator (small arrow or icon)
- Add label badges (scrollable if many labels)
- Add AI analysis indicator (small dot or icon)
- Keep existing functionality (checkbox, delete, due date badge)

---

## View Mode States

**View Types:**

1. **List View** - Linear-style with subtasks
2. **Kanban View** - Existing board with new columns
3. **Compact View** - Dense list for power users
4. **Board View** - Expanded cards with details

**User Preference Storage:**

- Save selected view to user settings
- Remember last view per page
- Default view: List (new)

---

## Component Styling Principles

**Design System:**

- Use shadcn-svelte components where possible
- Follow Tailwind CSS utility classes
- Consistent spacing (0.5rem, 1rem, 1.5rem)
- Consistent border radius (0.375rem, 0.5rem)
- Consistent shadows (sm, md, lg)

**Color Palette:**

- Status colors (Backlog: #6B7280, Todo: #3B82F6, In Progress: #F59E0B, Done: #10B981, Cancelled: #EF4444)
- Priority colors (Urgent: #EF4444, High: #F97316, Medium: #F59E0B, Low: #6B7280, No Priority: #9CA3AF)
- Semantic colors (Success: #10B981, Warning: #F59E0B, Error: #EF4444, Info: #3B82F6)

**Typography:**

- Font family: System fonts (San Francisco, Inter, Segoe UI)
- Font sizes: xs (0.75rem), sm (0.875rem), base (1rem), lg (1.125rem), xl (1.25rem)
- Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

---

## Component Interaction Patterns

### Hover States

- Task items: Show action buttons
- Project cards: Lift effect
- Buttons: Color shift

### Focus States

- Form inputs: Border color change, glow
- Focus ring on actionable elements

### Loading States

- Spinners for async operations
- Skeleton screens for initial load
- Progress bars for uploads

### Empty States

- Task lists: "No tasks yet" + action button
- Projects: "No projects yet" + create button
- Comments: "No comments yet" + add comment form

### Error States

- Inline error messages for forms
- Error banners for page-level errors
- Toast notifications for API errors

---

## Accessibility

**Keyboard Navigation:**

- Tab through interactive elements
- Enter/Space to activate buttons
- Escape to close modals
- Arrow keys for list navigation

**Screen Reader Support:**

- ARIA labels for all interactive elements
- Semantic HTML structure
- Focus indicators
- Announce dynamic content changes

**Color Contrast:**

- WCAG AA compliant color combinations
- Focus indicators visible
- Text resize support

---

## Component File Structure

```
modules/MoLOS-Tasks/src/lib/components/
├── view-switcher.svelte (NEW)
├── task-board.svelte (NEW)
├── kanban-board.svelte (EXISTING, enhance)
├── task-detail-panel.svelte (NEW)
├── task-form-modal.svelte (NEW)
├── comment-list.svelte (NEW)
├── attachment-list.svelte (NEW)
├── project-list.svelte (NEW)
└── task-item.svelte (EXISTING, enhance)
```

---

## Checklist

### Week 1 Tasks

**New Components:**

- [ ] Create view-switcher.svelte
- [ ] Create task-board.svelte
- [ ] Create task-detail-panel.svelte
- [ ] Create task-form-modal.svelte
- [ ] Create comment-list.svelte
- [ ] Create attachment-list.svelte
- [ ] Create project-list.svelte

**Enhanced Components:**

- [ ] Enhance task-item.svelte (subtasks, labels, AI indicator)
- [ ] Enhance kanban-board.svelte (new status columns, subtasks)

**Shared:**

- [ ] Create shared component library
- [ ] Implement loading states
- [ ] Implement empty states
- [ ] Implement error states

**Styling:**

- [ ] Apply consistent design tokens
- [ ] Implement hover states
- [ ] Implement focus states
- [ ] Add transitions

**Accessibility:**

- [ ] Add ARIA labels
- [ ] Implement keyboard navigation
- [ ] Test with screen reader
- [ ] Test color contrast

---

## Validation

After implementation, verify:

- [ ] Kanban board still functional
- [ ] List view displays correctly
- [ ] Task detail panel slides in/out smoothly
- [ ] Form validation works
- [ ] Drag-and-drop works in both views
- [ ] Subtasks display correctly nested
- [ ] Comments thread properly
- [ ] Attachments display correctly
- [ ] Responsive design works on mobile
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes

---

**Next:** Proceed to Phase 06 - Pages Integration

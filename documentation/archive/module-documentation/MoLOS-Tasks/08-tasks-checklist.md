# Implementation Tasks Checklist

> **Phase:** 08  
> **Status:** 📋 Ready to Start  
> **Total Tasks:** 150+ estimated

---

## Quick Start

### Before Starting

1. **Review Plan Documents** - Read through all 8 phase documents
2. **Set Up Environment** - Ensure database and dependencies are ready
3. **Run Database Backup** - Backup existing molos.db
4. **Check Current State** - Verify existing MoLOS-Tasks module is working

### During Implementation

1. **Follow Task Order** - Complete tasks in numerical order
2. **Mark Complete** - Check off items as you complete them
3. **Update Status** - Update task status as you progress
4. **Test As You Go** - Test each feature before moving on
5. **Document Issues** - Note any blockers or deviations

### After Completion

1. **Run All Tests** - Ensure all tests pass
2. **Fix Failing Tests** - Address any test failures
3. **Verify No Regressions** - Confirm existing features still work
4. **Update Documentation** - Update docs with any changes made
5. **Commit Changes** - Stage and commit all changes (when authorized)

---

## Phase 01: Database (1 week)

### 01.01 Database Design

- [ ] Review existing database schema
- [ ] Design new tables (comments, attachments, views)
- [ ] Design task table alterations
- [ ] Design project table alterations
- [ ] Write migration SQL script

### 01.02 Migration Script

- [ ] Create migration file: `0002_add_linear_features.sql`
- [ ] Add CREATE TABLE statements for new tables
- [ ] Add ALTER TABLE statements for existing tables
- [ ] Add CREATE INDEX statements
- [ ] Add data migration steps
- [ ] Add rollback steps documentation

### 01.03 TypeScript Models

- [ ] Update Task interface with new fields
- [ ] Create Comment interface
- [ ] Create Attachment interface
- [ ] Create View interface
- [ ] Create ViewFilters interface
- [ ] Update TaskStatus enum (Linear-style)
- [ ] Update TaskPriority enum (Linear-style)
- [ ] Update CreateTaskInput type
- [ ] Update UpdateTaskInput type

### 01.04 Drizzle Schema

- [ ] Update `src/server/database/schema.ts` with new tables
- [ ] Update `tasksTasks` table definition
- [ ] Update `tasksComments` table definition
- [ ] Update `tasksAttachments` table definition
- [ ] Update `tasksViews` table definition
- [ ] Add indexes to definitions
- [ ] Update export statement

### 01.05 Migration Execution

- [ ] Backup existing database: `cp molos.db molos.db.backup-$(date +%Y%m%d)`
- [ ] Generate migration with `bun run db:generate` (from module dir)
- [ ] Run migration: `bun run db:migrate`
- [ ] Verify migration success in logs
- [ ] Validate schema: `bun run db:validate`
- [ ] Test data access with new columns
- [ ] Verify no data loss
- [ ] Test rollback procedure if needed

### 01.06 Documentation

- [ ] Document migration process
- [ ] Document rollback process
- [ ] Update database architecture docs
- [ ] Document new model structures

**Week 1 Complete:**

- [ ] All migration files created
- [ ] Migration executed successfully
- [ ] All models updated
- [ ] Documentation complete

---

## Phase 02: Backend Services (1 week)

### 02.01 CommentService

- [ ] Create `comment-repository.ts`
- [ ] Implement CommentRepository class
- [ ] Implement getByTaskId method
- [ ] Implement create method
- [ ] Implement update method
- [ ] Implement delete method
- [ ] Add user ownership checks
- [ ] Write unit tests

### 02.02 AttachmentService

- [ ] Create `attachment-repository.ts`
- [ ] Implement AttachmentRepository class
- [ ] Implement getByTaskId method
- [ ] Implement getById method
- [ ] Implement create method
- [ ] Implement delete method
- [ ] Add file deletion logic
- [ ] Implement getFilePath method
- [ ] Write unit tests

### 02.03 ViewService

- [ ] Create `view-repository.ts`
- [ ] Implement ViewRepository class
- [ ] Implement getByUserId method
- [ ] Implement getById method
- [ ] Implement create method
- [ ] Implement update method
- [ ] Implement delete method
- [ ] Implement unsetDefault method
- [ ] Implement applyView method
- [ ] Implement setDefaultView method
- [ ] Add user ownership checks
- [ ] Write unit tests

### 02.04 TaskService Enhancements

- [ ] Add createSubtask method
- [ ] Add getTaskTree method
- [ ] Add buildTree helper method
- [ ] Add addLabel method
- [ ] Add removeLabel method
- [ ] Add moveTask method
- [ ] Add updateTimeSpent method
- [ ] Update task-repository.ts with getByParentId
- [ ] Update task-repository.ts with updatePosition
- [ ] Update task-repository.ts with hasSubtasks
- [ ] Write unit tests for new methods

### 02.05 Service Files

- [ ] Create `comment-service.ts`
- [ ] Import repositories and BaseRepository
- [ ] Implement all CommentService methods
- [ ] Add error handling
- [ ] Add input validation

- [ ] Create `attachment-service.ts`
- [ ] Import repositories and BaseRepository
- [ ] Implement all AttachmentService methods
- [ ] Add error handling
- [ ] Add file storage abstraction

- [ ] Create `view-service.ts`
- [ ] Import repositories and BaseRepository
- [ ] Implement all ViewService methods
- [ ] Add error handling
- [ ] Add filter application logic

- [ ] Update `task-service.ts` with new methods
- [ ] Import ViewService and CommentService
- [ ] Implement subtask validation
- [ ] Implement tree building logic
- [ ] Implement label management
- [ ] Implement position updates
- [ ] Implement time tracking updates

### 02.06 Service Exports

- [ ] Update `src/server/services/index.ts`
- [ ] Export CommentService
- [ ] Export AttachmentService
- [ ] Export ViewService
- [ ] Export enhanced TaskService

### 02.07 Testing

- [ ] Write unit tests for CommentService
- [ ] Write unit tests for AttachmentService
- [ ] Write unit tests for ViewService
- [ ] Write unit tests for TaskService enhancements
- [ ] Run all service unit tests
- [ ] Fix any failing tests
- [ ] Test service integration

**Week 2 Complete:**

- [ ] All services implemented
- [ ] All repositories updated
- [ ] All unit tests passing
- [ ] Services documented

---

## Phase 03: API Layer (3 days)

### 03.01 Comments API

- [ ] Create `tasks/[id]/comments/+server.ts`
- [ ] Implement GET endpoint
- [ ] Implement POST endpoint
- [ ] Implement PUT endpoint (deleted - use DELETE instead)
- [ ] Implement DELETE endpoint
- [ ] Add authentication check
- [ ] Add input validation with Zod
- [ ] Test all endpoints
- [ ] Add error handling

### 03.02 Attachments API

- [ ] Create `tasks/[id]/attachments/+server.ts`
- [ ] Implement GET endpoint
- [ ] Implement POST endpoint
- [ ] Implement GET download endpoint
- [ ] Implement DELETE endpoint
- [ ] Add authentication check
- [ ] Add file upload handling
- [ ] Add file size/type validation
- [ ] Test all endpoints

### 03.03 Subtasks API

- [ ] Create `tasks/[id]/subtasks/+server.ts`
- [ ] Implement GET endpoint
- [ ] Implement POST endpoint
- [ ] Add depth parameter support
- [ ] Add parent validation
- [ ] Test all endpoints

### 03.04 Views API

- [ ] Create `views/+server.ts`
- [ ] Implement GET endpoint
- [ ] Implement POST endpoint
- [ ] Implement PUT endpoint
- [ ] Implement DELETE endpoint
- [ ] Implement GET tasks endpoint for view
- [ ] Implement set-default endpoint
- [ ] Test all endpoints

### 03.05 Task Enhancement API

- [ ] Create `tasks/[id]/labels/+server.ts`
- [ ] Implement PATCH endpoint for add/remove labels
- [ ] Test endpoint

- [ ] Create `tasks/[id]/move/+server.ts`
- [ ] Implement POST endpoint
- [ ] Test endpoint

- [ ] Create `tasks/[id]/time-spent/+server.ts`
- [ ] Implement PATCH endpoint
- [ ] Add reason parameter
- [ ] Test endpoint

### 03.06 Existing Endpoint Enhancements

- [ ] Update `tasks/+server.ts` GET query params
- [ ] Add parent_id filter support
- [ ] Add labels filter support
- [ ] Add sort_by and sort_order support
- [ ] Update POST endpoint with new fields
- [ ] Update PATCH endpoint with version checking

### 03.07 API Documentation

- [ ] Document all new endpoints
- [ ] Document request/response formats
- [ ] Document query parameters
- [ ] Document error responses
- [ ] Create API endpoints reference file

### 03.08 API Testing

- [ ] Write integration tests for comments API
- [ ] Write integration tests for attachments API
- [ ] Write integration tests for subtasks API
- [ ] Write integration tests for views API
- [ ] Write integration tests for task enhancements API
- [ ] Test all new endpoints
- [ ] Test authentication on all endpoints
- [ ] Test error responses
- [ ] Test with invalid data

**Days 1-3 Complete:**

- [ ] All new endpoints implemented
- [ ] All endpoints tested
- [ ] API documentation complete
- [ ] No breaking changes to existing endpoints

---

## Phase 04: MCP Integration (3 days)

### 04.01 New MCP Tools

- [ ] Create `ai-tools-new.ts` or add to existing
- [ ] Implement get_task_with_context tool
- [ ] Implement get_project_overview tool
- [ ] Implement get_user_patterns tool
- [ ] Define all tool parameters
- [ ] Add tool descriptions
- [ ] Implement execute functions

### 04.02 Tool Context Building

- [ ] Implement TaskWithContext builder
- [ ] Add subtask fetching logic
- [ ] Add comment fetching logic
- [ ] Add attachment fetching logic
- [ ] Add related tasks logic
- [ ] Add context summary generation
- [ ] Add user context patterns

### 04.03 Tool Enhancements

- [ ] Enhance get_tasks with includeContext parameter
- [ ] Implement context building
- [ ] Return enriched data

- [ ] Enhance global_search with metadata
- [ ] Add AI-relevant metadata
- [ ] Implement context scoring

### 04.04 MCP Registration

- [ ] Update `ai/index.ts` exports
- [ ] Export all 13 tools
- [ ] Verify tool schemas are correct
- [ ] Test tool registration with MCP server
- [ ] Test tool invocation via MCP

### 04.05 Tool Documentation

- [ ] Document all 13 MCP tools
- [ ] Document tool parameters
- [ ] Document tool return values
- [ ] Create usage examples for external AI agents
- [ ] Document no internal AI API calls

### 04.06 MCP Testing

- [ ] Write tests for get_task_with_context
- [ ] Write tests for get_project_overview
- [ ] Write tests for get_user_patterns
- [ ] Test tool registration
- [ ] Test tool invocation
- [ ] Test tool error handling
- [ ] Verify no external AI API calls

**Days 1-3 Complete:**

- [ ] All 3 new tools implemented
- [ ] All existing tools enhanced
- [ ] All tools registered with MCP
- [ ] All tools tested
- [ ] Documentation complete

---

## Phase 05: UI Components (1 week)

### 05.01 View Switcher

- [ ] Create `view-switcher.svelte`
- [ ] Implement view display
- [ ] Implement view switching logic
- [ ] Implement view persistence
- [ ] Add keyboard navigation
- [ ] Test view switching

### 05.02 TaskBoard (Linear-Style List)

- [ ] Create `task-board.svelte`
- [ ] Implement status-based grouping
- [ ] Implement subtask nesting display
- [ ] Implement inline task creation
- [ ] Implement expand/collapse subtasks
- [ ] Add drag-and-drop hooks
- [ ] Add filter/sort controls
- [ ] Add label badges display
- [ ] Add AI analysis indicator
- [ ] Test task interactions
- [ ] Test subtask interactions

### 05.03 KanbanBoard Enhancement

- [ ] Update `kanban-board.svelte` status columns
- [ ] Add Backlog column
- [ ] Add Cancelled column
- [ ] Update Todo column (rename from To Do)
- [ ] Keep In Progress column
- [ ] Keep Done column
- [ ] Add subtask indicator to task cards
- [ ] Add label badges to task cards
- [ ] Test drag-and-drop with new columns

### 05.04 TaskDetailPanel

- [ ] Create `task-detail-panel.svelte`
- [ ] Implement slide-out animation
- [ ] Implement task header section
- [ ] Implement description section
- [ ] Implement subtasks section
- [ ] Implement comments section
- [ ] Implement attachments section
- [ Implement time tracking section
- [ ] Implement related tasks section
- [ ] Implement close button
- [ ] Add tabbed sections
- [ ] Test all interactions

### 05.05 TaskFormModal

- [ ] Create `task-form-modal.svelte`
- [ ] Implement form fields (title, description, status, priority, project, labels, due date, estimate)
- [ ] Implement parent task selector
- [ ] Implement subtask creation checkbox
- [ ] Implement validation
- [ ] Implement save/cancel buttons
- [ ] Test form submission

### 05.06 CommentList

- [ ] Create `comment-list.svelte`
- [ ] Implement chronological display
- [ ] Implement user avatars
- [ ] Implement timestamp formatting
- [ ] Implement reply functionality
- [ ] Implement edit/delete buttons
- [ ] Add AI summary indicator
- [ ] Test comment actions

### 05.07 AttachmentList

- [ ] Create `attachment-list.svelte`
- [ ] Implement file type icons
- [ ] Implement file size display
- [ ] Implement download button
- [ ] Implement delete button
- [ ] Test attachment actions

### 05.08 ProjectList

- [ ] Create `project-list.svelte`
- [ ] Implement grid layout
- [ ] Implement project cards with color/icon
- [ ] Implement task count display
- [ ] Implement progress bar
- [ ] Implement hover effects
- [ ] Test project interactions

### 05.09 Enhanced TaskItem

- [ ] Update `task-item.svelte` with subtask indicator
- [ ] Add label badges (scrollable if many)
- [ ] Add AI analysis indicator (small dot/icon)
- [ ] Keep existing functionality

### 05.10 Component Testing

- [ ] Test ViewSwitcher component
- [ ] Test TaskBoard component
- [ ] Test TaskDetailPanel component
- [ ] Test TaskFormModal component
- [ ] Test CommentList component
- [ ] Test AttachmentList component
- [ ] Test ProjectList component
- [ ] Test enhanced TaskItem component
- [ ] Test all interactions
- [ ] Test keyboard navigation
- [ ] Test accessibility

**Week 5 Complete:**

- [ ] All new components created
- [ ] All existing components enhanced
- [ ] All components tested
- [ ] Components documented

---

## Phase 06: Pages Integration (2 days)

### 06.01 Dashboard Updates

- [ ] Create ViewSwitcher component
- [ ] Update dashboard page sidebar
- [ ] Add ViewSwitcher to navigation
- [ ] Create AIInsights component (optional)
- [ ] Add AI insights section to dashboard
- [ ] Test dashboard with new features
- [ ] Test view switching

### 06.02 My Tasks Updates

- [ ] Replace single view with ViewSwitcher
- [ ] Update my tasks page with ViewSwitcher
- [ ] Replace content with TaskBoard (default) or KanbanBoard
- [ ] Add conditional rendering based on viewMode
- [ ] Implement view switching logic
- [ ] Add subtask support to task display
- [ ] Add label filtering
- [ ] Test list view functionality
- [ ] Test kanban view functionality
- [ ] Test view switching

### 06.03 Kanban Updates

- [ ] Update column configuration in KanbanBoard
- [ ] Update status columns to Linear-style
- [ ] Add subtask indicator prop to task cards
- [ ] Add label badges prop to task cards
- [ ] Test kanban with new columns
- [ ] Test drag-and-drop with subtasks

### 06.04 Projects Updates

- [ ] Create ProjectList component
- [ ] Update projects page with ProjectList
- [ ] Replace list with grid layout
- [ ] Keep ProjectDetailPanel
- [ ] Test project selection
- [ ] Test project details

### 06.05 Task Detail Page

- [ ] Create task detail route structure
- [ ] Create `tasks/[id]/+page.svelte`
- [ ] Create `tasks/[id]/+page.server.ts`
- [ ] Implement server load function
- [ ] Integrate TaskDetailPanel component
- [ ] Integrate CommentList section
- [ ] Integrate AttachmentList section
- [ ] Integrate SubtaskList section
- [ ] Integrate TimeLog section
- [ ] Integrate Related Tasks section
- [ ] Test page navigation
- [ ] Test all sections

### 06.06 View State Management

- [ ] Create `view.store.ts`
- [ ] Implement tasksView state
- [ ] Implement kanbanColumns state
- [ ] Implement preferences state
- [ ] Implement setTasksView action
- [ ] Implement updatePreferences action
- [ ] Test state persistence
- [ ] Test state reactivity

### 06.07 Page Testing

- [ ] Test dashboard navigation and features
- [ ] Test my tasks view switching
- [ ] Test kanban with new columns
- [ ] Test projects grid view
- [ ] Test task detail page
- [ ] Test navigation between pages
- [ ] Test view state persistence
- [ ] Test responsive design
- [ ] Test keyboard navigation

**Days 1-2 Complete:**

- [ ] Dashboard updated
- [ ] My Tasks updated with multi-view
- [ ] Kanban updated with new columns
- [ ] Projects updated
- [ ] Task detail page created
- [ ] View state management implemented
- [ ] All page updates tested

---

## Phase 07: Testing & Polish (2 days)

### 07.01 Acceptance Tests

**Task CRUD:**

- [ ] Create task with all new fields test
- [ ] Update task with labels test
- [ ] Update task with position test
- [ ] Update task with time spent test
- [ ] Delete task test
- [ ] Complete task test

**Subtasks:**

- [ ] Create subtask validation test
- [ ] Create nested subtasks test
- [ ] Move subtask test
- [ ] Delete subtask test
- [ ] Subtasks complete test

**Comments:**

- [ ] Add comment test
- [ ] View comments test
- [ ] Reply to comment test
- [ ] Edit comment test
- [ ] Delete comment test
- [ ] Comments complete test

**Attachments:**

- [ ] Upload attachment test
- [ ] View attachments test
- [ ] Download attachment test
- [ ] Delete attachment test
- [ ] Attachments complete test

**Views:**

- [ ] Create view test
- [ ] Apply view test
- [ ] Update view test
- [ ] Delete view test
- [ ] Set default view test
- [ ] Views complete test

**Task Detail Panel:**

- [ ] Open task detail panel test
- [ ] View all sections test
- [ ] Add subtask test
- [ ] Add comment test
- [ ] Add attachment test
- [ ] Update time spent test
- [ ] Related tasks test
- [ ] Task Detail Panel complete test

**Multiple Views:**

- [ ] Switch to list view test
- [ ] Switch to kanban view test
- [ ] View persists test
- [ ] Filters work in both views test
- [ ] Multiple views complete test

### 07.02 Unit Tests

**Service Tests:**

- [ ] CommentService tests (all methods)
- [ ] AttachmentService tests (all methods)
- [ ] ViewService tests (all methods)
- [ ] TaskService enhancement tests (all methods)

### 07.03 Integration Tests

**API Tests:**

- [ ] Comments API tests (all endpoints)
- [ ] Attachments API tests (all endpoints)
- [ ] Subtasks API tests (all endpoints)
- [ ] Views API tests (all endpoints)
- [ ] Task enhancements API tests (all endpoints)

### 07.04 MCP Tool Tests

**Tool Tests:**

- [ ] get_task_with_context test
- [ ] get_project_overview test
- [ ] get_user_patterns test
- [ ] get_tasks enhanced test
- [ ] global_search enhanced test
- [ ] Tool registration test
- [ ] Tool invocation test
- [ ] MCP Tools complete test

### 07.05 Performance Tests

**API Performance:**

- [ ] GET /tasks with 1000 tasks (p95 < 200ms)
- [ ] GET /tasks/:id single lookup (p95 < 100ms)
- [ ] POST /tasks creation (p95 < 200ms)
- [ ] GET /tasks/:id/comments (p95 < 100ms)
- [ ] GET /tasks/:id/subtasks (p95 < 100ms)
- [ ] GET /views (p95 < 100ms)

**UI Performance:**

- [ ] Task list renders 1000 items (< 100ms)
- [ ] Kanban board renders 1000 items (< 100ms)
- [ ] Task detail panel opens (< 100ms)
- [ ] View switching instant (< 50ms)
- [ ] Filter application (< 100ms)

**Database Performance:**

- [ ] Task list by project_id + position (< 50ms)
- [ ] Comments by task_id (< 50ms)
- [ ] Subtasks by parent_id (< 50ms)
- [ ] Performance tests complete

### 07.06 Accessibility Tests

**Keyboard Navigation:**

- [ ] Tab navigation test
- [ ] Enter/Space activates buttons test
- [ ] Escape closes modals test
- [ ] Arrow keys navigate lists test

**Screen Reader:**

- [ ] ARIA labels test
- [ ] Dynamic content changes announced test
- [ ] Error messages announced test
- [ ] Forms accessible test

**Visual Accessibility:**

- [ ] Color contrast test
- [ ] Text resizable test
- [ ] Focus indicators test
- [ ] No keyboard traps test

**Responsive Design:**

- [ ] Mobile layout test
- [ ] Touch targets test
- [ ] No horizontal scroll test

### 07.07 Test Execution

- [ ] Run all unit tests
- [ ] Run all integration tests
- [ ] Run all acceptance tests
- [ ] Run all performance tests
- [ ] Run all accessibility tests
- [ ] Verify test coverage > 80%
- [ ] Fix any failing tests
- [ ] Generate test coverage report

### 07.08 Final Validation

- [ ] All acceptance tests pass
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All MCP tool tests pass
- [ ] Performance targets met
- [ ] Accessibility standards met
- [ ] No regressions in existing features
- [ ] Kanban board still functional
- [ ] Documentation complete

**Days 1-2 Complete:**

- [ ] All tests written
- [ ] All tests passing
- [ ] Performance targets met
- [ ] Ready for production

---

## Final Verification

### Before Production Deployment

- [ ] All phase tasks complete
- [ ] All tests passing
- [ ] Documentation complete
- [ ] No known issues or blockers
- [ ] Code review complete
- [ ] Security review complete

### Post-Deployment Monitoring

- [ ] Monitor API error rates
- [ ] Monitor API performance
- [ ] Monitor database query performance
- [ ] Monitor user feedback
- [ ] Monitor MCP tool usage (if any)
- ] Address any issues promptly

---

## Total Progress Tracking

**Phase 01: Database (Week 1)**
`[ ]` 25/25 tasks complete

**Phase 02: Backend Services (Week 2)**
`[ ]` 30/30 tasks complete

**Phase 03: API Layer (Days 3)**
`[ ]` 40/40 tasks complete

**Phase 04: MCP Integration (Days 3)**
`[ ]` 20/20 tasks complete

**Phase 05: UI Components (Week 5)**
`[ ]` 60/60 tasks complete

**Phase 06: Pages Integration (Days 2)**
`[ ]` 20/20 tasks complete

**Phase 07: Testing & Polish (Days 2)**
`[ ]` 60/60 tasks complete

---

## Overall Progress

`[ ]` 255/255 tasks complete

**Estimated Time to Complete:** 4 weeks

**Start Date:** [TBD]

**Target Completion Date:** [TBD]

---

## Notes

### Blockers

- List any blockers encountered during implementation
- Note how they were resolved
- Track blockers for future reference

### Decisions

- Document any deviations from plan
- Note rationale for changes
- Record alternative approaches considered

### Learnings

- Note any lessons learned
- Record improvements for future implementations

---

**Ready to start implementation!** → Begin with Phase 01, Task 01.01

**Last Updated:** 2026-02-24

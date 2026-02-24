# Testing Strategy

> **Phase:** 07  
> **Duration:** 2 days  
> **Status:** ⏳ Pending

---

## Overview

Comprehensive testing approach for MoLOS-Tasks module enhancements. Include acceptance tests, unit tests, integration tests, and performance tests.

**Testing Goals:**

- Verify all new features work correctly
- Ensure existing functionality remains intact
- Validate MCP tool accessibility
- Confirm performance targets met
- Test accessibility standards

---

## Testing Types

### 1. Acceptance Tests

**Purpose:** Validate features work according to user expectations

**Location:** `tests/acceptance/`

**Test Categories:**

**Task CRUD:**

- Create task with all new fields
- Update task with labels, position, time tracking
- Delete task with subtasks (should fail)
- Complete task with blockers validation
- Move task to new position

**Subtasks:**

- Create subtask with parent validation
- Create nested subtasks (depth limit)
- Move subtask between parents
- Delete subtask

**Comments:**

- Add comment to task
- Reply to existing comment
- Edit own comment
- Delete own comment
- View comment thread

**Attachments:**

- Upload attachment to task
- Download existing attachment
- Delete own attachment
- View attachment list

**Views:**

- Create saved view with filters
- Apply saved view
- Update saved view
- Delete saved view
- Set default view

**Task Detail Panel:**

- Open task detail panel
- View all sections (comments, subtasks, attachments)
- Add subtask from panel
- Add comment from panel
- Update time spent from panel

**Multiple Views:**

- Switch between list and kanban views
- Persist view preference
- Verify consistent state across views

---

### 2. Unit Tests

**Purpose:** Test individual services and components in isolation

**Location:** `tests/unit/`

**Service Tests:**

**CommentService:**

- [ ] addComment() creates comment with correct data
- [ ] getTaskComments() returns comments in order
- [ ] updateComment() updates comment content
- [ ] deleteComment() deletes comment
- [ ] User authorization enforced

**AttachmentService:**

- [ ] createAttachment() creates attachment record
- [ ] getTaskAttachments() returns attachments
- [ ] deleteAttachment() deletes file and record
- [ ] getFilePath() returns correct path
- [ ] User authorization enforced

**ViewService:**

- [ ] createView() creates view with filters
- [ ] getViews() returns all user views
- [ ] updateView() updates view
- [ ] deleteView() deletes view
- [ ] applyView() returns filtered tasks
- [ ] setDefaultView() updates default flag

**TaskService Enhancements:**

- [ ] createSubtask() validates parent exists
- [ ] createSubtask() validates same project
- [ ] getTaskTree() builds correct hierarchy
- [ ] addLabel() adds label to array
- [ ] removeLabel() removes label from array
- [ ] moveTask() updates position
- [ ] updateTimeSpent() adds to time spent

---

### 3. Integration Tests

**Purpose:** Test API endpoints and data flow

**Location:** `tests/integration/`

**API Tests:**

**Comments API:**

- [ ] GET /tasks/:id/comments returns correct data
- [ ] POST /tasks/:id/comments creates comment
- [ ] PUT /comments/:id updates comment
- [ ] DELETE /comments/:id deletes comment
- [ ] Unauthorized returns 401
- [ ] Invalid comment ID returns 404

**Attachments API:**

- [ ] GET /tasks/:id/attachments returns list
- [ ] POST /tasks/:id/attachments creates record
- [ ] GET /attachments/:id/download returns file
- [ ] DELETE /attachments/:id deletes file and record
- [ ] Unauthorized returns 401
- [ ] Invalid attachment ID returns 404

**Subtasks API:**

- [ ] GET /tasks/:id/subtasks returns nested tasks
- [ ] POST /tasks/:id/subtasks creates subtask
- [ ] Unauthorized returns 401
- [ ] Invalid parent ID returns 404

**Views API:**

- [ ] GET /views returns user's views
- [ ] POST /views creates new view
- [ ] PUT /views/:id updates view
- [ ] DELETE /views/:id deletes view
- [ ] GET /views/:id/tasks applies filters
- [ ] POST /views/:id/set-default sets default

**Task Enhancement API:**

- [ ] PATCH /tasks/:id/labels adds/removes labels
- [ ] POST /tasks/:id/move updates position
- [ ] PATCH /tasks/:id/time-spent updates time

---

### 4. MCP Tool Tests

**Purpose:** Validate MCP tools work correctly for external AI agents

**Location:** `tests/mcp/`

**Tool Tests:**

**get_task_with_context:**

- [ ] Returns task with correct ID
- [ ] Includes subtasks when requested
- [ ] Includes comments when requested
- [ ] Includes attachments when requested
- [ ] Includes related tasks when requested
- [ ] Returns context summary
- [ ] Unauthorized returns error
- [ ] Invalid task ID returns error

**get_project_overview:**

- [ ] Returns project details
- [ ] Groups tasks by status correctly
- [ ] Calculates analytics correctly
- [ ] Returns completion rate
- [ ] Unauthorized returns error
- [ ] Invalid project ID returns error

**get_user_patterns:**

- [ ] Returns correct timeframe data
- [ ] Analyzes labels correctly
- [ ] Calculates priority distribution
- [ ] Calculates time tracking metrics
- [ ] Returns productivity insights
- [ ] Unauthorized returns error

**get_tasks (enhanced):**

- [ ] Returns tasks when includeContext=false
- [ ] Returns context when includeContext=true
- [ ] Context includes relevant metadata
- [ ] Filters work correctly

**global_search (enhanced):**

- [ ] Returns results from all entities
- [ ] Includes AI metadata in results
- [ ] Search query works correctly
- [ ] Returns results in correct order

---

### 5. Performance Tests

**Purpose:** Validate performance meets targets

**Location:** `tests/performance/`

**Performance Targets:**

- API p95 < 200ms for paginated lists
- API p95 < 100ms for single item lookup
- UI renders < 100ms for task lists
- MCP tool response < 1s for single operations
- Database queries < 50ms for indexed queries

**Tests:**

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
- [ ] Index lookups working correctly

---

### 6. Accessibility Tests

**Purpose:** Ensure application is accessible to all users

**Location:** `tests/accessibility/`

**Tests:**

**Keyboard Navigation:**

- [ ] Tab key navigates through interactive elements in logical order
- [ ] Enter/Space activates focused buttons
- [ ] Escape closes modals and panels
- [ ] Arrow keys navigate lists
- [ ] Focus indicator visible

**Screen Reader Support:**

- [ ] All interactive elements have ARIA labels
- [ ] Dynamic content changes are announced
- [ ] Error messages are announced
- [ ] Form validation errors are announced
- [ ] Success messages are announced

**Visual Accessibility:**

- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Text is resizable up to 200%
- [ ] Focus indicators are visible
- [ ] No keyboard traps
- [ ] Skip links present for main content

**Responsive Design:**

- [ ] Mobile layout works without horizontal scroll
- [ ] Touch targets are at least 44x44 pixels
- [ ] No horizontal scrolling on form fields
- [ ] Modals fit on mobile screens

---

## Test Data Setup

**Test Database:**

```sql
-- Create test tasks with various statuses
INSERT INTO MoLOS-Tasks_tasks (id, user_id, title, status, priority, position, parent_id, labels)
VALUES
  ('task-1', 'test-user', 'Task 1', 'backlog', 'high', 1000, NULL, '["bug"]'),
  ('task-2', 'test-user', 'Task 2', 'todo', 'medium', 2000, NULL, '["feature"]'),
  ('task-3', 'test-user', 'Task 3', 'in_progress', 'low', 3000, NULL, '[]'),
  ('task-4', 'test-user', 'Task 4', 'done', 'no_priority', 4000, NULL, '[]');

-- Create test subtasks
INSERT INTO MoLOS-Tasks_tasks (id, user_id, title, status, priority, position, parent_id, labels)
VALUES
  ('subtask-1', 'test-user', 'Subtask 1', 'todo', 'medium', 5000, 'task-1', '[]'),
  ('subtask-2', 'test-user', 'Subtask 2', 'todo', 'low', 6000, 'task-1', '[]');

-- Create test project
INSERT INTO MoLOS-Tasks_projects (id, user_id, name, key, status, color)
VALUES
  ('project-1', 'test-user', 'Test Project', 'TEST', 'active', '#3B82F6');
```

---

## Test Execution

### Unit Test Commands

```bash
# Run all unit tests
bun run test

# Run specific test file
bun run test:unit -- tests/unit/comment-service.spec.ts --run

# Run with coverage
bun run test:unit -- --coverage --run
```

### Integration Test Commands

```bash
# Run all integration tests
bun run test:integration

# Run API tests
bun run test:integration -- tests/integration/api.spec.ts --run
```

### MCP Tool Tests

```bash
# Test MCP tool registration
bun run test:mcp

# Test individual tools
bun run test:mcp -- tests/mcp/task-context.spec.ts --run
```

---

## Test Reporting

### Coverage Report

Generate after running tests with coverage:

```bash
bun run test:unit -- --coverage --run
```

**Target Coverage:**

- Services: > 80%
- Repositories: > 90%
- API endpoints: > 80%
- MCP tools: > 85%

### Performance Report

Run performance tests and collect metrics:

```bash
bun run test:performance
```

**Report Output:**

- API p95 latencies
- UI render times
- Database query times
- Failed targets (if any)

---

## Continuous Integration

### CI/CD Integration

**GitHub Actions Workflow:**

```yaml
name: Test MoLOS-Tasks

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dependencies
        run: bun install
      - name: Run unit tests
        run: bun run test
      - name: Run integration tests
        run: bun run test:integration
      - name: Check coverage
        run: bun run test:unit -- --coverage --run
```

---

## Checklist

### Acceptance Tests

**Task CRUD:**

- [ ] Create task with all new fields
- [ ] Update task with labels
- [ ] Update task with position
- [ ] Update task with time spent
- [ ] Delete task
- [ ] Complete task

**Subtasks:**

- [ ] Create subtask
- [ ] View nested subtasks
- [ ] Move subtask
- [ ] Delete subtask

**Comments:**

- [ ] Add comment
- [ ] View comments
- [ ] Reply to comment
- [ ] Edit comment
- [ ] Delete comment

**Attachments:**

- [ ] Upload attachment
- [ ] View attachments
- [ ] Download attachment
- [ ] Delete attachment

**Views:**

- [ ] Create view
- [ ] Apply view
- [ ] Update view
- [ ] Delete view
- [ ] Set default view

**Multiple Views:**

- [ ] Switch to list view
- [ ] Switch to kanban view
- [ ] View persists on navigation
- [ ] Filters work in both views

### Unit Tests

**Service Tests:**

- [ ] CommentService tests pass
- [ ] AttachmentService tests pass
- [ ] ViewService tests pass
- [ ] TaskService enhancements pass

### Integration Tests

**API Tests:**

- [ ] Comments API tests pass
- [ ] Attachments API tests pass
- [ ] Subtasks API tests pass
- [ ] Views API tests pass
- [ ] Task enhancements API tests pass

### MCP Tool Tests

- [ ] get_task_with_context works
- [ ] get_project_overview works
- [ ] get_user_patterns works
- [ ] get_tasks enhanced works
- [ ] global_search enhanced works

### Performance Tests

**API Performance:**

- [ ] List endpoint p95 < 200ms
- [ ] Single item p95 < 100ms
- [ ] All API tests pass

**UI Performance:**

- [ ] Task list renders < 100ms
- [ ] Kanban renders < 100ms
- [ ] Detail panel opens < 100ms
- [ ] All UI tests pass

### Accessibility Tests

**Keyboard:**

- [ ] Tab navigation works
- [ ] Enter/Space works
- [ ] Escape works
- [ ] Arrow keys work

**Screen Reader:**

- [ ] ARIA labels present
- [ ] Changes announced
- [ ] Forms accessible

**Visual:**

- [ ] Color contrast OK
- [ ] Text resizable
- [ ] Focus indicators OK
- [ ] No keyboard traps

**Responsive:**

- [ ] Mobile layout OK
- [ ] Touch targets OK
- [ ] No horizontal scroll

---

## Validation

After testing, verify:

- [ ] All acceptance tests pass
- [ ] Unit test coverage > 80%
- [ ] All integration tests pass
- [ ] All MCP tools work correctly
- [ ] Performance targets met
- [ ] Accessibility standards met
- [ ] No regressions in existing features
- [ ] Kanban board still functional
- [ ] Documentation is complete

---

**Ready for Production!** → Deploy and monitor

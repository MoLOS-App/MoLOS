# API Layer Implementation Plan

> **Phase:** 03  
> **Duration:** 3 days  
> **Status:** ⏳ Pending

---

## Overview

Add new REST API endpoints for comments, attachments, views, subtasks, and enhanced task operations. Follow existing MoLOS API patterns.

**New Endpoint Groups:**

1. Comments - Task comment CRUD
2. Attachments - File upload/download
3. Subtasks - Nested task operations
4. Views - Saved filter management
5. Task Enhancements - Labels, position, time tracking

---

## 1. Comments API

**Base Path:** `/api/MoLOS-Tasks`

### GET /api/MoLOS-Tasks/tasks/:id/comments

Get all comments for a task.

**Response:**

```json
[
	{
		"id": "uuid",
		"userId": "user-123",
		"taskId": "task-123",
		"content": "This is a comment",
		"createdAt": 1708768800
	}
]
```

### POST /api/MoLOS-Tasks/tasks/:id/comments

Add a new comment to a task.

**Request Body:**

```json
{
	"content": "New comment text"
}
```

**Response:** Created comment object

### PUT /api/MoLOS-Tasks/comments/:id

Update an existing comment.

**Request Body:**

```json
{
	"content": "Updated comment text"
}
```

**Response:** Updated comment object

### DELETE /api/MoLOS-Tasks/comments/:id

Delete a comment.

**Response:**

```json
{
	"success": true
}
```

---

## 2. Attachments API

### GET /api/MoLOS-Tasks/tasks/:id/attachments

Get all attachments for a task.

**Response:**

```json
[
	{
		"id": "uuid",
		"userId": "user-123",
		"taskId": "task-123",
		"fileName": "document.pdf",
		"fileSize": 1234567,
		"fileType": "application/pdf",
		"storagePath": "/uploads/tasks/...",
		"createdAt": 1708768800
	}
]
```

### POST /api/MoLOS-Tasks/tasks/:id/attachments

Upload a file attachment.

**Request Body:**

```json
{
	"fileName": "document.pdf",
	"fileSize": 1234567,
	"fileType": "application/pdf"
}
```

**Response:**

```json
{
	"id": "uuid",
	"uploadUrl": "https://storage.example.com/upload/...",
	"storagePath": "/uploads/tasks/...",
	"fileName": "document.pdf"
}
```

### GET /api/MoLOS-Tasks/attachments/:id/download

Download an attachment file.

**Response:** File download (binary)

### DELETE /api/MoLOS-Tasks/attachments/:id

Delete an attachment.

**Response:**

```json
{
	"success": true
}
```

---

## 3. Subtasks API

### GET /api/MoLOS-Tasks/tasks/:id/subtasks

Get all subtasks for a parent task.

**Query Params:**

- `depth` (optional, default: 3) - Maximum nesting depth

**Response:**

```json
[
	{
		"id": "uuid",
		"title": "Subtask 1",
		"parentId": "parent-123",
		"position": 1000,
		"status": "todo"
		// ... other task fields
	}
]
```

### POST /api/MoLOS-Tasks/tasks/:id/subtasks

Create a new subtask.

**Request Body:**

```json
{
	"title": "New subtask",
	"description": "Subtask description",
	"priority": "medium",
	"dueDate": 1708768800,
	"estimateHours": 2
}
```

**Response:** Created subtask object

---

## 4. Views API

### GET /api/MoLOS-Tasks/views

Get all saved views for current user.

**Query Params:**

- `projectId` (optional) - Filter by project

**Response:**

```json
[
	{
		"id": "view-123",
		"name": "My Tasks",
		"projectId": "project-123",
		"filters": {
			"status": ["todo", "in_progress"],
			"priority": ["high"]
		},
		"sortBy": "due_date",
		"sortOrder": "asc",
		"isDefault": true,
		"createdAt": 1708768800
	}
]
```

### POST /api/MoLOS-Tasks/views

Create a new saved view.

**Request Body:**

```json
{
	"name": "High Priority Tasks",
	"projectId": "project-123",
	"filters": {
		"status": ["todo", "in_progress"],
		"priority": ["high"]
	},
	"sortBy": "due_date",
	"sortOrder": "asc",
	"isDefault": false
}
```

**Response:** Created view object

### PUT /api/MoLOS-Tasks/views/:id

Update an existing view.

**Request Body:**

```json
{
	"name": "Updated View Name",
	"filters": {
		"status": ["done"]
	}
}
```

**Response:** Updated view object

### DELETE /api/MoLOS-Tasks/views/:id

Delete a saved view.

**Response:**

```json
{
	"success": true
}
```

### GET /api/MoLOS-Tasks/views/:id/tasks

Apply a saved view to get tasks.

**Response:**

```json
[
	{
		"id": "task-123",
		"title": "Task 1",
		"status": "done"
		// ... other task fields
	}
]
```

### POST /api/MoLOS-Tasks/views/:id/set-default

Set a view as the default for the user.

**Response:**

```json
{
	"success": true
}
```

---

## 5. Task Enhancement API

### PATCH /api/MoLOS-Tasks/tasks/:id/labels

Add or remove labels from a task.

**Request Body:**

```json
{
	"action": "add",
	"labels": ["bug", "feature"]
}
```

**Response:** Updated task object with new labels

### POST /api/MoLOS-Tasks/tasks/:id/move

Move a task to a new position.

**Request Body:**

```json
{
	"newPosition": 2000
}
```

**Response:** Updated task object

### PATCH /api/MoLOS-Tasks/tasks/:id/time-spent

Update time spent on a task.

**Request Body:**

```json
{
	"hours": 1.5,
	"reason": "Worked on frontend implementation"
}
```

**Response:** Updated task object

---

## Enhanced Existing Endpoints

### GET /api/MoLOS-Tasks

Enhanced with new query parameters:

- `parent_id` (optional) - Filter by parent task
- `labels` (optional) - Filter by labels (comma-separated)
- `sort_by` (optional) - Sort field (position, due_date, priority, created_at)
- `sort_order` (optional) - Sort direction (asc, desc)

**Example:**

```
GET /api/MoLOS-Tasks?parent_id=null&labels=bug,feature&sort_by=due_date&sort_order=asc
```

### POST /api/MoLOS-Tasks

Enhanced request body to support new fields:

```json
{
	"title": "New Task",
	"description": "Task description",
	"status": "todo",
	"priority": "high",
	"dueDate": 1708768800,
	"projectId": "project-123",
	"parentId": "parent-task-123",
	"labels": ["bug", "urgent"],
	"estimateHours": 4
}
```

---

## Error Responses

### 400 Bad Request

```json
{
	"error": "Bad Request",
	"message": "Invalid input: labels must be an array"
}
```

### 401 Unauthorized

```json
{
	"error": "Unauthorized",
	"message": "Authentication required"
}
```

### 404 Not Found

```json
{
	"error": "Not Found",
	"message": "Task not found"
}
```

### 409 Conflict (Version Mismatch)

```json
{
	"error": "Conflict",
	"message": "Task has been modified by another user. Please refresh and try again."
}
```

### 500 Internal Server Error

```json
{
	"error": "Internal Server Error",
	"message": "An unexpected error occurred"
}
```

---

## File Structure

```
modules/MoLOS-Tasks/src/routes/api/
├── tasks/
│   ├── [id]/
│   │   ├── +server.ts (existing - enhance)
│   │   ├── comments/+server.ts (NEW)
│   │   ├── attachments/+server.ts (NEW)
│   │   ├── subtasks/+server.ts (NEW)
│   │   ├── labels/+server.ts (NEW)
│   │   ├── move/+server.ts (NEW)
│   │   └── time-spent/+server.ts (NEW)
├── views/+server.ts (NEW)
```

---

## Checklist

### Day 1 Tasks

- [ ] Create comments endpoint files
- [ ] Implement GET /tasks/:id/comments
- [ ] Implement POST /tasks/:id/comments
- [ ] Implement PUT /comments/:id
- [ ] Implement DELETE /comments/:id

### Day 2 Tasks

- [ ] Create attachments endpoint files
- [ ] Implement GET /tasks/:id/attachments
- [ ] Implement POST /tasks/:id/attachments
- [ ] Implement GET /attachments/:id/download
- [ ] Implement DELETE /attachments/:id
- [ ] Implement file upload handling

### Day 3 Tasks

- [ ] Create views endpoint files
- [ ] Implement GET /views
- [ ] Implement POST /views
- [ ] Implement PUT /views/:id
- [ ] Implement DELETE /views/:id
- [ ] Implement GET /views/:id/tasks
- [ ] Implement POST /views/:id/set-default
- [ ] Create subtasks endpoint files
- [ ] Implement GET /tasks/:id/subtasks
- [ ] Implement POST /tasks/:id/subtasks
- [ ] Create task enhancement endpoints
- [ ] Implement PATCH /tasks/:id/labels
- [ ] Implement POST /tasks/:id/move
- [ ] Implement PATCH /tasks/:id/time-spent
- [ ] Enhance existing /tasks endpoint
- [ ] Test all new endpoints

---

## Validation

After implementation, verify:

- [ ] All endpoints follow REST conventions
- [ ] All endpoints require authentication
- [ ] All endpoints validate user ownership
- [ ] Error responses are consistent
- [ ] CORS headers are set correctly
- [ ] Input validation with Zod schemas
- [ ] Response types are documented

---

## API Documentation

For complete API reference with all endpoints, see `api-endpoints.md`.

---

**Next:** Proceed to Phase 04 - MCP Integration

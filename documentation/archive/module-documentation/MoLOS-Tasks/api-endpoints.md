# API Endpoints Reference

> Complete reference for all MoLOS-Tasks API endpoints including existing and new endpoints.

---

## Base URL

```
/api/MoLOS-Tasks
```

---

## Authentication

All endpoints require authentication. Include `session` cookie or `Authorization` header.

**Unauthorized Response:**

```json
{
	"error": "Unauthorized",
	"message": "Authentication required"
}
```

---

## Endpoints

### Tasks

#### GET /api/MoLOS-Tasks

Get all tasks for authenticated user.

**Query Parameters:**

- `project_id` (optional) - Filter by project
- `parent_id` (optional) - Filter by parent task (null for root tasks)
- `labels` (optional) - Filter by labels (comma-separated)
- `status` (optional) - Filter by status (comma-separated)
- `priority` (optional) - Filter by priority (comma-separated)
- `sort_by` (optional) - Sort field (position, due_date, priority, created_at)
- `sort_order` (optional) - Sort direction (asc, desc)
- `limit` (optional, default: 50) - Max tasks to return

**Response (200):**

```json
[
	{
		"id": "uuid",
		"userId": "user-123",
		"title": "Task Title",
		"description": "Task description",
		"status": "todo",
		"priority": "high",
		"dueDate": 1708768800,
		"doDate": 1708768800,
		"effort": 30,
		"context": ["deep_work"],
		"isCompleted": false,
		"projectId": "project-123",
		"areaId": "area-123",
		"parentId": null,
		"labels": ["bug", "urgent"],
		"estimateHours": 4,
		"timeSpentHours": 1.5,
		"position": 1000,
		"version": 1,
		"createdAt": 17087688000,
		"updatedAt": 1708768000
	}
]
```

---

#### POST /api/MoLOS-Tasks

Create a new task.

**Request Body:**

```json
{
	"title": "New Task",
	"description": "Task description",
	"status": "todo",
	"priority": "medium",
	"dueDate": 1708768800,
	"doDate": 1708768800,
	"effort": 30,
	"context": ["deep_work"],
	"projectId": "project-123",
	"areaId": "area-123",
	"parentId": "parent-task-123",
	"labels": ["feature"],
	"estimateHours": 4
}
```

**Response (201):**

```json
{
	"id": "uuid",
	"userId": "user-123",
	"title": "New Task",
	"status": "todo",
	"priority": "medium",
	"dueDate": 1708768800,
	"doDate": 1708768800,
	"effort": 30,
	"context": ["deep_work"],
	"isCompleted": false,
	"projectId": "project-123",
	"areaId": "area-123",
	"parentId": "parent-task-123",
	"labels": ["feature"],
	"estimateHours": 4,
	"timeSpentHours": 0,
	"position": 5000,
	"version": 1,
	"createdAt": 17087688000,
	"updatedAt": 17087688000
}
```

---

#### PATCH /api/MoLOS-Tasks/tasks/:id

Update a task.

**Request Headers:**

- `If-Match: <version>` - Optimistic concurrency version (required)

**Request Body:**

```json
{
	"title": "Updated Title",
	"status": "in_progress",
	"priority": "high",
	"dueDate": 1708768800,
	"labels": ["bug", "urgent"]
}
```

**Response (200):**

```json
{
	"id": "uuid",
	"title": "Updated Title",
	"status": "in_progress",
	"priority": "high",
	"labels": ["bug", "urgent"],
	"version": 2,
	"updatedAt": 17087689000
}
```

**Response (409 - Conflict):**

```json
{
	"error": "Conflict",
	"message": "Task has been modified by another user. Please refresh and try again."
}
```

---

#### DELETE /api/MoLOS-Tasks/tasks/:id

Delete a task.

**Response (200):**

```json
{
	"success": true
}
```

---

### Task Operations

#### PATCH /api/MoLOS-Tasks/tasks/:id/labels

Add or remove labels from a task.

**Request Body:**

```json
{
	"action": "add",
	"labels": ["bug", "feature", "urgent"]
}
```

**Response (200):**

```json
{
	"id": "uuid",
	"labels": ["bug", "feature", "urgent"]
}
```

---

#### POST /api/MoLOS-Tasks/tasks/:id/move

Move a task to a new position.

**Request Body:**

```json
{
	"newPosition": 2000
}
```

**Response (200):**

```json
{
	"id": "uuid",
	"position": 2000
}
```

---

#### PATCH /api/MoLOS-Tasks/tasks/:id/time-spent

Update time spent on a task.

**Request Body:**

```json
{
	"hours": 1.5,
	"reason": "Worked on backend implementation"
}
```

**Response (200):**

```json
{
	"id": "uuid",
	"timeSpentHours": 3.0,
	"updatedAt": 1708769000
}
```

---

### Comments

#### GET /api/MoLOS-Tasks/tasks/:id/comments

Get all comments for a task.

**Response (200):**

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

---

#### POST /api/MoLOS-Tasks/tasks/:id/comments

Add a new comment to a task.

**Request Body:**

```json
{
	"content": "New comment text"
}
```

**Response (201):**

```json
{
	"id": "uuid",
	"userId": "user-123",
	"taskId": "task-123",
	"content": "New comment text",
	"createdAt": 17087688000
}
```

---

#### PUT /api/MoLOS-Tasks/comments/:id

Update an existing comment.

**Request Body:**

```json
{
	"content": "Updated comment text"
}
```

**Response (200):**

```json
{
	"id": "uuid",
	"content": "Updated comment text",
	"updatedAt": 1708768900
}
```

---

#### DELETE /api/MoLOS-Tasks/comments/:id

Delete a comment.

**Response (200):**

```json
{
	"success": true
}
```

---

### Attachments

#### GET /api/MoLOS-Tasks/tasks/:id/attachments

Get all attachments for a task.

**Response (200):**

```json
[
	{
		"id": "uuid",
		"userId": "user-123",
		"taskId": "task-123",
		"fileName": "document.pdf",
		"fileSize": 1234567,
		"fileType": "application/pdf",
		"storagePath": "/uploads/tasks/uuid-document.pdf",
		"createdAt": 1708768800
	}
]
```

---

#### POST /api/MoLOS-Tasks/tasks/:id/attachments

Upload a file attachment.

**Request Body:**

```json
{
	"fileName": "document.pdf",
	"fileSize": 1234567,
	"fileType": "application/pdf"
}
```

**Response (201):**

```json
{
	"id": "uuid",
	"fileName": "document.pdf",
	"uploadUrl": "https://storage.example.com/upload/...",
	"storagePath": "/uploads/tasks/uuid-document.pdf"
}
```

---

#### GET /api/MoLOS-Tasks/attachments/:id/download

Download an attachment file.

**Response:** File download (binary)

**Headers:**

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="document.pdf"
Content-Length: 1234567
```

---

#### DELETE /api/MoLOS-Tasks/attachments/:id

Delete an attachment.

**Response (200):**

```json
{
	"success": true
}
```

---

### Subtasks

#### GET /api/MoLOS-Tasks/tasks/:id/subtasks

Get all subtasks for a parent task.

**Query Parameters:**

- `depth` (optional, default: 3) - Maximum nesting depth

**Response (200):**

```json
[
	{
		"id": "uuid",
		"title": "Subtask 1",
		"parentId": "parent-123",
		"position": 1100,
		"status": "todo",
		"subtasks": [
			{
				"id": "uuid",
				"title": "Nested Subtask",
				"parentId": "uuid",
				"position": 1200
			}
		]
	}
]
```

---

#### POST /api/MoLOS-Tasks/tasks/:id/subtasks

Create a new subtask.

**Request Body:**

```json
{
	"title": "New subtask",
	"description": "Subtask description",
	"status": "todo",
	"priority": "medium",
	"dueDate": 1708768800,
	"estimateHours": 2
}
```

**Response (201):**

```json
{
	"id": "uuid",
	"title": "New subtask",
	"parentId": "parent-123",
	"position": 1100,
	"status": "todo",
	"createdAt": 17087688000
}
```

---

### Views

#### GET /api/MoLOS-Tasks/views

Get all saved views for current user.

**Query Parameters:**

- `project_id` (optional) - Filter by project

**Response (200):**

```json
[
	{
		"id": "view-123",
		"userId": "user-123",
		"projectId": "project-123",
		"name": "My Tasks",
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

---

#### POST /api/MoLOS-Tasks/views

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

**Response (201):**

```json
{
	"id": "view-123",
	"name": "High Priority Tasks",
	"projectId": "project-123",
	"filters": {
		"status": ["todo", "in_progress"],
		"priority": ["high"]
	},
	"sortBy": "due_date",
	"sortOrder": "asc",
	"isDefault": false,
	"createdAt": 17087688000
}
```

---

#### PUT /api/MoLOS-Tasks/views/:id

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

**Response (200):**

```json
{
	"id": "view-123",
	"name": "Updated View Name",
	"filters": {
		"status": ["done"]
	},
	"updatedAt": 1708768900
}
```

---

#### DELETE /api/MoLOS-Tasks/views/:id

Delete a saved view.

**Response (200):**

```json
{
	"success": true
}
```

---

#### GET /api/MoLOS-Tasks/views/:id/tasks

Apply a saved view to get tasks.

**Response (200):**

```json
[
	{
		"id": "task-123",
		"title": "Task 1",
		"status": "todo",
		"priority": "high",
		"dueDate": 1708768800
	}
]
```

---

#### POST /api/MoLOS-Tasks/views/:id/set-default

Set a view as the default for the user.

**Response (200):**

```json
{
	"success": true
}
```

---

## Existing Endpoints

The following endpoints already exist and remain functional:

### Projects

- `GET /api/MoLOS-Tasks/projects` - List all projects
- `POST /api/MoLOS-Tasks/projects` - Create project
- `PUT /api/MoLOS-Tasks/projects` - Update project
- `DELETE /api/MoLOS-Tasks/projects` - Delete project

### Areas

- `GET /api/MoLOS-Tasks/areas` - List all areas
- `POST /api/MoLOS-Tasks/areas` - Create area
- `PUT /api/MoLOS-Tasks/areas` - Update area
- `DELETE /api/MoLOS-Tasks/areas` - Delete area

### Daily Log

- `GET /api/MoLOS-Tasks/daily-log` - List all daily logs
- `POST /api/MoLOS-Tasks/daily-log` - Create daily log
- `PUT /api/MoLOS-Tasks/daily-log` - Update daily log (by logDate)
- `DELETE /api/MoLOS-Tasks/daily-log` - Delete daily log (by logDate)

### Settings

- `GET /api/MoLOS-Tasks/settings` - Get user settings
- `PUT /api/MoLOS-Tasks/settings` - Update user settings

### Search

- `GET /api/MoLOS-Tasks/search` - Global search across all entities

---

## Status Codes

| Code | Meaning                     |
| ---- | --------------------------- |
| 200  | Success                     |
| 201  | Created                     |
| 400  | Bad Request                 |
| 401  | Unauthorized                |
| 404  | Not Found                   |
| 409  | Conflict (version mismatch) |
| 500  | Internal Server Error       |

---

## Error Responses

All endpoints return consistent error format:

```json
{
	"error": "Error Type",
	"message": "Detailed error message",
	"details": {} // Optional additional context
}
```

---

## Rate Limiting

No rate limiting currently implemented. May add in future if needed.

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-24

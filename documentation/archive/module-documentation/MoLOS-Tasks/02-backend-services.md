# Backend Services Implementation Plan

> **Phase:** 02  
> **Duration:** 1 week  
> **Status:** ⏳ Pending

---

## Overview

Implement service layer for new features following existing MoLOS patterns. All services use repositories for data access and provide business logic.

**Services to Create:**

1. CommentService - Comment CRUD
2. AttachmentService - File attachment management
3. ViewService - Saved view filters
4. TaskService enhancements - Subtasks, labels, position, time tracking

---

## 1. CommentService

**File:** `modules/MoLOS-Tasks/src/server/services/comment-service.ts`

### Methods

```typescript
export class CommentService {
	constructor(private commentRepo: CommentRepository) {}

	async addComment(taskId: string, userId: string, content: string): Promise<Comment> {
		const comment = await this.commentRepo.create({
			taskId,
			userId,
			content,
			createdAt: Math.floor(Date.now() / 1000)
		});

		return comment;
	}

	async getTaskComments(taskId: string, userId: string): Promise<Comment[]> {
		return await this.commentRepo.getByTaskId(taskId, userId);
	}

	async updateComment(id: string, userId: string, content: string): Promise<Comment> {
		return await this.commentRepo.update(id, userId, {
			content,
			updatedAt: Math.floor(Date.now() / 1000)
		});
	}

	async deleteComment(id: string, userId: string): Promise<void> {
		await this.commentRepo.delete(id, userId);
	}
}
```

### Repository Requirements

**File:** `modules/MoLOS-Tasks/src/server/repositories/comment-repository.ts`

```typescript
export class CommentRepository extends BaseRepository {
	async getByTaskId(taskId: string, userId: string): Promise<Comment[]> {
		const result = await this.db
			.select()
			.from(tasksComments)
			.where(and(eq(tasksComments.taskId, taskId), eq(tasksComments.userId, userId)))
			.orderBy(desc(tasksComments.createdAt));

		return result as Comment[];
	}

	async create(input: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
		const result = await this.db.insert(tasksComments).values(input).returning();
		return result[0] as Comment;
	}

	async update(id: string, userId: string, updates: Partial<Comment>): Promise<Comment | null> {
		const result = await this.db
			.update(tasksComments)
			.set({ ...updates, updatedAt: Math.floor(Date.now() / 1000) })
			.where(and(eq(tasksComments.id, id), eq(tasksComments.userId, userId)))
			.returning();

		return (result[0] as Comment) || null;
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(tasksComments)
			.where(and(eq(tasksComments.id, id), eq(tasksComments.userId, userId)));

		return result.changes > 0;
	}
}
```

---

## 2. AttachmentService

**File:** `modules/MoLOS-Tasks/src/server/services/attachment-service.ts`

### Methods

```typescript
export class AttachmentService {
	constructor(private attachmentRepo: AttachmentRepository) {}

	async createAttachment(
		taskId: string,
		userId: string,
		fileName: string,
		fileSize: number,
		fileType: string
	): Promise<Attachment> {
		const storagePath = `/uploads/tasks/${crypto.randomUUID()}-${fileName}`;

		const attachment = await this.attachmentRepo.create({
			taskId,
			userId,
			fileName,
			fileSize,
			fileType,
			storagePath,
			createdAt: Math.floor(Date.now() / 1000)
		});

		return attachment;
	}

	async getTaskAttachments(taskId: string, userId: string): Promise<Attachment[]> {
		return await this.attachmentRepo.getByTaskId(taskId, userId);
	}

	async deleteAttachment(id: string, userId: string): Promise<void> {
		// Get attachment to get storage path
		const attachment = await this.attachmentRepo.getById(id, userId);
		if (attachment) {
			// Delete file from storage
			await this.deleteFile(attachment.storagePath);
		}

		// Delete database record
		await this.attachmentRepo.delete(id, userId);
	}

	getFilePath(attachmentId: string): string {
		// Return file path for download
		return `/api/MoLOS-Tasks/attachments/${attachmentId}/download`;
	}

	private async deleteFile(path: string): Promise<void> {
		// Delete file from file system
		// Implementation depends on storage strategy
	}
}
```

### Repository Requirements

**File:** `modules/MoLOS-Tasks/src/server/repositories/attachment-repository.ts`

```typescript
export class AttachmentRepository extends BaseRepository {
	async getByTaskId(taskId: string, userId: string): Promise<Attachment[]> {
		const result = await this.db
			.select()
			.from(tasksAttachments)
			.where(and(eq(tasksAttachments.taskId, taskId), eq(tasksAttachments.userId, userId)))
			.orderBy(desc(tasksAttachments.createdAt));

		return result as Attachment[];
	}

	async getById(id: string, userId: string): Promise<Attachment | null> {
		const result = await this.db
			.select()
			.from(tasksAttachments)
			.where(and(eq(tasksAttachments.id, id), eq(tasksAttachments.userId, userId)))
			.limit(1);

		return (result[0] as Attachment) || null;
	}

	async create(input: Omit<Attachment, 'id' | 'createdAt'>): Promise<Attachment> {
		const result = await this.db.insert(tasksAttachments).values(input).returning();
		return result[0] as Attachment;
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(tasksAttachments)
			.where(and(eq(tasksAttachments.id, id), eq(tasksAttachments.userId, userId)));

		return result.changes > 0;
	}
}
```

---

## 3. ViewService

**File:** `modules/MoLOS-Tasks/src/server/services/view-service.ts`

### Methods

```typescript
export class ViewService {
	constructor(private viewRepo: ViewRepository) {}

	async createView(
		userId: string,
		name: string,
		filters: ViewFilters,
		sortBy: string,
		sortOrder: 'asc' | 'desc',
		projectId?: string,
		isDefault: boolean = false
	): Promise<View> {
		const view = await this.viewRepo.create({
			userId,
			name,
			projectId,
			filters: JSON.stringify(filters),
			sortBy,
			sortOrder,
			isDefault,
			createdAt: Math.floor(Date.now() / 1000)
		});

		return view;
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

	async applyView(viewId: string, userId: string): Promise<Task[]> {
		const view = await this.viewRepo.getById(viewId, userId);
		if (!view) {
			throw new Error('View not found');
		}

		const filters = JSON.parse(view.filters) as ViewFilters;

		// Use TaskService to get filtered tasks
		const taskService = new TaskService(/*...*/);
		return await taskService.getTasks(userId, filters, view.sortBy, view.sortOrder);
	}

	async setDefaultView(userId: string, viewId: string): Promise<void> {
		// Unset current default
		await this.viewRepo.unsetDefault(userId);

		// Set new default
		await this.viewRepo.update(viewId, userId, { isDefault: true });
	}
}
```

### Repository Requirements

**File:** `modules/MoLOS-Tasks/src/server/repositories/view-repository.ts`

```typescript
export class ViewRepository extends BaseRepository {
	async getByUserId(userId: string, projectId?: string): Promise<View[]> {
		const conditions = [eq(tasksViews.userId, userId)];

		if (projectId) {
			conditions.push(eq(tasksViews.projectId, projectId));
		}

		const result = await this.db
			.select()
			.from(tasksViews)
			.where(and(...conditions))
			.orderBy(desc(tasksViews.createdAt));

		return result as View[];
	}

	async getById(id: string, userId: string): Promise<View | null> {
		const result = await this.db
			.select()
			.from(tasksViews)
			.where(and(eq(tasksViews.id, id), eq(tasksViews.userId, userId)))
			.limit(1);

		return (result[0] as View) || null;
	}

	async create(input: Omit<View, 'id' | 'createdAt'>): Promise<View> {
		const result = await this.db.insert(tasksViews).values(input).returning();
		return result[0] as View;
	}

	async update(id: string, userId: string, updates: Partial<View>): Promise<View> {
		const result = await this.db
			.update(tasksViews)
			.set(updates)
			.where(and(eq(tasksViews.id, id), eq(tasksViews.userId, userId)))
			.returning();

		return result[0] as View;
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(tasksViews)
			.where(and(eq(tasksViews.id, id), eq(tasksViews.userId, userId)));

		return result.changes > 0;
	}

	async unsetDefault(userId: string): Promise<void> {
		await this.db.update(tasksViews).set({ isDefault: false }).where(eq(tasksViews.userId, userId));
	}
}
```

---

## 4. TaskService Enhancements

**File:** `modules/MoLOS-Tasks/src/server/services/task-service.ts` (existing, add methods)

### New Methods to Add

```typescript
// Subtasks
async createSubtask(parentId: string, input: CreateTaskInput, userId: string): Promise<Task> {
  const parent = await this.taskRepo.getById(parentId, userId);
  if (!parent) {
    throw new Error('Parent task not found');
  }

  // Ensure parent and child share same project
  if (input.projectId && input.projectId !== parent.projectId) {
    throw new Error('Parent and child tasks must belong to the same project');
  }

  input.parentId = parentId;
  input.projectId = parent.projectId;

  const subtask = await this.createTask(input, userId);
  return subtask;
}

async getTaskTree(userId: string, projectId?: string): Promise<TaskTree> {
  const tasks = await this.getTasks(userId, { projectId });
  return this.buildTree(tasks);
}

// Labels
async addLabel(taskId: string, userId: string, label: string): Promise<Task> {
  const task = await this.taskRepo.getById(taskId, userId);
  if (!task) {
    throw new Error('Task not found');
  }

  const labels = task.labels ? JSON.parse(task.labels) : [];
  if (!labels.includes(label)) {
    labels.push(label);
  }

  return await this.taskRepo.update(taskId, userId, {
    labels: JSON.stringify(labels),
    updatedAt: Math.floor(Date.now() / 1000)
  });
}

async removeLabel(taskId: string, userId: string, label: string): Promise<Task> {
  const task = await this.taskRepo.getById(taskId, userId);
  if (!task) {
    throw new Error('Task not found');
  }

  const labels = task.labels ? JSON.parse(task.labels) : [];
  const filtered = labels.filter(l => l !== label);

  return await this.taskRepo.update(taskId, userId, {
    labels: JSON.stringify(filtered),
    updatedAt: Math.floor(Date.now() / 1000)
  });
}

// Position
async moveTask(id: string, userId: string, newPosition: number): Promise<Task> {
  return await this.taskRepo.update(id, userId, {
    position: newPosition,
    updatedAt: Math.floor(Date.now() / 1000)
  });
}

// Time tracking
async updateTimeSpent(id: string, userId: string, hours: number): Promise<Task> {
  const task = await this.taskRepo.getById(id, userId);
  if (!task) {
    throw new Error('Task not found');
  }

  return await this.taskRepo.update(id, userId, {
    timeSpentHours: task.timeSpentHours + hours,
    updatedAt: Math.floor(Date.now() / 1000)
  });
}

// Task tree building
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
```

### Repository Updates

**File:** `modules/MoLOS-Tasks/src/server/repositories/task-repository.ts` (existing, add methods)

```typescript
// Add to TaskRepository class:

async getByParentId(parentId: string, userId: string): Promise<Task[]> {
  const result = await this.db
    .select()
    .from(tasksTasks)
    .where(
      and(
        eq(tasksTasks.parentId, parentId),
        eq(tasksTasks.userId, userId)
      )
    )
    .orderBy(asc(tasksTasks.position));

  return result as Task[];
}

async updatePosition(id: string, userId: string, position: number): Promise<Task | null> {
  const result = await this.db
    .update(tasksTasks)
    .set({
      position,
      updatedAt: Math.floor(Date.now() / 1000)
    })
    .where(
      and(
        eq(tasksTasks.id, id),
        eq(tasksTasks.userId, userId)
      )
    )
    .returning();

  return (result[0] as Task) || null;
}

async hasSubtasks(taskId: string): Promise<boolean> {
  const result = await this.db
    .select({ count: sql`count(*)` })
    .from(tasksTasks)
    .where(eq(tasksTasks.parentId, taskId));

  return (result[0]?.count as number) > 0;
}
```

---

## Checklist

### Week 1 Tasks

**CommentService**

- [ ] Create comment-repository.ts
- [ ] Create comment-service.ts
- [ ] Implement addComment
- [ ] Implement getTaskComments
- [ ] Implement updateComment
- [ ] Implement deleteComment
- [ ] Write unit tests
- [ ] Integrate with API

**AttachmentService**

- [ ] Create attachment-repository.ts
- [ ] Create attachment-service.ts
- [ ] Implement createAttachment
- [ ] Implement getTaskAttachments
- [ ] Implement deleteAttachment
- [ ] Implement file deletion logic
- [ ] Write unit tests
- [ ] Integrate with API

**ViewService**

- [ ] Create view-repository.ts
- [ ] Create view-service.ts
- [ ] Implement createView
- [ ] Implement getViews
- [ ] Implement updateView
- [ ] Implement deleteView
- [ ] Implement applyView
- [ ] Implement setDefaultView
- [ ] Write unit tests
- [ ] Integrate with API

**TaskService Enhancements**

- [ ] Add createSubtask method
- [ ] Add getTaskTree method
- [ ] Add addLabel method
- [ ] Add removeLabel method
- [ ] Add moveTask method
- [ ] Add updateTimeSpent method
- [ ] Add buildTree helper
- [ ] Update task-repository.ts
- [ ] Write unit tests for new methods
- [ ] Test subtask hierarchy

---

## Validation

After implementation, verify:

- [ ] All services follow existing patterns
- [ ] All services use repositories (no direct DB access)
- [ ] All methods have proper error handling
- [ ] All timestamps use Unix seconds
- [ ] All user ownership checks in place
- [ ] Unit tests pass

---

**Next:** Proceed to Phase 03 - API Layer

# 3. Repository Layer

This section describes the repository layer, responsible for abstracting data access and providing a clean interface for interacting with the database. This layer typically resides in `src/lib/repositories/{module-name}/`.

## Base Repository

It is common to have a base repository that provides generic CRUD (Create, Read, Update, Delete) operations, which can then be extended by entity-specific repositories.

## Entity-Specific Repositories

Each major entity within a module should have its own repository, extending the base repository and implementing methods specific to that entity.

### Expected Structure (Example for Tasks Module)

```typescript
// src/lib/repositories/tasks/tasksRepository.ts
import { db } from '$lib/server/db';
import { tasksTasks, type Task } from '$lib/server/db/schema/tasks/tables';
import { eq } from 'drizzle-orm';

export class TasksRepository {
	async getTaskById(id: string): Promise<Task | undefined> {
		return db.select().from(tasksTasks).where(eq(tasksTasks.id, id)).get();
	}

	async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
		const [newTask] = await db.insert(tasksTasks).values(task).returning();
		return newTask;
	}

	async updateTask(id: string, task: Partial<Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<Task | undefined> {
		const [updatedTask] = await db.update(tasksTasks).set(task).where(eq(tasksTasks.id, id)).returning();
		return updatedTask;
	}

	async deleteTask(id: string): Promise<void> {
		await db.delete(tasksTasks).where(eq(tasksTasks.id, id));
	}

	// ... other task-specific methods
}
```

## CRUD Operations

Each repository should provide methods for:

- **Create**: Adding new entities to the database.
- **Read**: Retrieving entities by ID, or fetching lists of entities with various filtering and sorting options.
- **Update**: Modifying existing entities.
- **Delete**: Removing entities from the database.

## Complex Queries

Repositories are also the place to implement more complex queries involving joins, aggregations, and custom filtering logic.

## Repository Patterns

- **Dependency Injection**: Repositories should ideally be instantiated with their dependencies (e.g., the database client) to facilitate testing and maintainability.
- **Error Handling**: Implement robust error handling within the repository methods to catch and manage database-related errors.
- **Type Safety**: Ensure all repository methods are fully type-safe, leveraging the TypeScript models defined in the previous step.

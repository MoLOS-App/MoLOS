# 4. API Endpoints

This section describes the structure and implementation of API endpoints for your module, typically located in `src/routes/api/{module-name}/`. These endpoints handle incoming requests, interact with the repository layer, and return appropriate responses.

## Main CRUD Endpoints

Each primary entity in your module should have a `+server.ts` file in its respective API directory to handle basic CRUD operations (GET, POST, PUT, DELETE).

### Example: Tasks Module - `src/routes/ui/MoLOS-Tasks/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TasksRepository } from '$lib/repositories/tasks/tasksRepository';
import { CreateTaskInput, UpdateTaskInput } from '$lib/models/tasks';

const tasksRepository = new TasksRepository();

export const GET: RequestHandler = async ({ url }) => {
	const userId = url.searchParams.get('userId');
	if (!userId) {
		return json({ message: 'User ID is required' }, { status: 400 });
	}
	const tasks = await tasksRepository.getTasksByUserId(userId);
	return json(tasks);
};

export const POST: RequestHandler = async ({ request }) => {
	const data: CreateTaskInput = await request.json();
	// Add validation here
	const newTask = await tasksRepository.createTask(data);
	return json(newTask, { status: 201 });
};

export const PUT: RequestHandler = async ({ url, request }) => {
	const id = url.searchParams.get('id');
	if (!id) {
		return json({ message: 'Task ID is required' }, { status: 400 });
	}
	const data: UpdateTaskInput = await request.json();
	const updatedTask = await tasksRepository.updateTask(id, data);
	if (!updatedTask) {
		return json({ message: 'Task not found' }, { status: 404 });
	}
	return json(updatedTask);
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) {
		return json({ message: 'Task ID is required' }, { status: 400 });
	}
	await tasksRepository.deleteTask(id);
	return json({ message: 'Task deleted' }, { status: 204 });
};
```

## Sub-entity Endpoints

For sub-entities or related resources, create subdirectories within the API route and define their `+server.ts` files accordingly.

### Example: `src/routes/ui/MoLOS-Tasks/projects/+server.ts`

```typescript
// Example for projects related to tasks
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ProjectsRepository } from '$lib/repositories/tasks/projectsRepository';

const projectsRepository = new ProjectsRepository();

export const GET: RequestHandler = async ({ url }) => {
	const userId = url.searchParams.get('userId');
	if (!userId) {
		return json({ message: 'User ID is required' }, { status: 400 });
	}
	const projects = await projectsRepository.getProjectsByUserId(userId);
	return json(projects);
};

// ... other CRUD operations for projects
```

## Authentication and Validation

- **Authentication**: All API endpoints should implement proper authentication to ensure only authorized users can access and modify data. This typically involves checking the `userId` from the session or request headers.
- **Validation**: Validate incoming request data against your TypeScript models to ensure data integrity and prevent invalid data from reaching the database.

## Error Handling

Implement comprehensive error handling to gracefully manage and respond to errors, providing meaningful error messages and appropriate HTTP status codes.

## API Patterns

- **RESTful Principles**: Design your API endpoints following RESTful principles for clear and predictable resource management.
- **Separation of Concerns**: Keep API logic focused on handling requests and responses, delegating business logic to services and data access to repositories.
- **Type Safety**: Leverage TypeScript to ensure type safety across your API, from request payloads to database interactions.

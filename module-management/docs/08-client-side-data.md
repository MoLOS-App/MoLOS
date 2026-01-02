# 8. Client-Side Data Management

This section details how client-side data management is handled within MoLOS modules, focusing on the use of Svelte stores for state management and data fetching. This pattern is evident in both the Tasks and Finance modules.

## Svelte Stores

Svelte stores are used to manage the state of the module's data on the client-side. These stores typically hold the main data entities, as well as UI-related states like loading indicators and error messages.

### Example: Tasks Module - `src/lib/stores/modules/tasks/index.ts` (Conceptual)

```typescript
import { writable } from 'svelte/store';
import type { Task, Project, Area, DailyLog } from '$lib/models/tasks';

interface TasksUIState {
	loading: boolean;
	error: string | null;
}

export const tasks = writable<Task[]>([]);
export const projects = writable<Project[]>([]);
export const areas = writable<Area[]>([]);
export const dailyLogs = writable<DailyLog[]>([]);
export const tasksUIState = writable<TasksUIState>({ loading: false, error: null });

export async function loadAllTasksData() {
	tasksUIState.update((state) => ({ ...state, loading: true, error: null }));
	try {
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 1000));
		// const fetchedTasks = await api.get('/ui/MoLOS-Tasks');
		// tasks.set(fetchedTasks);
		tasksUIState.update((state) => ({ ...state, loading: false }));
	} catch (err: any) {
		tasksUIState.update((state) => ({ ...state, loading: false, error: err.message }));
	}
}

// ... other data fetching and manipulation functions
```

## Derived Stores

Derived stores can be used to create computed values from existing stores, providing reactive data transformations without modifying the original data.

## Data Fetching Functions

Functions like `loadAllTasksData()` are responsible for orchestrating API calls, updating stores with fetched data, and managing loading/error states.

## Store Patterns

- **Centralized State**: Keep related data within a module's dedicated store files.
- **Loading and Error States**: Implement `loading` and `error` states within your UI stores to provide feedback to the user during data operations.
- **Asynchronous Operations**: Handle asynchronous data fetching operations gracefully, updating the UI state accordingly.
- **Type Safety**: Ensure all store operations are type-safe, leveraging the TypeScript models.

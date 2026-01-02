# 6. UI Components

This section focuses on the development of UI components specific to your module, typically located in `src/lib/components/modules/{module-name}/`. These components are built using Svelte and adhere to best practices for reusability, accessibility, and maintainability.

## Basic Entity Components

For each major entity in your module, you will likely have components responsible for displaying and interacting with a single instance of that entity. For example, a `TaskItem.svelte` for the Tasks module.

### Example: Tasks Module - `src/lib/components/modules/tasks/task-item.svelte`

```svelte
<script lang="ts">
	import type { Task } from '$lib/models/tasks';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';

	let { task }: { task: Task } = $props();

	function toggleCompletion() {
		task.isCompleted = !task.isCompleted;
		// Call an update function or dispatch an event
		console.log('Task completion toggled:', task);
	}
</script>

<div class="flex items-center space-x-2 rounded-md border p-4">
	<Checkbox checked={task.isCompleted} onCheckedChange={toggleCompletion} />
	<div class="flex-1">
		<h3 class="font-medium">{task.title}</h3>
		{#if task.description}
			<p class="text-muted-foreground text-sm">{task.description}</p>
		{/if}
		<div class="mt-2 flex items-center space-x-2">
			<Badge variant="secondary">{task.status}</Badge>
			<Badge variant="outline">{task.priority}</Badge>
		</div>
	</div>
</div>
```

## Dialog/Modal Forms

Components for creating or editing entities often take the form of dialogs or modals to provide a focused user experience.

## Component Patterns

- **Props**: Clearly define component props using `let { propName }: { propName: Type } = $props();` for type safety and clarity.
- **Event Handlers**: Use `on:eventName` to emit custom events for parent components to react to, promoting a clear separation of concerns.
- **Accessibility**: Design and implement components with accessibility in mind, using appropriate ARIA attributes and semantic HTML.
- **Reusability**: Strive to create reusable components that can be used across different parts of your module or even other modules.
- **Styling**: Utilize Tailwind CSS for consistent and efficient styling.

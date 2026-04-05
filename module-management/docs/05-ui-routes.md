# 5. UI Routes and Layout

This section details the structure and implementation of UI routes and layouts for your module, following the patterns observed in the Tasks and Finance modules. UI routes are typically located in `src/routes/ui/(modules)/{module-name}/`.

## Layout Server Loading

The `+layout.server.ts` file in the module's root UI directory is responsible for loading data that is common to all pages within the module. This data is then available to the layout and all child pages.

### Example: Tasks Module - `src/routes/ui/(modules)/tasks/+layout.server.ts`

```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Example: Load user-specific data or module configuration
	const userId = locals.user?.id; // Assuming user is available in locals
	// ... fetch data using repositories or services
	return {
		/* data to be passed to layout and pages */
	};
};
```

## Layout Structure

The `+layout.svelte` file defines the overall layout for the module, including common UI elements like navigation, headers, and footers. It also handles global loading and error states.

### Example: Tasks Module - `src/routes/ui/(modules)/tasks/+layout.svelte`

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadAllTasksData, tasksUIState } from '$lib/stores/modules/tasks';
	import { Loader2 } from 'lucide-svelte';

	let { children } = $props();

	onMount(async () => {
		await loadAllTasksData();
	});
</script>

<div class="flex h-full flex-col">
	{#if $tasksUIState.loading && !$tasksUIState.error}
		<div class="flex flex-1 items-center justify-center">
			<Loader2 class="h-8 w-8 animate-spin text-primary" />
		</div>
	{:else if $tasksUIState.error}
		<div class="flex flex-1 items-center justify-center p-4">
			<div
				class="max-w-md rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center text-destructive"
			>
				<h2 class="mb-2 font-bold">Error Loading Tasks Data</h2>
				<p class="text-sm">{$tasksUIState.error}</p>
				<button
					class="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
					onclick={() => loadAllTasksData()}
				>
					Retry
				</button>
			</div>
		</div>
	{:else}
		<div class="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
			{@render children()}
		</div>
	{/if}
</div>
```

## Dashboard Pages

Each module typically has a dashboard page (`dashboard/+page.svelte`) that serves as the main entry point for the module's UI, providing an overview of key information and functionalities.

## Index Redirects

The root `+page.svelte` of a module often redirects to its dashboard page, ensuring a consistent entry point.

### Example: Tasks Module - `src/routes/ui/(modules)/tasks/+page.svelte`

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(async () => {
		await goto('/ui/MoLOS-Tasks/dashboard');
	});
</script>

<div>Loading...</div>
```

## Other Module Pages

Subdirectories within the module's UI routes (`src/routes/ui/(modules)/{module-name}/`) are used to organize different pages and functionalities.

### Example: Tasks Module - `src/routes/ui/(modules)/tasks/projects/+page.svelte`

```svelte
<!-- Example content for a projects page --><h1>Projects</h1><p>List of projects goes here.</p>
```

## Route Patterns

- **Nested Routes**: Utilize SvelteKit's nested routing to create logical and organized UI structures.
- **Layouts**: Leverage `+layout.svelte` and `+layout.server.ts` for shared UI elements and data loading.
- **Client-Side Navigation**: Use `goto` for client-side navigation within the module.

<script lang="ts">
	/**
	 * Example usage of ModuleCard and ModuleGrid components
	 * This file demonstrates how to use the components in the welcome flow
	 */
	import ModuleGrid from '$lib/components/ui/module-grid/module-grid.svelte';
	import { MODULE_REGISTRY } from '$lib/config';

	// State management
	let selectedIds = $state(new Set(['dashboard', 'ai', 'MoLOS-Tasks']));
	let disabledIds = $state(new Set(['dashboard', 'ai']));

	// Toggle handler
	function handleToggle(moduleId: string) {
		if (selectedIds.has(moduleId)) {
			selectedIds.delete(moduleId);
		} else {
			selectedIds.add(moduleId);
		}
		// Trigger reactivity by creating a new Set
		selectedIds = new Set(selectedIds);
	}

	// Get all modules from registry
	const modules = Object.values(MODULE_REGISTRY);
</script>

<div class="p-6">
	<h1 class="mb-6 text-2xl font-bold">Module Selection Example</h1>

	<ModuleGrid {modules} {selectedIds} {disabledIds} onToggle={handleToggle} />

	<div class="mt-6">
		<h2 class="mb-2 font-bold">Selected Modules:</h2>
		<ul class="list-inside list-disc">
			{#each Array.from(selectedIds) as id}
				<li>{id}</li>
			{/each}
		</ul>
	</div>
</div>

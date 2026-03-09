<script lang="ts">
	import type { ModuleConfig } from '$lib/config/types';
	import { ModuleCard } from '$lib/components/ui/module-card';
	import { cn } from '$lib/utils';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface ModuleGridProps {
		modules: ModuleConfig[];
		selectedIds: Set<string>;
		disabledIds?: Set<string>;
		onToggle?: (moduleId: string) => void;
	}

	let { modules, selectedIds, disabledIds = new Set(), onToggle }: ModuleGridProps = $props();

	// Sort modules: disabled (mandatory) first, then alphabetically
	const sortedModules = $derived(
		[...modules].sort((a, b) => {
			const aDisabled = disabledIds.has(a.id);
			const bDisabled = disabledIds.has(b.id);

			// Disabled (mandatory) modules first
			if (aDisabled && !bDisabled) return -1;
			if (!aDisabled && bDisabled) return 1;

			// Then alphabetically by name
			return a.name.localeCompare(b.name);
		})
	);
</script>

<div
	class="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
	role="group"
	aria-label="Module selection"
>
	{#each sortedModules as module, index (module.id)}
		<div
			in:fly={{
				y: 20,
				duration: 300,
				delay: index * 50,
				easing: cubicOut
			}}
		>
			<ModuleCard
				{module}
				selected={selectedIds.has(module.id)}
				disabled={disabledIds.has(module.id)}
				onToggle={() => onToggle?.(module.id)}
			/>
		</div>
	{/each}
</div>

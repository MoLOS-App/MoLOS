<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { searchIcons } from '../utils/icon-packs.js';

	interface Props {
		selected?: string;
		searchQuery?: string;
		onSelect: (icon: string) => void;
	}

	let { selected, searchQuery = '', onSelect }: Props = $props();

	// Get filtered icons based on search
	let filteredIcons = $derived.by(() => {
		if (!searchQuery) {
			// Show all icons when no search
			return searchIcons('');
		}
		return searchIcons(searchQuery);
	});

	function handleIconSelect(iconId: string, packId: string) {
		onSelect(`${packId}-${iconId}`);
	}
</script>

{#if filteredIcons.length === 0}
	<div class="flex min-h-[200px] items-center justify-center text-center">
		<div class="space-y-2">
			<p class="text-muted-foreground text-sm">No icons found</p>
			<p class="text-muted-foreground text-xs">Try a different search term</p>
		</div>
	</div>
{:else}
	<div class="grid grid-cols-6 gap-1.5 p-1">
		{#each filteredIcons as icon (icon.id)}
			<button
				type="button"
				class={cn(
					'flex aspect-square items-center justify-center rounded-md border transition-colors',
					'hover:text-accent-foreground focus-visible:ring-ring hover:bg-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
					selected === `lucide-${icon.id}`
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border bg-background text-foreground'
				)}
				onclick={() => handleIconSelect(icon.id, 'lucide')}
				title={icon.id}
				aria-label={`Select ${icon.id} icon`}
			>
				<svelte:component this={icon.component} class="h-5 w-5" />
			</button>
		{/each}
	</div>
{/if}

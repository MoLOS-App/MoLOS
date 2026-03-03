<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { EMOJI_CATEGORIES, searchEmojis } from '../utils/emoji-data.js';

	interface Props {
		selected?: string;
		searchQuery?: string;
		onSelect: (emoji: string) => void;
	}

	let { selected, searchQuery = '', onSelect }: Props = $props();

	// When searching, show all matching emojis in a single grid
	// When not searching, show category tabs
	let isSearching = $derived(searchQuery.length > 0);

	// Get filtered emojis based on search
	let searchedEmojis = $derived.by(() => {
		if (!searchQuery) return [];
		return searchEmojis(searchQuery);
	});

	// Set default category
	let activeCategory = $state('people');

	// Reset to first category when search is cleared
	$effect(() => {
		if (!isSearching && EMOJI_CATEGORIES.length > 0) {
			activeCategory = EMOJI_CATEGORIES[0].id;
		}
	});
</script>

{#if isSearching}
	{#if searchedEmojis.length === 0}
		<div class="flex min-h-[200px] items-center justify-center text-center">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm">No emojis found</p>
				<p class="text-muted-foreground text-xs">Try a different search term</p>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-8 gap-1 p-1">
			{#each searchedEmojis as emoji}
				<button
					type="button"
					class={cn(
						'flex aspect-square items-center justify-center rounded-md border text-xl transition-colors',
						'hover:text-accent-foreground focus-visible:ring-ring hover:bg-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
						selected === emoji
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-border bg-background text-foreground'
					)}
					onclick={() => onSelect(emoji)}
					title={emoji}
					aria-label={`Select ${emoji} emoji`}
				>
					{emoji}
				</button>
			{/each}
		</div>
	{/if}
{:else}
	<Tabs.Root value={activeCategory} onValueChange={(v) => (activeCategory = v)}>
		<Tabs.List class="mb-2 flex-wrap gap-1">
			{#each EMOJI_CATEGORIES as category (category.id)}
				<Tabs.Trigger value={category.id} class="text-xs">
					{category.name}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		{#each EMOJI_CATEGORIES as category (category.id)}
			<Tabs.Content value={category.id} class="focus-visible:outline-none">
				<div class="grid grid-cols-8 gap-1 p-1">
					{#each category.emojis as emoji}
						<button
							type="button"
							class={cn(
								'flex aspect-square items-center justify-center rounded-md border text-xl transition-colors',
								'hover:text-accent-foreground focus-visible:ring-ring hover:bg-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
								selected === emoji
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-border bg-background text-foreground'
							)}
							onclick={() => onSelect(emoji)}
							title={emoji}
							aria-label={`Select ${emoji} emoji`}
						>
							{emoji}
						</button>
					{/each}
				</div>
			</Tabs.Content>
		{/each}
	</Tabs.Root>
{/if}

<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Search } from 'lucide-svelte';
	import IconPickerIcons from './icon-picker-icons.svelte';
	import IconPickerEmojis from './icon-picker-emojis.svelte';

	interface Props {
		selected?: string;
		onSelect: (icon: string) => void;
		enableEmojis?: boolean;
	}

	let { selected, onSelect, enableEmojis = true }: Props = $props();

	let searchQuery = $state('');
	let activeTab = $state<'icons' | 'emojis'>('icons');

	// Clear search
	function clearSearch() {
		searchQuery = '';
	}
</script>

<Tabs.Root value={activeTab} onValueChange={(v) => (activeTab = v as 'icons' | 'emojis')}>
	<!-- Tabs List -->
	{#if enableEmojis}
		<Tabs.List class="mb-3">
			<Tabs.Trigger value="icons">Icons</Tabs.Trigger>
			<Tabs.Trigger value="emojis">Emojis</Tabs.Trigger>
		</Tabs.List>
	{/if}

	<!-- Header -->
	<div class="mb-3 flex items-center gap-2">
		<Search class="text-muted-foreground h-4 w-4" />
		<span class="text-sm font-medium">Choose icon</span>
	</div>

	<!-- Search Input -->
	<div class="relative mb-3">
		<Input
			type="text"
			placeholder="Search icons or emojis..."
			bind:value={searchQuery}
			class="pl-9"
		/>
		{#if searchQuery}
			<button
				onclick={clearSearch}
				class="text-muted-foreground absolute top-2.5 right-2.5 h-5 w-5 rounded-full hover:bg-muted hover:text-foreground"
				aria-label="Clear search"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Icons Tab -->
	<Tabs.Content value="icons" class="focus-visible:outline-none">
		<IconPickerIcons {selected} {searchQuery} {onSelect} />
	</Tabs.Content>

	<!-- Emojis Tab -->
	{#if enableEmojis}
		<Tabs.Content value="emojis" class="focus-visible:outline-none">
			<IconPickerEmojis {selected} {searchQuery} {onSelect} />
		</Tabs.Content>
	{/if}
</Tabs.Root>

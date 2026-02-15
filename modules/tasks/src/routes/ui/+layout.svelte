<script lang="ts">
	import { loadAllTasksData, tasksUIState } from '$lib/stores/external_modules/MoLOS-Tasks/tasks.store';
	import { Loader2 } from 'lucide-svelte';

	let { children } = $props();
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

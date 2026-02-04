<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import type { ProgressState } from './progress-types';
	import { getLogEntryIcon, getLogEntryClasses, getEntryDuration } from './progress-types';

	let { progress }: { progress: ProgressState } = $props();

	let logContainer: HTMLElement;
	let lastLogLength = $state(0);

	// Auto-scroll to bottom when new entries are added
	$effect(() => {
		const logLength = progress.executionLog.length;
		if (logLength > lastLogLength && logContainer) {
			lastLogLength = logLength;
			// Scroll to bottom smoothly
			logContainer.scrollTo({
				top: logContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	});

	// Set initial lastLogLength
	$effect(() => {
		lastLogLength = progress.executionLog.length;
	});
</script>

{#if progress.executionLog.length > 0}
	<div class="rounded-xl border border-border/50 bg-muted/20 p-3" in:fade>
		<div class="mb-2 flex items-center justify-between">
			<span class="text-xs font-semibold uppercase text-muted-foreground">
				Execution Log
			</span>
			<span class="text-muted-foreground text-[10px]">
				{progress.executionLog.length} {progress.executionLog.length === 1 ? 'entry' : 'entries'}
			</span>
		</div>
		<div class="max-h-64 space-y-1 overflow-y-auto" bind:this={logContainer}>
			{#each progress.executionLog as entry (entry.id)}
				<div class={getLogEntryClasses(entry.type)}>
					<span class="flex-shrink-0">{getLogEntryIcon(entry.type)}</span>
					<span class="flex-1">{entry.message}</span>
					{#if getEntryDuration(entry)}
						<span class="text-muted-foreground/60 text-[10px]">{getEntryDuration(entry)}</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

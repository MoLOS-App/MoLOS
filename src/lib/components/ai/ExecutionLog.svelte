<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ProgressState } from './progress-types';
	import { getLogEntryIcon, getLogEntryClasses } from './progress-types';

	let { progress }: { progress: ProgressState } = $props();
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
		<div class="max-h-64 space-y-1 overflow-y-auto">
			{#each progress.executionLog as entry (entry.id)}
				<div class={getLogEntryClasses(entry.type)}>
					<span class="flex-shrink-0">{getLogEntryIcon(entry.type)}</span>
					<span class="flex-1">{entry.message}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

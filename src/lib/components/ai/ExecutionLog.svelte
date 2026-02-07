<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { ProgressState } from './progress-types';
	import { getLogEntryIcon, getLogEntryClasses, getEntryDuration } from './progress-types';
	import ExecutionLogActions from './ExecutionLogActions.svelte';

	let {
		progress,
		onRetry
	}: {
		progress: ProgressState;
		onRetry?: (failedSteps: typeof progress.executionLog) => void;
	} = $props();

	let logContainer: HTMLElement;
	let lastLogLength = $state(0);

	// Track expanded entries
	let expandedEntries = $state<Set<string>>(new Set());

	function toggleExpand(entryId: string) {
		if (expandedEntries.has(entryId)) {
			expandedEntries.delete(entryId);
		} else {
			expandedEntries.add(entryId);
		}
		expandedEntries = new Set(expandedEntries);
	}

	function isExpanded(entryId: string): boolean {
		return expandedEntries.has(entryId);
	}

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

	// Format value for display
	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return 'N/A';
		if (typeof value === 'object') return JSON.stringify(value, null, 2);
		return String(value);
	}

	// Check if entry has expandable details
	function hasDetails(entry: (typeof progress.executionLog)[0]): boolean {
		return !!(entry.toolName || entry.parameters || entry.result || entry.errorDetail);
	}
</script>

{#if progress.executionLog.length > 0}
	<div class="rounded-xl border border-border/50 bg-muted/20 p-3" in:fade>
		<div class="mb-2 flex items-center justify-between">
			<span class="text-muted-foreground text-xs font-semibold uppercase"> Execution Log </span>
			<span class="text-muted-foreground text-[10px]">
				{progress.executionLog.length}
				{progress.executionLog.length === 1 ? 'entry' : 'entries'}
			</span>
		</div>
		<div class="max-h-64 space-y-1 overflow-y-auto" bind:this={logContainer}>
			{#each progress.executionLog as entry (entry.id)}
				<div>
					<!-- Main entry row (clickable if has details) -->
					<div
						class={getLogEntryClasses(entry.type)}
						class:cursor-pointer={hasDetails(entry)}
						onclick={() => hasDetails(entry) && toggleExpand(entry.id)}
						role={hasDetails(entry) ? 'button' : undefined}
						tabindex={hasDetails(entry) ? 0 : undefined}
					>
						<span class="flex-shrink-0">
							{#if hasDetails(entry)}
								{#if isExpanded(entry.id)}
									<ChevronDown class="h-3 w-3" />
								{:else}
									<ChevronRight class="h-3 w-3" />
								{/if}
							{:else}
								<span class="inline-block w-3 text-center">{getLogEntryIcon(entry.type)}</span>
							{/if}
						</span>
						<span class="flex-1">{entry.message}</span>
						{#if getEntryDuration(entry)}
							<span class="text-muted-foreground/60 text-[10px]">{getEntryDuration(entry)}</span>
						{/if}
					</div>

					<!-- Expanded details -->
					{#if isExpanded(entry.id) && hasDetails(entry)}
						<div class="mt-1 ml-6 space-y-1 border-l-2 border-border/40 pl-3 text-[11px]">
							{#if entry.toolName}
								<div class="text-muted-foreground flex items-center gap-2">
									<span class="font-medium">Tool:</span>
									<span class="font-mono text-foreground">{entry.toolName}</span>
								</div>
							{/if}
							{#if entry.parameters && Object.keys(entry.parameters).length > 0}
								<div class="space-y-1">
									<div class="text-muted-foreground font-medium">Parameters:</div>
									<div class="rounded border border-border/50 bg-background/50 p-2">
										<pre
											class="overflow-x-auto font-mono text-[10px] whitespace-pre-wrap text-foreground">{JSON.stringify(
												entry.parameters,
												null,
												2
											)}</pre>
									</div>
								</div>
							{/if}
							{#if entry.result !== undefined}
								<div class="space-y-1">
									<div class="text-muted-foreground font-medium">Result:</div>
									<div class="rounded border border-border/50 bg-background/50 p-2">
										<pre
											class="overflow-x-auto font-mono text-[10px] whitespace-pre-wrap text-foreground">{formatValue(
												entry.result
											)}</pre>
									</div>
								</div>
							{/if}
							{#if entry.errorDetail}
								<div class="space-y-1">
									<div class="font-medium text-destructive">Error:</div>
									<div class="rounded border border-destructive/50 bg-destructive/5 p-2">
										<pre
											class="overflow-x-auto font-mono text-[10px] whitespace-pre-wrap text-destructive">{entry.errorDetail}</pre>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Actions (Export, Retry) -->
	<ExecutionLogActions {progress} {onRetry} />
{/if}

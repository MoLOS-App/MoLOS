<script lang="ts">
	import { fade } from 'svelte/transition';
	import { RotateCcw, Download } from 'lucide-svelte';
	import type { ProgressState, ExecutionLogEntry } from './progress-types';

	let { progress, onRetry }: {
		progress: ProgressState;
		onRetry?: (failedSteps: ExecutionLogEntry[]) => void;
	} = $props();

	// Count failed steps
	const failedSteps = $derived(
		progress.executionLog.filter((e) => e.type === 'error' || e.type === 'warning')
	);

	const hasFailures = $derived(failedSteps().length > 0);
	const isComplete = $derived(progress.status === 'complete' || progress.status === 'error');

	// Only show actions when execution is complete and has failures
	const showActions = $derived(isComplete && hasFailures);

	async function retryFailedSteps() {
		if (onRetry) {
			await onRetry(failedSteps());
		}
	}

	async function exportLog() {
		// Create export data
		const exportData = {
			timestamp: new Date().toISOString(),
			planGoal: progress.planGoal,
			totalSteps: progress.totalSteps,
			status: progress.status,
			entries: progress.executionLog.map((entry) => ({
				id: entry.id,
				type: entry.type,
				message: entry.message,
				step: entry.step,
				total: entry.total,
				timestamp: new Date(entry.timestamp).toISOString(),
				startTime: entry.startTime ? new Date(entry.startTime).toISOString() : undefined,
				endTime: entry.endTime ? new Date(entry.endTime).toISOString() : undefined,
				duration: entry.startTime && entry.endTime ? (entry.endTime - entry.startTime) : undefined,
				toolName: entry.toolName,
				parameters: entry.parameters,
				result: entry.result,
				errorDetail: entry.errorDetail
			}))
		};

		// Create blob and download
		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `execution-log-${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

{#if showActions}
	<div class="mt-3 flex items-center justify-between border-t border-border/40 pt-3" in:fade>
		<div class="text-muted-foreground text-[10px]">
			{failedSteps().length} {failedSteps().length === 1 ? 'step' : 'steps'} failed
		</div>
		<div class="flex items-center gap-2">
			<!-- Export Button -->
			<button
				onclick={exportLog}
				class="focus-visible:ring-ring flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/90 focus-visible:ring-2 focus-visible:ring-offset-2"
				title="Export execution log as JSON"
			>
				<Download class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Export</span>
			</button>

			<!-- Retry Button -->
			<button
				onclick={retryFailedSteps}
				class="focus-visible:ring-ring flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/90 focus-visible:ring-2 focus-visible:ring-offset-2"
				title="Retry failed steps"
			>
				<RotateCcw class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Retry Failed</span>
			</button>
		</div>
	</div>
{/if}

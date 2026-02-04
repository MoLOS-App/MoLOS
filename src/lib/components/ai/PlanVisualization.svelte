<script lang="ts">
	import { fade } from 'svelte/transition';
	import { ListChecks, Circle, CheckCircle2, XCircle, LoaderCircle } from 'lucide-svelte';
	import type { ExecutionLogEntry } from './progress-types';
	import { getEntryDuration } from './progress-types';

	interface PlanStep {
		id: string;
		stepNumber: number;
		totalSteps: number;
		description: string;
		status: 'pending' | 'in_progress' | 'completed' | 'failed';
		timestamp?: number;
		duration?: string;
	}

	let { executionLog, goal, totalSteps }: {
		executionLog: ExecutionLogEntry[];
		goal?: string;
		totalSteps?: number;
	} = $props();

	// Build plan steps from execution log
	const planSteps = $derived(() => {
		const steps = new Map<number, PlanStep>();

		for (const entry of executionLog) {
			if (entry.step !== undefined && entry.total !== undefined) {
				const existing = steps.get(entry.step);
				if (!existing) {
					// Determine status from entry type
					let status: PlanStep['status'] = 'pending';
					if (entry.type === 'success') status = 'completed';
					else if (entry.type === 'error') status = 'failed';
					else if (entry.type === 'pending') status = 'in_progress';

					steps.set(entry.step, {
						id: entry.id,
						stepNumber: entry.step,
						totalSteps: entry.total,
						description: entry.message.replace(/^\[\d+\/\d+\]\s*[✓✗⟳]\s*/, ''),
						status,
						timestamp: entry.timestamp,
						duration: getEntryDuration(entry)
					});
				} else {
					// Update status and duration if we have newer info
					if (entry.type === 'success') {
						existing.status = 'completed';
						existing.duration = getEntryDuration(entry);
					} else if (entry.type === 'error') {
						existing.status = 'failed';
						existing.duration = getEntryDuration(entry);
					} else if (entry.type === 'pending') {
						existing.status = 'in_progress';
					}
				}
			}
		}

		return Array.from(steps.values()).sort((a, b) => a.stepNumber - b.stepNumber);
	});

	const completedCount = $derived(
		planSteps().filter((s) => s.status === 'completed').length
	);
	const failedCount = $derived(planSteps().filter((s) => s.status === 'failed').length);
	const inProgressCount = $derived(
		planSteps().filter((s) => s.status === 'in_progress').length
	);

	function getStepIcon(step: PlanStep) {
		switch (step.status) {
			case 'completed':
				return CheckCircle2;
			case 'failed':
				return XCircle;
			case 'in_progress':
				return LoaderCircle;
			default:
				return Circle;
		}
	}

	function getStepIconClasses(step: PlanStep): string {
		const base = 'h-4 w-4 flex-shrink-0';
		switch (step.status) {
			case 'completed':
				return `${base} text-green-600 dark:text-green-400`;
			case 'failed':
				return `${base} text-destructive`;
			case 'in_progress':
				return `${base} text-primary animate-spin`;
			default:
				return `${base} text-muted-foreground`;
		}
	}
</script>

{#if planSteps().length > 0}
	<div class="rounded-xl border border-border/50 bg-muted/20 p-3" in:fade>
		<div class="mb-3 flex items-center gap-2">
			<ListChecks class="h-4 w-4 text-muted-foreground" />
			<span class="text-xs font-semibold uppercase text-muted-foreground">
				Plan
			</span>
			{#if goal}
				<span class="text-muted-foreground text-[10px]">· {goal}</span>
			{/if}
		</div>

		<!-- Progress bar -->
		{#if totalSteps}
			<div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
				<div
					class="h-full bg-primary transition-all duration-300"
					style="width: {(completedCount / totalSteps) * 100}%"
				></div>
			</div>
		{/if}

		<!-- Step list -->
		<div class="space-y-1.5">
			{#each planSteps() as step (step.id)}
				<div
					class="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/40 {step.status ===
					'failed'
						? 'text-destructive'
						: step.status === 'completed'
							? 'text-green-600 dark:text-green-400'
							: step.status === 'in_progress'
								? 'text-foreground'
								: 'text-muted-foreground'}"
				>
					<svelte:component this={getStepIcon(step)} class={getStepIconClasses(step)} />
					<span class="flex-1">
						[{step.stepNumber}/{step.totalSteps}] {step.description}
					</span>
					{#if step.duration}
						<span class="text-muted-foreground/60 text-[10px]">{step.duration}</span>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Summary -->
		<div class="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
			<span>
				{completedCount}/{planSteps().length} completed
				{#if failedCount > 0}
					, {failedCount} failed
				{/if}
			</span>
			{#if inProgressCount > 0}
				<span class="flex items-center gap-1">
					<LoaderCircle class="h-3 w-3 animate-spin" />
					In progress
				</span>
			{/if}
		</div>
	</div>
{/if}

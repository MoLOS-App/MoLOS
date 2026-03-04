<script lang="ts">
	/**
	 * Progress indicator for verification challenges
	 * Shows current challenge number and total, with visual progress dots
	 */
	import { cn } from '$lib/utils.js';
	import { Check, X } from 'lucide-svelte';
	import type { ProgressIndicatorProps } from '../types.js';

	interface Props extends ProgressIndicatorProps {
		class?: string;
	}

	let { current, total, results, class: className }: Props = $props();

	const progressText = $derived(`${current} of ${total}`);
	const progressPercent = $derived((current / total) * 100);

	function getResultForChallenge(index: number) {
		return results[index];
	}
</script>

<div class={cn('space-y-3', className)}>
	<!-- Progress text -->
	<div class="flex items-center justify-between text-sm">
		<span class="text-muted-foreground font-medium">Challenge {progressText}</span>
		<span class="text-muted-foreground">{Math.round(progressPercent)}% complete</span>
	</div>

	<!-- Progress bar -->
	<div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
		<div
			class="h-full bg-primary transition-all duration-300 ease-out"
			style="width: {progressPercent}%"
		/>
	</div>

	<!-- Challenge dots -->
	<div class="flex items-center justify-center gap-2">
		{#each Array(total) as _, index}
			{@const result = getResultForChallenge(index)}
			{@const isCurrent = index === current - 1}
			{@const isCompleted = index < current - 1}

			<div
				class={cn(
					'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
					'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
					isCurrent && 'border-primary bg-primary/10',
					isCompleted && !result?.passed && 'border-destructive bg-destructive/10',
					isCompleted && result?.passed && 'border-green-500 bg-green-500/10',
					!isCurrent && !isCompleted && 'border-muted bg-background'
				)}
				aria-label="Challenge {index + 1}"
			>
				{#if isCompleted}
					{#if result?.passed}
						<Check class="h-4 w-4 text-green-500" />
					{:else}
						<X class="h-4 w-4 text-destructive" />
					{/if}
				{:else if isCurrent}
					<span class="font-semibold text-primary">{index + 1}</span>
				{:else}
					<span class="text-muted-foreground">{index + 1}</span>
				{/if}
			</div>
		{/each}
	</div>
</div>

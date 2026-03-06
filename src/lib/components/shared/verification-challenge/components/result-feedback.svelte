<script lang="ts">
	/**
	 * Result feedback component
	 * Shows success/error messages after challenge completion
	 */
	import { cn } from '$lib/utils.js';
	import { CheckCircle2, XCircle, AlertCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { ResultFeedbackProps } from '../types.js';

	interface Props extends ResultFeedbackProps {
		class?: string;
	}

	let { result, showRetry = false, onRetry, onNext, class: className }: Props = $props();

	const isSuccess = $derived(result?.passed === true);
	const isFailure = $derived(result?.passed === false);
</script>

{#if result}
	<div
		class={cn(
			'flex items-center gap-4 rounded-lg border p-4 transition-all',
			isSuccess && 'border-green-500/50 bg-green-500/10',
			isFailure && 'border-destructive/50 bg-destructive/10',
			className
		)}
		role="alert"
	>
		<!-- Icon -->
		<div
			class={cn(
				'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
				isSuccess && 'bg-green-500/20',
				isFailure && 'bg-destructive/20'
			)}
		>
			{#if isSuccess}
				<CheckCircle2 class="h-5 w-5 text-green-500" />
			{:else if isFailure}
				<XCircle class="h-5 w-5 text-destructive" />
			{/if}
		</div>

		<!-- Content -->
		<div class="flex-1">
			{#if isSuccess}
				<p class="font-semibold text-green-700 dark:text-green-400">Correct!</p>
				<p class="text-sm text-green-600 dark:text-green-300">Great job, keep going.</p>
			{:else if isFailure}
				<p class="font-semibold text-destructive">Incorrect</p>
				<p class="text-sm text-destructive/80">
					{#if showRetry}
						Would you like to try again?
					{:else}
						You can try again.
					{/if}
				</p>
			{/if}
		</div>

		<!-- Actions -->
		{#if isFailure && showRetry && onRetry}
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={onRetry}>Retry</Button>
				{#if onNext}
					<Button variant="ghost" size="sm" onclick={onNext}>Skip</Button>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<script lang="ts">
	/**
	 * Challenge display component
	 * Shows the current challenge question and handles user interaction
	 */
	import { cn } from '$lib/utils.js';
	import { Lightbulb, HelpCircle } from 'lucide-svelte';
	import ChallengeInput from './challenge-input.svelte';
	import type { Challenge, ChallengeResult } from '../types.js';

	interface Props {
		challenge: Challenge;
		userAnswer?: string | string[];
		result?: ChallengeResult | null;
		onAnswerChange: (answer: string | string[]) => void;
		onSubmit: () => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		challenge,
		userAnswer = '',
		result = null,
		onAnswerChange,
		onSubmit,
		disabled = false,
		class: className
	}: Props = $props();

	// Determine if showing memory phase
	const isMemoryChallenge = $derived(challenge.type === 'memory');
	const memoryPhase = $derived(isMemoryChallenge ? (challenge.metadata?.phase as string) : null);
	const showMemoryItems = $derived(memoryPhase === 'memorize');

	function getDifficultyColor(difficulty: string) {
		switch (difficulty) {
			case 'easy':
				return 'text-green-600 dark:text-green-400';
			case 'medium':
				return 'text-yellow-600 dark:text-yellow-400';
			case 'hard':
				return 'text-red-600 dark:text-red-400';
			default:
				return 'text-muted-foreground';
		}
	}
</script>

<div class={cn('space-y-6', className)}>
	<!-- Challenge header -->
	<div class="space-y-2">
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<h3 class="text-lg leading-tight font-semibold">{challenge.question}</h3>
				{#if challenge.metadata?.hint}
					<p class="text-muted-foreground mt-1 text-sm">{challenge.metadata.hint}</p>
				{/if}
			</div>
			<span class={cn('text-sm font-medium capitalize', getDifficultyColor(challenge.difficulty))}>
				{challenge.difficulty}
			</span>
		</div>

		<!-- Memory challenge special display -->
		{#if showMemoryItems && challenge.metadata?.items && Array.isArray(challenge.metadata.items)}
			<div class="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
				<div class="mb-2 flex items-center gap-2">
					<Lightbulb class="h-4 w-4 text-primary" />
					<span class="text-sm font-medium text-primary">Memorize these items:</span>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each challenge.metadata.items as item}
						<span class="rounded-md bg-primary/10 px-3 py-1.5 text-base font-medium text-primary">
							{item}
						</span>
					{/each}
				</div>
			</div>
		{:else if isMemoryChallenge && memoryPhase === 'recall'}
			<div class="rounded-lg bg-muted/50 p-3">
				<div class="flex items-center gap-2">
					<HelpCircle class="text-muted-foreground h-4 w-4" />
					<span class="text-muted-foreground text-sm">
						{challenge.metadata?.recallQuestion || 'What was asked?'}
					</span>
				</div>
			</div>
		{/if}

		<!-- Logic challenge scenario -->
		{#if challenge.type === 'logic' && challenge.metadata?.scenario}
			<div class="rounded-lg bg-muted/50 p-4">
				<p class="text-sm italic">{challenge.metadata.scenario}</p>
			</div>
		{/if}
	</div>

	<!-- Challenge input -->
	<ChallengeInput
		{challenge}
		value={userAnswer}
		onValueChange={onAnswerChange}
		{onSubmit}
		{disabled}
	/>
</div>

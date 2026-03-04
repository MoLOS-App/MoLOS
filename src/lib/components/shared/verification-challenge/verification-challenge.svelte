<script lang="ts">
	/**
	 * Main verification challenge modal component
	 * Orchestrates the challenge flow and manages session state
	 */
	import { cn } from '$lib/utils.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChallengeDisplay from './components/challenge-display.svelte';
	import ProgressIndicator from './components/progress-indicator.svelte';
	import ResultFeedback from './components/result-feedback.svelte';
	import { createConfig } from './config.js';
	import { challengeRegistry } from './challenges/index.js';
	import { generateChallengeSession } from './utils/randomizer.js';
	import type { VerificationChallengeProps, VerificationSession, Challenge } from './types.js';

	console.log('VerificationChallenge component loaded');
	console.log('Challenge registry size on load:', challengeRegistry?.size);

	interface Props extends VerificationChallengeProps {}

	let {
		open = $bindable(false),
		onVerified,
		onCancelled,
		onChallengeComplete,
		config: userConfig,
		class: className
	}: Props = $props();

	// Configuration
	const config = $derived(createConfig(userConfig));

	// Session state
	let session = $state<VerificationSession | null>(null);
	let currentChallenge = $derived<Challenge | null>(
		session && session.challenges && session.challenges.length > 0
			? session.challenges[session.currentIndex]
			: null
	);
	let userAnswer = $state<string | string[]>('');
	let isSubmitting = $state(false);
	let lastResult = $state<{ passed: boolean; challengeId: string } | null>(null);

	// Derived state
	const isVerified = $derived(session?.status === 'verified');
	const isInvalid = $derived(session?.status === 'invalid');
	const canProceed = $derived(isVerified && session !== null);

	// Initialize session when modal opens
	function initializeSession() {
		try {
			console.log('Initializing verification session...');
			console.log('Config:', config);
			console.log('Challenge registry size:', challengeRegistry.size);

			const challenges = generateChallengeSession(challengeRegistry, config);
			console.log('Generated challenges:', challenges);

			if (challenges.length === 0) {
				console.error('No challenges generated');
				return;
			}
			session = {
				challenges,
				currentIndex: 0,
				results: [],
				status: 'pending'
			};
			userAnswer = '';
			lastResult = null;
			isSubmitting = false;
			console.log('Session initialized successfully');
		} catch (error) {
			console.error('Failed to initialize session:', error);
		}
	}

	// Track open state changes
	$effect(() => {
		console.log('Effect running, open:', open, 'session:', session?.status);

		if (open) {
			// Modal is open - initialize session if not already initialized
			if (!session || session.status === 'cancelled') {
				initializeSession();
			}
		} else {
			// Modal is closed - reset if not verified
			if (session && session.status !== 'verified') {
				session.status = 'cancelled';
				onCancelled?.();
			}
		}
	});

	// Handle answer submission
	async function handleSubmit() {
		if (!currentChallenge || isSubmitting) return;

		isSubmitting = true;

		// Validate answer
		const passed = currentChallenge.validator(userAnswer);

		// Record result
		const result = {
			challengeId: currentChallenge.id,
			passed,
			userAnswer,
			timestamp: new Date()
		};

		session?.results.push(result);
		lastResult = { passed, challengeId: currentChallenge.id };

		// Notify callback
		onChallengeComplete?.(result);

		// Handle pass/fail
		if (passed) {
			// Move to next challenge or complete
			if (session && session.currentIndex < session.challenges.length - 1) {
				// Brief delay to show success
				await new Promise((resolve) => setTimeout(resolve, 500));
				session.currentIndex++;
				userAnswer = '';
				lastResult = null;
			} else {
				// All challenges complete
				session!.status = 'verified';
			}
		} else {
			// Challenge failed
			session!.status = 'invalid';
		}

		isSubmitting = false;
	}

	// Handle retry
	function handleRetry() {
		if (!session) return;

		// Remove the last failed result for the current challenge
		if (session.results.length > 0) {
			const lastResult = session.results[session.results.length - 1];
			if (lastResult.challengeId === currentChallenge?.id && !lastResult.passed) {
				session.results.pop();
			}
		}

		session.status = 'pending';
		userAnswer = '';
		lastResult = null;
	}

	// Handle cancel
	function handleCancel() {
		if (session) {
			session.status = 'cancelled';
		}
		onCancelled?.();
	}

	// Handle verified action
	function handleProceed() {
		onVerified?.();
	}

	// Update user answer
	function handleAnswerChange(answer: string | string[]) {
		userAnswer = answer;
	}

	// Get current result for feedback
	const currentResult = $derived(() => {
		if (!session || session.results.length === 0) return null;
		if (!lastResult) return null;

		// Find the MOST RECENT result for the current challenge (in case of retries)
		for (let i = session.results.length - 1; i >= 0; i--) {
			if (session.results[i].challengeId === lastResult!.challengeId) {
				return session.results[i];
			}
		}
		return null;
	});
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content class={cn('max-w-2xl', className)}>
		<AlertDialog.Header>
			<AlertDialog.Title>{config.title}</AlertDialog.Title>
			<AlertDialog.Description>{config.description}</AlertDialog.Description>
		</AlertDialog.Header>

		{#if session && currentChallenge}
			<div class="space-y-6">
				<!-- Progress indicator -->
				<ProgressIndicator
					current={session.currentIndex + 1}
					total={session.challenges.length}
					results={session.results}
				/>

				<!-- Challenge display -->
				<ChallengeDisplay
					challenge={currentChallenge}
					{userAnswer}
					result={currentResult()}
					onAnswerChange={handleAnswerChange}
					onSubmit={handleSubmit}
					disabled={isSubmitting || isVerified}
				/>

				<!-- Result feedback -->
				{#if lastResult && currentResult()}
					<ResultFeedback
						result={currentResult()!}
						showRetry={isInvalid && config.maxRetries === 'unlimited'}
						onRetry={handleRetry}
					/>
				{/if}
			</div>

			<AlertDialog.Footer class="flex-col gap-2 sm:flex-row">
				<!-- Cancel button is ALWAYS visible and clickable -->
				<AlertDialog.Cancel onclick={handleCancel} class="order-last sm:order-first">
					{config.cancelText}
				</AlertDialog.Cancel>

				{#if !isVerified && !isInvalid}
					<Button
						variant="default"
						onclick={handleSubmit}
						disabled={isSubmitting ||
							!userAnswer ||
							(Array.isArray(userAnswer) && userAnswer.length === 0)}
					>
						{#if isSubmitting}
							Submitting...
						{:else}
							Submit Answer
						{/if}
					</Button>
				{:else if isInvalid}
					<Button variant="destructive" onclick={handleRetry}>Try Again</Button>
				{:else if isVerified}
					<Button variant="default" onclick={handleProceed}>
						{config.confirmText}
					</Button>
				{/if}
			</AlertDialog.Footer>
		{:else}
			<div class="flex flex-col items-center justify-center gap-4 py-8">
				<p class="text-muted-foreground">Loading challenges...</p>
				<p class="text-muted-foreground text-xs">
					Session: {session ? 'exists' : 'null'} | Registry: {challengeRegistry?.size ?? 0} challenges
				</p>
			</div>
			<AlertDialog.Footer>
				<AlertDialog.Cancel onclick={handleCancel}>
					{config.cancelText}
				</AlertDialog.Cancel>
			</AlertDialog.Footer>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>

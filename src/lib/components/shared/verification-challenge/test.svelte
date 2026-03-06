<script lang="ts">
	/**
	 * Demo page for Verification Challenge Component
	 * Shows how to use the component with different configurations
	 */
	import VerificationChallenge from './index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Trash2, Settings, AlertTriangle } from 'lucide-svelte';

	// State for different verification scenarios
	let showDeleteVerification = $state(false);
	let showSettingsVerification = $state(false);
	let showCustomVerification = $state(false);

	// Track results for demo
	let lastAction = $state<string>('');

	function handleDeleteVerified() {
		lastAction = '✅ Delete action verified and executed!';
		showDeleteVerification = false;
	}

	function handleSettingsVerified() {
		lastAction = '✅ Settings change verified and applied!';
		showSettingsVerification = false;
	}

	function handleCustomVerified() {
		lastAction = '✅ Custom action verified with 3 challenges!';
		showCustomVerification = false;
	}

	function handleCancelled() {
		lastAction = '❌ Verification cancelled by user';
	}

	function handleChallengeComplete(result: any) {
		console.log('Challenge completed:', result);
	}
</script>

<div class="container mx-auto max-w-4xl space-y-8 p-8">
	<div class="space-y-2">
		<h1 class="text-3xl font-bold">Verification Challenge Component Demo</h1>
		<p class="text-muted-foreground">
			Interactive demo showing different usage patterns for the verification challenge system.
		</p>
	</div>

	<!-- Last action feedback -->
	{#if lastAction}
		<div class="rounded-lg border-2 border-primary/20 bg-primary/10 p-4">
			<p class="font-medium">{lastAction}</p>
		</div>
	{/if}

	<!-- Demo scenarios -->
	<div class="grid gap-6">
		<!-- Scenario 1: Delete Action -->
		<div class="space-y-4 rounded-lg border p-6">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-semibold">1. Delete Action (Default Config)</h2>
					<p class="text-muted-foreground mt-1">
						Basic setup with 2 random challenges of any type and difficulty
					</p>
				</div>
				<Button variant="destructive" onclick={() => (showDeleteVerification = true)}>
					<Trash2 class="h-4 w-4" />
					Delete Item
				</Button>
			</div>

			<div class="text-muted-foreground space-y-1 text-sm">
				<p>• <strong>Challenges:</strong> 2 (random types)</p>
				<p>• <strong>Difficulty:</strong> Random (50% easy, 35% medium, 15% hard)</p>
				<p>• <strong>Retries:</strong> Unlimited</p>
			</div>
		</div>

		<!-- Scenario 2: Settings Change -->
		<div class="space-y-4 rounded-lg border p-6">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-semibold">2. Settings Change (Easy Only)</h2>
					<p class="text-muted-foreground mt-1">
						Only easy challenges for less disruptive verification
					</p>
				</div>
				<Button variant="default" onclick={() => (showSettingsVerification = true)}>
					<Settings class="h-4 w-4" />
					Change Settings
				</Button>
			</div>

			<div class="text-muted-foreground space-y-1 text-sm">
				<p>• <strong>Challenges:</strong> 2 (easy difficulty only)</p>
				<p>• <strong>Types:</strong> Math, text-input, multiple-choice</p>
				<p>• <strong>Custom:</strong> Title and description</p>
			</div>
		</div>

		<!-- Scenario 3: Custom Configuration -->
		<div class="space-y-4 rounded-lg border p-6">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-xl font-semibold">3. High Security (3 Challenges)</h2>
					<p class="text-muted-foreground mt-1">
						More challenges with harder difficulty for critical actions
					</p>
				</div>
				<Button variant="outline" onclick={() => (showCustomVerification = true)}>
					<AlertTriangle class="h-4 w-4" />
					Critical Action
				</Button>
			</div>

			<div class="text-muted-foreground space-y-1 text-sm">
				<p>• <strong>Challenges:</strong> 3 (harder weighting)</p>
				<p>• <strong>Difficulty:</strong> 20% easy, 40% medium, 40% hard</p>
				<p>• <strong>Custom:</strong> Specific challenge types only</p>
			</div>
		</div>

		<!-- Challenge Types Reference -->
		<div class="space-y-4 rounded-lg border p-6">
			<h2 class="text-xl font-semibold">Available Challenge Types</h2>
			<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				<div class="text-sm">🔢 <strong>Math:</strong> Arithmetic problems</div>
				<div class="text-sm">✏️ <strong>Text Input:</strong> Type exact phrases</div>
				<div class="text-sm">📋 <strong>Multiple Choice:</strong> Select from options</div>
				<div class="text-sm">🔤 <strong>Pattern:</strong> Complete sequences</div>
				<div class="text-sm">🧩 <strong>Word Puzzle:</strong> Unscramble words</div>
				<div class="text-sm">✓ <strong>True/False:</strong> Verify statements</div>
				<div class="text-sm">🎨 <strong>Icon Recognition:</strong> Identify icons</div>
				<div class="text-sm">🧠 <strong>Logic:</strong> If-then puzzles</div>
				<div class="text-sm">💭 <strong>Memory:</strong> Remember items</div>
				<div class="text-sm">📊 <strong>Sorting:</strong> Arrange in order</div>
			</div>
		</div>
	</div>

	<!-- Verification Modals -->
	<!-- Scenario 1: Delete (default config) -->
	<VerificationChallenge
		bind:open={showDeleteVerification}
		onVerified={handleDeleteVerified}
		onCancelled={handleCancelled}
		onChallengeComplete={handleChallengeComplete}
	/>

	<!-- Scenario 2: Settings (easy only) -->
	<VerificationChallenge
		bind:open={showSettingsVerification}
		onVerified={handleSettingsVerified}
		onCancelled={handleCancelled}
		onChallengeComplete={handleChallengeComplete}
		config={{
			challengeCount: 2,
			challengeTypes: ['math', 'text-input', 'multiple-choice'],
			difficultyWeighting: { easy: 100, medium: 0, hard: 0 },
			title: 'Confirm Settings Change',
			description: 'Please complete these easy challenges to change your settings.',
			confirmText: 'Apply Changes'
		}}
	/>

	<!-- Scenario 3: Custom (3 challenges, harder) -->
	<VerificationChallenge
		bind:open={showCustomVerification}
		onVerified={handleCustomVerified}
		onCancelled={handleCancelled}
		onChallengeComplete={handleChallengeComplete}
		config={{
			challengeCount: 3,
			challengeTypes: ['math', 'logic', 'pattern', 'memory', 'sorting'],
			difficultyWeighting: { easy: 20, medium: 40, hard: 40 },
			title: 'Critical Action Verification',
			description: 'This is a critical action. Please complete 3 challenges to proceed.',
			confirmText: 'Execute Action'
		}}
	/>
</div>

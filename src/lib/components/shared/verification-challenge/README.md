# Verification Challenge Component

Modal-based verification system requiring users to complete randomized challenges before proceeding with sensitive actions.

## Features

- **10 Challenge Types**: Math, text input, multiple choice, pattern matching, word puzzles, true/false, icon recognition, logic puzzles, memory challenges, and sorting
- **Configurable**: Set challenge count, difficulty weighting, and retry behavior
- **Accessible**: WCAG 2.2 compliant with keyboard navigation and screen reader support
- **Responsive**: Works on all devices (320px+)
- **Dark Mode**: Full dark mode support
- **No Time Limits**: Users can take as long as they need (better accessibility)

## Installation

The component is already integrated into MoLOS. Import it from:

```typescript
import VerificationChallenge from '$lib/components/shared/verification-challenge/index.js';
```

## Basic Usage

```svelte
<script lang="ts">
	import VerificationChallenge from '$lib/components/shared/verification-challenge/index.js';

	let showVerification = $state(false);

	function handleDelete() {
		showVerification = true;
	}

	function handleVerified() {
		// Execute destructive action
		deleteItem();
		showVerification = false;
	}
</script>

<Button variant="destructive" onclick={handleDelete}>Delete Item</Button>

<VerificationChallenge
	bind:open={showVerification}
	onVerified={handleVerified}
	onCancelled={() => (showVerification = false)}
/>
```

## Configuration Options

```typescript
interface VerificationConfig {
	// Number of challenges per session (default: 2)
	challengeCount: number;

	// Specific challenge types to use (default: all 10 types)
	challengeTypes?: ChallengeType[];

	// Difficulty weighting (default: { easy: 50, medium: 35, hard: 15 })
	difficultyWeighting?: Record<ChallengeDifficulty, number>;

	// Maximum retries per challenge (default: 'unlimited')
	maxRetries: number | 'unlimited';

	// Allow skipping challenges (default: false)
	allowSkip: boolean;

	// Modal title (default: "Verification Required")
	title?: string;

	// Modal description (default: "Please complete the following challenges...")
	description?: string;

	// Confirm button text (default: "Proceed")
	confirmText?: string;

	// Cancel button text (default: "Cancel")
	cancelText?: string;
}
```

### Example with Custom Config

```svelte
<VerificationChallenge
	bind:open={showVerification}
	onVerified={handleVerified}
	config={{
		challengeCount: 3,
		challengeTypes: ['math', 'text-input', 'multiple-choice'],
		difficultyWeighting: { easy: 70, medium: 25, hard: 5 },
		title: 'Confirm Deletion',
		description: 'Please complete these challenges to confirm deletion.',
		confirmText: 'Delete Item'
	}}
/>
```

## Challenge Types

### 1. Math (`math`)

Arithmetic problems with +, -, ×, ÷ operators.

**Example**: "What is 12 + 8?"

### 2. Text Input (`text-input`)

Type exact phrases.

**Example**: "Type 'confirm' to proceed"

### 3. Multiple Choice (`multiple-choice`)

General knowledge questions with 4 options.

**Example**: "What color is the sky on a clear day?" [Blue, Green, Red, Yellow]

### 4. Pattern Matching (`pattern`)

Complete number or letter sequences.

**Example**: "2, 4, 6, ?" → Answer: 8

### 5. Word Puzzle (`word-puzzle`)

Unscramble words.

**Example**: "Unscramble: 'tac'" → Answer: "cat"

### 6. True/False (`true-false`)

Determine if statements are true or false.

**Example**: "The sun rises in the east." [True/False]

### 7. Icon Recognition (`icon-recognition`)

Identify Lucide icons.

**Example**: "Which icon represents 'Email'?" [Shows Mail, Phone, Home, Star icons]

### 8. Logic Puzzles (`logic`)

If-then scenarios.

**Example**: "If it rains, the ground gets wet. It is raining. Is the ground wet?" [Yes/No]

### 9. Memory Challenge (`memory`)

Remember and recall items.

**Example**: "Remember: Apple, Banana, Cherry. What was the second item?"

### 9. Sorting (`sorting`)

Arrange items in correct order.

**Example**: "Sort by size (smallest to largest):" [Mouse, Elephant, Dog]

**Note:** The memory challenge type is excluded from the default pool because it requires multiple stages (show items, then ask question). All other challenge types are single-stage for better user experience. You can explicitly enable memory challenges via `config.challengeTypes` if needed.

## Events

### `onVerified`

Called when all challenges are completed successfully.

```svelte
<VerificationChallenge
	onVerified={() => {
		// Execute the protected action
		deleteItem();
	}}
/>
```

### `onCancelled`

Called when user cancels the verification process.

```svelte
<VerificationChallenge
	onCancelled={() => {
		console.log('User cancelled verification');
	}}
/>
```

### `onChallengeComplete`

Called after each challenge is completed (pass or fail).

```svelte
<VerificationChallenge
	onChallengeComplete={(result) => {
		console.log(`Challenge ${result.passed ? 'passed' : 'failed'}`);
		console.log('User answer:', result.userAnswer);
	}}
/>
```

## Accessibility

- **Keyboard Navigation**: Tab through options, Enter to submit, Escape to cancel
- **Screen Readers**: Full ARIA support with semantic HTML
- **Focus Management**: Focus trapped in modal, returns to trigger on close
- **Visual Focus Indicators**: 3:1 contrast ratio, 2px offset
- **Reduced Motion**: Respects `prefers-reduced-motion`

## Styling

The component uses Tailwind CSS and follows the existing design system:

- **Colors**: Semantic color tokens (primary, destructive, etc.)
- **Typography**: Follows app type scale
- **Spacing**: Uses Tailwind spacing scale
- **Dark Mode**: Automatic via CSS variables

## States

### Pending

User hasn't completed all challenges yet.

### Invalid

User failed a challenge. Shows error feedback and retry option.

### Verified

All challenges passed. "Proceed" button becomes active.

### Cancelled

User exited modal without completing.

## Example Integration

```svelte
<script lang="ts">
	import VerificationChallenge from '$lib/components/shared/verification-challenge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Trash2 } from 'lucide-svelte';

	let showVerification = $state(false);
	let itemToDelete = $state<string | null>(null);

	function promptDelete(itemId: string) {
		itemToDelete = itemId;
		showVerification = true;
	}

	function handleVerified() {
		if (itemToDelete) {
			// Perform deletion
			deleteItem(itemToDelete);
			itemToDelete = null;
		}
		showVerification = false;
	}

	function handleCancel() {
		itemToDelete = null;
		showVerification = false;
	}
</script>

<Button variant="destructive" onclick={() => promptDelete('item-123')}>
	<Trash2 class="h-4 w-4" />
	Delete
</Button>

<VerificationChallenge
	bind:open={showVerification}
	onVerified={handleVerified}
	onCancelled={handleCancel}
	config={{
		challengeCount: 2,
		title: 'Confirm Deletion',
		description: 'This action cannot be undone. Please verify to proceed.',
		confirmText: 'Delete Permanently'
	}}
/>
```

## Best Practices

1. **Use for Destructive Actions**: Delete, remove, bulk operations
2. **Use for Sensitive Actions**: Privacy settings, account changes
3. **Keep Challenge Count Low**: 2-3 challenges for good UX
4. **Provide Context**: Use descriptive titles and descriptions
5. **Handle Cancellation**: Always provide onCancelled callback
6. **Test Accessibility**: Verify keyboard navigation works

## Technical Details

- **Framework**: Svelte 5 with runes ($state, $derived, $props)
- **Styling**: Tailwind CSS
- **Components**: shadcn-svelte (AlertDialog, Button, Input, etc.)
- **Icons**: Lucide Svelte
- **TypeScript**: Fully typed

## File Structure

```
src/lib/components/shared/verification-challenge/
├── index.ts                      # Public exports
├── verification-challenge.svelte # Main modal component
├── types.ts                      # TypeScript definitions
├── config.ts                     # Default configuration
├── README.md                     # This file
├── utils/
│   ├── randomizer.ts            # Challenge selection
│   ├── validator.ts             # Answer validation
│   └── generators.ts            # Challenge generation
├── challenges/
│   ├── index.ts                 # Challenge registry
│   ├── math.ts
│   ├── text-input.ts
│   ├── multiple-choice.ts
│   ├── pattern.ts
│   ├── word-puzzle.ts
│   ├── true-false.ts
│   ├── icon-recognition.ts
│   ├── logic.ts
│   ├── memory.ts
│   └── sorting.ts
└── components/
    ├── challenge-display.svelte
    ├── progress-indicator.svelte
    ├── challenge-input.svelte
    └── result-feedback.svelte
```

## License

Part of MoLOS - see main repository for license details.

<script lang="ts">
	/**
	 * Challenge input component
	 * Renders appropriate input UI based on challenge type
	 */
	import { cn } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import type { ChallengeInputProps, Challenge } from '../types.js';

	interface Props extends ChallengeInputProps {
		class?: string;
	}

	let {
		challenge,
		value = '',
		onValueChange,
		onSubmit,
		disabled = false,
		class: className
	}: Props = $props();

	// Derived state
	const inputType = $derived(challenge.type);
	const hasOptions = $derived(!!challenge.options && challenge.options.length > 0);

	// Ensure sorting challenges have an array value
	$effect(() => {
		if (inputType === 'sorting' && hasOptions && !Array.isArray(value)) {
			handleSortingChange([...challenge.options!]);
		}
	});

	// Handle different input types
	function handleTextInput(event: Event) {
		const target = event.target as HTMLInputElement;
		onValueChange(target.value);
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !disabled) {
			event.preventDefault();
			onSubmit();
		}
	}

	function handleMultipleChoiceSelect(option: string) {
		onValueChange(option);
	}

	function handleSortingChange(newOrder: string[]) {
		onValueChange(newOrder);
	}

	function moveSortingItem(fromIndex: number, toIndex: number) {
		if (!Array.isArray(value)) return;
		const newArray = [...value];
		const [removed] = newArray.splice(fromIndex, 1);
		newArray.splice(toIndex, 0, removed);
		handleSortingChange(newArray);
	}
</script>

<div class={cn('space-y-4', className)}>
	{#if inputType === 'math' || inputType === 'text-input' || inputType === 'pattern' || inputType === 'word-puzzle'}
		<!-- Text/Number input -->
		<div class="space-y-2">
			<Label for="challenge-input" class="sr-only">Your Answer</Label>
			<Input
				id="challenge-input"
				type={inputType === 'math' ? 'number' : 'text'}
				value={Array.isArray(value) ? '' : value}
				oninput={handleTextInput}
				onkeydown={handleKeyPress}
				{disabled}
				placeholder="Enter your answer"
				class="text-base"
				autocomplete="off"
			/>
		</div>
	{:else if inputType === 'multiple-choice' && hasOptions}
		<!-- Multiple choice options -->
		<div class="grid gap-2" role="radiogroup" aria-label="Answer options">
			{#each challenge.options as option, index}
				<button
					type="button"
					class={cn(
						'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all',
						'hover:border-primary hover:bg-accent',
						'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
						value === option && 'border-primary bg-primary/10',
						disabled && 'cursor-not-allowed opacity-50'
					)}
					onclick={() => !disabled && handleMultipleChoiceSelect(option)}
					{disabled}
					role="radio"
					aria-checked={value === option}
				>
					<div
						class={cn(
							'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
							value === option ? 'border-primary bg-primary' : 'border-muted-foreground'
						)}
					>
						{#if value === option}
							<div class="h-2 w-2 rounded-full bg-white" />
						{/if}
					</div>
					<span class="text-base">{option}</span>
				</button>
			{/each}
		</div>
	{:else if inputType === 'true-false'}
		<!-- True/False buttons -->
		<div class="flex gap-3">
			<Button
				variant={value === 'true' ? 'default' : 'outline'}
				size="lg"
				class="flex-1"
				onclick={() => handleMultipleChoiceSelect('true')}
				{disabled}
			>
				True
			</Button>
			<Button
				variant={value === 'false' ? 'default' : 'outline'}
				size="lg"
				class="flex-1"
				onclick={() => handleMultipleChoiceSelect('false')}
				{disabled}
			>
				False
			</Button>
		</div>
	{:else if inputType === 'icon-recognition' && challenge.iconOptions}
		<!-- Icon recognition grid -->
		<div class="grid grid-cols-2 gap-3">
			{#each challenge.iconOptions as iconOption}
				<button
					type="button"
					class={cn(
						'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
						'hover:border-primary hover:bg-accent',
						'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
						value === iconOption.name && 'border-primary bg-primary/10',
						disabled && 'cursor-not-allowed opacity-50'
					)}
					onclick={() => !disabled && handleMultipleChoiceSelect(iconOption.name)}
					{disabled}
					aria-label={iconOption.name}
					aria-pressed={value === iconOption.name}
				>
					<div class="text-4xl">
						<svelte:component this={iconOption.component} class="h-12 w-12" />
					</div>
					<span class="text-sm font-medium">{iconOption.name}</span>
				</button>
			{/each}
		</div>
	{:else if inputType === 'logic'}
		<!-- Logic puzzle - True/False -->
		<div class="flex gap-3">
			<Button
				variant={value === 'true' ? 'default' : 'outline'}
				size="lg"
				class="flex-1"
				onclick={() => handleMultipleChoiceSelect('true')}
				{disabled}
			>
				Yes
			</Button>
			<Button
				variant={value === 'false' ? 'default' : 'outline'}
				size="lg"
				class="flex-1"
				onclick={() => handleMultipleChoiceSelect('false')}
				{disabled}
			>
				No
			</Button>
		</div>
	{:else if inputType === 'memory'}
		<!-- Memory challenge input -->
		<div class="space-y-2">
			<Label for="memory-input" class="sr-only">Your Answer</Label>
			<Input
				id="memory-input"
				type="text"
				value={Array.isArray(value) ? '' : value}
				oninput={handleTextInput}
				onkeydown={handleKeyPress}
				{disabled}
				placeholder="Enter your answer"
				class="text-base"
				autocomplete="off"
			/>
		</div>
	{:else if inputType === 'sorting' && hasOptions}
		<!-- Sorting challenge -->
		<div class="space-y-2">
			{#if Array.isArray(value) && value.length > 0}
				{#each value as item, index}
					<div
						class={cn(
							'flex items-center gap-3 rounded-lg border-2 bg-background p-3 transition-all',
							'hover:border-primary'
						)}
					>
						<div class="flex items-center gap-1">
							{#if index > 0}
								<button
									type="button"
									class="focus-visible:ring-ring rounded p-1 text-lg transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
									onclick={() => moveSortingItem(index, index - 1)}
									aria-label="Move up"
									{disabled}
								>
									↑
								</button>
							{:else}
								<span class="w-6"></span>
							{/if}
							{#if index < value.length - 1}
								<button
									type="button"
									class="focus-visible:ring-ring rounded p-1 text-lg transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
									onclick={() => moveSortingItem(index, index + 1)}
									aria-label="Move down"
									{disabled}
								>
									↓
								</button>
							{:else}
								<span class="w-6"></span>
							{/if}
						</div>
						<span class="text-base font-medium">{index + 1}.</span>
						<span class="text-base">{item}</span>
					</div>
				{/each}
			{:else if challenge.options}
				{#each challenge.options as item, index}
					<div
						class={cn(
							'flex items-center gap-3 rounded-lg border-2 bg-background p-3 transition-all',
							'hover:border-primary'
						)}
					>
						<div class="flex items-center gap-1">
							{#if index > 0}
								<button
									type="button"
									class="focus-visible:ring-ring rounded p-1 text-lg transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
									onclick={() => moveSortingItem(index, index - 1)}
									aria-label="Move up"
									{disabled}
								>
									↑
								</button>
							{:else}
								<span class="w-6"></span>
							{/if}
							{#if index < challenge.options!.length - 1}
								<button
									type="button"
									class="focus-visible:ring-ring rounded p-1 text-lg transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
									onclick={() => moveSortingItem(index, index + 1)}
									aria-label="Move down"
									{disabled}
								>
									↓
								</button>
							{:else}
								<span class="w-6"></span>
							{/if}
						</div>
						<span class="text-base font-medium">{index + 1}.</span>
						<span class="text-base">{item}</span>
					</div>
				{/each}
			{/if}
		</div>
	{:else}
		<!-- Fallback input -->
		<div class="space-y-2">
			<Label for="fallback-input" class="sr-only">Your Answer</Label>
			<Input
				id="fallback-input"
				type="text"
				value={Array.isArray(value) ? '' : value}
				oninput={handleTextInput}
				onkeydown={handleKeyPress}
				{disabled}
				placeholder="Enter your answer"
				class="text-base"
				autocomplete="off"
			/>
		</div>
	{/if}
</div>

<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Send, Paperclip, StopCircle, X } from 'lucide-svelte';
	import ModuleMentionPicker from './ModuleMentionPicker.svelte';
	import type { ModuleConfig } from '@molos/module-types';
	import { tick } from 'svelte';
	import { scale, fly } from 'svelte/transition';

	let {
		input = $bindable(''),
		isLoading,
		pendingAction,
		mentionedModules = [],
		modules = [],
		onSendMessage,
		onInput,
		onKeydown,
		onMentionModule,
		onRemoveMention
	}: {
		input?: string;
		isLoading: boolean;
		pendingAction: unknown;
		mentionedModules?: ModuleConfig[];
		modules?: ModuleConfig[];
		onSendMessage: () => void;
		onInput: (value: string) => void;
		onKeydown: (e: KeyboardEvent) => void;
		onMentionModule?: (module: ModuleConfig) => void;
		onRemoveMention?: (moduleId: string) => void;
	} = $props();

	let textareaElement = $state<HTMLTextAreaElement | null>(null);
	let showMentionPicker = $state(false);
	let mentionQuery = $state('');
	let mentionStartPosition = $state(0);
	let pickerPosition = $state({ x: 0, y: 0 });

	// Filter out already mentioned modules
	const availableModules = $derived(
		modules.filter((m) => !mentionedModules.some((mentioned) => mentioned.id === m.id))
	);

	function autoResize() {
		if (textareaElement) {
			textareaElement.style.height = 'auto';
			textareaElement.style.height = Math.min(textareaElement.scrollHeight, 200) + 'px';
		}
	}

	$effect(() => {
		if (input === '') {
			if (textareaElement) textareaElement.style.height = 'auto';
		}
	});

	function getCaretCoordinates(element: HTMLTextAreaElement): { x: number; y: number } {
		const rect = element.getBoundingClientRect();
		const text = element.value.substring(0, element.selectionStart);

		// Create a hidden div to measure text position
		const div = document.createElement('div');
		const style = getComputedStyle(element);

		div.style.position = 'absolute';
		div.style.visibility = 'hidden';
		div.style.whiteSpace = 'pre-wrap';
		div.style.wordWrap = 'break-word';
		div.style.font = style.font;
		div.style.lineHeight = style.lineHeight;
		div.style.padding = style.padding;
		div.style.border = style.border;
		div.style.boxSizing = style.boxSizing;
		div.style.width = style.width;
		div.style.left = '-9999px';

		div.textContent = text;

		document.body.appendChild(div);

		const span = document.createElement('span');
		span.textContent = '|';
		div.appendChild(span);

		const coordinates = {
			x: rect.left + span.offsetLeft - element.scrollLeft,
			y: rect.top + span.offsetTop - element.scrollTop + 24 // Add some offset to appear below cursor
		};

		document.body.removeChild(div);

		return coordinates;
	}

	async function checkForMention() {
		// Wait for DOM to update
		await tick();

		if (!textareaElement) return;

		const cursorPos = textareaElement.selectionStart;
		const textBeforeCursor = input.substring(0, cursorPos);

		// Find the last @ before cursor that isn't part of another word
		const lastAtIndex = textBeforeCursor.lastIndexOf('@');

		if (lastAtIndex !== -1) {
			// Check if there's a space between @ and cursor (if so, not a mention)
			const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

			// If there's no space after @, we're in a mention
			if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
				mentionQuery = textAfterAt;
				mentionStartPosition = lastAtIndex;
				pickerPosition = getCaretCoordinates(textareaElement);
				showMentionPicker = true;
				console.log('[Mention] Showing picker, query:', textAfterAt, 'available modules:', availableModules.length);
				return;
			}
		}
		showMentionPicker = false;
	}

	function handleInput(value: string) {
		autoResize();
		onInput(value);
		// Check for mentions after a microtask to ensure selectionStart is updated
		queueMicrotask(() => checkForMention());
	}

	function handleKeydown(e: KeyboardEvent) {
		// If mention picker is open and it's a navigation key, don't propagate
		if (
			showMentionPicker &&
			(e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')
		) {
			return; // Let ModuleMentionPicker handle these
		}

		// Pass to parent handler
		onKeydown(e);
	}

	function selectModule(module: ModuleConfig) {
		// Remove the @query from input
		const beforeMention = input.substring(0, mentionStartPosition);
		const afterCursor = input.substring(textareaElement?.selectionStart || 0);

		// Update input (remove the @mention text)
		input = beforeMention + afterCursor;

		// Notify parent
		if (onMentionModule) {
			onMentionModule(module);
		}

		showMentionPicker = false;

		// Focus back on textarea
		setTimeout(() => {
			if (textareaElement) {
				textareaElement.focus();
				textareaElement.setSelectionRange(mentionStartPosition, mentionStartPosition);
			}
		}, 0);
	}

	function closeMentionPicker() {
		showMentionPicker = false;
	}
</script>

<div class="ai-input-container relative">
	<!-- Mention chips -->
	{#if mentionedModules.length > 0}
		<div class="mb-2 flex flex-wrap gap-1.5">
			{#each mentionedModules as module (module.id)}
				<span in:scale={{ start: 0.8, duration: 150 }} out:scale={{ start: 1, duration: 100 }}>
					<Badge variant="secondary" class="gap-1.5 pr-1 transition-all">
						{#if module.icon}
							<module.icon class="h-3.5 w-3.5 text-primary/70" />
						{/if}
						<span class="text-sm">{module.name}</span>
						<button
							type="button"
							class="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-foreground/20"
							onclick={() => onRemoveMention?.(module.id)}
							aria-label="Remove {module.name} mention"
						>
							<X class="h-3 w-3" />
						</button>
					</Badge>
				</span>
			{/each}
		</div>
	{/if}

	<form
		onsubmit={(e) => {
			e.preventDefault();
			onSendMessage();
		}}
		class="relative flex items-end gap-2 rounded-xl border border-border/60 bg-background/90 p-2 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20"
	>
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground h-9 w-9 shrink-0 rounded-xl hover:bg-muted/30 hover:text-foreground"
			type="button"
			title="Attach files"
		>
			<Paperclip class="h-5 w-5" />
		</Button>

		<div class="relative flex-1">
			<Textarea
				bind:value={input}
				bind:ref={textareaElement}
				onkeydown={handleKeydown}
				oninput={() => handleInput(input)}
				class="max-h-50 min-h-10 w-full resize-none border-none bg-transparent text-[14px] leading-relaxed shadow-none focus-visible:ring-0"
				disabled={isLoading || !!pendingAction}
				placeholder={mentionedModules.length > 0
					? `Ask about ${mentionedModules.map(m => m.name).join(', ')}...`
					: 'Type @ to mention a module...'}
			/>
		</div>

		{#if isLoading}
			<Button
				type="button"
				size="icon"
				variant="ghost"
				class="h-9 w-9 shrink-0 rounded-xl text-destructive hover:bg-destructive/10"
				title="Stop generating"
			>
				<StopCircle class="h-5 w-5" />
			</Button>
		{:else}
			<Button
				type="submit"
				size="icon"
				class="h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-20"
				disabled={!input.trim() || !!pendingAction}
			>
				<Send class="h-4 w-4" />
			</Button>
		{/if}

		<!-- Mention picker dropdown -->
		{#if showMentionPicker && availableModules.length > 0}
			<ModuleMentionPicker
				modules={availableModules}
				query={mentionQuery}
				position={pickerPosition}
				onSelect={selectModule}
				onClose={closeMentionPicker}
			/>
		{/if}
	</form>
</div>

<style>
	:global(.ai-input-container textarea) {
		scrollbar-width: thin;
	}
</style>

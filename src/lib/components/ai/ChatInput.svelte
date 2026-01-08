<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { Send, Paperclip, StopCircle } from 'lucide-svelte';

	let {
		input = $bindable(''),
		isLoading,
		pendingAction,
		onSendMessage,
		onInput,
		onKeydown
	} = $props();

	let textareaElement = $state<HTMLTextAreaElement | null>(null);

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
</script>

<div class="ai-input-container relative">
	<form
		onsubmit={(e) => {
			e.preventDefault();
			onSendMessage();
		}}
		class="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2 transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20"
	>
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground h-9 w-9 shrink-0 rounded-xl hover:text-foreground"
			type="button"
			title="Attach files"
		>
			<Paperclip class="h-5 w-5" />
		</Button>

		<div class="relative flex-1">
			<Textarea
				bind:value={input}
				bind:ref={textareaElement}
				onkeydown={onKeydown}
				oninput={() => {
					autoResize();
					onInput(input);
				}}
				class="max-h-50 min-h-10 w-full resize-none border-none bg-transparent text-[14px] leading-relaxed shadow-none focus-visible:ring-0"
				disabled={isLoading || !!pendingAction}
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
	</form>
</div>

<style>
	:global(.ai-input-container textarea) {
		scrollbar-width: thin;
	}
</style>

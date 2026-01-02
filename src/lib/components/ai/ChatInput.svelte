<script lang="ts">
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { Send } from 'lucide-svelte';

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

<div class="border-t border-border/40 bg-background/50 p-6 backdrop-blur-md">
	<form
		onsubmit={(e) => {
			e.preventDefault();
			onSendMessage();
		}}
		class="group relative"
	>
		<div
			class="absolute -inset-0.5 rounded-[20px] bg-gradient-to-r from-primary/20 to-primary/10 opacity-0 blur transition duration-500 group-focus-within:opacity-100"
		></div>
		<div class="relative">
			<Textarea
				placeholder="Message AI Assistant..."
				bind:value={input}
				bind:ref={textareaElement}
				onkeydown={onKeydown}
				oninput={() => {
					autoResize();
					onInput(input);
				}}
				class="max-h-[200px] min-h-[56px] resize-none overflow-y-auto rounded-[18px] border-border/60 bg-background/80 py-4 pr-14 shadow-inner transition-all duration-300 focus-visible:ring-primary/20"
				disabled={isLoading || !!pendingAction}
			/>
			<Button
				type="submit"
				size="icon"
				class="absolute right-2 bottom-2 h-10 w-10 rounded-xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
				disabled={!input.trim() || isLoading || !!pendingAction}
			>
				<Send class="h-4.5 w-4.5" />
			</Button>
		</div>
	</form>
	<p class="text-muted-foreground/50 mt-3 text-center text-[10px] font-medium">
		AI can make mistakes. Check important info.
	</p>
</div>

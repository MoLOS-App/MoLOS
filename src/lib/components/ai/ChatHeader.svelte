<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Bot, ChevronLeft, Plus, X } from 'lucide-svelte';

	let { view, isOpen, onBack, onNewChat, onClose } = $props();
</script>

<div class="flex h-16 items-center justify-between border-b border-border/40 px-6">
	<div class="flex items-center gap-3">
		{#if view === 'chat'}
			<Button
				variant="ghost"
				size="icon"
				class="h-8 w-8 rounded-full hover:bg-muted/80"
				onclick={onBack}
			>
				<ChevronLeft class="h-5 w-5" />
			</Button>
		{/if}
		<div class="relative">
			<div
				class="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-2 text-primary shadow-sm"
			>
				<Bot class="h-5 w-5" />
			</div>
			<div
				class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500"
			></div>
		</div>
		<div class="flex flex-col">
			<span class="text-sm font-semibold tracking-tight">
				{view === 'sessions' ? 'AI Assistant' : 'Chat'}
			</span>
			{#if view === 'chat'}
				<span class="text-muted-foreground text-[10px] font-medium">Online</span>
			{/if}
		</div>
	</div>
	<div class="flex items-center gap-1">
		{#if view === 'sessions'}
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onNewChat}>
				<Plus class="h-4 w-4" />
			</Button>
		{/if}
		<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onClose}>
			<X class="h-4 w-4" />
		</Button>
	</div>
</div>

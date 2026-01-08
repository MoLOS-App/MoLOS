<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Bot, ChevronLeft, Plus, X } from 'lucide-svelte';

	let { view, onBack, onNewChat, onClose } = $props();
</script>

<div class="flex items-center justify-between border-b border-border/60 bg-accent px-4 py-3">
	<div class="flex items-center gap-4">
		<div class="grid h-9 w-9 place-items-center rounded-2xl bg-muted/60 text-primary">
			<Bot class="h-5 w-5" />
		</div>
		<div class="flex flex-col">
			<span class="text-sm font-semibold tracking-tight">MoLOS Assistant</span>
			<span class="text-muted-foreground text-[11px]">
				{view === 'sessions' ? 'Sessions' : 'Workspace'}
			</span>
		</div>
	</div>
	<div class="flex items-center gap-1">
		{#if view === 'sessions'}
			<Button
				variant="ghost"
				size="icon"
				class="h-9 w-9 rounded-full border border-border/60 bg-background/70 hover:bg-muted/60"
				onclick={onNewChat}
			>
				<Plus class="h-4 w-4" />
			</Button>
		{/if}
		{#if view === 'chat'}
			<Button
				variant="ghost"
				size="icon"
				class="h-9 w-9 rounded-full border border-border/60 bg-background/70 hover:bg-muted/60"
				onclick={onBack}
			>
				<ChevronLeft class="h-5 w-5" />
			</Button>
		{/if}
		<Button
			variant="ghost"
			size="icon"
			class="h-9 w-9 rounded-full border border-border/60 bg-background/70 hover:bg-muted/60"
			onclick={onClose}
		>
			<X class="h-4 w-4" />
		</Button>
	</div>
</div>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Bot, ChevronLeft, Plus, X, Sparkles } from 'lucide-svelte';

	let { view, isOpen, onBack, onNewChat, onClose } = $props();
</script>

<div class="ai-header flex items-center justify-between border-b border-border/40 px-4">
	<div class="flex items-center gap-4">
		{#if view === 'chat'}
			<Button
				variant="ghost"
				size="icon"
				class="h-8 w-8 rounded-full border border-border/50 bg-background/60 hover:bg-muted/80"
				onclick={onBack}
			>
				<ChevronLeft class="h-5 w-5" />
			</Button>
		{/if}
		<div class="relative">
			<div
				class="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent text-primary shadow-[0_10px_30px_rgba(56,189,248,0.18)]"
			>
				<Bot class="h-5 w-5" />
			</div>
			<div
				class="absolute -right-1 -bottom-1 flex items-center gap-1 rounded-full border border-background bg-emerald-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white shadow-sm"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-white"></span>
				Live
			</div>
		</div>
		<div class="flex flex-col">
			<span class="text-sm font-semibold tracking-tight">
				{view === 'sessions' ? 'MoLOS Agent' : 'Agent Workspace'}
			</span>
			<div class="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
				<Sparkles class="h-3 w-3 text-primary/70" />
				Google-grade assistant
			</div>
		</div>
	</div>
	<div class="flex items-center gap-1">
		{#if view === 'sessions'}
			<Button
				variant="ghost"
				size="icon"
				class="h-8 w-8 rounded-full border border-border/40 bg-background/70 hover:bg-muted/80"
				onclick={onNewChat}
			>
				<Plus class="h-4 w-4" />
			</Button>
		{/if}
		<Button
			variant="ghost"
			size="icon"
			class="h-8 w-8 rounded-full border border-border/40 bg-background/70 hover:bg-muted/80"
			onclick={onClose}
		>
			<X class="h-4 w-4" />
		</Button>
	</div>
</div>

<style>
	.ai-header {
		min-height: 60px;
		background: radial-gradient(circle at top, rgba(56, 189, 248, 0.12), transparent 55%),
			linear-gradient(120deg, rgba(15, 23, 42, 0.02), rgba(59, 130, 246, 0.08));
	}
</style>

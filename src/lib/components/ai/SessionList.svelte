<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus, MessageSquare, Clock, Trash2 } from 'lucide-svelte';
	import type { AiSession } from '$lib/models/ai';

	let { sessions, onNewChat, onLoadSession, onDeleteSession } = $props();
</script>

<div class="flex-1 space-y-5 overflow-y-auto p-4">
	<div class="space-y-2">
		<Button
			variant="outline"
			class="group mb-5 w-full justify-start gap-3 rounded-[24px] border-dashed bg-gradient-to-br from-muted/40 to-background py-6 transition-all duration-300 hover:bg-muted/50 hover:shadow-[0_18px_50px_rgba(15,23,42,0.1)]"
			onclick={onNewChat}
		>
			<div
				class="rounded-2xl bg-background p-2 shadow-sm transition-transform group-hover:scale-110"
			>
				<Plus class="h-4 w-4 text-primary" />
			</div>
			<div class="flex flex-col items-start">
				<span class="text-sm font-semibold">New conversation</span>
				<span class="text-muted-foreground text-[11px]">Start a focused session</span>
			</div>
		</Button>

		<div class="mb-2 px-2">
			<h3 class="text-muted-foreground/60 text-[10px] font-bold uppercase tracking-[0.3em]">
				Recent Chats
			</h3>
		</div>

		{#each sessions as session (session.id)}
			<div class="group relative">
				<button
					class="flex w-full items-start gap-3 rounded-2xl border border-transparent bg-background/70 p-3 text-left transition-all duration-200 hover:border-border/50 hover:bg-muted/40 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
					onclick={() => onLoadSession(session.id)}
				>
					<div class="mt-1 flex-shrink-0">
						<div class="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary/10">
							<MessageSquare class="h-4 w-4 text-primary" />
						</div>
					</div>
					<div class="min-w-0 flex-1">
						<h4 class="mb-1 truncate text-sm font-semibold">{session.title}</h4>
						<p class="text-muted-foreground flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
							<Clock class="h-3 w-3" />
							{new Date(session.updatedAt).toLocaleDateString()} at {new Date(
								session.updatedAt
							).toLocaleTimeString([], {
								hour: '2-digit',
								minute: '2-digit'
							})}
						</p>
					</div>
				</button>
				<Button
					as="div"
					variant="ghost"
					size="icon"
					class="absolute top-3 right-3 h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
					onclick={(e) => {
						e.stopPropagation();
						onDeleteSession(session.id);
					}}
				>
					<Trash2 class="h-3.5 w-3.5" />
				</Button>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<MessageSquare class="w-10 h-10 mb-3 text-muted-foreground/20" />
				<p class="text-sm font-medium text-muted-foreground">No chats yet</p>
				<p class="text-[11px] text-muted-foreground/60">Start one to see it here.</p>
			</div>
		{/each}
	</div>
</div>

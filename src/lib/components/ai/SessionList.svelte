<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus, MessageSquare, Clock, Trash2 } from 'lucide-svelte';
	import type { AiSession } from '$lib/models/ai';

	let { sessions, onNewChat, onLoadSession, onDeleteSession } = $props();
</script>

<div class="flex-1 space-y-6 overflow-y-auto p-4">
	<div class="space-y-2">
		<Button
			variant="outline"
			class="group mb-6 w-full justify-start gap-3 rounded-2xl border-dashed bg-muted/30 py-8 transition-all duration-300 hover:bg-muted/50"
			onclick={onNewChat}
		>
			<div
				class="rounded-xl bg-background p-2 shadow-sm transition-transform group-hover:scale-110"
			>
				<Plus class="h-4 w-4 text-primary" />
			</div>
			<div class="flex flex-col items-start">
				<span class="text-sm font-semibold">New Conversation</span>
				<span class="text-muted-foreground text-[11px]">Start a fresh session</span>
			</div>
		</Button>

		<div class="mb-2 px-2">
			<h3 class="text-muted-foreground/60 text-[11px] font-bold tracking-widest uppercase">
				Recent Chats
			</h3>
		</div>

		{#each sessions as session (session.id)}
			<div class="group relative">
				<button
					class="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all duration-200 hover:bg-muted/50 hover:shadow-sm"
					onclick={() => onLoadSession(session.id)}
				>
					<div class="mt-1 flex-shrink-0">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
							<MessageSquare class="h-4 w-4 text-primary" />
						</div>
					</div>
					<div class="min-w-0 flex-1">
						<h4 class="mb-1 truncate text-sm font-medium">{session.title}</h4>
						<p class="text-muted-foreground flex items-center gap-1 text-xs">
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
					class="absolute top-2 right-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
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
				<MessageSquare class="w-10 h-10 mb-2 text-muted-foreground/20" />
				<p class="text-sm text-muted-foreground">No chats yet</p>
			</div>
		{/each}
	</div>
</div>

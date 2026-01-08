<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Plus, MessageSquare } from 'lucide-svelte';
	import type { AiSession } from '$lib/models/ai';

	let { sessions, currentSessionId, onNewChat, onLoadSession, onCloseSidebar } = $props<{
		sessions: AiSession[];
		currentSessionId: string | null;
		onNewChat: () => void;
		onLoadSession: (sessionId: string) => void;
		onCloseSidebar?: () => void;
	}>();
</script>

<div class="flex flex-col gap-4 p-4">
	<div class="flex items-center justify-between">
		<h2 class="text-muted-foreground text-xs font-bold tracking-wider uppercase">Conversations</h2>
		<Button
			variant="ghost"
			size="icon"
			class="h-9 w-9 rounded-xl border border-border/40 bg-background/70 hover:bg-muted"
			onclick={onNewChat}
			aria-label="Start new chat"
		>
			<Plus class="h-4 w-4" />
		</Button>
	</div>
	<div class="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
		{#if sessions.length === 0}
			<div
				class="rounded-2xl border border-dashed border-border/40 bg-muted/10 px-4 py-6 text-center"
			>
				<MessageSquare class="text-muted-foreground/50 mx-auto mb-3 h-5 w-5" />
				<p class="text-muted-foreground text-sm font-semibold">No chats yet</p>
				<p class="text-muted-foreground/60 text-xs">Start one to see it here.</p>
			</div>
		{:else}
			{#each sessions as session (session.id)}
				<button
					class="focus-visible:ring-ring w-full rounded-2xl border border-transparent bg-background/60 px-4 py-3 text-left text-sm font-medium transition-all hover:border-border/60 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-offset-2 {currentSessionId ===
					session.id
						? 'border-primary/40 bg-primary/10'
						: ''}"
					onclick={() => {
						onLoadSession(session.id);
						onCloseSidebar?.();
					}}
					aria-label="Select conversation: {session.title}"
				>
					<div class="truncate font-semibold">{session.title}</div>
					<div class="text-muted-foreground/60 text-xs font-medium tracking-wide uppercase">
						{new Date(session.updatedAt).toLocaleDateString()}
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>

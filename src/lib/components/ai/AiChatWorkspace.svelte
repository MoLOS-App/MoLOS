<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { AiAction, AiMessage, AiSession } from '$lib/models/ai';
	import { Bot, MessageSquare, Loader2, Plus, Menu, ArrowDown } from 'lucide-svelte';
	import ChatMessage from '$lib/components/ai/ChatMessage.svelte';
	import ChatInput from '$lib/components/ai/ChatInput.svelte';
	import ReviewChangesOverlay from '$lib/components/ai/ReviewChangesOverlay.svelte';

	let { userName } = $props<{ userName?: string }>();

	let sessions = $state<AiSession[]>([]);
	let currentSessionId = $state<string | null>(null);
	let messages = $state<AiMessage[]>([]);
	let input = $state('');
	let isLoading = $state(false);
	let scrollViewport = $state<HTMLElement | null>(null);
	let pendingAction = $state<AiAction | null>(null);
	let actionTimer = $state(5);
	let timerInterval = $state<number | null>(null);
	let isSidebarOpen = $state(false);
	let showScrollButton = $state(false);

	let activeModuleIds = $derived($page.data.activeExternalIds || []);

	const now = new Date();
	const greeting =
		now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

	async function loadSessions() {
		const res = await fetch('/api/ai/chat');
		if (res.ok) {
			const data = await res.json();
			sessions = data.sessions || [];
		}
	}

	async function loadMessages(sessionId: string) {
		const res = await fetch(`/api/ai/chat?sessionId=${sessionId}`);
		if (res.ok) {
			const data = await res.json();
			messages = data.messages || [];
			currentSessionId = sessionId;
			await scrollToBottom();
		}
	}

	function startNewChat() {
		currentSessionId = null;
		messages = [];
		input = '';
		pendingAction = null;
		isSidebarOpen = false;
	}

	function startActionTimer() {
		actionTimer = 5;
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(() => {
			actionTimer -= 1;
			if (actionTimer <= 0) {
				if (timerInterval !== null) clearInterval(timerInterval);
				confirmAction();
			}
		}, 1000) as unknown as number;
	}

	function cancelAction() {
		if (timerInterval) clearInterval(timerInterval);
		pendingAction = null;
	}

	async function confirmAction() {
		if (!pendingAction) return;
		if (timerInterval) clearInterval(timerInterval);
		const action = pendingAction;
		pendingAction = null;
		isLoading = true;

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					actionToExecute: action,
					sessionId: currentSessionId,
					activeModuleIds
				})
			});
			if (res.ok && currentSessionId) {
				await loadMessages(currentSessionId);
			}
		} finally {
			isLoading = false;
		}
	}

	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		const userContent = input;
		input = '';
		isLoading = true;

		const tempUserMsg: AiMessage = {
			id: crypto.randomUUID(),
			userId: '',
			sessionId: currentSessionId || '',
			role: 'user',
			content: userContent,
			createdAt: new Date()
		};
		messages = [...messages, tempUserMsg];
		await scrollToBottom();

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: userContent,
					sessionId: currentSessionId,
					activeModuleIds
				})
			});
			if (res.ok) {
				const data = await res.json();
				currentSessionId = data.sessionId;
				if (data.actions?.some((a: AiAction) => a.type === 'write' && a.status === 'pending')) {
					pendingAction = data.actions.find(
						(a: AiAction) => a.type === 'write' && a.status === 'pending'
					);
					startActionTimer();
				}
				await loadMessages(currentSessionId!);
				await loadSessions();
			}
		} finally {
			isLoading = false;
			await scrollToBottom();
		}
	}

	async function scrollToBottom() {
		await tick();
		if (scrollViewport) {
			scrollViewport.scrollTo({
				top: scrollViewport.scrollHeight,
				behavior: 'smooth'
			});
		}
	}

	function handleScroll() {
		if (!scrollViewport) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollViewport;
		showScrollButton = scrollHeight - scrollTop - clientHeight > 200;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	onMount(() => {
		loadSessions();
	});
</script>

<div class="ai-page flex h-[calc(100vh-56px)] flex-col overflow-hidden bg-background">
	<div
		class="ai-shell mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden p-3 sm:p-6"
		in:fade={{ duration: 500 }}
	>
		<div class="ai-layout flex h-full gap-4 overflow-hidden lg:gap-6">
			<!-- Mobile Sidebar Overlay -->
			{#if isSidebarOpen}
				<button
					class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
					onclick={() => (isSidebarOpen = false)}
					aria-label="Close sidebar"
				></button>
			{/if}

			<aside
				class="ai-sidebar fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col gap-4 border-r border-border/40 bg-background p-4 transition-transform duration-300 lg:static lg:z-0 lg:flex lg:w-[260px] lg:rounded-2xl lg:border lg:bg-background/70 lg:shadow-sm lg:backdrop-blur {isSidebarOpen
					? 'translate-x-0'
					: '-translate-x-full lg:translate-x-0'}"
			>
				<div class="flex items-center justify-between">
					<h2 class="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
						Conversations
					</h2>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 rounded-xl border border-border/40 bg-background/70 hover:bg-muted"
							onclick={startNewChat}
						>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
				</div>
				<div class="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
					{#if sessions.length === 0}
						<div
							class="rounded-2xl border border-dashed border-border/40 bg-muted/10 px-4 py-6 text-center"
						>
							<MessageSquare class="mx-auto mb-3 h-5 w-5 text-muted-foreground/50" />
							<p class="text-xs font-semibold text-muted-foreground">No chats yet</p>
							<p class="text-[10px] text-muted-foreground/60">Start one to see it here.</p>
						</div>
					{:else}
						{#each sessions as session (session.id)}
							<button
								class="w-full rounded-2xl border border-transparent bg-background/60 px-3 py-3 text-left text-xs font-semibold transition-all hover:border-border/60 hover:bg-muted/40 {currentSessionId ===
								session.id
									? 'border-primary/40 bg-primary/10'
									: ''}"
								onclick={() => {
									loadMessages(session.id);
									isSidebarOpen = false;
								}}
							>
								<div class="truncate text-sm font-semibold">{session.title}</div>
								<div
									class="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60"
								>
									{new Date(session.updatedAt).toLocaleDateString()}
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</aside>

			<section
				class="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/80 shadow-sm backdrop-blur"
			>
				<div
					class="flex-1 overflow-y-auto scroll-smooth p-4"
					bind:this={scrollViewport}
					onscroll={handleScroll}
					role="log"
					aria-live="polite"
					aria-label="Chat messages"
				>
					<div class="mx-auto max-w-3xl space-y-8">
						{#if messages.length === 0}
							<div
								class="flex min-h-[40vh] flex-col items-center justify-center gap-5 text-center mx-auto"
							>
								<div class="rounded-2xl bg-primary/10 p-3 text-primary shadow-sm">
									<Bot class="h-6 w-6" />
								</div>
								<div class="space-y-2">
									<p class="text-base font-semibold">Ask anything</p>
									<p class="text-xs text-muted-foreground">
										Summarize tasks, plan a week, or get a quick status update.
									</p>
								</div>
								<div class="grid w-full gap-3 text-left text-xs text-muted-foreground sm:grid-cols-2">
									<div class="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
										"Plan my week around deep work and workouts."
									</div>
									<div class="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
										"Summarize my tasks and deadlines."
									</div>
									<div class="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
										"Draft a status update for leadership."
									</div>
									<div class="rounded-xl border border-border/40 bg-muted/20 px-3 py-3">
										"Turn meeting notes into action items."
									</div>
								</div>
							</div>
						{:else}
							<div class="flex flex-col gap-6">
								{#each messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.content?.trim() !== '' || m.contextMetadata || m.parts || m.attachments))) as msg (msg.id)}
									<ChatMessage message={msg} />
								{/each}
								{#if isLoading}
									<div class="flex items-start" in:fade>
										<div
											class="flex items-center gap-2 rounded-2xl border border-border/40 bg-muted/30 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground"
										>
											<Loader2 class="h-3.5 w-3.5 animate-spin" />
											Thinking
											<span class="ai-dots">
												<span></span>
												<span></span>
												<span></span>
											</span>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				{#if showScrollButton}
					<button
						class="absolute right-8 bottom-32 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/80 text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-muted active:scale-90"
						onclick={scrollToBottom}
						transition:fade
					>
						<ArrowDown class="h-5 w-5" />
					</button>
				{/if}

				<div
					class="sticky bottom-0 z-10 flex flex-col border-t border-border/40 bg-background/95 backdrop-blur-md"
				>
					<ReviewChangesOverlay {pendingAction} {actionTimer} onCancelAction={cancelAction} />
					<div class="p-4">
						<ChatInput
							bind:input
							{isLoading}
							{pendingAction}
							onSendMessage={sendMessage}
							onInput={(value: string) => (input = value)}
							onKeydown={handleKeydown}
						/>
					</div>
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.ai-dots {
		display: inline-flex;
		gap: 4px;
	}

	.ai-dots span {
		width: 4px;
		height: 4px;
		border-radius: 9999px;
		background: currentColor;
		opacity: 0.4;
		animation: pulse-dot 1.2s infinite ease-in-out;
	}

	.ai-dots span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.ai-dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		50% {
			transform: translateY(-2px);
			opacity: 1;
		}
	}
</style>

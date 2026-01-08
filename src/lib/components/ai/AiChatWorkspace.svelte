<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import type { AiAction, AiMessage, AiSession } from '$lib/models/ai';
	import { Bot, Loader2, Menu, ArrowDown } from 'lucide-svelte';
	import ChatMessage from '$lib/components/ai/ChatMessage.svelte';
	import ChatInput from '$lib/components/ai/ChatInput.svelte';
	import ReviewChangesOverlay from '$lib/components/ai/ReviewChangesOverlay.svelte';
	import ChatSidebar from '$lib/components/ai/ChatSidebar.svelte';

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

<div class="ai-page flex h-full flex-col overflow-hidden">
	<div class="ai-shell flex h-full w-full flex-col overflow-hidden" in:fade={{ duration: 500 }}>
		<div class="ai-layout flex h-full max-h-screen min-h-[90svh] overflow-hidden pb-26 md:pb-8">
			<!-- Mobile Sidebar Overlay -->
			{#if isSidebarOpen}
				<button
					class="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
					onclick={() => (isSidebarOpen = false)}
					aria-label="Close sidebar"
				></button>
			{/if}

			<aside
				class="ai-sidebar fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-border/30 bg-background shadow-lg transition-transform duration-300 md:static md:z-0 md:flex md:rounded-2xl md:border md:shadow-sm {isSidebarOpen
					? 'translate-x-0'
					: '-translate-x-full md:translate-x-0'}"
			>
				<ChatSidebar
					{sessions}
					{currentSessionId}
					onNewChat={startNewChat}
					onLoadSession={loadMessages}
					onCloseSidebar={() => (isSidebarOpen = false)}
				/>
			</aside>

			<section
				class="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/40 bg-background"
				role="main"
			>
				<header
					class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur md:px-6"
				>
					<div class="flex items-center gap-3">
						<button
							class="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background text-foreground shadow-sm transition hover:bg-muted md:hidden"
							onclick={() => (isSidebarOpen = !isSidebarOpen)}
							aria-label="Toggle sidebar"
							aria-expanded={isSidebarOpen}
						>
							<Menu class="h-4 w-4" />
						</button>
						<div class="flex items-center gap-2 text-sm font-semibold">
							<Bot class="text-muted-foreground h-5 w-5" />
							<span>ChatGPT</span>
						</div>
					</div>
					<div class="text-muted-foreground hidden text-xs sm:block">
						{currentSessionId ? 'Chat in progress' : 'New chat'}
					</div>
				</header>

				<div
					class="flex-1 overflow-y-auto scroll-smooth px-4 py-6 md:px-6 md:py-8"
					bind:this={scrollViewport}
					onscroll={handleScroll}
					role="log"
					aria-live="polite"
					aria-label="Chat messages"
				>
					<div class="mx-auto max-w-3xl min-w-0 space-y-6 md:space-y-8">
						{#if messages.length === 0}
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
								<div class="rounded-full border border-border/40 bg-muted/30 p-4">
									<Bot class="text-muted-foreground h-8 w-8" />
								</div>
								<div class="space-y-2">
									<p class="text-xl font-semibold">
										{greeting}{userName ? `, ${userName}` : ''}
									</p>
									<p class="text-muted-foreground max-w-md text-sm">
										Ask a question, generate content, or explore ideas. Here are a few starting
										points.
									</p>
								</div>
								<div
									class="text-muted-foreground grid w-full max-w-2xl grid-cols-1 gap-3 text-left text-sm md:grid-cols-2"
								>
									<div class="rounded-xl border border-border/40 bg-muted/20 px-4 py-4">
										"Plan my week around deep work and workouts."
									</div>
									<div class="rounded-xl border border-border/40 bg-muted/20 px-4 py-4">
										"Summarize my tasks and deadlines."
									</div>
									<div class="rounded-xl border border-border/40 bg-muted/20 px-4 py-4">
										"Draft a status update for leadership."
									</div>
									<div class="rounded-xl border border-border/40 bg-muted/20 px-4 py-4">
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
											class="text-muted-foreground flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/30 px-4 py-3 text-sm font-bold tracking-wide uppercase"
										>
											<Loader2 class="h-4 w-4 animate-spin" />
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
						class="focus-visible:ring-ring absolute right-4 bottom-36 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-background/90 text-foreground shadow-lg backdrop-blur transition-all hover:bg-muted focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 md:right-6"
						onclick={scrollToBottom}
						transition:fade
						aria-label="Scroll to bottom"
					>
						<ArrowDown class="h-5 w-5" />
					</button>
				{/if}

				<div
					class="sticky bottom-0 z-10 flex flex-col border-t border-border/40 bg-background/95 backdrop-blur"
				>
					<ReviewChangesOverlay {pendingAction} {actionTimer} onCancelAction={cancelAction} />
					<div class="px-4 pt-4 pb-5 md:px-6">
						<ChatInput
							bind:input
							{isLoading}
							{pendingAction}
							onSendMessage={sendMessage}
							onInput={(value: string) => (input = value)}
							onKeydown={handleKeydown}
						/>
						<p class="text-muted-foreground mt-3 text-center text-xs">
							ChatGPT can make mistakes. Consider checking important information.
						</p>
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

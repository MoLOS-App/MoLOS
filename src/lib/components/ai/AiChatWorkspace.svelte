<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import type { AiAction, AiMessage, AiSession } from '$lib/models/ai';
	import { Bot, LoaderCircle, Menu, ArrowDown } from 'lucide-svelte';
	import ChatMessage from '$lib/components/ai/ChatMessage.svelte';
	import ChatInput from '$lib/components/ai/ChatInput.svelte';
	import ReviewChangesOverlay from '$lib/components/ai/ReviewChangesOverlay.svelte';
	import ChatSidebar from '$lib/components/ai/ChatSidebar.svelte';
	import { uuid } from '$lib/utils/uuid';

	let { userName } = $props<{ userName?: string }>();

	let sessions = $state<AiSession[]>([]);
	let currentSessionId = $state<string | null>(null);
	let messages = $state<AiMessage[]>([]);
	let input = $state('');
	let isLoading = $state(false);
	let isStreaming = $state(false);
	let streamEnabled = $state(true);
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

	async function loadSettings() {
		const res = await fetch('/api/ai/settings');
		if (res.ok) {
			const data = await res.json();
			streamEnabled = data.settings?.streamEnabled ?? true;
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
		isLoading = false;
		isStreaming = false;
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

	function updateAssistantMessage(messageId: string, content: string) {
		messages = messages.map((msg) => (msg.id === messageId ? { ...msg, content } : msg));
	}

	function applyStreamMeta(meta: { sessionId?: string; actions?: AiAction[] }) {
		if (meta.sessionId) {
			currentSessionId = meta.sessionId;
		}
		if (meta.actions?.some((a) => a.type === 'write' && a.status === 'pending')) {
			pendingAction =
				meta.actions.find((a) => a.type === 'write' && a.status === 'pending') || null;
			if (pendingAction) startActionTimer();
		}
	}

	async function handleStreamResponse(res: Response, assistantMessageId: string) {
		const reader = res.body?.getReader();
		if (!reader) throw new Error('Streaming response unavailable');

		const decoder = new TextDecoder();
		let buffer = '';
		let content = '';

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const parts = buffer.split(/\r?\n\r?\n/);
			buffer = parts.pop() || '';
			for (const part of parts) {
				const lines = part.split(/\r?\n/);
				const dataLines = lines.filter((line) => line.startsWith('data:'));
				if (!dataLines.length) continue;
				const payload = dataLines.map((line) => line.replace(/^data:\s?/, '')).join('\n');
				if (payload === '[DONE]') {
					return;
				}
				let data: { type?: string; content?: string; message?: string } & {
					sessionId?: string;
					actions?: AiAction[];
				};
				try {
					data = JSON.parse(payload);
				} catch {
					continue;
				}
				if (data.type === 'chunk') {
					content += data.content || '';
					updateAssistantMessage(assistantMessageId, content);
					await scrollToBottom();
				} else if (data.type === 'meta') {
					applyStreamMeta(data);
				} else if (data.type === 'error') {
					throw new Error(data.message || 'Streaming failed');
				}
			}
		}
	}

	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		const userContent = input;
		input = '';
		isLoading = true;
		isStreaming = false;

		const tempUserMsg: AiMessage = {
			id: uuid(),
			userId: '',
			sessionId: currentSessionId || '',
			role: 'user',
			content: userContent,
			createdAt: new Date()
		};

		let assistantMessageId: string | null = null;
		if (streamEnabled) {
			assistantMessageId = uuid();
			const tempAssistantMsg: AiMessage = {
				id: assistantMessageId,
				userId: '',
				sessionId: currentSessionId || '',
				role: 'assistant',
				content: '...',
				createdAt: new Date()
			};
			messages = [...messages, tempUserMsg, tempAssistantMsg];
		} else {
			messages = [...messages, tempUserMsg];
		}
		await scrollToBottom();

		try {
			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: userContent,
					sessionId: currentSessionId,
					activeModuleIds,
					stream: streamEnabled
				})
			});

			const isEventStream =
				res.headers.get('content-type')?.includes('text/event-stream') ?? streamEnabled;

			if (res.ok && streamEnabled && isEventStream && assistantMessageId) {
				isStreaming = true;
				await handleStreamResponse(res, assistantMessageId);
				if (currentSessionId) {
					await loadMessages(currentSessionId);
				}
				await loadSessions();
			} else if (res.ok) {
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
		} catch (error) {
			console.error(error);
		} finally {
			isLoading = false;
			isStreaming = false;
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
		loadSettings();
	});
</script>

<div class="flex flex-col h-full overflow-hidden">
	<div class="flex flex-col w-full h-full mb-4 overflow-hidden md:pr-4" in:fade={{ duration: 500 }}>
		<div
			class="flex h-full min-h-[90svh] overflow-hidden md:rounded-2xl md:border md:border-border/70"
		>
			<!-- Mobile Sidebar Overlay -->
			{#if isSidebarOpen}
				<button
					class="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
					onclick={() => (isSidebarOpen = false)}
					aria-label="Close sidebar"
				></button>
			{/if}

			<aside
				class="fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r border-border/60 bg-background shadow-lg transition-transform duration-300 ease-out md:static md:z-0 md:flex md:bg-muted/20 md:shadow-sm {isSidebarOpen
					? 'translate-x-0'
					: '-translate-x-full md:translate-x-0'}"
			>
				<ChatSidebar
					{sessions}
					{currentSessionId}
					{userName}
					onNewChat={startNewChat}
					onLoadSession={loadMessages}
					onCloseSidebar={() => (isSidebarOpen = false)}
				/>
			</aside>

			<section
				class="relative flex flex-col flex-1 min-w-0 overflow-hidden bg-background md:bg-transparent"
				role="main"
			>
				<header
					class="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-background md:px-6"
				>
					<div class="flex items-center gap-3">
						<button
							class="flex items-center justify-center transition border rounded-full shadow-sm focus-visible:ring-ring h-9 w-9 border-border/50 bg-background text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-offset-2 md:hidden"
							onclick={() => (isSidebarOpen = !isSidebarOpen)}
							aria-label="Toggle sidebar"
							aria-expanded={isSidebarOpen}
						>
							<Menu class="w-4 h-4" />
						</button>
						<div class="flex items-center gap-2 text-sm font-semibold">
							<Bot class="w-5 h-5 text-muted-foreground" />
							<span>The Architect</span>
						</div>
					</div>
					<div class="hidden text-xs text-muted-foreground sm:block">
						{currentSessionId ? 'Chat in progress' : 'New chat'}
					</div>
				</header>

				<div
					class="flex-1 px-4 py-6 overflow-y-auto scroll-smooth md:px-6 md:py-8"
					bind:this={scrollViewport}
					onscroll={handleScroll}
					role="log"
					aria-live="polite"
					aria-label="Chat messages"
				>
					<div class="w-full max-w-4xl min-w-0 mx-auto space-y-6 md:space-y-8">
						{#if messages.length === 0}
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
								<div class="p-4 border rounded-full border-border/60 bg-muted/30">
									<Bot class="w-8 h-8 text-muted-foreground" />
								</div>
								<div class="space-y-2">
									<p class="text-xl font-semibold">
										{greeting}{userName ? `, ${userName}` : ''}
									</p>
									<p class="max-w-md text-sm text-muted-foreground">
										Ask a question, generate content, or explore ideas. Here are a few starting
										points.
									</p>
								</div>
								<div
									class="grid w-full max-w-2xl grid-cols-1 gap-3 text-sm text-left text-muted-foreground md:grid-cols-2"
								>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										"Plan my week around deep work and workouts."
									</div>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										"Summarize my tasks and deadlines."
									</div>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										"Draft a status update for leadership."
									</div>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										"Turn meeting notes into action items."
									</div>
								</div>
							</div>
						{:else}
							<div class="flex flex-col gap-6">
								{#each messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.content?.trim() !== '' || m.contextMetadata || m.parts || m.attachments))) as msg (msg.id)}
									<ChatMessage message={msg} />
								{/each}
								{#if isLoading && !isStreaming}
									<div class="flex items-start" in:fade>
										<div
											class="flex items-center gap-3 px-4 py-3 text-sm font-bold tracking-wide uppercase border shadow-sm text-muted-foreground animate-pulse rounded-2xl border-border/60 bg-muted/35"
										>
											<LoaderCircle class="w-4 h-4 animate-spin" />
											Thinking
											<span class="inline-flex gap-1">
												<span
													class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40"
												></span>
												<span
													class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40 [animation-delay:0.2s]"
												></span>
												<span
													class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40 [animation-delay:0.4s]"
												></span>
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
						class="absolute z-20 flex items-center justify-center transition-all border rounded-full shadow-lg focus-visible:ring-ring right-4 bottom-36 h-11 w-11 border-border/60 bg-background text-foreground backdrop-blur hover:bg-muted/90 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 md:right-6"
						onclick={scrollToBottom}
						transition:fade
						aria-label="Scroll to bottom"
					>
						<ArrowDown class="w-5 h-5" />
					</button>
				{/if}

				<div class="sticky bottom-0 z-10 flex flex-col border-t border-border/60 bg-background">
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
					</div>
				</div>
			</section>
		</div>
	</div>
</div>

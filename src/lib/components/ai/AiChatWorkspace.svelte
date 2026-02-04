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

	// Enhanced progress state with execution tracking
	type ProgressStatus = 'idle' | 'thinking' | 'planning' | 'executing' | 'complete' | 'error';

	interface ExecutionLogEntry {
		id: string;
		type: 'info' | 'success' | 'error' | 'warning' | 'pending';
		message: string;
		step?: number;
		total?: number;
		timestamp: number;
	}

	interface CurrentAction {
		type: 'plan' | 'step_start' | 'step_complete' | 'step_failed' | 'thinking';
		message: string;
		step?: number;
		total?: number;
		timestamp: number;
	}

	let currentProgress = $state<{
		status: ProgressStatus;
		currentAction: CurrentAction | null;
		executionLog: ExecutionLogEntry[];
	}>({
		status: 'idle',
		currentAction: null,
		executionLog: []
	});

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
		// Reset progress state
		currentProgress = {
			status: 'idle',
			currentAction: null,
			executionLog: []
		};
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
				let data: { type?: string; content?: string; message?: string; eventType?: string; timestamp?: number; data?: any } & {
					sessionId?: string;
					actions?: AiAction[];
					progressEvents?: any[];
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
				} else if (data.type === 'progress') {
					// Handle progress events from the new agent
					handleProgressEvent(data);
				} else if (data.type === 'meta') {
					applyStreamMeta(data);
				} else if (data.type === 'error') {
					throw new Error(data.message || 'Streaming failed');
				}
			}
		}
	}

	function handleProgressEvent(event: any) {
		const { eventType, data: eventData } = event;
		const now = Date.now();

		switch (eventType) {
			case 'plan':
				currentProgress.status = 'planning';
				currentProgress.currentAction = {
					type: 'plan',
					message: `Creating plan: ${eventData.goal}`,
					step: 0,
					total: eventData.totalSteps,
					timestamp: now
				};
				break;

			case 'step_start':
				currentProgress.status = 'executing';
				currentProgress.currentAction = {
					type: 'step_start',
					message: eventData.description || 'Working...',
					step: eventData.stepNumber,
					total: eventData.totalSteps,
					timestamp: now
				};
				// Add pending entry to log
				currentProgress.executionLog.push({
					id: `step-${eventData.stepNumber}-${now}`,
					type: 'pending',
					message: eventData.description || 'Working...',
					step: eventData.stepNumber,
					total: eventData.totalSteps,
					timestamp: now
				});
				break;

			case 'step_complete':
				currentProgress.status = 'executing';
				const stepNumber = eventData.stepNumber;
				const completeMsg = `Completed: ${eventData.description?.substring(0, 50) || 'Step'}`;
				currentProgress.currentAction = {
					type: 'step_complete',
					message: completeMsg,
					step: stepNumber,
					total: eventData.totalSteps,
					timestamp: now
				};
				// Update or add success entry to log
				const existingEntry = currentProgress.executionLog.find(
					e => e.step === stepNumber && e.type === 'pending'
				);
				if (existingEntry) {
					existingEntry.type = 'success';
					existingEntry.message = `[${stepNumber}/${eventData.totalSteps}] ✓ ${eventData.description || 'Completed'}`;
					existingEntry.timestamp = now;
				} else {
					currentProgress.executionLog.push({
						id: `step-${stepNumber}-${now}`,
						type: 'success',
						message: `[${stepNumber}/${eventData.totalSteps}] ✓ ${eventData.description || 'Completed'}`,
						step: stepNumber,
						total: eventData.totalSteps,
						timestamp: now
					});
				}
				break;

			case 'step_failed':
				currentProgress.status = 'error';
				const failedStep = eventData.stepNumber;
				const errorMsg = eventData.error || 'Unknown error';
				currentProgress.currentAction = {
					type: 'step_failed',
					message: `Failed: ${errorMsg}`,
					step: failedStep,
					total: eventData.totalSteps,
					timestamp: now
				};
				// Update or add error entry to log
				const failedEntry = currentProgress.executionLog.find(
					e => e.step === failedStep && e.type === 'pending'
				);
				if (failedEntry) {
					failedEntry.type = 'error';
					failedEntry.message = `[${failedStep}/${eventData.totalSteps}] ✗ ${eventData.description || 'Failed'}: ${errorMsg}`;
					failedEntry.timestamp = now;
				} else {
					currentProgress.executionLog.push({
						id: `step-${failedStep}-${now}`,
						type: 'error',
						message: `[${failedStep}/${eventData.totalSteps}] ✗ ${eventData.description || 'Failed'}: ${errorMsg}`,
						step: failedStep,
						total: eventData.totalSteps,
						timestamp: now
					});
				}
				break;

			case 'thinking':
				currentProgress.status = 'thinking';
				currentProgress.currentAction = {
					type: 'thinking',
					message: eventData.thought || 'Thinking...',
					timestamp: now
				};
				// Add thinking to log
				currentProgress.executionLog.push({
					id: `thinking-${now}`,
					type: 'info',
					message: eventData.thought || 'Thinking...',
					timestamp: now
				});
				break;

			case 'complete':
				currentProgress.status = 'complete';
				currentProgress.currentAction = {
					type: 'step_complete',
					message: 'All done!',
					timestamp: now
				};
				break;

			case 'error':
				currentProgress.status = 'error';
				currentProgress.currentAction = {
					type: 'step_failed',
					message: eventData.error || 'Something went wrong',
					timestamp: now
				};
				currentProgress.executionLog.push({
					id: `error-${now}`,
					type: 'error',
					message: `Error: ${eventData.error || 'Something went wrong'}`,
					timestamp: now
				});
				break;
		}
	}

	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		const userContent = input;
		input = '';
		isLoading = true;
		isStreaming = false;
		// Reset progress state for new message
		currentProgress = {
			status: 'thinking',
			currentAction: null,
			executionLog: []
		};

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

<div class="flex h-full flex-col overflow-hidden">
	<div class="mb-4 flex h-full w-full flex-col overflow-hidden md:pr-4" in:fade={{ duration: 500 }}>
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
				class="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background md:bg-transparent"
				role="main"
			>
				<header
					class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background px-4 py-3 md:px-6"
				>
					<div class="flex items-center gap-3">
						<button
							class="focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background text-foreground shadow-sm transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-offset-2 md:hidden"
							onclick={() => (isSidebarOpen = !isSidebarOpen)}
							aria-label="Toggle sidebar"
							aria-expanded={isSidebarOpen}
						>
							<Menu class="h-4 w-4" />
						</button>
						<div class="flex items-center gap-2 text-sm font-semibold">
							<Bot class="text-muted-foreground h-5 w-5" />
							<span>The Architect</span>
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
					<div class="mx-auto w-full max-w-4xl min-w-0 space-y-6 md:space-y-8">
						{#if messages.length === 0}
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
								<div class="rounded-full border border-border/60 bg-muted/30 p-4">
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
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										"Plan my week around deep work and workouts."
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										"Summarize my tasks and deadlines."
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										"Draft a status update for leadership."
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										"Turn meeting notes into action items."
									</div>
								</div>
							</div>
						{:else}
							<div class="flex flex-col gap-6">
								{#each messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.content?.trim() !== '' || m.contextMetadata || m.parts || m.attachments))) as msg (msg.id)}
									<ChatMessage message={msg} />
								{/each}

								<!-- Enhanced Progress Display -->
								{#if isLoading || currentProgress.status !== 'idle'}
									<div class="flex flex-col gap-3" in:fade>
										<!-- Loader with Status -->
										{#if isLoading && !isStreaming}
											<div class="flex items-start">
												<div
													class="text-muted-foreground flex animate-pulse items-center gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm font-bold tracking-wide uppercase shadow-sm"
												>
													<LoaderCircle class="h-4 w-4 animate-spin" />
													{#if currentProgress.status === 'thinking'}
														Thinking
													{:else if currentProgress.status === 'planning'}
														Planning
													{:else if currentProgress.status === 'executing'}
														Executing
													{:else if currentProgress.status === 'complete'}
														Complete
													{:else if currentProgress.status === 'error'}
														Error
													{:else}
														Working
													{/if}
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

										<!-- Current Action (prominently displayed) -->
										{#if currentProgress.currentAction}
											<div class="flex items-center gap-3 text-sm text-muted-foreground" in:fade>
												<div class="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
												<span>
													{#if currentProgress.currentAction.step && currentProgress.currentAction.total}
														[{currentProgress.currentAction.step}/{currentProgress.currentAction.total}] {currentProgress.currentAction.message}
													{:else}
														{currentProgress.currentAction.message}
													{/if}
												</span>
											</div>
										{/if}
									</div>
								{/if}

								<!-- Execution Log (persistent) -->
								{#if currentProgress.executionLog.length > 0}
									<div class="rounded-xl border border-border/50 bg-muted/20 p-3">
										<div class="mb-2 flex items-center justify-between">
											<span class="text-xs font-semibold uppercase text-muted-foreground">
												Execution Log
											</span>
											<span class="text-muted-foreground text-[10px]">
												{currentProgress.executionLog.length} {currentProgress.executionLog.length === 1 ? 'entry' : 'entries'}
											</span>
										</div>
										<div class="max-h-64 space-y-1 overflow-y-auto">
											{#each currentProgress.executionLog as entry (entry.id)}
												<div
													class="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/40 {entry.type === 'error'
														? 'text-destructive'
														: entry.type === 'success'
															? 'text-green-600 dark:text-green-400'
															: entry.type === 'warning'
																? 'text-yellow-600 dark:text-yellow-400'
																: 'text-muted-foreground'}"
												>
													<span class="flex-shrink-0">
														{#if entry.type === 'success'}
															✓
														{:else if entry.type === 'error'}
															✗
														{:else if entry.type === 'pending'}
															⟳
														{:else if entry.type === 'warning'}
															⚠
														{:else}
															•
														{/if}
													</span>
													<span class="flex-1">{entry.message}</span>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				{#if showScrollButton}
					<button
						class="focus-visible:ring-ring absolute right-4 bottom-36 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-lg backdrop-blur transition-all hover:bg-muted/90 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 md:right-6"
						onclick={scrollToBottom}
						transition:fade
						aria-label="Scroll to bottom"
					>
						<ArrowDown class="h-5 w-5" />
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

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import type { AiAction, AiMessage, AiSession } from '$lib/models/ai';
	import { Bot, Menu, ArrowDown } from 'lucide-svelte';
	import ChatMessage from '$lib/components/ai/ChatMessage.svelte';
	import ChatInput from '$lib/components/ai/ChatInput.svelte';
	import ReviewChangesOverlay from '$lib/components/ai/ReviewChangesOverlay.svelte';
	import ChatSidebar from '$lib/components/ai/ChatSidebar.svelte';
	import ProgressDisplay from '$lib/components/ai/ProgressDisplay.svelte';
	import { uuid } from '$lib/utils/uuid';
	import type { ProgressState } from './progress-types';
	import { INITIAL_PROGRESS_STATE } from './progress-types';
	import type { UIMessage } from 'ai';

	let { userName } = $props<{ userName?: string }>();

	// Session state
	let sessions = $state<AiSession[]>([]);
	let currentSessionId = $state<string | null>(null);

	// Messages in UIMessage format (AI SDK compatible)
	let messages = $state<UIMessage[]>([]);

	// Input state
	let input = $state('');
	let isLoading = $state(false);
	let isStreaming = $state(false);
	let isCancelling = $state(false);
	let streamEnabled = $state(true);

	// UI state
	let scrollViewport = $state<HTMLElement | null>(null);
	let pendingAction = $state<AiAction | null>(null);
	let actionTimer = $state(5);
	let timerInterval = $state<number | null>(null);
	let isSidebarOpen = $state(false);
	let showScrollButton = $state(false);

	// AbortController for cancelling requests
	let abortController: AbortController | null = null;

	// Progress state for agent execution tracking
	let currentProgress = $state<ProgressState>({ ...INITIAL_PROGRESS_STATE });

	// Progress log to be shown in accordion
	let progressLog = $state<string[]>([]);

	// Track the current assistant message ID for real-time updates
	let currentAssistantMessageId = $state<string | null>(null);

	// Active modules from page data
	let activeModuleIds = $derived($page.data.activeExternalIds || []);

	// Greeting based on time
	const now = new Date();
	const greeting =
		now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

	// Computed loading state
	let isProcessing = $derived(isLoading || isStreaming);

	// Load sessions from API
	async function loadSessions() {
		const res = await fetch('/api/ai/chat');
		if (res.ok) {
			const data = await res.json();
			sessions = data.sessions || [];
		}
	}

	// Load settings
	async function loadSettings() {
		const res = await fetch('/api/ai/settings');
		if (res.ok) {
			const data = await res.json();
			streamEnabled = data.settings?.streamEnabled ?? true;
		}
	}

	// Load messages for a session
	async function loadMessages(sessionId: string) {
		const res = await fetch(`/api/ai/chat?sessionId=${sessionId}`);
		if (res.ok) {
			const data = await res.json();
			messages = data.messages || [];
			currentSessionId = sessionId;
			await scrollToBottom();
		}
	}

	// Start a new chat
	function startNewChat() {
		currentSessionId = null;
		messages = [];
		input = '';
		pendingAction = null;
		isLoading = false;
		isStreaming = false;
		isCancelling = false;
		isSidebarOpen = false;
		// Cancel any ongoing request
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		// Reset progress state
		currentProgress = { ...INITIAL_PROGRESS_STATE };
		progressLog = [];
		currentAssistantMessageId = null;
	}

	// Timer for action confirmation
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

	// Update assistant message content (for streaming)
	function updateAssistantMessage(messageId: string, content: string) {
		messages = messages.map((msg) =>
			msg.id === messageId
				? { ...msg, parts: [{ type: 'text' as const, text: content }] }
				: msg
		);
	}

	// Apply stream metadata
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

	// Handle streaming response
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
				let data: {
					type?: string;
					content?: string;
					message?: string;
					eventType?: string;
					timestamp?: number;
					data?: any;
				} & {
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
					handleProgressEvent(data);
				} else if (data.type === 'meta') {
					applyStreamMeta(data);
				} else if (data.type === 'error') {
					throw new Error(data.message || 'Streaming failed');
				}
			}
		}
	}

	// Handle progress events
	function handleProgressEvent(event: any) {
		const { eventType, data: eventData } = event;
		const now = Date.now();

		function addProgressLine(content: string) {
			progressLog = [...progressLog, content];
			if (currentAssistantMessageId) {
				messages = messages.map((msg) =>
					msg.id === currentAssistantMessageId
						? {
								...msg,
								// Store progress log in a custom property for display
								...(msg as any).metadata?.progressLog !== undefined
									? { metadata: { ...(msg as any).metadata, progressLog } }
									: {}
							}
						: msg
				);
			}
		}

		switch (eventType) {
			case 'plan':
				currentProgress.status = 'planning';
				currentProgress.planGoal = eventData.goal;
				currentProgress.totalSteps = eventData.totalSteps;
				currentProgress.currentAction = {
					type: 'plan',
					message: `Creating plan: ${eventData.goal}`,
					step: 0,
					total: eventData.totalSteps,
					timestamp: now
				};
				addProgressLine(`📋 Plan: ${eventData.goal}\nSteps: ${eventData.totalSteps || 'Unknown'}`);
				break;

			case 'thought':
				currentProgress.status = 'thinking';
				currentProgress.currentAction = {
					type: 'thought',
					message: eventData.reasoning || `Iteration ${eventData.iteration}: ${eventData.nextAction}`,
					step: eventData.iteration,
					total: eventData.totalSteps,
					timestamp: now,
					reasoning: eventData.reasoning,
					nextAction: eventData.nextAction,
					confidence: eventData.confidence
				};
				if (eventData.reasoning && eventData.reasoning.length > 10) {
					addProgressLine(`💭 [${eventData.iteration}] ${eventData.reasoning}`);
				}
				break;

			case 'observation':
				currentProgress.status = 'executing';
				const obsMessage = eventData.isSuccess
					? `✓ ${eventData.toolName}: Success`
					: `✗ ${eventData.toolName}: Failed`;
				currentProgress.currentAction = {
					type: 'observation',
					message: obsMessage,
					step: eventData.iteration,
					total: eventData.totalSteps,
					timestamp: now,
					toolName: eventData.toolName
				};
				addProgressLine(`👁 ${obsMessage}${eventData.durationMs ? ` (${eventData.durationMs}ms)` : ''}`);
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
				addProgressLine(
					`[${eventData.stepNumber}/${eventData.totalSteps}] ▸ ${eventData.description || 'Working...'}`
				);
				break;

			case 'step_complete':
				currentProgress.status = 'executing';
				const stepNumber = eventData.stepNumber;
				const completeMsg = `✓ Completed: ${eventData.description || 'Step'}`;
				currentProgress.currentAction = {
					type: 'step_complete',
					message: completeMsg,
					step: stepNumber,
					total: eventData.totalSteps,
					timestamp: now
				};
				addProgressLine(
					`[${stepNumber}/${eventData.totalSteps}] ✓ ${eventData.description || 'Completed'}`
				);
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
				addProgressLine(
					`[${failedStep}/${eventData.totalSteps}] ✗ Failed: ${eventData.description || 'Step'}\nError: ${errorMsg}`
				);
				break;

			case 'thinking':
				currentProgress.status = 'thinking';
				currentProgress.currentAction = {
					type: 'thinking',
					message: eventData.thought || 'Thinking...',
					timestamp: now
				};
				if (eventData.thought && eventData.thought.length > 10) {
					addProgressLine(`💭 ${eventData.thought}`);
				}
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
				addProgressLine(`❌ Error: ${eventData.error || 'Something went wrong'}`);
				break;
		}
	}

	// Send message
	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		const userContent = input;
		input = '';
		isLoading = true;
		isStreaming = false;
		isCancelling = false;
		// Reset progress state for new message
		currentProgress = { ...INITIAL_PROGRESS_STATE, status: 'thinking' };
		// Reset progress log
		progressLog = [];
		// Reset current assistant message ID
		currentAssistantMessageId = null;

		// Create AbortController for this request
		abortController = new AbortController();

		// Create user message in UIMessage format
		const tempUserMsg: UIMessage = {
			id: uuid(),
			role: 'user',
			parts: [{ type: 'text', text: userContent }]
		};

		let assistantMessageId: string | null = null;
		if (streamEnabled) {
			assistantMessageId = uuid();
			currentAssistantMessageId = assistantMessageId;
			const tempAssistantMsg: UIMessage = {
				id: assistantMessageId,
				role: 'assistant',
				parts: [{ type: 'text', text: '...' }]
			};
			messages = [...messages, tempUserMsg, tempAssistantMsg];
		} else {
			messages = [...messages, tempUserMsg];
		}
		await scrollToBottom();

		try {
			// Build request body in AI SDK format (messages array with parts)
			const requestBody = {
				messages: messages.slice(0, -1).map(m => ({
					id: m.id,
					role: m.role,
					parts: m.parts
				})),
				sessionId: currentSessionId,
				activeModuleIds,
				stream: streamEnabled
			};

			const res = await fetch('/api/ai/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
				signal: abortController.signal
			});

			// Check if request was aborted
			if (abortController.signal.aborted) {
				throw new Error('Request cancelled');
			}

			const isEventStream =
				res.headers.get('content-type')?.includes('text/event-stream') ?? streamEnabled;

			if (res.ok && streamEnabled && isEventStream && assistantMessageId) {
				isStreaming = true;
				await handleStreamResponse(res, assistantMessageId);
				// Save the progress log before loading messages
				const savedProgressLog = [...progressLog];
				if (currentSessionId) {
					await loadMessages(currentSessionId);
					// Re-attach progress log to the last assistant message
					const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
					if (lastAssistantMsg && savedProgressLog.length > 0) {
						messages = messages.map((m) =>
							m.id === lastAssistantMsg.id
								? { ...m, metadata: { ...(m as any).metadata, progressLog: savedProgressLog } }
								: m
						);
					}
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
				if (currentSessionId) {
					await loadMessages(currentSessionId);
				}
				await loadSessions();
			}
		} catch (error) {
			// Only log error if it's not a cancellation
			if (
				(error as Error).name !== 'AbortError' &&
				(error as Error).message !== 'Request cancelled'
			) {
				console.error(error);
			}
		} finally {
			isLoading = false;
			isStreaming = false;
			isCancelling = false;
			abortController = null;
			await scrollToBottom();
		}
	}

	// Cancel execution
	function cancelExecution() {
		if (abortController && !isCancelling) {
			isCancelling = true;
			abortController.abort();
			// Add cancellation to the progress log
			progressLog = [...progressLog, '⚠️ Execution cancelled by user'];
			// Update progress status
			currentProgress.status = 'error';
			currentProgress.currentAction = {
				type: 'step_failed',
				message: 'Cancelled',
				timestamp: Date.now()
			};
		}
	}

	// Scroll to bottom
	async function scrollToBottom() {
		await tick();
		if (scrollViewport) {
			scrollViewport.scrollTo({
				top: scrollViewport.scrollHeight,
				behavior: 'smooth'
			});
		}
	}

	// Handle scroll
	function handleScroll() {
		if (!scrollViewport) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollViewport;
		showScrollButton = scrollHeight - scrollTop - clientHeight > 200;
	}

	// Handle keydown
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
							<!-- Empty State -->
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
							<!-- Message List -->
							<div class="flex flex-col gap-6">
								{#each messages as msg (msg.id)}
									{@const textPart = msg.parts?.find((p: any) => p.type === 'text') as { type: 'text'; text: string } | undefined}
									{@const textContent = textPart?.text || ''}
									{@const hasContent = textContent.trim() !== '' || (msg as any).metadata?.progressLog}
									{#if msg.role === 'user' || hasContent}
										<ChatMessage
											message={{
												id: msg.id,
												userId: '',
												sessionId: currentSessionId || '',
												role: msg.role as 'user' | 'assistant',
												content: textContent,
												createdAt: (msg as any).createdAt || new Date(),
												parts: msg.parts,
												metadata: (msg as any).metadata
											}}
										/>
									{/if}
								{/each}

								<!-- Progress Display -->
								<ProgressDisplay
									isLoading={isLoading}
									isStreaming={isStreaming}
									isCancelling={isCancelling}
									progress={currentProgress}
									onCancel={cancelExecution}
								/>
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
							isLoading={isProcessing}
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

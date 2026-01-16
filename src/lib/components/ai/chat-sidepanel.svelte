<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { AiMessage, AiAction, AiSession } from '$lib/models/ai';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { Loader2 } from 'lucide-svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	import ChatHeader from './ChatHeader.svelte';
	import SessionList from './SessionList.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import ChatInput from './ChatInput.svelte';
	import ReviewChangesOverlay from './ReviewChangesOverlay.svelte';
	import { uuid } from '$lib/utils/uuid';

	let { isOpen = $bindable(false) } = $props();

	let sessions = $state<AiSession[]>([]);
	let currentSessionId = $state<string | null>(null);
	let messages = $state<AiMessage[]>([]);
	let input = $state('');
	let isLoading = $state(false);
	let scrollViewport = $state<HTMLElement | null>(null);
	let view = $state<'sessions' | 'chat'>('sessions');

	// Delete dialog state
	let showDeleteDialog = $state(false);
	let sessionToDelete = $state<string | null>(null);

	// Resizing State
	let width = $state(384); // Default 384px (md:w-96)
	let isResizing = $state(false);
	const minWidth = 320;
	const maxWidth = 800;

	// Review Changes State
	let pendingAction = $state<AiAction | null>(null);
	let actionTimer = $state<number>(5);
	let timerInterval = $state<number | null>(null);

	// Get active modules from page data (passed from root layout)
	let activeModuleIds = $derived($page.data.activeExternalIds || []);

	async function loadSessions() {
		const res = await fetch('/api/ai/chat');
		if (res.ok) {
			const data = await res.json();
			sessions = data.sessions;
		}
	}

	async function loadMessages(sessionId: string) {
		const res = await fetch(`/api/ai/chat?sessionId=${sessionId}`);
		if (res.ok) {
			const data = await res.json();
			messages = data.messages;
			currentSessionId = sessionId;
			view = 'chat';
			await scrollToBottom();
		}
	}

	async function startNewChat() {
		currentSessionId = null;
		messages = [];
		view = 'chat';
	}

	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		const userContent = input;
		input = '';
		isLoading = true;

		// Optimistic update
		const tempUserMsg: AiMessage = {
			id: uuid(),
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
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
			await scrollToBottom();
		}
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
		pendingAction = null; // Clear immediately to avoid double execution
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

			if (res.ok) {
				// Refresh UI data
				await refreshModuleData(action);
				await loadMessages(currentSessionId!);
			}
		} catch (e) {
			toast.error('Failed to execute action');
		} finally {
			isLoading = false;
		}
	}

	async function refreshModuleData(action: AiAction) {
		console.log('Refreshing module data for action:', action);
		const entity = action.entity.toLowerCase();
		const toolName = ((action.data as any)?.toolName || '').toLowerCase();

		// Always invalidate SvelteKit data
		await invalidateAll();

		try {
			// TODO: this has to be different because of external modules

			// Determine which stores to refresh
			// const isTask =
			// 	entity.includes('task') ||
			// 	entity.includes('project') ||
			// 	entity.includes('area') ||
			// 	entity.includes('log') ||
			// 	toolName.includes('task');
			// const isFinance =
			// 	entity.includes('expense') ||
			// 	entity.includes('sub') ||
			// 	entity.includes('account') ||
			// 	entity.includes('budget') ||
			// 	toolName.includes('expense');
			// const isHealth =
			// 	entity.includes('weight') ||
			// 	entity.includes('activity') ||
			// 	entity.includes('measure') ||
			// 	entity.includes('profile') ||
			// 	toolName.includes('weight') ||
			// 	toolName.includes('activity');
			// const isGoal =
			// 	entity.includes('goal') || entity.includes('resource') || toolName.includes('goal');
			// const isMeal =
			// 	entity.includes('meal') ||
			// 	entity.includes('workout') ||
			// 	toolName.includes('meal') ||
			// 	toolName.includes('workout');

			// if (isTask) {
			// 	console.log('Refreshing Tasks store...');
			// 	const { loadAllTasksData } = await import('$lib/stores/modules/tasks/tasks.store');
			// 	await loadAllTasksData();
			// }
			// if (isFinance) {
			// 	console.log('Refreshing Finance store...');
			// 	const { loadAllFinanceData } = await import('$lib/stores/modules/finance/finance.store');
			// 	await loadAllFinanceData();
			// }
			// if (isHealth) {
			// 	console.log('Refreshing Health store...');
			// 	const { loadAllHealthData } = await import('$lib/stores/modules/health/health.store');
			// 	await loadAllHealthData();
			// }
			// if (isGoal) {
			// 	console.log('Refreshing Goals store...');
			// 	const { loadAllGoalsData } = await import('$lib/stores/modules/goals/goals.store');
			// 	await loadAllGoalsData();
			// }
			// if (isMeal) {
			// 	console.log('Refreshing Meals store...');
			// 	const { loadAllMealsData } = await import('$lib/stores/modules/meals/meals.store');
			// 	await loadAllMealsData();
			// }

			console.log('Refresh complete.');
		} catch (e) {
			console.warn(`Failed to refresh store for action:`, e);
		}
	}

	function deleteSession(sessionId: string) {
		sessionToDelete = sessionId;
		showDeleteDialog = true;
	}

	async function confirmDelete() {
		if (sessionToDelete) {
			await fetch(`/api/ai/chat?sessionId=${sessionToDelete}`, { method: 'DELETE' });
			await loadSessions();
			if (currentSessionId === sessionToDelete) {
				view = 'sessions';
				currentSessionId = null;
			}
		}
		showDeleteDialog = false;
		sessionToDelete = null;
	}

	async function scrollToBottom() {
		await tick();
		if (scrollViewport) {
			scrollViewport.scrollTop = scrollViewport.scrollHeight;
		}
	}

	// Resizing Handlers
	function startResizing(e: MouseEvent) {
		isResizing = true;
		e.preventDefault();
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isResizing) return;
		const newWidth = window.innerWidth - e.clientX;
		if (newWidth >= minWidth && newWidth <= maxWidth) {
			width = newWidth;
		}
	}

	function stopResizing() {
		isResizing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	onMount(() => {
		loadSessions();
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', stopResizing);
		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', stopResizing);
		};
	});

	$effect(() => {
		if (isOpen && view === 'chat') {
			scrollToBottom();
		}
	});
</script>

{#if isOpen}
	<aside
		class="flex flex-col border-l border-border/60 bg-background/95 shadow-sm backdrop-blur transition-all duration-300"
		style="width: min({width}px, 100vw)"
	>
		<!-- Resize Handle -->
		<button
			type="button"
			aria-label="Resize handle"
			class="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize transition-colors hover:bg-primary/30 {isResizing
				? 'bg-primary'
				: ''}"
			onmousedown={startResizing}
		></button>

		<ChatHeader
			{view}
			onBack={() => (view = 'sessions')}
			onNewChat={startNewChat}
			onClose={() => (isOpen = false)}
		/>

		{#if view === 'sessions'}
			<SessionList
				{sessions}
				onNewChat={startNewChat}
				onLoadSession={loadMessages}
				onDeleteSession={deleteSession}
			/>
		{:else}
			<!-- Chat View -->
			<div class="flex-1 overflow-y-auto scroll-smooth bg-muted/10 p-4" bind:this={scrollViewport}>
				<div class="space-y-6">
					{#each messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && (m.content?.trim() !== '' || m.contextMetadata || m.parts || m.attachments))) as msg (msg.id)}
						<ChatMessage message={msg} />
					{/each}
					{#if isLoading}
						<div class="flex items-start">
							<div
								class="text-muted-foreground flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-[10px] tracking-[0.2em] uppercase shadow-sm"
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
			</div>

			<ReviewChangesOverlay {pendingAction} {actionTimer} onCancelAction={cancelAction} />

			<ChatInput
				bind:input
				{isLoading}
				{pendingAction}
				onSendMessage={sendMessage}
				onInput={(value: string) => (input = value)}
				onKeydown={handleKeydown}
			/>
		{/if}
	</aside>
{/if}

<AlertDialog.Root bind:open={showDeleteDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Chat Session</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete this chat session? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmDelete}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

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

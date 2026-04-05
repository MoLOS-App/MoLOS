<script lang="ts">
	import { fade } from 'svelte/transition';
	import { LoaderCircle, X, ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { ProgressState } from './progress-types';
	import { getStatusText } from './progress-types';

	let {
		isLoading = false,
		isStreaming = false,
		isCancelling = false,
		progress,
		onCancel
	}: {
		isLoading?: boolean;
		isStreaming?: boolean;
		isCancelling?: boolean;
		progress: ProgressState;
		onCancel?: () => void;
	} = $props();

	// Show cancel button only during active execution
	const canCancel = $derived(
		!isCancelling &&
			(progress.status === 'thinking' ||
				progress.status === 'planning' ||
				progress.status === 'executing')
	);

	const showCancelButton = $derived(isLoading && canCancel);

	// Tool result state for collapsible display
	let showToolResult = $state(false);

	// Check if current action has a result
	const hasToolResult = $derived(
		progress.currentAction?.result !== undefined && progress.currentAction?.result !== null
	);

	// Format result for display (truncate if too long)
	const toolResultPreview = $derived.by(() => {
		if (!progress.currentAction?.result) return '';
		const result = progress.currentAction.result;
		const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
		// Limit preview to 500 chars
		return resultStr.length > 500 ? resultStr.substring(0, 500) + '...' : resultStr;
	});

	// Reset expanded state when action changes
	$effect(() => {
		if (progress.currentAction?.toolName) {
			showToolResult = false;
		}
	});
</script>

{#if isLoading || progress.status !== 'idle'}
	<div class="flex flex-col gap-3" in:fade>
		<!-- Loader with Status and Cancel -->
		{#if isLoading && !isStreaming}
			<div class="flex items-center gap-3">
				<div
					class="text-muted-foreground flex animate-pulse items-center gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm font-bold tracking-wide uppercase shadow-sm"
					class:opacity-50={isCancelling}
				>
					<LoaderCircle class="h-4 w-4 animate-spin" />
					{isCancelling ? 'Cancelling...' : getStatusText(progress.status)}
					<span class="inline-flex gap-1" class:opacity-0={isCancelling}>
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

				<!-- Cancel Button -->
				{#if showCancelButton}
					<button
						onclick={onCancel}
						class="focus-visible:ring-ring flex h-9 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition hover:bg-muted/90 hover:text-destructive focus-visible:ring-2 focus-visible:ring-offset-2"
						title="Stop execution"
						disabled={isCancelling}
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
		{/if}

		<!-- Current Action (prominently displayed) -->
		{#if progress.currentAction && progress.currentAction.type !== 'thinking'}
			<div class="text-muted-foreground flex items-center gap-3 text-sm" in:fade>
				<div
					class="h-2 w-2 rounded-full bg-primary"
					class:animate-pulse={isLoading || isStreaming}
					class:bg-green-500={progress.status === 'complete'}
					class:bg-destructive={isCancelling || progress.status === 'error'}
				></div>
				<span>
					{#if isCancelling}
						Cancelling...
					{:else if progress.currentAction.step && progress.currentAction.total}
						[{progress.currentAction.step}/{progress.currentAction.total}]
						{progress.currentAction.message}
					{:else}
						{progress.currentAction.message}
					{/if}
				</span>
			</div>
		{/if}

		<!-- Tool Result Preview (collapsible) -->
		{#if hasToolResult}
			<div
				class="text-muted-foreground/90 flex flex-col gap-1 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs"
				in:fade
			>
				<button
					class="text-muted-foreground flex items-center gap-2 font-medium transition-colors hover:text-foreground"
					onclick={() => (showToolResult = !showToolResult)}
				>
					<span class="flex items-center gap-1">
						<span class="h-1.5 w-1.5 rounded-full bg-green-500" class:animate-pulse={isLoading}
						></span>
						📥 Tool Result
					</span>
					{#if showToolResult}
						<ChevronUp class="h-3 w-3" />
					{:else}
						<ChevronDown class="h-3 w-3" />
					{/if}
				</button>

				{#if showToolResult}
					<pre
						class="max-h-48 overflow-auto rounded-lg bg-muted/30 p-2 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap"
						in:fade={{ duration: 150 }}>{toolResultPreview}</pre>
				{:else}
					<div class="line-clamp-2 px-1 text-[11px] opacity-75">
						{toolResultPreview.substring(0, 150)}...
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

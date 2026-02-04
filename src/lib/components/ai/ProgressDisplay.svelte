<script lang="ts">
	import { fade } from 'svelte/transition';
	import { LoaderCircle, X } from 'lucide-svelte';
	import type { ProgressState } from './progress-types';
	import { getStatusText } from './progress-types';

	let { isLoading = false, isStreaming = false, isCancelling = false, progress, onCancel }: {
		isLoading?: boolean;
		isStreaming?: boolean;
		isCancelling?: boolean;
		progress: ProgressState;
		onCancel?: () => void;
	} = $props();

	// Show cancel button only during active execution
	const canCancel = $derived(
		!isCancelling && (
			progress.status === 'thinking' ||
			progress.status === 'planning' ||
			progress.status === 'executing'
		)
	);

	const showCancelButton = $derived(isLoading && canCancel);
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
		{#if progress.currentAction}
			<div class="flex items-center gap-3 text-sm text-muted-foreground" in:fade>
				<div class="h-2 w-2 animate-pulse rounded-full bg-primary" class:bg-destructive={isCancelling}></div>
				<span>
					{#if isCancelling}
						Cancelling...
					{:else if progress.currentAction.step && progress.currentAction.total}
						[{progress.currentAction.step}/{progress.currentAction.total}] {progress.currentAction.message}
					{:else}
						{progress.currentAction.message}
					{/if}
				</span>
			</div>
		{/if}
	</div>
{/if}

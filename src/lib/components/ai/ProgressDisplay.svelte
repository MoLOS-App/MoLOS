<script lang="ts">
	import { fade } from 'svelte/transition';
	import { LoaderCircle } from 'lucide-svelte';
	import type { ProgressState, CurrentAction } from './progress-types';
	import { getStatusText } from './progress-types';

	let { isLoading = false, isStreaming = false, progress }: {
		isLoading?: boolean;
		isStreaming?: boolean;
		progress: ProgressState;
	} = $props();
</script>

{#if isLoading || progress.status !== 'idle'}
	<div class="flex flex-col gap-3" in:fade>
		<!-- Loader with Status -->
		{#if isLoading && !isStreaming}
			<div class="flex items-start">
				<div
					class="text-muted-foreground flex animate-pulse items-center gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm font-bold tracking-wide uppercase shadow-sm"
				>
					<LoaderCircle class="h-4 w-4 animate-spin" />
					{getStatusText(progress.status)}
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
		{#if progress.currentAction}
			<div class="flex items-center gap-3 text-sm text-muted-foreground" in:fade>
				<div class="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
				<span>
					{#if progress.currentAction.step && progress.currentAction.total}
						[{progress.currentAction.step}/{progress.currentAction.total}] {progress.currentAction.message}
					{:else}
						{progress.currentAction.message}
					{/if}
				</span>
			</div>
		{/if}
	</div>
{/if}

<script lang="ts">
	import { Clock } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { AiAction } from '$lib/models/ai';
	import { slide } from 'svelte/transition';

	const { pendingAction, actionTimer, onCancelAction } = $props();
</script>

{#if pendingAction}
	<div class="border-t border-border bg-orange-500/5 px-4 py-3" transition:slide>
		<div class="flex items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-2">
				<div class="flex-shrink-0 rounded-full bg-orange-500/20 p-1 text-orange-500">
					<Clock class="h-3.5 w-3.5 animate-pulse" />
				</div>
				<div class="min-w-0">
					<p class="text-muted-foreground truncate text-[11px] font-medium">
						{pendingAction.description}
					</p>
				</div>
			</div>
			<div class="flex flex-shrink-0 items-center gap-2">
				<div
					class="rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-500"
				>
					{actionTimer}s
				</div>
				<Button
					variant="ghost"
					size="sm"
					class="h-7 px-2 text-[10px] font-bold tracking-wider uppercase hover:bg-orange-500/10 hover:text-orange-500"
					onclick={onCancelAction}
				>
					Cancel
				</Button>
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import { Clock } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { AiAction } from '$lib/models/ai';
	import { slide } from 'svelte/transition';

	const { pendingAction, actionTimer, onCancelAction } = $props();
</script>

{#if pendingAction}
	<div class="border-t border-border/60 bg-muted/30 px-3 py-2 shadow-sm" transition:slide>
		<div class="flex items-center justify-between gap-4">
			<div class="flex min-w-0 items-center gap-3">
				<div class="flex-shrink-0 rounded-2xl bg-orange-500/15 p-1.5 text-orange-500">
					<Clock class="h-3.5 w-3.5 animate-pulse" />
				</div>
				<div class="min-w-0">
					<p class="text-muted-foreground truncate text-[11px] font-medium">
						Review pending action
					</p>
					<p class="truncate text-xs font-medium text-foreground">{pendingAction.description}</p>
				</div>
			</div>
			<div class="flex flex-shrink-0 items-center gap-3">
				<div
					class="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-orange-600"
				>
					Auto-confirm in {actionTimer}s
				</div>
				<Button
					variant="ghost"
					size="sm"
					class="h-7 rounded-full px-2.5 text-[10px] font-semibold hover:bg-orange-500/10 hover:text-orange-500"
					onclick={onCancelAction}
				>
					Cancel
				</Button>
			</div>
		</div>
	</div>
{/if}

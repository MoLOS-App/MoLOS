<script lang="ts">
	import { Puzzle } from 'lucide-svelte';
	import { Card, CardContent } from '$lib/components/ui/card';

	let {
		modules = []
	}: { modules: Array<{ id: string; name: string }> } = $props();
</script>

{#if modules && modules.length > 0}
	<Card class="border-0 bg-card shadow-sm">
		<CardContent class="p-6">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
					<Puzzle class="w-4 h-4 text-primary" />
				</div>
				<div>
					<h3 class="font-semibold text-foreground text-sm">Available Modules</h3>
					<p class="text-xs text-muted-foreground">{modules.length} external modules</p>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each modules as module (module.id)}
					<div class="px-3 py-1.5 bg-primary/5 hover:bg-primary/10 rounded-md text-sm text-foreground transition-colors border border-primary/10">
						{module.name}
					</div>
				{/each}
			</div>
		</CardContent>
	</Card>
{/if}

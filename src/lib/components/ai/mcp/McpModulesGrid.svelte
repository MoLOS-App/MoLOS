<script lang="ts">
	import { Puzzle } from 'lucide-svelte';
	import { Card, CardContent } from '$lib/components/ui/card';

	let { modules = [] }: { modules: Array<{ id: string; name: string }> } = $props();
</script>

{#if modules && modules.length > 0}
	<Card class="border-0 bg-card shadow-sm">
		<CardContent class="p-6">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
					<Puzzle class="h-4 w-4 text-primary" />
				</div>
				<div>
					<h3 class="text-sm font-semibold text-foreground">Available Modules</h3>
					<p class="text-muted-foreground text-xs">{modules.length} external modules</p>
				</div>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each modules as module (module.id)}
					<div
						class="rounded-md border border-primary/10 bg-primary/5 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-primary/10"
					>
						{module.name}
					</div>
				{/each}
			</div>
		</CardContent>
	</Card>
{/if}

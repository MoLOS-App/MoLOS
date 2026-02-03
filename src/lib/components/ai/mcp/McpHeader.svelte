<script lang="ts">
	import { Server } from 'lucide-svelte';

	let { serverOnline = true }: { serverOnline?: boolean } = $props();
</script>

<div class="flex items-center justify-between">
	<div class="space-y-1">
		<h1 class="text-3xl font-black tracking-tighter">MCP Server</h1>
		<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
			Model Context Protocol management
		</p>
	</div>
	{#if serverOnline}
		<div
			class="bg-success/10 text-success border-success/20 flex items-center gap-2 rounded-lg border px-4 py-2"
		>
			<div class="bg-success h-2 w-2 animate-pulse rounded-full"></div>
			<span class="text-sm font-medium">Server Online</span>
		</div>
	{/if}
</div>

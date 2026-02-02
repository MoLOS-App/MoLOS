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
			class="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-lg border border-success/20"
		>
			<div class="w-2 h-2 bg-success rounded-full animate-pulse"></div>
			<span class="text-sm font-medium">Server Online</span>
		</div>
	{/if}
</div>

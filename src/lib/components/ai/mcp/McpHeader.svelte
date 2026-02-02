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
			class="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg border border-green-500/20"
		>
			<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
			<span class="text-sm font-medium">Server Online</span>
		</div>
	{/if}
</div>

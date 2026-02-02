<script lang="ts">
	import { browser } from '$app/environment';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Copy, Check, Globe } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let {
		transportUrl = '/api/ai/mcp/transport',
		protocolVersion = '2024-11-05'
	}: { transportUrl?: string; protocolVersion?: string } = $props();

	let copied = $state(false);

	// Get the full URL - safely handles SSR
	function getFullUrl() {
		if (browser && typeof window !== 'undefined') {
			return `${window.location.origin}${transportUrl}`;
		}
		return transportUrl;
	}

	async function copyToClipboard(text: string, label: string) {
		if (!browser) return;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			toast.success(`${label} copied to clipboard`);
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			toast.error('Failed to copy to clipboard');
		}
	}
</script>

<Card>
	<CardHeader>
		<CardTitle class="flex items-center gap-2">
			<Globe class="w-5 h-5" />
			Connection Information
		</CardTitle>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Transport URL -->
		<div class="space-y-2">
			<p class="text-sm text-muted-foreground">Transport URL</p>
			<div class="flex items-center gap-2">
				<code class="flex-1 text-sm font-mono text-blue-600 dark:text-blue-400 bg-muted px-3 py-2 rounded break-all">
					{transportUrl}
				</code>
				{#if browser}
					<Button
						variant="outline"
						size="icon"
						onclick={() => copyToClipboard(getFullUrl(), 'Transport URL')}
						title="Copy transport URL"
					>
						{#if copied}
							<Check class="w-4 h-4 text-green-500" />
						{:else}
							<Copy class="w-4 h-4" />
						{/if}
					</Button>
				{/if}
			</div>
		</div>

		<!-- Protocol Version -->
		<div class="space-y-2">
			<p class="text-sm text-muted-foreground">Protocol Version</p>
			<code class="text-sm font-mono text-foreground bg-muted px-3 py-2 rounded block">
				{protocolVersion}
			</code>
		</div>

		<!-- Full URL Info (only in browser) -->
		{#if browser}
			<div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
				<p class="text-xs text-blue-600 dark:text-blue-400">
					<strong>Full URL:</strong> {getFullUrl()}
				</p>
			</div>
		{/if}
	</CardContent>
</Card>

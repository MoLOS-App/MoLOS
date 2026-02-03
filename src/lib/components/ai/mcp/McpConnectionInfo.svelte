<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Copy, Check, Globe, Link as LinkIcon } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';

	let {
		transportUrl = '/api/ai/mcp/transport',
		protocolVersion = '2024-11-05'
	}: { transportUrl?: string; protocolVersion?: string } = $props();

	let copied = $state(false);

	function getFullUrl() {
		if (browser && typeof window !== 'undefined') {
			return `${window.location.origin}${transportUrl}`;
		}
		return transportUrl;
	}

	async function copyToClipboard(text: string) {
		if (!browser) return;
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			toast.success('URL copied to clipboard');
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}
</script>

<!-- Modern connection info card -->
<Card class="border-0 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm">
	<CardContent class="p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
				<Globe class="w-5 h-5 text-primary" />
			</div>
			<div>
				<h3 class="font-semibold text-foreground">Server Connection</h3>
				<p class="text-xs text-muted-foreground">MCP endpoint details</p>
			</div>
		</div>

		<div class="space-y-4">
			<!-- Transport URL -->
			<div class="group">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>Transport URL</span
					>
					<Badge variant="secondary" class="text-[10px] h-5">HTTP/WS</Badge>
				</div>
				<div
					class={cn(
						'flex items-center gap-2 p-3 rounded-lg bg-background/50',
						'border border-border/50 group-hover:border-primary/50 transition-colors'
					)}
				>
					<div class="flex-1 min-w-0">
						<code class="text-sm font-mono text-foreground break-all">
							{browser ? getFullUrl() : transportUrl}
						</code>
					</div>
					{#if browser}
						<Button
							variant="ghost"
							size="icon"
							onclick={() => copyToClipboard(getFullUrl())}
							class="flex-shrink-0 h-8 w-8"
						>
							{#if copied}
								<Check class="w-4 h-4 text-success" />
							{:else}
								<Copy class="w-4 h-4" />
							{/if}
						</Button>
					{/if}
				</div>
			</div>

			<!-- Protocol & Version -->
			<div class="flex items-center gap-4 pt-2">
				<div class="flex items-center gap-2">
					<div class="w-2 h-2 rounded-full bg-success animate-pulse"></div>
					<span class="text-sm text-muted-foreground">Server Online</span>
				</div>
				<div class="flex items-center gap-1.5 text-muted-foreground">
					<LinkIcon class="w-3.5 h-3.5" />
					<span class="text-xs font-mono">{protocolVersion}</span>
				</div>
			</div>
		</div>
	</CardContent>
</Card>

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
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
				<Globe class="h-5 w-5 text-primary" />
			</div>
			<div>
				<h3 class="font-semibold text-foreground">Server Connection</h3>
				<p class="text-muted-foreground text-xs">MCP endpoint details</p>
			</div>
		</div>

		<div class="space-y-4">
			<!-- Transport URL -->
			<div class="group">
				<div class="mb-2 flex items-center justify-between">
					<span class="text-muted-foreground text-xs font-medium tracking-wider uppercase"
						>Transport URL</span
					>
					<Badge variant="secondary" class="h-5 text-[10px]">HTTP/WS</Badge>
				</div>
				<div
					class={cn(
						'flex items-center gap-2 rounded-lg bg-background/50 p-3',
						'border border-border/50 transition-colors group-hover:border-primary/50'
					)}
				>
					<div class="min-w-0 flex-1">
						<code class="font-mono text-sm break-all text-foreground">
							{browser ? getFullUrl() : transportUrl}
						</code>
					</div>
					{#if browser}
						<Button
							variant="ghost"
							size="icon"
							onclick={() => copyToClipboard(getFullUrl())}
							class="h-8 w-8 flex-shrink-0"
						>
							{#if copied}
								<Check class="text-success h-4 w-4" />
							{:else}
								<Copy class="h-4 w-4" />
							{/if}
						</Button>
					{/if}
				</div>
			</div>

			<!-- Protocol & Version -->
			<div class="flex items-center gap-4 pt-2">
				<div class="flex items-center gap-2">
					<div class="bg-success h-2 w-2 animate-pulse rounded-full"></div>
					<span class="text-muted-foreground text-sm">Server Online</span>
				</div>
				<div class="text-muted-foreground flex items-center gap-1.5">
					<LinkIcon class="h-3.5 w-3.5" />
					<span class="font-mono text-xs">{protocolVersion}</span>
				</div>
			</div>
		</div>
	</CardContent>
</Card>

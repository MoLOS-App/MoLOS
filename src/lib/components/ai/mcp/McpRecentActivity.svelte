<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-svelte';

	export interface LogEntry {
		id: string;
		createdAt: string;
		method: string;
		status: 'success' | 'error';
		durationMs: number;
		toolName?: string;
		resourceName?: string;
		promptName?: string;
	}

	let {
		logs = [],
		onViewAll
	}: { logs: LogEntry[]; onViewAll?: () => void } = $props();

	function getTargetName(log: LogEntry): string {
		return log.toolName || log.resourceName || log.promptName || '-';
	}
</script>

{#if logs && logs.length > 0}
	<Card class="border-0 bg-card shadow-sm">
		<CardContent class="p-6">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<Clock class="w-4 h-4 text-primary" />
					</div>
					<div>
						<h3 class="font-semibold text-foreground text-sm">Recent Activity</h3>
						<p class="text-xs text-muted-foreground">Latest MCP requests</p>
					</div>
				</div>
				{#if onViewAll}
					<Button variant="ghost" size="sm" onclick={onViewAll} class="gap-1 text-xs">
						View all
						<ArrowRight class="w-3 h-3" />
					</Button>
				{/if}
			</div>

			<div class="space-y-2">
				{#each logs.slice(0, 5) as log}
					<div class="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
						{#if log.status === 'success'}
							<CheckCircle class="w-4 h-4 text-success flex-shrink-0" />
						{:else}
							<XCircle class="w-4 h-4 text-error flex-shrink-0" />
						{/if}

						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-foreground truncate">{log.method}</p>
							<p class="text-xs text-muted-foreground truncate">{getTargetName(log)}</p>
						</div>

						<div class="flex-shrink-0 text-right">
							<p class="text-xs text-muted-foreground">{log.durationMs}ms</p>
							<p class="text-[10px] text-muted-foreground">
								{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</CardContent>
	</Card>
{/if}

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

	let { logs = [], onViewAll }: { logs: LogEntry[]; onViewAll?: () => void } = $props();

	function getTargetName(log: LogEntry): string {
		return log.toolName || log.resourceName || log.promptName || '-';
	}
</script>

{#if logs && logs.length > 0}
	<Card class="border-0 bg-card shadow-sm">
		<CardContent class="p-6">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
						<Clock class="h-4 w-4 text-primary" />
					</div>
					<div>
						<h3 class="text-sm font-semibold text-foreground">Recent Activity</h3>
						<p class="text-muted-foreground text-xs">Latest MCP requests</p>
					</div>
				</div>
				{#if onViewAll}
					<Button variant="ghost" size="sm" onclick={onViewAll} class="gap-1 text-xs">
						View all
						<ArrowRight class="h-3 w-3" />
					</Button>
				{/if}
			</div>

			<div class="space-y-2">
				{#each logs.slice(0, 5) as log}
					<div
						class="group flex items-center gap-3 rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50"
					>
						{#if log.status === 'success'}
							<CheckCircle class="text-success h-4 w-4 flex-shrink-0" />
						{:else}
							<XCircle class="text-error h-4 w-4 flex-shrink-0" />
						{/if}

						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-foreground">{log.method}</p>
							<p class="text-muted-foreground truncate text-xs">{getTargetName(log)}</p>
						</div>

						<div class="flex-shrink-0 text-right">
							<p class="text-muted-foreground text-xs">{log.durationMs}ms</p>
							<p class="text-muted-foreground text-[10px]">
								{new Date(log.createdAt).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</CardContent>
	</Card>
{/if}

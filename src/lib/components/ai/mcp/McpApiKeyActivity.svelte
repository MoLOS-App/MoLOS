<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

	export interface ActivityLog {
		method: string;
		status: 'success' | 'error';
		createdAt: string | Date;
	}

	let { logs = [] }: { logs: ActivityLog[] } = $props();

	function formatDate(date: string | Date): string {
		return typeof date === 'string' ? date : new Date(date).toLocaleString();
	}
</script>

<Card>
	<CardHeader>
		<CardTitle class="text-base">Recent Activity</CardTitle>
	</CardHeader>
	<CardContent>
		{#if logs.length === 0}
			<p class="text-muted-foreground text-sm italic">No recent activity</p>
		{:else}
			<div class="space-y-2">
				{#each logs as log}
					<div class="flex items-start justify-between rounded-lg bg-muted/50 p-2 text-sm">
						<div class="flex-1">
							<p class="font-medium text-foreground">{log.method}</p>
							<p class="text-muted-foreground text-xs">{formatDate(log.createdAt)}</p>
						</div>
						<Badge variant={log.status === 'success' ? 'secondary' : 'destructive'} class="text-xs">
							{log.status}
						</Badge>
					</div>
				{/each}
			</div>
		{/if}
	</CardContent>
</Card>

<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Activity, CheckCircle, Clock } from 'lucide-svelte';

	export interface ApiKeyStats {
		totalRequests: number;
		successCount: number;
		avgDuration: number;
		usageCount?: number;
	}

	let { stats }: { stats: ApiKeyStats } = $props();

	const successRate = $derived(
		stats.totalRequests > 0 ? Math.round((stats.successCount / stats.totalRequests) * 100) : 0
	);
</script>

<Card>
	<CardHeader>
		<CardTitle class="text-base">Usage Statistics</CardTitle>
	</CardHeader>
	<CardContent class="space-y-3">
		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-lg bg-muted/50 p-3">
				<Activity class="mb-2 h-4 w-4 text-primary" />
				<p class="text-muted-foreground text-xs">Total Requests</p>
				<p class="text-lg font-semibold text-foreground">{stats.totalRequests}</p>
			</div>
			<div class="rounded-lg bg-muted/50 p-3">
				<CheckCircle class="text-success mb-2 h-4 w-4" />
				<p class="text-muted-foreground text-xs">Success Rate</p>
				<p class="text-lg font-semibold text-foreground">{successRate}%</p>
			</div>
			<div class="rounded-lg bg-muted/50 p-3">
				<Clock class="mb-2 h-4 w-4 text-primary" />
				<p class="text-muted-foreground text-xs">Avg Duration</p>
				<p class="text-lg font-semibold text-foreground">
					{Math.round(stats.avgDuration)}ms
				</p>
			</div>
			{#if stats.usageCount !== undefined}
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-muted-foreground mb-2 text-xs">Usage Count</p>
					<p class="text-lg font-semibold text-foreground">{stats.usageCount}</p>
				</div>
			{/if}
		</div>
	</CardContent>
</Card>

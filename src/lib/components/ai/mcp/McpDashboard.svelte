<script lang="ts">
	import { HelpCircle, Key, Activity, CheckCircle, Clock } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { McpStatsCard, McpQuickStart } from './index';

	export interface DashboardData {
		stats: {
			activeKeys: number;
			totalRequests: number;
			successRate: number;
			avgDuration: number;
		};
		availableModules: { id: string; name: string }[];
	}

	let { data, onShowHelp }: { data: DashboardData; onShowHelp?: () => void } = $props();
</script>

<div class="space-y-6">
	<!-- Tab Header with Help Button -->
	<div class="flex items-start justify-between">
		<div>
			<h2 class="text-2xl font-semibold tracking-tight">Dashboard</h2>
			<p class="text-muted-foreground mt-1 text-sm">Monitor your MCP server at a glance</p>
		</div>
		{#if onShowHelp}
			<Button
				variant="ghost"
				size="icon"
				onclick={onShowHelp}
				class="text-muted-foreground flex-shrink-0 hover:text-foreground"
				title="Show help"
			>
				<HelpCircle class="h-5 w-5" />
			</Button>
		{/if}
	</div>

	<!-- Quick Stats - Modern Cards -->
	{#if data.stats}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<McpStatsCard
				title="Active Keys"
				value={data.stats.activeKeys}
				icon={Key}
				iconColor="text-primary"
			/>
			<McpStatsCard
				title="Total Requests"
				value={data.stats.totalRequests}
				icon={Activity}
				iconColor="text-primary"
				trend="All time"
			/>
			<McpStatsCard
				title="Success Rate"
				value="{data.stats.successRate}%"
				icon={CheckCircle}
				iconColor="text-success"
				trend="Last 24h"
				trendUp={true}
			/>
			<McpStatsCard
				title="Avg Duration"
				value="{data.stats.avgDuration}ms"
				icon={Clock}
				iconColor="text-primary"
			/>
		</div>
	{/if}

	<!-- Main Content Grid -->
	<div class="flex flex-col xl:grid-cols-6">
		<div class="space-y-6 xl:col-span-4">
			<!-- Quick Start -->
			<McpQuickStart />
		</div>
	</div>
</div>

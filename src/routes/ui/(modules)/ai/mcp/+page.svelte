<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { Server, Key, ScrollText, List, Activity, ArrowRight, CheckCircle, XCircle, Clock } from 'lucide-svelte';

	export let data: PageData;

	const MCP_TRANSPORT_URL = '/api/ai/mcp/transport';
</script>

<svelte:head>
	<title>MCP Server - MoLOS</title>
	<meta name="description" content="Model Context Protocol server management" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">MCP Server</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				Manage your Model Context Protocol server and API keys
			</p>
		</div>
		<div
			class="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg"
		>
			<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
			<span class="text-sm font-medium">Server Online</span>
		</div>
	</div>

	<!-- Quick Stats -->
	{#if data.stats}
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Active Keys</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.stats.activeKeys}</p>
					</div>
					<Key class="w-8 h-8 text-blue-500" />
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Total Requests</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.stats.totalRequests}</p>
					</div>
					<Activity class="w-8 h-8 text-green-500" />
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.stats.successRate}%</p>
					</div>
					<CheckCircle class="w-8 h-8 text-green-500" />
				</div>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-600 dark:text-gray-400">Avg Duration</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.stats.avgDuration}ms</p>
					</div>
					<Clock class="w-8 h-8 text-purple-500" />
				</div>
			</div>
		</div>
	{/if}

	<!-- Quick Actions -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<a
			href="/ui/ai/mcp/keys"
			class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
		>
			<Key class="w-8 h-8 text-blue-500" />
			<div class="flex-1">
				<p class="font-medium text-gray-900 dark:text-white">API Keys</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">Manage access keys</p>
			</div>
			<ArrowRight class="w-5 h-5 text-gray-400" />
		</a>

		<a
			href="/ui/ai/mcp/resources"
			class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors"
		>
			<ScrollText class="w-8 h-8 text-green-500" />
			<div class="flex-1">
				<p class="font-medium text-gray-900 dark:text-white">Resources</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">Manage resources</p>
			</div>
			<ArrowRight class="w-5 h-5 text-gray-400" />
		</a>

		<a
			href="/ui/ai/mcp/prompts"
			class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors"
		>
			<List class="w-8 h-8 text-purple-500" />
			<div class="flex-1">
				<p class="font-medium text-gray-900 dark:text-white">Prompts</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">Manage prompts</p>
			</div>
			<ArrowRight class="w-5 h-5 text-gray-400" />
		</a>

		<a
			href="/ui/ai/mcp/logs"
			class="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 transition-colors"
		>
			<Activity class="w-8 h-8 text-orange-500" />
			<div class="flex-1">
				<p class="font-medium text-gray-900 dark:text-white">Activity Logs</p>
				<p class="text-sm text-gray-600 dark:text-gray-400">View activity</p>
			</div>
			<ArrowRight class="w-5 h-5 text-gray-400" />
		</a>
	</div>

	<!-- Connection Info -->
	<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connection Information</h2>
		<div class="space-y-3">
			<div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
				<span class="text-sm text-gray-600 dark:text-gray-400">Transport URL</span>
				<code class="text-sm font-mono text-blue-600 dark:text-blue-400">{MCP_TRANSPORT_URL}</code>
			</div>
			<div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
				<span class="text-sm text-gray-600 dark:text-gray-400">Protocol Version</span>
				<span class="text-sm font-mono text-gray-900 dark:text-white">2024-11-05</span>
			</div>
		</div>
	</div>

	<!-- Available Modules -->
	{#if data.availableModules && data.availableModules.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Available Modules</h2>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
				{#each data.availableModules as module}
					<div class="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
						<span class="text-sm font-medium text-gray-900 dark:text-white">{module.name}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Recent Activity -->
	{#if data.recentLogs && data.recentLogs.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
				<a href="/ui/ai/mcp/logs" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">
					View all
				</a>
			</div>
			<div class="space-y-2">
				{#each data.recentLogs as log}
					<div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
						<div class="flex items-center gap-3">
							{#if log.status === 'success'}
								<CheckCircle class="w-4 h-4 text-green-500" />
							{:else}
								<XCircle class="w-4 h-4 text-red-500" />
							{/if}
							<div>
								<p class="text-sm font-medium text-gray-900 dark:text-white">{log.method}</p>
								{#if log.toolName}
									<p class="text-xs text-gray-600 dark:text-gray-400">{log.toolName}</p>
								{/if}
							</div>
						</div>
						<div class="text-right">
							<p class="text-xs text-gray-600 dark:text-gray-400">{log.durationMs}ms</p>
							<p class="text-xs text-gray-500 dark:text-gray-500">
								{new Date(log.createdAt).toLocaleTimeString()}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

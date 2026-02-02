<script lang="ts">
	import type { PageData } from './$types';
	import { Activity, Search, Filter, CheckCircle, XCircle, Clock } from 'lucide-svelte';

	export let data: PageData;

	// Filters
	let searchQuery = '';
	let apiKeyFilter = '';
	let methodFilter = '';
	let statusFilter = '';

	$: filteredLogs = data.logs.filter((log) => {
		const matchesSearch =
			!searchQuery ||
			log.method?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			log.toolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			log.resourceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			log.promptName?.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesApiKey = !apiKeyFilter || log.apiKeyId === apiKeyFilter;
		const matchesMethod = !methodFilter || log.method === methodFilter;
		const matchesStatus = !statusFilter || log.status === statusFilter;
		return matchesSearch && matchesApiKey && matchesMethod && matchesStatus;
	});

	function getUniqueMethods(): string[] {
		const methods = new Set(data.logs.map((log) => log.method));
		return Array.from(methods).sort();
	}
</script>

<svelte:head>
	<title>MCP Activity Logs - MoLOS</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">MCP Activity Logs</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				View all MCP protocol requests and responses
			</p>
		</div>
	</div>

	<!-- Stats -->
	{#if data.stats}
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-600 dark:text-gray-400">Total Requests</p>
				<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data.stats.totalRequests}</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
				<p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
					{Math.round((data.stats.successCount / (data.stats.totalRequests || 1)) * 100)}%
				</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-600 dark:text-gray-400">Avg Duration</p>
				<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{Math.round(data.stats.avgDuration)}ms</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
				<p class="text-sm text-gray-600 dark:text-gray-400">Error Count</p>
				<p class="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{data.stats.errorCount}</p>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-md">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search logs..."
				class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
		</div>
		<select
			bind:value={apiKeyFilter}
			class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
		>
			<option value="">All API Keys</option>
			{#each data.apiKeys as key}
				<option value={key.id}>{key.name}</option>
			{/each}
		</select>
		<select
			bind:value={methodFilter}
			class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
		>
			<option value="">All Methods</option>
			{#each getUniqueMethods() as method}
				<option value={method}>{method}</option>
			{/each}
		</select>
		<select
			bind:value={statusFilter}
			class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
		>
			<option value="">All Status</option>
			<option value="success">Success</option>
			<option value="error">Error</option>
		</select>
	</div>

	<!-- Logs Table -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
		{#if filteredLogs.length === 0}
			<div class="p-12 text-center">
				<Activity class="w-16 h-16 mx-auto text-gray-400 mb-4" />
				<p class="text-gray-600 dark:text-gray-400">No logs found</p>
			</div>
		{:else}
			<table class="w-full">
				<thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Time
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Method
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Target
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Status
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Duration
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each filteredLogs as log}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-900">
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">
									{new Date(log.createdAt).toLocaleString()}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded">
									{log.method}
								</span>
							</td>
							<td class="px-6 py-4">
								{#if log.toolName}
									<div class="text-sm text-gray-900 dark:text-white">{log.toolName}</div>
								{:else if log.resourceName}
									<div class="text-sm text-gray-900 dark:text-white font-mono">
										{log.resourceName}
									</div>
								{:else if log.promptName}
									<div class="text-sm text-gray-900 dark:text-white">{log.promptName}</div>
								{:else}
									<span class="text-sm text-gray-500 dark:text-gray-400">-</span>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if log.status === 'success'}
									<div class="flex items-center gap-2">
										<CheckCircle class="w-4 h-4 text-green-500" />
										<span class="text-sm text-green-600 dark:text-green-400">Success</span>
									</div>
								{:else}
									<div class="flex items-center gap-2">
										<XCircle class="w-4 h-4 text-red-500" />
										<span class="text-sm text-red-600 dark:text-red-400">Error</span>
									</div>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
									<Clock class="w-4 h-4" />
									<span>{log.durationMs}ms</span>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
									Details
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Pagination -->
	{#if data.total > data.limit}
		<div class="flex items-center justify-between">
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Showing {((data.page - 1) * data.limit + 1).toLocaleString()} to {Math.min(data.page * data.limit, data.total).toLocaleString()} of {data.total.toLocaleString()} results
			</p>
			<div class="flex gap-2">
				{#if data.page > 1}
					<a
						href="?page={data.page - 1}"
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900"
					>
						Previous
					</a>
				{/if}
				{#if data.hasMore}
					<a
						href="?page={data.page + 1}"
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900"
					>
						Next
					</a>
				{/if}
			</div>
		</div>
	{/if}
</div>

<script lang="ts">
	import type { PageData } from './$types';
	import { ScrollText, Plus, Search, Filter, MoreHorizontal } from 'lucide-svelte';

	export let data: PageData;

	let showCreateDialog = false;

	// Filters
	let searchQuery = '';
	let moduleFilter = '';
	let enabledFilter = '';

	function openCreateDialog() {
		showCreateDialog = true;
	}

	function handleCreateResource() {
		// TODO: Implement resource creation
		showCreateDialog = false;
	}

	$: filteredResources = data.resources.filter((resource) => {
		const matchesSearch =
			!searchQuery ||
			resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			resource.description.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesModule = !moduleFilter || resource.moduleId === moduleFilter;
		const matchesEnabled = enabledFilter === '' || resource.enabled === (enabledFilter === 'true');
		return matchesSearch && matchesModule && matchesEnabled;
	});
</script>

<svelte:head>
	<title>MCP Resources - MoLOS</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">MCP Resources</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				Manage resources exposed via the MCP protocol
			</p>
		</div>
		<button
			onclick={openCreateDialog}
			class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
		>
			<Plus class="w-5 h-5" />
			Create Resource
		</button>
	</div>

	<!-- Filters -->
	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-md">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search resources..."
				class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
		</div>
		<select
			bind:value={moduleFilter}
			class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
		>
			<option value="">All Modules</option>
			{#each data.availableModules as module}
				<option value={module.id}>{module.name}</option>
			{/each}
		</select>
		<select
			bind:value={enabledFilter}
			class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
		>
			<option value="">All Status</option>
			<option value="true">Enabled</option>
			<option value="false">Disabled</option>
		</select>
	</div>

	<!-- Resources List -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
		{#if filteredResources.length === 0}
			<div class="p-12 text-center">
				<ScrollText class="w-16 h-16 mx-auto text-gray-400 mb-4" />
				<p class="text-gray-600 dark:text-gray-400">No resources found</p>
				<button
					onclick={openCreateDialog}
					class="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
				>
					Create your first resource
				</button>
			</div>
		{:else}
			<table class="w-full">
				<thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							URI
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Module
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Status
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each filteredResources as resource}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-900">
							<td class="px-6 py-4">
								<div class="text-sm font-medium text-gray-900 dark:text-white">{resource.name}</div>
								<div class="text-sm text-gray-500 dark:text-gray-400">{resource.description}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<code class="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
									{resource.uri}
								</code>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
									{resource.moduleId}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if resource.enabled}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
										Enabled
									</span>
								{:else}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
										Disabled
									</span>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
									Edit
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

<!-- Create Resource Dialog -->
{#if showCreateDialog}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Create MCP Resource</h2>

			<form onsubmit|preventDefault={handleCreateResource}>
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Name
						</label>
						<input
							type="text"
							placeholder="e.g., Active Tasks"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							URI
						</label>
						<input
							type="text"
							placeholder="mcp://molos/tasks/active"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Module
						</label>
						<select class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
							<option value="">Select a module</option>
							{#each data.availableModules as module}
								<option value={module.id}>{module.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Description
						</label>
						<textarea
							rows="3"
							placeholder="Describe what this resource provides..."
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
						></textarea>
					</div>
				</div>

				<div class="flex justify-end gap-3 mt-6">
					<button
						type="button"
						onclick={() => (showCreateDialog = false)}
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
					>
						Create Resource
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

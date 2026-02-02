<script lang="ts">
	import type { PageData } from './$types';
	import { Key, Plus, Search, Filter, MoreHorizontal, Copy, Check, X, Edit, Trash2 } from 'lucide-svelte';

	export let data: PageData;

	let showCreateDialog = false;
	let showKeySecret = false;
	let createdKeySecret = '';
	let copiedToClipboard = false;

	// Filters
	let searchQuery = '';
	let statusFilter = '';

	// Create key form
	let newKeyName = '';
	let selectedModules: string[] = [];
	let expiresAt = '';

	function openCreateDialog() {
		newKeyName = '';
		selectedModules = [];
		expiresAt = '';
		showCreateDialog = true;
	}

	async function createApiKey() {
		const response = await fetch('/api/ai/mcp/keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: newKeyName,
				allowedModules: selectedModules.length > 0 ? selectedModules : null,
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
			})
		});

		if (response.ok) {
			const result = await response.json();
			createdKeySecret = result.fullKey;
			showCreateDialog = false;
			showKeySecret = true;
			// Refresh page
			window.location.reload();
		}
	}

	async function copyKeySecret() {
		await navigator.clipboard.writeText(createdKeySecret);
		copiedToClipboard = true;
		setTimeout(() => (copiedToClipboard = false), 2000);
	}

	function closeKeySecret() {
		showKeySecret = false;
		createdKeySecret = '';
	}

	async function revokeKey(keyId: string) {
		if (!confirm('Are you sure you want to revoke this API key?')) return;

		const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			window.location.reload();
		}
	}

	$: filteredKeys = data.keys.filter((key) => {
		const matchesSearch =
			!searchQuery ||
			key.name.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = !statusFilter || key.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	$: availableModules = data.availableModules;
</script>

<svelte:head>
	<title>API Keys - MCP Server</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">API Keys</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				Manage API keys for MCP access with module-level scoping
			</p>
		</div>
		<button
			onclick={openCreateDialog}
			class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
		>
			<Plus class="w-5 h-5" />
			Create API Key
		</button>
	</div>

	<!-- Filters -->
	<div class="flex items-center gap-4">
		<div class="relative flex-1 max-w-md">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search API keys..."
				class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
		</div>
		<select
			bind:value={statusFilter}
			class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
		>
			<option value="">All Statuses</option>
			<option value="active">Active</option>
			<option value="disabled">Disabled</option>
			<option value="revoked">Revoked</option>
		</select>
	</div>

	<!-- Keys List -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
		{#if filteredKeys.length === 0}
			<div class="p-12 text-center">
				<Key class="w-16 h-16 mx-auto text-gray-400 mb-4" />
				<p class="text-gray-600 dark:text-gray-400">No API keys found</p>
				<button
					onclick={openCreateDialog}
					class="mt-4 text-blue-600 dark:text-blue-400 hover:underline"
				>
					Create your first API key
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
							Key Prefix
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Modules
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Status
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Last Used
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each filteredKeys as key}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-900">
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900 dark:text-white">{key.name}</div>
								{#if key.expiresAt}
									<div class="text-xs text-gray-500 dark:text-gray-400">
										Expires: {new Date(key.expiresAt).toLocaleDateString()}
									</div>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<code class="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
									mcp_live_{key.keyPrefix}_******
								</code>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if key.allowedModules && key.allowedModules.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each key.allowedModules.slice(0, 2) as moduleId}
											<span
												class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
											>
												{moduleId}
											</span>
										{/each}
										{#if key.allowedModules.length > 2}
											<span class="text-xs text-gray-500 dark:text-gray-400">
												+{key.allowedModules.length - 2} more
											</span>
										{/if}
									</div>
								{:else}
									<span class="text-sm text-gray-500 dark:text-gray-400">All modules</span>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								{#if key.status === 'active'}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
										Active
									</span>
								{:else if key.status === 'disabled'}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
										Disabled
									</span>
								{:else}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
										Revoked
									</span>
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
								{#if key.lastUsedAt}
									{new Date(key.lastUsedAt).toLocaleString()}
								{:else}
									Never
								{/if}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<button
									onclick={() => revokeKey(key.id)}
									class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
								>
									Revoke
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

<!-- Create API Key Dialog -->
{#if showCreateDialog}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Create API Key</h2>

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Name
					</label>
					<input
						type="text"
						bind:value={newKeyName}
						placeholder="e.g., Claude Desktop Key"
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Allowed Modules (optional)
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
						Leave empty to allow all modules
					</p>
					<div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
						{#each availableModules as module}
							<label class="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
								<input
									type="checkbox"
									bind:group={selectedModules}
									value={module.id}
									class="rounded text-blue-600"
								/>
								<span class="text-sm text-gray-900 dark:text-white">{module.name}</span>
							</label>
						{/each}
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Expiration (optional)
					</label>
					<input
						type="date"
						bind:value={expiresAt}
						class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
					/>
				</div>
			</div>

			<div class="flex justify-end gap-3 mt-6">
				<button
					onclick={() => (showCreateDialog = false)}
					class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900"
				>
					Cancel
				</button>
				<button
					onclick={createApiKey}
					disabled={!newKeyName}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
				>
					Create Key
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Key Secret Display Dialog -->
{#if showKeySecret}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
			<div class="flex items-center gap-3 mb-4">
				<CheckCircle class="w-8 h-8 text-green-500" />
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">API Key Created</h2>
			</div>

			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Copy this key now. You won't be able to see it again.
			</p>

			<div class="relative">
				<code class="block w-full p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-mono rounded break-all pr-12">
					{createdKeySecret}
				</code>
				<button
					onclick={copyKeySecret}
					class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
					title="Copy to clipboard"
				>
					{#if copiedToClipboard}
						<Check class="w-5 h-5 text-green-500" />
					{:else}
						<Copy class="w-5 h-5" />
					{/if}
				</button>
			</div>

			<div class="flex justify-end mt-6">
				<button
					onclick={closeKeySecret}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import {
		Server,
		Key,
		ScrollText,
		List,
		Activity,
		CheckCircle,
		XCircle,
		Clock,
		Search,
		Plus,
		Copy,
		Check,
		Edit,
		Trash2,
		Filter
	} from 'lucide-svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const MCP_TRANSPORT_URL = '/api/ai/mcp/transport';

	// Tab state
	let activeTab = $state(data.tab || 'dashboard');

	// Keys state
	let showCreateKeyDialog = $state(false);
	let showKeySecret = $state(false);
	let createdKeySecret = $state('');
	let copiedToClipboard = $state(false);
	let newKeyName = $state('');
	let selectedModules = $state<string[]>([]);
	let expiresAt = $state('');

	// Filters
	let keySearchQuery = $state('');
	let keyStatusFilter = $state('');
	let resourceSearchQuery = $state('');
	let resourceModuleFilter = $state('');
	let resourceEnabledFilter = $state('');
	let promptSearchQuery = $state('');
	let promptModuleFilter = $state('');
	let promptEnabledFilter = $state('');
	let logSearchQuery = $state('');
	let logApiKeyFilter = $state('');
	let logMethodFilter = $state('');
	let logStatusFilter = $state('');

	const tabs = [
		{ id: 'dashboard', label: 'Dashboard', icon: Server },
		{ id: 'keys', label: 'API Keys', icon: Key },
		{ id: 'resources', label: 'Resources', icon: ScrollText },
		{ id: 'prompts', label: 'Prompts', icon: List },
		{ id: 'logs', label: 'Activity Logs', icon: Activity }
	];

	function updateUrl() {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('tab', activeTab);

		// Update filter params
		if (activeTab === 'keys') {
			if (keySearchQuery) params.set('keySearch', keySearchQuery);
			else params.delete('keySearch');
			if (keyStatusFilter) params.set('keyStatus', keyStatusFilter);
			else params.delete('keyStatus');
		} else if (activeTab === 'resources') {
			if (resourceSearchQuery) params.set('resourceSearch', resourceSearchQuery);
			else params.delete('resourceSearch');
			if (resourceModuleFilter) params.set('resourceId', resourceModuleFilter);
			else params.delete('resourceId');
			if (resourceEnabledFilter) params.set('resourceEnabled', resourceEnabledFilter);
			else params.delete('resourceEnabled');
		} else if (activeTab === 'prompts') {
			if (promptSearchQuery) params.set('promptSearch', promptSearchQuery);
			else params.delete('promptSearch');
			if (promptModuleFilter) params.set('promptId', promptModuleFilter);
			else params.delete('promptId');
			if (promptEnabledFilter) params.set('promptEnabled', promptEnabledFilter);
			else params.delete('promptEnabled');
		} else if (activeTab === 'logs') {
			if (logSearchQuery) params.set('logSearch', logSearchQuery);
			else params.delete('logSearch');
			if (logApiKeyFilter) params.set('logApiKey', logApiKeyFilter);
			else params.delete('logApiKey');
			if (logMethodFilter) params.set('logMethod', logMethodFilter);
			else params.delete('logMethod');
			if (logStatusFilter) params.set('logStatus', logStatusFilter);
			else params.delete('logStatus');
		}

		window.history.replaceState({}, '', `?${params.toString()}`);
	}

	// Watch for filter changes
	$effect(() => {
		updateUrl();
	});

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
			showCreateKeyDialog = false;
			showKeySecret = true;
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

	function openCreateDialog() {
		newKeyName = '';
		selectedModules = [];
		expiresAt = '';
		showCreateKeyDialog = true;
	}

	// Filtered data
	const filteredKeys = $derived(
		data.keys.filter((key) => {
			const matchesSearch =
				!keySearchQuery || key.name.toLowerCase().includes(keySearchQuery.toLowerCase());
			const matchesStatus = !keyStatusFilter || key.status === keyStatusFilter;
			return matchesSearch && matchesStatus;
		})
	);

	const filteredResources = $derived(
		data.resources.filter((resource) => {
			const matchesSearch =
				!resourceSearchQuery ||
				resource.name.toLowerCase().includes(resourceSearchQuery.toLowerCase()) ||
				resource.description.toLowerCase().includes(resourceSearchQuery.toLowerCase());
			const matchesModule = !resourceModuleFilter || resource.moduleId === resourceModuleFilter;
			const matchesEnabled =
				resourceEnabledFilter === '' || resource.enabled === (resourceEnabledFilter === 'true');
			return matchesSearch && matchesModule && matchesEnabled;
		})
	);

	const filteredPrompts = $derived(
		data.prompts.filter((prompt) => {
			const matchesSearch =
				!promptSearchQuery ||
				prompt.name.toLowerCase().includes(promptSearchQuery.toLowerCase()) ||
				prompt.description.toLowerCase().includes(promptSearchQuery.toLowerCase());
			const matchesModule = !promptModuleFilter || prompt.moduleId === promptModuleFilter;
			const matchesEnabled =
				promptEnabledFilter === '' || prompt.enabled === (promptEnabledFilter === 'true');
			return matchesSearch && matchesModule && matchesEnabled;
		})
	);

	const filteredLogs = $derived(
		data.logs.filter((log) => {
			const matchesSearch =
				!logSearchQuery ||
				log.method?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
				log.toolName?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
				log.resourceName?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
				log.promptName?.toLowerCase().includes(logSearchQuery.toLowerCase());
			const matchesApiKey = !logApiKeyFilter || log.apiKeyId === logApiKeyFilter;
			const matchesMethod = !logMethodFilter || log.method === logMethodFilter;
			const matchesStatus = !logStatusFilter || log.status === logStatusFilter;
			return matchesSearch && matchesApiKey && matchesMethod && matchesStatus;
		})
	);

	const uniqueLogMethods = $derived(
		Array.from(new Set(data.logs.map((log) => log.method))).sort()
	);
</script>

<svelte:head>
	<title>MCP Server - MoLOS</title>
	<meta name="description" content="Model Context Protocol server management" />
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="mx-auto max-w-7xl space-y-6 p-6">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<h1 class="text-3xl font-black tracking-tighter">MCP Server</h1>
				<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
					Model Context Protocol management
				</p>
			</div>
			<div
				class="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg border border-green-500/20"
			>
				<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
				<span class="text-sm font-medium">Server Online</span>
			</div>
		</div>

		<!-- Tabs Navigation -->
		<div class="border-b border-border">
			<nav class="flex gap-1">
				{#each tabs as tab}
					<button
						onclick={() => (activeTab = tab.id)}
						class="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors"
						class:border-primary={activeTab === tab.id}
						class:border-transparent={activeTab !== tab.id}
						class:text-foreground={activeTab === tab.id}
						class:text-muted-foreground={activeTab !== tab.id}
						class:hover:text-foreground={activeTab !== tab.id}
					>
						<svelte:component this={tab.icon} class="w-4 h-4" />
						<span class="text-sm font-medium">{tab.label}</span>
					</button>
				{/each}
			</nav>
		</div>

		<!-- Tab Content -->
		{#if activeTab === 'dashboard'}
			<!-- Dashboard Tab -->
			<div class="space-y-6">
				<!-- Quick Stats -->
				{#if data.stats}
					<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div class="bg-card rounded-lg p-6 shadow-sm border border-border">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm text-muted-foreground">Active Keys</p>
									<p class="text-2xl font-bold tracking-tight mt-1">{data.stats.activeKeys}</p>
								</div>
								<Key class="w-8 h-8 text-blue-500" />
							</div>
						</div>

						<div class="bg-card rounded-lg p-6 shadow-sm border border-border">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm text-muted-foreground">Total Requests</p>
									<p class="text-2xl font-bold tracking-tight mt-1">{data.stats.totalRequests}</p>
								</div>
								<Activity class="w-8 h-8 text-green-500" />
							</div>
						</div>

						<div class="bg-card rounded-lg p-6 shadow-sm border border-border">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm text-muted-foreground">Success Rate</p>
									<p class="text-2xl font-bold tracking-tight mt-1">{data.stats.successRate}%</p>
								</div>
								<CheckCircle class="w-8 h-8 text-green-500" />
							</div>
						</div>

						<div class="bg-card rounded-lg p-6 shadow-sm border border-border">
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm text-muted-foreground">Avg Duration</p>
									<p class="text-2xl font-bold tracking-tight mt-1">{data.stats.avgDuration}ms</p>
								</div>
								<Clock class="w-8 h-8 text-purple-500" />
							</div>
						</div>
					</div>
				{/if}

				<!-- Connection Info -->
				<div class="bg-card rounded-lg p-6 shadow-sm border border-border">
					<h2 class="text-lg font-semibold text-foreground mb-4">Connection Information</h2>
					<div class="space-y-3">
						<div class="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
							<span class="text-sm text-muted-foreground">Transport URL</span>
							<code class="text-sm font-mono text-blue-600 dark:text-blue-400"
								>{MCP_TRANSPORT_URL}</code
							>
						</div>
						<div class="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
							<span class="text-sm text-muted-foreground">Protocol Version</span>
							<span class="text-sm font-mono text-foreground">2024-11-05</span>
						</div>
					</div>
				</div>

				<!-- Available Modules -->
				{#if data.availableModules && data.availableModules.length > 0}
					<div class="bg-card rounded-lg p-6 shadow-sm border border-border">
						<h2 class="text-lg font-semibold text-foreground mb-4">Available Modules</h2>
						<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
							{#each data.availableModules as module}
								<div class="px-3 py-2 bg-accent rounded-lg text-center">
									<span class="text-sm font-medium text-foreground">{module.name}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recent Activity -->
				{#if data.recentLogs && data.recentLogs.length > 0}
					<div class="bg-card rounded-lg p-6 shadow-sm border border-border">
						<div class="flex items-center justify-between mb-4">
							<h2 class="text-lg font-semibold text-foreground">Recent Activity</h2>
						</div>
						<div class="space-y-2">
							{#each data.recentLogs as log}
								<div class="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
									<div class="flex items-center gap-3">
										{#if log.status === 'success'}
											<CheckCircle class="w-4 h-4 text-green-500" />
										{:else}
											<XCircle class="w-4 h-4 text-red-500" />
										{/if}
										<div>
											<p class="text-sm font-medium text-foreground">{log.method}</p>
											{#if log.toolName}
												<p class="text-xs text-muted-foreground">{log.toolName}</p>
											{/if}
										</div>
									</div>
									<div class="text-right">
										<p class="text-xs text-muted-foreground">{log.durationMs}ms</p>
										<p class="text-xs text-muted-foreground">
											{new Date(log.createdAt).toLocaleTimeString()}
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

		{:else if activeTab === 'keys'}
			<!-- API Keys Tab -->
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="relative">
							<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
							<input
								type="text"
								bind:value={keySearchQuery}
								placeholder="Search API keys..."
								class="w-64 pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
							/>
						</div>
						<select
							bind:value={keyStatusFilter}
							class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
						>
							<option value="">All Statuses</option>
							<option value="active">Active</option>
							<option value="disabled">Disabled</option>
							<option value="revoked">Revoked</option>
						</select>
					</div>
					<button
						onclick={openCreateDialog}
						class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition-colors"
					>
						<Plus class="w-5 h-5" />
						Create API Key
					</button>
				</div>

				<div class="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
					{#if filteredKeys.length === 0}
						<div class="p-12 text-center">
							<Key class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
							<p class="text-muted-foreground">No API keys found</p>
							<button
								onclick={openCreateDialog}
								class="mt-4 text-primary hover:underline"
							>
								Create your first API key
							</button>
						</div>
					{:else}
						<table class="w-full">
							<thead class="bg-muted/50 border-b border-border">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Name
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Key Prefix
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Modules
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Status
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Last Used
									</th>
									<th
										class="px-6 py-3 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border">
								{#each filteredKeys as key}
									<tr class="hover:bg-accent/50">
										<td class="px-6 py-4">
											<div class="text-sm font-medium text-foreground">{key.name}</div>
											{#if key.expiresAt}
												<div class="text-xs text-muted-foreground">
													Expires: {new Date(key.expiresAt).toLocaleDateString()}
												</div>
											{/if}
										</td>
										<td class="px-6 py-4">
											<code
												class="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded"
											>
												mcp_live_{key.keyPrefix}_******
											</code>
										</td>
										<td class="px-6 py-4">
											{#if key.allowedModules && key.allowedModules.length > 0}
												<div class="flex flex-wrap gap-1">
													{#each key.allowedModules.slice(0, 2) as moduleId}
														<span
															class="px-2 py-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded"
														>
															{moduleId}
														</span>
													{/each}
													{#if key.allowedModules.length > 2}
														<span class="text-xs text-muted-foreground">
															+{key.allowedModules.length - 2} more
														</span>
													{/if}
												</div>
											{:else}
												<span class="text-sm text-muted-foreground">All modules</span>
											{/if}
										</td>
										<td class="px-6 py-4">
											{#if key.status === 'active'}
												<span
													class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400"
												>
													Active
												</span>
											{:else if key.status === 'disabled'}
												<span
													class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
												>
													Disabled
												</span>
											{:else}
												<span
													class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400"
												>
													Revoked
												</span>
											{/if}
										</td>
										<td class="px-6 py-4 text-sm text-muted-foreground">
											{#if key.lastUsedAt}
												{new Date(key.lastUsedAt).toLocaleString()}
											{:else}
												Never
											{/if}
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium">
											<button
												onclick={() => revokeKey(key.id)}
												class="text-destructive hover:text-destructive/90"
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
			</div>

		{:else if activeTab === 'resources'}
			<!-- Resources Tab -->
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="relative">
							<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
							<input
								type="text"
								bind:value={resourceSearchQuery}
								placeholder="Search resources..."
								class="w-64 pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
							/>
						</div>
						<select
							bind:value={resourceModuleFilter}
							class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
						>
							<option value="">All Modules</option>
							{#each data.availableModules as module}
								<option value={module.id}>{module.name}</option>
							{/each}
						</select>
						<select
							bind:value={resourceEnabledFilter}
							class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
						>
							<option value="">All Status</option>
							<option value="true">Enabled</option>
							<option value="false">Disabled</option>
						</select>
					</div>
					<button
						class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition-colors"
					>
						<Plus class="w-5 h-5" />
						Create Resource
					</button>
				</div>

				<div class="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
					{#if filteredResources.length === 0}
						<div class="p-12 text-center">
							<ScrollText class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
							<p class="text-muted-foreground">No resources found</p>
						</div>
					{:else}
						<table class="w-full">
							<thead class="bg-muted/50 border-b border-border">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Name
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										URI
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Module
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Status
									</th>
									<th
										class="px-6 py-3 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border">
								{#each filteredResources as resource}
									<tr class="hover:bg-accent/50">
										<td class="px-6 py-4">
											<div class="text-sm font-medium text-foreground">{resource.name}</div>
											<div class="text-sm text-muted-foreground">{resource.description}</div>
										</td>
										<td class="px-6 py-4">
											<code
												class="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded"
											>
												{resource.uri}
											</code>
										</td>
										<td class="px-6 py-4">
											<span
												class="px-2 py-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded"
											>
												{resource.moduleId}
											</span>
										</td>
										<td class="px-6 py-4">
											{#if resource.enabled}
												<span
													class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400"
												>
													Enabled
												</span>
											{:else}
												<span
													class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
												>
													Disabled
												</span>
											{/if}
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium">
											<button class="text-primary hover:underline"> Edit </button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			</div>

		{:else if activeTab === 'prompts'}
			<!-- Prompts Tab -->
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="relative">
							<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
							<input
								type="text"
								bind:value={promptSearchQuery}
								placeholder="Search prompts..."
								class="w-64 pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
							/>
						</div>
						<select
							bind:value={promptModuleFilter}
							class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
						>
							<option value="">All Modules</option>
							{#each data.availableModules as module}
								<option value={module.id}>{module.name}</option>
							{/each}
						</select>
						<select
							bind:value={promptEnabledFilter}
							class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
						>
							<option value="">All Status</option>
							<option value="true">Enabled</option>
							<option value="false">Disabled</option>
						</select>
					</div>
					<button
						class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition-colors"
					>
						<Plus class="w-5 h-5" />
						Create Prompt
					</button>
				</div>

				<div class="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
					{#if filteredPrompts.length === 0}
						<div class="p-12 text-center">
							<List class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
							<p class="text-muted-foreground">No prompts found</p>
						</div>
					{:else}
						<table class="w-full">
							<thead class="bg-muted/50 border-b border-border">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Name
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Description
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Arguments
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Module
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Status
									</th>
									<th
										class="px-6 py-3 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border">
								{#each filteredPrompts as prompt}
									<tr class="hover:bg-accent/50">
										<td class="px-6 py-4">
											<div class="text-sm font-medium text-foreground">{prompt.name}</div>
										</td>
										<td class="px-6 py-4">
											<div class="text-sm text-muted-foreground max-w-md truncate">
												{prompt.description}
											</div>
										</td>
										<td class="px-6 py-4">
											<span class="text-sm text-muted-foreground">
												{prompt.arguments.length} argument{prompt.arguments.length !== 1
													? 's'
													: ''}</span
											>
										</td>
										<td class="px-6 py-4">
											{#if prompt.moduleId}
												<span
													class="px-2 py-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded"
												>
													{prompt.moduleId}
												</span>
											{:else}
												<span class="text-sm text-muted-foreground">Global</span>
											{/if}
										</td>
										<td class="px-6 py-4">
											{#if prompt.enabled}
												<span
													class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400"
												>
													Enabled
												</span>
											{:else}
												<span
													class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
												>
													Disabled
												</span>
											{/if}
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium">
											<button class="text-primary hover:underline"> Edit </button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			</div>

		{:else if activeTab === 'logs'}
			<!-- Activity Logs Tab -->
			<div class="space-y-6">
				<div class="flex items-center gap-4">
					<div class="relative flex-1 max-w-md">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
						<input
							type="text"
							bind:value={logSearchQuery}
							placeholder="Search logs..."
							class="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
						/>
					</div>
					<select
						bind:value={logApiKeyFilter}
						class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
					>
						<option value="">All API Keys</option>
						{#each data.apiKeysForFilter as key}
							<option value={key.id}>{key.name}</option>
						{/each}
					</select>
					<select
						bind:value={logMethodFilter}
						class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
					>
						<option value="">All Methods</option>
						{#each uniqueLogMethods as method}
							<option value={method}>{method}</option>
						{/each}
					</select>
					<select
						bind:value={logStatusFilter}
						class="px-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
					>
						<option value="">All Status</option>
						<option value="success">Success</option>
						<option value="error">Error</option>
					</select>
				</div>

				<div class="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
					{#if filteredLogs.length === 0}
						<div class="p-12 text-center">
							<Activity class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
							<p class="text-muted-foreground">No logs found</p>
						</div>
					{:else}
						<table class="w-full">
							<thead class="bg-muted/50 border-b border-border">
								<tr>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Time
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Method
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Target
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Status
									</th>
									<th
										class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Duration
									</th>
									<th
										class="px-6 py-3 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-border">
								{#each filteredLogs as log}
									<tr class="hover:bg-accent/50">
										<td class="px-6 py-4">
											<div class="text-sm text-foreground">
												{new Date(log.createdAt).toLocaleString()}
											</div>
										</td>
										<td class="px-6 py-4">
											<span
												class="px-2 py-1 text-xs font-mono text-foreground bg-muted rounded"
											>
												{log.method}
											</span>
										</td>
										<td class="px-6 py-4">
											{#if log.toolName}
												<div class="text-sm font-medium text-foreground">
													{log.toolName}
												</div>
											{:else if log.resourceName}
												<code
													class="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded"
												>
													{log.resourceName}
												</code>
											{:else if log.promptName}
												<div class="text-sm font-medium text-foreground">
													{log.promptName}
												</div>
											{:else}
												<span class="text-sm text-muted-foreground">-</span>
											{/if}
										</td>
										<td class="px-6 py-4">
											{#if log.status === 'success'}
												<div class="flex items-center gap-2">
													<CheckCircle class="w-4 h-4 text-green-500" />
													<span class="text-sm text-green-600 dark:text-green-400"
														>Success</span
													>
												</div>
											{:else}
												<div class="flex items-center gap-2">
													<XCircle class="w-4 h-4 text-red-500" />
													<span class="text-sm text-red-600 dark:text-red-400">Error</span>
												</div>
											{/if}
										</td>
										<td class="px-6 py-4">
											<div class="flex items-center gap-1 text-sm text-muted-foreground">
												<Clock class="w-4 h-4" />
												<span>{log.durationMs}ms</span>
											</div>
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium">
											<button class="text-primary hover:underline"> Details </button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Create API Key Dialog -->
{#if showCreateKeyDialog}
	<div class="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
		<div class="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border">
			<h2 class="text-xl font-bold text-foreground mb-4">Create API Key</h2>

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-foreground mb-1"> Name </label>
					<input
						type="text"
						bind:value={newKeyName}
						placeholder="e.g., Claude Desktop Key"
						class="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-foreground mb-1">
						Allowed Modules (optional)
					</label>
					<p class="text-xs text-muted-foreground mb-2"> Leave empty to allow all modules </p>
					<div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
						{#each data.availableModules as module}
							<label
								class="flex items-center gap-2 p-2 border border-input rounded cursor-pointer hover:bg-accent"
							>
								<input
									type="checkbox"
									bind:group={selectedModules}
									value={module.id}
									class="rounded text-primary"
								/>
								<span class="text-sm text-foreground">{module.name}</span>
							</label>
						{/each}
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-foreground mb-1">
						Expiration (optional)
					</label>
					<input
						type="date"
						bind:value={expiresAt}
						class="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
					/>
				</div>
			</div>

			<div class="flex justify-end gap-3 mt-6">
				<button
					onclick={() => (showCreateKeyDialog = false)}
					class="px-4 py-2 border border-input bg-background hover:bg-accent rounded-lg text-foreground transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={createApiKey}
					disabled={!newKeyName}
					class="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground rounded-lg font-medium transition-colors"
				>
					Create Key
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Key Secret Display Dialog -->
{#if showKeySecret}
	<div class="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
		<div class="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border">
			<div class="flex items-center gap-3 mb-4">
				<CheckCircle class="w-8 h-8 text-green-500" />
				<h2 class="text-xl font-bold text-foreground">API Key Created</h2>
			</div>

			<p class="text-sm text-muted-foreground mb-4">
				Copy this key now. You won't be able to see it again.
			</p>

			<div class="relative">
				<code
					class="block w-full p-3 bg-muted text-foreground text-sm font-mono rounded break-all pr-12"
				>
					{createdKeySecret}
				</code>
				<button
					onclick={copyKeySecret}
					class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
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
					class="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition-colors"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import {
		Key,
		ScrollText,
		Activity,
		CheckCircle,
		XCircle,
		Clock
	} from 'lucide-svelte';

	// MCP components
	import {
		McpHeader,
		McpTabs,
		McpStatsCard,
		McpConnectionInfo,
		McpQuickStart,
		McpCreateKeyDialog,
		McpKeySecretDialog,
		McpApiKeyTable,
		McpResourcesTable,
		McpPromptsTable,
		McpLogsTable
	} from '$lib/components/ai/mcp';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Tab state
	let activeTab = $state(data.tab || 'dashboard');

	// Dialog states
	let showCreateKeyDialog = $state(false);
	let showKeySecret = $state(false);
	let createdKeySecret = $state('');

	// Update URL when tab changes
	$effect(() => {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('tab', activeTab);
		window.history.replaceState({}, '', `?${params.toString()}`);
	});

	async function createApiKey(formData: {
		name: string;
		allowedModules: string[] | null;
		expiresAt: string | null;
	}) {
		const response = await fetch('/api/ai/mcp/keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			const result = await response.json();
			createdKeySecret = result.fullKey;
			showCreateKeyDialog = false;
			showKeySecret = true;
			window.location.reload();
		}
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

	function closeKeySecret() {
		showKeySecret = false;
		createdKeySecret = '';
	}

	// Get selected API key for quick start
	const firstActiveKey = $derived(data.keys.find((k) => k.status === 'active'));
	const firstActiveKeyFullSecret = $derived(undefined);
</script>

<svelte:head>
	<title>MCP Server - MoLOS</title>
	<meta name="description" content="Model Context Protocol server management" />
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="mx-auto max-w-7xl space-y-6 p-6">
		<!-- Header -->
		<McpHeader serverOnline={true} />

		<!-- Tabs Navigation -->
		<McpTabs {activeTab} onTabChange={(tab) => (activeTab = tab)} />

		<!-- Tab Content -->
		{#if activeTab === 'dashboard'}
			<!-- Dashboard Tab -->
			<div class="space-y-6">
				<!-- Quick Stats -->
				{#if data.stats}
					<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
						<McpStatsCard
							title="Active Keys"
							value={data.stats.activeKeys}
							icon={Key}
							iconColor="text-blue-500"
						/>
						<McpStatsCard
							title="Total Requests"
							value={data.stats.totalRequests}
							icon={Activity}
							iconColor="text-green-500"
						/>
						<McpStatsCard
							title="Success Rate"
							value="{data.stats.successRate}%"
							icon={CheckCircle}
							iconColor="text-green-500"
						/>
						<McpStatsCard
							title="Avg Duration"
							value="{data.stats.avgDuration}ms"
							icon={Clock}
							iconColor="text-purple-500"
						/>
					</div>
				{/if}

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Connection Info -->
					<McpConnectionInfo />

					<!-- Quick Start -->
					<McpQuickStart selectedApiKey={firstActiveKeyFullSecret} />
				</div>

				<!-- Available Modules -->
				{#if data.availableModules && data.availableModules.length > 0}
					<Card>
						<CardHeader>
							<CardTitle>Available Modules</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
								{#each data.availableModules as module (module.id)}
									<div class="px-3 py-2 bg-accent rounded-lg text-center">
										<span class="text-sm font-medium text-foreground">{module.name}</span>
									</div>
								{/each}
							</div>
						</CardContent>
					</Card>
				{/if}

				<!-- Recent Activity -->
				{#if data.recentLogs && data.recentLogs.length > 0}
					<Card>
						<CardHeader>
							<CardTitle>Recent Activity</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="space-y-2">
								{#each data.recentLogs as log (log.id)}
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
						</CardContent>
					</Card>
				{/if}
			</div>

		{:else if activeTab === 'keys'}
			<!-- API Keys Tab -->
			<McpApiKeyTable
				keys={data.keys.map((k) => ({
					...k,
					// Map to expected format
					status: k.status as 'active' | 'disabled' | 'revoked'
				}))}
				availableModules={data.availableModules}
				onCreateKey={() => (showCreateKeyDialog = true)}
				onRevokeKey={revokeKey}
			/>

		{:else if activeTab === 'resources'}
			<!-- Resources Tab -->
			<McpResourcesTable
				resources={data.resources.map((r) => ({
					...r,
					moduleId: r.moduleId ?? null
				}))}
				availableModules={data.availableModules}
			/>

		{:else if activeTab === 'prompts'}
			<!-- Prompts Tab -->
			<McpPromptsTable
				prompts={data.prompts.map((p) => ({
					...p,
					moduleId: p.moduleId ?? null
				}))}
				availableModules={data.availableModules}
			/>

		{:else if activeTab === 'logs'}
			<!-- Activity Logs Tab -->
			<McpLogsTable logs={data.logs} apiKeyOptions={data.apiKeysForFilter} />
		{/if}
	</div>
</div>

<!-- Create API Key Dialog -->
<McpCreateKeyDialog
	bind:open={showCreateKeyDialog}
	onOpenChange={(open) => (showCreateKeyDialog = open)}
	availableModules={data.availableModules}
	onCreate={createApiKey}
/>

<!-- Key Secret Display Dialog -->
<McpKeySecretDialog
	bind:open={showKeySecret}
	onOpenChange={(open) => (showKeySecret = open)}
	keySecret={createdKeySecret}
	onClose={closeKeySecret}
/>

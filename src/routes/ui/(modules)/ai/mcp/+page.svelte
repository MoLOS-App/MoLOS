<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import {
		Key,
		ScrollText,
		Activity,
		CheckCircle,
		XCircle,
		Clock,
		HelpCircle
	} from 'lucide-svelte';

	// MCP components
	import {
		McpHeader,
		McpTabs,
		McpStatsCard,
		McpConnectionInfo,
		McpQuickStart,
		McpCreateKeyDialog,
		McpEditKeyDialog,
		McpKeySecretDialog,
		McpCreateResourceDialog,
		McpEditResourceDialog,
		McpCreatePromptDialog,
		McpEditPromptDialog,
		McpApiKeyTable,
		McpResourcesTable,
		McpPromptsTable,
		McpLogDetailDialog,
		McpLogsTable,
		McpHelpDialog
	} from '$lib/components/ai/mcp';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Tab state - initialize from URL params to avoid prop reference warning
	let activeTab = $state($page.url.searchParams.get('tab') || 'dashboard');

	// Dialog states
	let showCreateKeyDialog = $state(false);
	let showEditKeyDialog = $state(false);
	let showKeySecret = $state(false);
	let createdKeySecret = $state('');
	let editingKey = $state<{
		id: string;
		name: string;
		keyPrefix: string;
		status: 'active' | 'disabled' | 'revoked';
		allowedModules: string[] | null;
		lastUsedAt: string | null;
		expiresAt: string | null;
		createdAt: string;
	} | null>(null);

	// Resource dialog states
	let showCreateResourceDialog = $state(false);
	let showEditResourceDialog = $state(false);
	let editingResource = $state<{
		id: string;
		name: string;
		description: string;
		uri: string;
		moduleId: string | null;
		resourceType: 'static' | 'url';
		url: string | null;
		enabled: boolean;
	} | null>(null);

	// Prompt dialog states
	let showCreatePromptDialog = $state(false);
	let showEditPromptDialog = $state(false);
	let editingPrompt = $state<{
		id: string;
		name: string;
		description: string;
		arguments: Array<{
			name: string;
			description: string;
			required: boolean;
			type: string;
		}>;
		moduleId: string | null;
		enabled: boolean;
	} | null>(null);

	// Log detail dialog state
	let showLogDetailDialog = $state(false);
	let viewingLog = $state<{
		id: string;
		createdAt: string;
		method: string;
		status: 'success' | 'error';
		durationMs: number;
		errorMessage?: string;
		errorStack?: string;
		requestData?: unknown;
		responseData?: unknown;
		apiKeyId: string;
		apiKeyName?: string;
		toolName?: string;
		resourceName?: string;
		promptName?: string;
	} | null>(null);

	// Help dialog state
	let showHelpDialog = $state(false);

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

	// API Key handlers
	async function updateApiKey(keyId: string, formData: {
		name: string;
		allowedModules: string[] | null;
		expiresAt: string | null;
	}) {
		const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditKeyDialog = false;
			editingKey = null;
			window.location.reload();
		}
	}

	async function toggleKeyStatus(keyId: string, newStatus: 'active' | 'disabled') {
		const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: newStatus })
		});

		if (response.ok) {
			showEditKeyDialog = false;
			editingKey = null;
			window.location.reload();
		}
	}

	function openEditKey(keyId: string) {
		const key = data.keys.find((k) => k.id === keyId);
		if (key) {
			editingKey = {
				id: key.id,
				name: key.name,
				keyPrefix: key.keyPrefix,
				status: key.status as 'active' | 'disabled' | 'revoked',
				allowedModules: key.allowedModules,
				lastUsedAt: key.lastUsedAt,
				expiresAt: key.expiresAt,
				createdAt: key.createdAt
			};
			showEditKeyDialog = true;
		}
	}

	// Resource handlers
	async function createResource(formData: {
		name: string;
		description: string;
		uri: string;
		moduleId: string | null;
		resourceType: 'static' | 'url';
		url: string | null;
		enabled: boolean;
	}) {
		const response = await fetch('/api/ai/mcp/resources', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showCreateResourceDialog = false;
			window.location.reload();
		}
	}

	async function updateResource(resourceId: string, formData: {
		name: string;
		description: string;
		uri: string;
		moduleId: string | null;
		resourceType: 'static' | 'url';
		url: string | null;
		enabled: boolean;
	}) {
		const response = await fetch(`/api/ai/mcp/resources/${resourceId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditResourceDialog = false;
			editingResource = null;
			window.location.reload();
		}
	}

	function openEditResource(resourceId: string) {
		const resource = data.resources.find((r) => r.id === resourceId);
		if (resource) {
			editingResource = {
				id: resource.id,
				name: resource.name,
				description: resource.description,
				uri: resource.uri,
				moduleId: resource.moduleId,
				resourceType: (resource as any).resourceType ?? 'static',
				url: (resource as any).url ?? null,
				enabled: resource.enabled
			};
			showEditResourceDialog = true;
		}
	}

	async function deleteResource(resourceId: string) {
		if (!confirm('Are you sure you want to delete this resource?')) return;

		const response = await fetch(`/api/ai/mcp/resources/${resourceId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			window.location.reload();
		}
	}

	// Prompt handlers
	async function createPrompt(formData: {
		name: string;
		description: string;
		arguments: Array<{
			name: string;
			description: string;
			required: boolean;
			type: string;
		}>;
		moduleId: string | null;
		enabled: boolean;
	}) {
		const response = await fetch('/api/ai/mcp/prompts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showCreatePromptDialog = false;
			window.location.reload();
		}
	}

	async function updatePrompt(promptId: string, formData: {
		name: string;
		description: string;
		arguments: Array<{
			name: string;
			description: string;
			required: boolean;
			type: string;
		}>;
		moduleId: string | null;
		enabled: boolean;
	}) {
		const response = await fetch(`/api/ai/mcp/prompts/${promptId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditPromptDialog = false;
			editingPrompt = null;
			window.location.reload();
		}
	}

	function openEditPrompt(promptId: string) {
		const prompt = data.prompts.find((p) => p.id === promptId);
		if (prompt) {
			editingPrompt = {
				id: prompt.id,
				name: prompt.name,
				description: prompt.description,
				arguments: prompt.arguments.map(arg => ({
					name: arg.name,
					description: arg.description,
					required: arg.required,
					type: arg.type
				})),
				moduleId: prompt.moduleId,
				enabled: prompt.enabled
			};
			showEditPromptDialog = true;
		}
	}

	async function deletePrompt(promptId: string) {
		if (!confirm('Are you sure you want to delete this prompt?')) return;

		const response = await fetch(`/api/ai/mcp/prompts/${promptId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			window.location.reload();
		}
	}

	// Log detail handler
	function viewLogDetail(logId: string) {
		const log = data.logs.find((l) => l.id === logId);
		if (log) {
			viewingLog = {
				id: log.id,
				createdAt: log.createdAt,
				method: log.method,
				status: log.status,
				durationMs: log.durationMs,
				errorMessage: log.errorMessage,
				errorStack: log.errorStack,
				requestData: log.requestData,
				responseData: log.responseData,
				apiKeyId: log.apiKeyId,
				toolName: log.toolName,
				resourceName: log.resourceName,
				promptName: log.promptName
			};
			showLogDetailDialog = true;
		}
	}

	// Note: Full API key secrets are only shown once at creation time for security.
	// Existing keys cannot have their full secret retrieved from the database.
</script>

<svelte:head>
	<title>MCP Server - MoLOS</title>
	<meta name="description" content="Model Context Protocol server management" />
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="mx-auto max-w-7xl space-y-8 p-4 md:p-6 lg:p-8">
		<!-- Header -->
		<div class="space-y-1">
			<McpHeader serverOnline={true} />
		</div>

		<!-- Tabs Navigation -->
		<McpTabs {activeTab} onTabChange={(tab) => (activeTab = tab)} />

		<!-- Tab Content -->
		{#if activeTab === 'dashboard'}
			<!-- Dashboard Tab -->
			<div class="space-y-8">
				<!-- Tab Header with Help Button -->
				<div class="flex items-start justify-between">
					<div class="space-y-1">
						<h2 class="text-xl font-semibold">Dashboard Overview</h2>
						<p class="text-sm text-muted-foreground">Monitor your MCP server activity and performance</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onclick={() => (showHelpDialog = true)}
						class="flex-shrink-0 text-muted-foreground hover:text-foreground"
						title="Show help"
					>
						<HelpCircle class="w-5 h-5" />
					</Button>
				</div>
				<!-- Quick Stats -->
				{#if data.stats}
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
					<!-- Connection Info -->
					<McpConnectionInfo />

					<!-- Quick Start -->
					<McpQuickStart />
				</div>

				<!-- Available Modules -->
				{#if data.availableModules && data.availableModules.length > 0}
					<Card>
						<CardHeader>
							<CardTitle class="text-lg">Available Modules</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
								{#each data.availableModules as module (module.id)}
									<div class="px-3 py-2.5 bg-accent/50 hover:bg-accent rounded-lg text-center transition-colors">
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
						<CardHeader class="flex flex-row items-center justify-between">
							<CardTitle class="text-lg">Recent Activity</CardTitle>
							<Button variant="ghost" size="sm" onclick={() => activeTab = 'logs'}>
								View all
							</Button>
						</CardHeader>
						<CardContent>
							<div class="space-y-2">
								{#each data.recentLogs as log (log.id)}
									<div class="flex items-center justify-between p-3 bg-accent/50 hover:bg-accent rounded-lg transition-colors">
										<div class="flex items-center gap-3">
											{#if log.status === 'success'}
												<CheckCircle class="w-4 h-4 text-green-500 flex-shrink-0" />
											{:else}
												<XCircle class="w-4 h-4 text-red-500 flex-shrink-0" />
											{/if}
											<div class="min-w-0">
												<p class="text-sm font-medium text-foreground truncate">{log.method}</p>
												{#if log.toolName}
													<p class="text-xs text-muted-foreground truncate">{log.toolName}</p>
												{/if}
											</div>
										</div>
										<div class="text-right flex-shrink-0">
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
				onEditKey={openEditKey}
				onRevokeKey={revokeKey}
				onShowHelp={() => (showHelpDialog = true)}
			/>

		{:else if activeTab === 'resources'}
			<!-- Resources Tab -->
			<McpResourcesTable
				resources={data.resources.map((r) => ({
					...r,
					moduleId: r.moduleId ?? null
				}))}
				availableModules={data.availableModules}
				onCreateResource={() => (showCreateResourceDialog = true)}
				onEditResource={openEditResource}
				onDeleteResource={deleteResource}
				onShowHelp={() => (showHelpDialog = true)}
			/>

		{:else if activeTab === 'prompts'}
			<!-- Prompts Tab -->
			<McpPromptsTable
				prompts={data.prompts.map((p) => ({
					...p,
					moduleId: p.moduleId ?? null
				}))}
				availableModules={data.availableModules}
				onCreatePrompt={() => (showCreatePromptDialog = true)}
				onEditPrompt={openEditPrompt}
				onDeletePrompt={deletePrompt}
				onShowHelp={() => (showHelpDialog = true)}
			/>

		{:else if activeTab === 'logs'}
			<!-- Activity Logs Tab -->
			<McpLogsTable
				logs={data.logs}
				apiKeyOptions={data.apiKeysForFilter}
				onViewDetails={viewLogDetail}
				onShowHelp={() => (showHelpDialog = true)}
			/>
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

<!-- Edit API Key Dialog -->
<McpEditKeyDialog
	bind:open={showEditKeyDialog}
	onOpenChange={(open) => (showEditKeyDialog = open)}
	availableModules={data.availableModules}
	apiKey={editingKey}
	onUpdate={updateApiKey}
	onToggleStatus={toggleKeyStatus}
/>

<!-- Key Secret Display Dialog -->
<McpKeySecretDialog
	bind:open={showKeySecret}
	onOpenChange={(open) => (showKeySecret = open)}
	keySecret={createdKeySecret}
	onClose={closeKeySecret}
/>

<!-- Create Resource Dialog -->
<McpCreateResourceDialog
	bind:open={showCreateResourceDialog}
	onOpenChange={(open) => (showCreateResourceDialog = open)}
	availableModules={data.availableModules}
	onCreate={createResource}
/>

<!-- Edit Resource Dialog -->
<McpEditResourceDialog
	bind:open={showEditResourceDialog}
	onOpenChange={(open) => (showEditResourceDialog = open)}
	availableModules={data.availableModules}
	resource={editingResource}
	onUpdate={updateResource}
/>

<!-- Create Prompt Dialog -->
<McpCreatePromptDialog
	bind:open={showCreatePromptDialog}
	onOpenChange={(open) => (showCreatePromptDialog = open)}
	availableModules={data.availableModules}
	onCreate={createPrompt}
/>

<!-- Edit Prompt Dialog -->
<McpEditPromptDialog
	bind:open={showEditPromptDialog}
	onOpenChange={(open) => (showEditPromptDialog = open)}
	availableModules={data.availableModules}
	prompt={editingPrompt}
	onUpdate={updatePrompt}
/>

<!-- Log Detail Dialog -->
<McpLogDetailDialog
	bind:open={showLogDetailDialog}
	onOpenChange={(open) => (showLogDetailDialog = open)}
	log={viewingLog}
/>

<!-- Help Dialog -->
<McpHelpDialog
	bind:open={showHelpDialog}
	onOpenChange={(open) => (showHelpDialog = open)}
	tab={activeTab}
/>

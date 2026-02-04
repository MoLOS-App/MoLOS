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
		HelpCircle,
		TrendingUp,
		Server,
		AlertTriangle
	} from 'lucide-svelte';

	// MCP components
	import {
		McpHeader,
		McpTabs,
		McpStatsCard,
		McpConnectionInfo,
		McpQuickStart,
		McpModulesGrid,
		McpRecentActivity,
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
		McpLogsTable,
		McpHelpDialog,
		McpOAuthAppsTable,
		McpCreateOAuthAppDialog,
		McpEditOAuthAppDialog,
		type HelpTabId
	} from '$lib/components/ai/mcp';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Helper to format dates
	function formatDate(date: string | Date): string {
		return typeof date === 'string' ? date : date.toISOString();
	}

	// Local reactive state for data
	// svelte-ignore state_referenced_locally
	let localKeys = $state(
		[...data.keys].map((k) => ({
			...k,
			lastUsedAt: k.lastUsedAt ? formatDate(k.lastUsedAt) : null,
			expiresAt: k.expiresAt ? formatDate(k.expiresAt) : null,
			createdAt: formatDate(k.createdAt)
		}))
	);
	// svelte-ignore state_referenced_locally
	let localResources = $state(
		[...data.resources].map((r) => ({
			...r,
			createdAt: formatDate(r.createdAt),
			updatedAt: formatDate(r.updatedAt)
		}))
	);
	// svelte-ignore state_referenced_locally
	let localPrompts = $state(
		[...data.prompts].map((p) => ({
			...p,
			arguments: p.arguments.map((arg) => ({
				...arg,
				required: arg.required ?? false,
				type: arg.type ?? 'string'
			})),
			createdAt: formatDate(p.createdAt),
			updatedAt: formatDate(p.updatedAt)
		}))
	);
	// svelte-ignore state_referenced_locally
	let localLogs = $state(
		[...data.logs].map((log) => ({
			...log,
			createdAt: formatDate(log.createdAt)
		}))
	);
	// svelte-ignore state_referenced_locally
	let localOAuthApps = $state(
		[...data.oauthApps].map((app) => ({
			client_id: app.client_id,
			client_id_issued_at: app.client_id_issued_at,
			name: app.client_name || app.name || 'Unnamed App',
			redirect_uris: (app.redirect_uris || []).map((u) => u.toString()),
			scopes: app.scope ? app.scope.split(' ') : [],
			token_endpoint_auth_method: app.token_endpoint_auth_method || 'none',
			client_secret: app.client_secret,
			client_secret_expires_at: app.client_secret_expires_at
		}))
	);

	// Refresh function to fetch latest data from server
	async function refreshData() {
		try {
			// Fetch keys - returns { items: [...], total, page, limit, hasMore }
			const keysResponse = await fetch('/api/ai/mcp/keys?limit=100');
			if (keysResponse.ok) {
				const keysData = await keysResponse.json();
				localKeys = [...keysData.items];
			}

			// Fetch resources - returns { items: [...], total, page, limit, hasMore }
			const resourcesResponse = await fetch('/api/ai/mcp/resources?limit=100');
			if (resourcesResponse.ok) {
				const resourcesData = await resourcesResponse.json();
				localResources = [...resourcesData.items];
			}

			// Fetch prompts - returns { items: [...], total, page, limit, hasMore }
			const promptsResponse = await fetch('/api/ai/mcp/prompts?limit=100');
			if (promptsResponse.ok) {
				const promptsData = await promptsResponse.json();
				localPrompts = [...promptsData.items];
			}

			// Logs can't be refreshed via API - they're only loaded server-side
			// For a full refresh including logs, user would need to reload the page
		} catch (error) {
			console.error('Failed to refresh data:', error);
		}
	}

	// Tab state - initialize from URL params to avoid prop reference warning
	let activeTab = $state(($page.url.searchParams.get('tab') || 'dashboard') as HelpTabId);

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

	// OAuth dialog states
	let showCreateOAuthAppDialog = $state(false);
	let showEditOAuthAppDialog = $state(false);
	let editingOAuthApp = $state<{
		client_id: string;
		client_id_issued_at: number;
		name: string;
		redirect_uris: string[];
		scopes: string[];
		token_endpoint_auth_method: string;
		client_secret?: string;
		client_secret_expires_at?: number;
	} | null>(null);

	// Help dialog state
	let showHelpDialog = $state(false);

	// Confirmation dialog state
	let showDeleteConfirmDialog = $state(false);
	let deleteConfirmType = $state<'key' | 'resource' | 'prompt' | 'oauth' | null>(null);
	let deleteConfirmId = $state<string | null>(null);
	let deleteConfirmName = $state<string>('');

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
			// Don't reload - let user view the secret first
			// Table will be refreshed when they close the modal
		}
	}

	function confirmRevokeKey(keyId: string) {
		const key = localKeys.find((k) => k.id === keyId);
		if (key) {
			deleteConfirmType = 'key';
			deleteConfirmId = keyId;
			deleteConfirmName = key.name;
			showDeleteConfirmDialog = true;
		}
	}

	async function revokeKey(keyId: string) {
		const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			await refreshData();
		}
	}

	async function closeKeySecret() {
		showKeySecret = false;
		createdKeySecret = '';
		// Refresh data after closing the secret modal
		await refreshData();
	}

	// API Key handlers
	async function updateApiKey(
		keyId: string,
		formData: {
			name: string;
			allowedModules: string[] | null;
			expiresAt: string | null;
		}
	) {
		const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditKeyDialog = false;
			editingKey = null;
			await refreshData();
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
			await refreshData();
		}
	}

	function openEditKey(keyId: string) {
		const key = localKeys.find((k) => k.id === keyId);
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
			await refreshData();
		}
	}

	async function updateResource(
		resourceId: string,
		formData: {
			name: string;
			description: string;
			uri: string;
			moduleId: string | null;
			resourceType: 'static' | 'url';
			url: string | null;
			enabled: boolean;
		}
	) {
		const response = await fetch(`/api/ai/mcp/resources/${resourceId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditResourceDialog = false;
			editingResource = null;
			await refreshData();
		}
	}

	function openEditResource(resourceId: string) {
		const resource = localResources.find((r) => r.id === resourceId);
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

	function confirmDeleteResource(resourceId: string) {
		const resource = localResources.find((r) => r.id === resourceId);
		if (resource) {
			deleteConfirmType = 'resource';
			deleteConfirmId = resourceId;
			deleteConfirmName = resource.name;
			showDeleteConfirmDialog = true;
		}
	}

	async function deleteResource(resourceId: string) {
		const response = await fetch(`/api/ai/mcp/resources/${resourceId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			await refreshData();
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
			await refreshData();
		}
	}

	async function updatePrompt(
		promptId: string,
		formData: {
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
		}
	) {
		const response = await fetch(`/api/ai/mcp/prompts/${promptId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditPromptDialog = false;
			editingPrompt = null;
			await refreshData();
		}
	}

	function openEditPrompt(promptId: string) {
		const prompt = localPrompts.find((p) => p.id === promptId);
		if (prompt) {
			editingPrompt = {
				id: prompt.id,
				name: prompt.name,
				description: prompt.description,
				arguments: prompt.arguments.map((arg) => ({
					name: arg.name,
					description: arg.description,
					required: arg.required ?? false,
					type: arg.type ?? 'string'
				})),
				moduleId: prompt.moduleId,
				enabled: prompt.enabled
			};
			showEditPromptDialog = true;
		}
	}

	function confirmDeletePrompt(promptId: string) {
		const prompt = localPrompts.find((p) => p.id === promptId);
		if (prompt) {
			deleteConfirmType = 'prompt';
			deleteConfirmId = promptId;
			deleteConfirmName = prompt.name;
			showDeleteConfirmDialog = true;
		}
	}

	// OAuth handlers
	async function createOAuthApp(formData: {
		name: string;
		redirectUris: string[];
		scopes: string[];
		tokenEndpointAuthMethod: string;
	}) {
		const response = await fetch('/api/ai/mcp/oauth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_name: formData.name,
				redirect_uris: formData.redirectUris,
				scope: formData.scopes.join(' '),
				token_endpoint_auth_method: formData.tokenEndpointAuthMethod,
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code']
			})
		});

		if (response.ok) {
			const result = await response.json();
			showCreateOAuthAppDialog = false;
			// Refresh the OAuth apps list
			const appsResponse = await fetch('/api/ai/mcp/oauth/register');
			if (appsResponse.ok) {
				const appsData = await appsResponse.json();
				localOAuthApps = appsData.items.map((app: any) => ({
					client_id: app.client_id,
					client_id_issued_at: app.client_id_issued_at,
					name: app.client_name || app.name || 'Unnamed App',
					redirect_uris: (app.redirect_uris || []).map((u: URL) => u.toString()),
					scopes: app.scope ? app.scope.split(' ') : [],
					token_endpoint_auth_method: app.token_endpoint_auth_method || 'none',
					client_secret: app.client_secret,
					client_secret_expires_at: app.client_secret_expires_at
				}));
			}
			return result;
		}
	}

	async function updateOAuthApp(clientId: string, updates: {
		name: string;
		scopes: string[];
	}) {
		const response = await fetch(`/api/ai/mcp/oauth/apps/${clientId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: updates.name,
				scopes: updates.scopes
			})
		});

		if (response.ok) {
			showEditOAuthAppDialog = false;
			editingOAuthApp = null;
			// Refresh the OAuth apps list
			const appsResponse = await fetch('/api/ai/mcp/oauth/register');
			if (appsResponse.ok) {
				const appsData = await appsResponse.json();
				localOAuthApps = appsData.items.map((app: any) => ({
					client_id: app.client_id,
					client_id_issued_at: app.client_id_issued_at,
					name: app.client_name || app.name || 'Unnamed App',
					redirect_uris: (app.redirect_uris || []).map((u: URL) => u.toString()),
					scopes: app.scope ? app.scope.split(' ') : [],
					token_endpoint_auth_method: app.token_endpoint_auth_method || 'none',
					client_secret: app.client_secret,
					client_secret_expires_at: app.client_secret_expires_at
				}));
			}
		}
	}

	function openEditOAuthApp(app: {
		client_id: string;
		client_id_issued_at: number;
		name: string;
		redirect_uris: string[];
		scopes: string[];
		token_endpoint_auth_method: string;
		client_secret?: string;
		client_secret_expires_at?: number;
	}) {
		editingOAuthApp = app;
		showEditOAuthAppDialog = true;
	}

	function confirmDeleteOAuthApp(clientId: string) {
		const app = localOAuthApps.find((a) => a.client_id === clientId);
		if (app) {
			deleteConfirmType = 'oauth';
			deleteConfirmId = clientId;
			deleteConfirmName = app.name;
			showDeleteConfirmDialog = true;
		}
	}

	async function deletePrompt(promptId: string) {
		const response = await fetch(`/api/ai/mcp/prompts/${promptId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			await refreshData();
		}
	}

	async function deleteOAuthApp(clientId: string) {
		const response = await fetch(`/api/ai/mcp/oauth/apps/${clientId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			// Refresh the OAuth apps list
			const appsResponse = await fetch('/api/ai/mcp/oauth/register');
			if (appsResponse.ok) {
				const appsData = await appsResponse.json();
				localOAuthApps = appsData.items.map((app: any) => ({
					client_id: app.client_id,
					client_id_issued_at: app.client_id_issued_at,
					name: app.client_name || app.name || 'Unnamed App',
					redirect_uris: (app.redirect_uris || []).map((u: URL) => u.toString()),
					scopes: app.scope ? app.scope.split(' ') : [],
					token_endpoint_auth_method: app.token_endpoint_auth_method || 'none',
					client_secret: app.client_secret,
					client_secret_expires_at: app.client_secret_expires_at
				}));
			}
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
			<!-- Dashboard Tab - Modern Material Design 3 Layout -->
			<div class="space-y-6">
				<!-- Tab Header with Help Button -->
				<div class="flex items-start justify-between">
					<div>
						<h2 class="text-2xl font-semibold tracking-tight">Dashboard</h2>
						<p class="text-muted-foreground mt-1 text-sm">Monitor your MCP server at a glance</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onclick={() => (showHelpDialog = true)}
						class="text-muted-foreground flex-shrink-0 hover:text-foreground"
						title="Show help"
					>
						<HelpCircle class="h-5 w-5" />
					</Button>
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
					<!-- <div class="flex flex-row justify-between w-full pb-6">
						<McpConnectionInfo />

						<McpModulesGrid modules={data.availableModules} />
					</div> -->

					<div class="space-y-6 xl:col-span-4">
						<!-- Quick Start -->
						<McpQuickStart />
					</div>
				</div>
			</div>
		{:else if activeTab === 'keys'}
			<!-- API Keys Tab -->
			<McpApiKeyTable
				keys={localKeys.map((k) => ({
					...k,
					// Map to expected format
					status: k.status as 'active' | 'disabled' | 'revoked'
				}))}
				availableModules={data.availableModules}
				onCreateKey={() => (showCreateKeyDialog = true)}
				onEditKey={openEditKey}
				onRevokeKey={confirmRevokeKey}
				onShowHelp={() => (showHelpDialog = true)}
			/>
		{:else if activeTab === 'resources'}
			<!-- Resources Tab -->
			<McpResourcesTable
				resources={localResources.map((r) => ({
					...r,
					moduleId: r.moduleId ?? null
				}))}
				availableModules={data.availableModules}
				onCreateResource={() => (showCreateResourceDialog = true)}
				onEditResource={openEditResource}
				onDeleteResource={confirmDeleteResource}
				onShowHelp={() => (showHelpDialog = true)}
			/>
		{:else if activeTab === 'prompts'}
			<!-- Prompts Tab -->
			<McpPromptsTable
				prompts={localPrompts.map((p) => ({
					...p,
					moduleId: p.moduleId ?? null
				}))}
				availableModules={data.availableModules}
				onCreatePrompt={() => (showCreatePromptDialog = true)}
				onEditPrompt={openEditPrompt}
				onDeletePrompt={confirmDeletePrompt}
				onShowHelp={() => (showHelpDialog = true)}
			/>
		{:else if activeTab === 'logs'}
			<!-- Activity Logs Tab -->
			<McpLogsTable
				logs={localLogs}
				apiKeyOptions={data.apiKeysForFilter}
				onShowHelp={() => (showHelpDialog = true)}
			/>
		{:else if activeTab === 'oauth'}
			<!-- OAuth Apps Tab -->
			<McpOAuthAppsTable
				apps={localOAuthApps}
				onCreateApp={() => (showCreateOAuthAppDialog = true)}
				onEditApp={openEditOAuthApp}
				onDeleteApp={confirmDeleteOAuthApp}
				onShowHelp={() => (showHelpDialog = true)}
			/>
		{/if}
	</div>
</div>

<!-- Create API Key Dialog -->
<McpCreateKeyDialog
	open={showCreateKeyDialog}
	onOpenChange={(open) => (showCreateKeyDialog = open)}
	availableModules={data.availableModules}
	onCreate={createApiKey}
/>

<!-- Edit API Key Dialog -->
<McpEditKeyDialog
	open={showEditKeyDialog}
	onOpenChange={(open) => (showEditKeyDialog = open)}
	availableModules={data.availableModules}
	apiKey={editingKey}
	onUpdate={updateApiKey}
	onToggleStatus={toggleKeyStatus}
/>

<!-- Key Secret Display Dialog -->
<McpKeySecretDialog
	open={showKeySecret}
	onOpenChange={(open) => (showKeySecret = open)}
	keySecret={createdKeySecret}
	onClose={closeKeySecret}
/>

<!-- Create Resource Dialog -->
<McpCreateResourceDialog
	open={showCreateResourceDialog}
	onOpenChange={(open) => (showCreateResourceDialog = open)}
	availableModules={data.availableModules}
	onCreate={createResource}
/>

<!-- Edit Resource Dialog -->
<McpEditResourceDialog
	open={showEditResourceDialog}
	onOpenChange={(open) => (showEditResourceDialog = open)}
	availableModules={data.availableModules}
	resource={editingResource}
	onUpdate={updateResource}
/>

<!-- Create Prompt Dialog -->
<McpCreatePromptDialog
	open={showCreatePromptDialog}
	onOpenChange={(open) => (showCreatePromptDialog = open)}
	availableModules={data.availableModules}
	onCreate={createPrompt}
/>

<!-- Edit Prompt Dialog -->
<McpEditPromptDialog
	open={showEditPromptDialog}
	onOpenChange={(open) => (showEditPromptDialog = open)}
	availableModules={data.availableModules}
	prompt={editingPrompt}
	onUpdate={updatePrompt}
/>

<!-- Create OAuth App Dialog -->
<McpCreateOAuthAppDialog
	open={showCreateOAuthAppDialog}
	onOpenChange={(open) => (showCreateOAuthAppDialog = open)}
	availableScopes={data.availableScopes}
	onCreate={createOAuthApp}
/>

<!-- Edit OAuth App Dialog -->
<McpEditOAuthAppDialog
	open={showEditOAuthAppDialog}
	onOpenChange={(open) => (showEditOAuthAppDialog = open)}
	availableScopes={data.availableScopes}
	app={editingOAuthApp}
	onUpdate={updateOAuthApp}
/>

<!-- Help Dialog -->
<McpHelpDialog
	open={showHelpDialog}
	onOpenChange={(open) => (showHelpDialog = open)}
	tab={activeTab}
/>

<!-- Delete Confirmation Dialog -->
<AlertDialog bind:open={showDeleteConfirmDialog}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle class="flex items-center gap-2">
				<AlertTriangle class="h-5 w-5 text-destructive" />
				Confirm {deleteConfirmType === 'key' ? 'Revoke' : 'Delete'}
			</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to {deleteConfirmType === 'key' ? 'revoke' : 'delete'}
				{deleteConfirmType === 'key' ? ' this API key' : ` this ${deleteConfirmType}`}
				<strong>"{deleteConfirmName}"</strong>? This action cannot be undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				onclick={async () => {
					if (deleteConfirmId && deleteConfirmType) {
						if (deleteConfirmType === 'key') {
							await revokeKey(deleteConfirmId);
						} else if (deleteConfirmType === 'resource') {
							await deleteResource(deleteConfirmId);
						} else if (deleteConfirmType === 'prompt') {
							await deletePrompt(deleteConfirmId);
						} else if (deleteConfirmType === 'oauth') {
							await deleteOAuthApp(deleteConfirmId);
						}
					}
					showDeleteConfirmDialog = false;
					deleteConfirmType = null;
					deleteConfirmId = null;
					deleteConfirmName = '';
				}}
			>
				{deleteConfirmType === 'key' ? 'Revoke' : 'Delete'}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

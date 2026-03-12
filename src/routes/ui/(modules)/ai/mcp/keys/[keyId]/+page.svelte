<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { Save, ArrowLeft } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { toast } from 'svelte-sonner';
	import {
		McpApiKeyInfo,
		McpApiKeyStats,
		McpApiKeyActivity,
		McpScopePicker,
		type ModuleData,
		type Tool
	} from '$lib/components/ai/mcp';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Form state - reactive to data changes
	let name = $state(data.apiKey.name);

	// Normalize scopes from old format (module IDs) to new format (null for all)
	// Old format: ['MoLOS-Tasks', 'MoLOS-Markdown'] → means all tools in those modules
	// New format: ['MoLOS-Tasks:tasks:get_tasks', ...] → means specific tools
	// We normalize old format to null (all tools) to use Scope Picker
	let normalizedScopes = $derived(() => {
		const scopes = data.apiKey.allowedScopes;
		if (!scopes || scopes.length === 0) return [];

		// Check if scopes are in old format (just module IDs, no colons)
		const hasOldFormatScopes = scopes.some((s) => !s.includes(':'));

		if (hasOldFormatScopes) {
			// Old format detected - convert to null (all tools)
			console.log('[ApiKeyDetail] Normalizing old-format scopes to null:', scopes);
			return [];
		}

		// Already in new format - return as-is
		return scopes;
	});

	let selectedScopes = $state(data.apiKey.allowedScopes || []);
	let expiresAt = $state(
		data.apiKey.expiresAt ? new Date(data.apiKey.expiresAt).toISOString().split('T')[0] : ''
	);

	let saving = $state(false);

	// Sync form state when data.apiKey changes
	$effect(() => {
		const apiKey = data.apiKey;
		name = apiKey.name;
		selectedScopes = apiKey.allowedScopes || [];
		expiresAt = apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString().split('T')[0] : '';
	});

	// Modules data for scope picker - handle undefined gracefully
	const modulesData: ModuleData[] = data.modules
		.filter((module) => module != null && module.submodules != null)
		.map((module) => {
			try {
				const submodulesMap = new Map<string, { tools: Tool[]; submoduleCount: number }>();

				// Handle both Map (from server) and Object (from API)
				if (module.submodules) {
					if (module.submodules instanceof Map) {
						// Server returns Map format
						module.submodules.forEach((submoduleData, submoduleName) => {
							if (submoduleData && Array.isArray(submoduleData)) {
								submodulesMap.set(submoduleName, {
									tools: submoduleData,
									submoduleCount: submoduleData.length
								});
							}
						});
					} else if (typeof module.submodules === 'object') {
						// API returns Object format - convert to Map
						for (const [submoduleName, submoduleData] of Object.entries(module.submodules)) {
							if (Array.isArray(submoduleData)) {
								submodulesMap.set(submoduleName, {
									tools: submoduleData,
									submoduleCount: submoduleData.length
								});
							}
						}
					}
				}

				const result = {
					id: module.id,
					name: module.name,
					description: module.description,
					isExternal: module.isExternal,
					submodules: submodulesMap
				};

				return result;
			} catch (e) {
				console.error('[ApiKeyDetail] Error processing module:', module.id, e);
				return {
					id: module.id,
					name: module.name,
					description: module.description,
					isExternal: module.isExternal,
					submodules: new Map()
				};
			}
		});

	// Debug log
	console.log('[ApiKeyDetail Page] Total modules:', modulesData.length);
	console.log(
		'[ApiKeyDetail Page] Module names:',
		modulesData.map((m) => m.name)
	);

	// Save changes
	async function handleSave() {
		if (saving) return;

		saving = true;

		try {
			const response = await fetch(`/api/ai/mcp/keys/${data.apiKey.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					allowedScopes: normalizedScopes, // Use normalized scopes for saving
					expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
				})
			});

			if (response.ok) {
				toast.success('API key updated successfully');
			} else {
				const error = await response.json();
				toast.error(error.error || 'Failed to update API key');
			}
		} catch (error) {
			toast.error('An error occurred while saving');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Edit API Key - {data.apiKey.name} | MoLOS</title>
	<meta name="description" content="Manage MCP API key permissions" />
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<Button variant="ghost" size="sm" onclick={() => goto('/ui/ai/mcp?tab=keys')} class="gap-2">
					<ArrowLeft class="h-4 w-4" />
					Back to Keys
				</Button>
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">Edit API Key</h1>
					<p class="text-muted-foreground text-sm">{data.apiKey.name}</p>
				</div>
			</div>
		</div>

		<Separator class="my-6" />

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Left Column: Key Info & Stats -->
			<div class="space-y-6 lg:col-span-1">
				<!-- Key Info Card -->
				<McpApiKeyInfo apiKey={data.apiKey} editable={data.apiKey.status !== 'revoked'} />

				<!-- Stats Card -->
				<McpApiKeyStats
					stats={{
						totalRequests: data.stats.totalRequests,
						successCount: data.stats.successCount,
						avgDuration: data.stats.avgDuration,
						usageCount: data.apiKey.usageCount
					}}
				/>

				<!-- Recent Logs -->
				<McpApiKeyActivity
					logs={data.recentLogs.map((log) => ({
						...log,
						createdAt: log.createdAt
					}))}
				/>
			</div>

			<!-- Right Column: Tool Permissions -->
			<div class="lg:col-span-2">
				<Card class="h-full">
					<CardHeader class="flex items-start justify-between">
						<div>
							<CardTitle class="text-base">Tool Permissions</CardTitle>
							<p class="text-muted-foreground text-sm">
								Select which tools this API key can access
							</p>
						</div>
						<Button onclick={handleSave} disabled={saving} class="gap-2">
							<Save class="h-4 w-4" />
							{saving ? 'Saving...' : 'Save Changes'}
						</Button>
					</CardHeader>
					<CardContent class="pt-0">
						<!-- Use improved McpScopePicker with tabs UI -->
						<McpScopePicker
							modules={modulesData}
							{selectedScopes}
							onChange={(scopes) => (selectedScopes = scopes)}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	</div>
</div>

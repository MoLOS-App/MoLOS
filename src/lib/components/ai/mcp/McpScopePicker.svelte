<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import type { Tool, ModuleData, SubmoduleData } from './types.js';

	// MCP Scope Picker Component - Handles module/tool selection

	let {
		modules = [],
		selectedScopes = [],
		onChange
	}: {
		modules: ModuleData[];
		selectedScopes: string[];
		onChange?: (scopes: string[]) => void;
	} = $props();

	// UI state
	let expandedModules = $state<Set<string>>(new Set());
	let selectedModuleTab = $state(modules[0]?.id || '');
	let copiedToClipboard = $state(false);
	let previousTab = $state('');

	// Update selected tab when modules change
	$effect(() => {
		console.log('[McpScopePicker] Modules updated, count:', modules.length);
		console.log(
			'[McpScopePicker] Module IDs:',
			modules.map((m) => m.id)
		);
		if (modules.length > 0 && !modules.find((m) => m.id === selectedModuleTab)) {
			selectedModuleTab = modules[0]?.id || '';
		}
	});

	// Accordion behavior: auto-expand selected module when tab changes
	$effect(() => {
		// Only act when tab actually changes
		if (previousTab !== selectedModuleTab) {
			console.log('[McpScopePicker] Tab changed from', previousTab, 'to', selectedModuleTab);
			// Clear and expand only the new tab
			expandedModules.clear();
			if (selectedModuleTab) {
				expandedModules.add(selectedModuleTab);
			}
			previousTab = selectedModuleTab;
		}
	});

	// Derived state
	const totalTools = $derived(
		modules.reduce((sum, module) => {
			let moduleTotal = 0;
			for (const submodule of module.submodules.values()) {
				moduleTotal += submodule.tools.length;
			}
			return sum + moduleTotal;
		}, 0)
	);

	const selectedToolCount = $derived(selectedScopes.length);

	// Helper to get total tool count for a module
	function getModuleToolCount(module: ModuleData): number {
		let count = 0;
		for (const submodule of module.submodules.values()) {
			count += submodule.tools.length;
		}
		return count;
	}

	// Expand/collapse module
	function toggleModuleExpand(moduleId: string) {
		if (expandedModules.has(moduleId)) {
			expandedModules.delete(moduleId);
		} else {
			expandedModules.add(moduleId);
		}
	}

	// Check if module has any tools selected
	function isModuleSelected(moduleId: string): boolean {
		return selectedScopes.some((scope) => {
			const parts = scope.split(':');
			return parts[0] === moduleId;
		});
	}

	// Check if submodule has any tools selected
	function isSubmoduleSelected(moduleId: string, submodule: string): boolean {
		return selectedScopes.some((scope) => {
			const parts = scope.split(':');
			return parts[0] === moduleId && parts[1] === submodule;
		});
	}

	// Check if specific tool is selected
	function isToolSelected(moduleId: string, submodule: string, tool: string): boolean {
		const scope = `${moduleId}:${submodule}:${tool}`;
		return selectedScopes.includes(scope);
	}

	// Toggle module selection (select all tools in module)
	function toggleModule(moduleId: string, module: ModuleData) {
		const isSelected = isModuleSelected(moduleId);

		// Remove all scopes for this module
		selectedScopes = selectedScopes.filter((scope) => {
			const parts = scope.split(':');
			return parts[0] !== moduleId;
		});

		// If was not selected, add all tools from all submodules
		if (!isSelected) {
			module.submodules.forEach((submoduleData, submoduleName) => {
				submoduleData.tools.forEach((tool) => {
					selectedScopes.push(`${moduleId}:${submoduleName}:${tool.name}`);
				});
			});
		}

		if (onChange) {
			onChange(selectedScopes);
		}
	}

	// Toggle submodule selection
	function toggleSubmodule(moduleId: string, submodule: string, submoduleData: SubmoduleData) {
		const isSelected = isSubmoduleSelected(moduleId, submodule);

		// Remove all scopes for this submodule
		selectedScopes = selectedScopes.filter((scope) => {
			const parts = scope.split(':');
			return parts[0] !== moduleId || parts[1] !== submodule;
		});

		// If was not selected, add all tools
		if (!isSelected && submoduleData?.tools) {
			submoduleData.tools.forEach((tool) => {
				selectedScopes.push(`${moduleId}:${submodule}:${tool.name}`);
			});
		}

		if (onChange) {
			onChange(selectedScopes);
		}
	}

	// Toggle individual tool selection
	function toggleTool(moduleId: string, submodule: string, toolName: string) {
		const scope = `${moduleId}:${submodule}:${toolName}`;

		if (selectedScopes.includes(scope)) {
			selectedScopes = selectedScopes.filter((s) => s !== scope);
		} else {
			selectedScopes = [...selectedScopes, scope];
		}

		if (onChange) {
			onChange(selectedScopes);
		}
	}

	// Copy scopes to clipboard
	async function copyScopes() {
		try {
			await navigator.clipboard.writeText(selectedScopes.join('\n'));
			copiedToClipboard = true;
			toast.success('Scopes copied to clipboard');
			setTimeout(() => {
				copiedToClipboard = false;
			}, 2000);
		} catch (error) {
			toast.error('Failed to copy scopes');
		}
	}

	// Get selection summary
	function getSelectionSummary(): string {
		if (selectedToolCount === 0) {
			return 'No tools selected';
		}
		if (selectedToolCount === totalTools) {
			return 'All tools selected';
		}
		return `${selectedToolCount} of ${totalTools} tools selected`;
	}
</script>

<div class="space-y-4">
	<!-- Selection Summary -->
	<div class="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
		<span class="text-sm font-medium">{getSelectionSummary()}</span>
		<Button variant="outline" size="sm" onclick={copyScopes} class="gap-2">
			{#if copiedToClipboard}
				<Check class="text-success h-4 w-4" />
				Copied!
			{:else}
				<Copy class="h-4 w-4" />
				Copy Scopes
			{/if}
		</Button>
	</div>

	<!-- Tabs for Module Selection -->
	{#if modules.length > 0}
		<Tabs bind:value={selectedModuleTab} class="w-full">
			<div class="mb-4">
				<TabsList class="grid h-auto min-h-fit w-full grid-cols-2 lg:grid-cols-4">
					{#each modules as module}
						<TabsTrigger value={module.id} class="h-auto min-h-[34px] text-sm whitespace-normal">
							<div class="flex items-center gap-1">
								<span>{module.name}</span>
								<Badge variant="secondary" class="ml-1 flex-shrink-0">
									{getModuleToolCount(module)}
								</Badge>
							</div>
						</TabsTrigger>
					{/each}
				</TabsList>
			</div>

			{#each modules as module (module.id)}
				<TabsContent value={module.id} class="mt-4">
					<Card>
						<CardHeader>
							<div class="flex items-start justify-between">
								<div>
									<CardTitle class="text-base">{module.name}</CardTitle>
									<p class="text-muted-foreground text-sm">{module.description}</p>
								</div>
								<div class="flex items-center gap-2">
									<Checkbox
										id="module-{module.id}"
										checked={isModuleSelected(module.id)}
										onCheckedChange={() => toggleModule(module.id, module)}
									/>
									<Label for="module-{module.id}" class="cursor-pointer text-sm font-medium">
										Select All
									</Label>
								</div>
							</div>
						</CardHeader>
						<CardContent class="space-y-3">
							{#each Array.from(module.submodules.entries()) as [submoduleName, submoduleData]}
								{@const tools = (submoduleData?.tools as Tool[]) || []}
								<div class="rounded-lg border bg-card">
									<!-- Submodule Header -->
									<div class="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
										<div class="flex items-center gap-2">
											<Checkbox
												id="submodule-{module.id}-{submoduleName}"
												checked={isSubmoduleSelected(module.id, submoduleName)}
												onCheckedChange={() =>
													toggleSubmodule(module.id, submoduleName, {
														tools,
														submoduleCount: tools.length
													})}
											/>
											<Label
												for="submodule-{module.id}-{submoduleName}"
												class="cursor-pointer text-sm font-medium"
											>
												{submoduleName === 'main' ? 'Default' : submoduleName}
											</Label>
											<Badge variant="secondary" class="text-xs">
												{tools.length} tools
											</Badge>
										</div>
										<Button
											variant="ghost"
											size="sm"
											class="h-6 w-6 p-0"
											onclick={() => toggleModuleExpand(module.id)}
										>
											{#if expandedModules.has(module.id)}
												<ChevronUp class="text-muted-foreground h-4 w-4" />
											{:else}
												<ChevronDown class="text-muted-foreground h-4 w-4" />
											{/if}
										</Button>
									</div>

									<!-- Tools List (Collapsible) -->
									{#if expandedModules.has(module.id)}
										<div class="p-4">
											{#each tools as tool}
												<div class="flex items-start gap-3 rounded px-2 py-2 hover:bg-accent/10">
													<Checkbox
														id="tool-{module.id}-{submoduleName}-{tool.name}"
														checked={isToolSelected(module.id, submoduleName, tool.name)}
														onCheckedChange={() => toggleTool(module.id, submoduleName, tool.name)}
													/>
													<div class="flex-1">
														<Label
															for="tool-{module.id}-{submoduleName}-{tool.name}"
															class="cursor-pointer text-sm font-medium"
														>
															{tool.name}
														</Label>
														<p class="text-muted-foreground text-xs">
															{tool.description}
														</p>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}

							<!-- Info Note -->
							{#if module.submodules.size === 0}
								<div class="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
									<Info class="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
									<p class="text-muted-foreground text-sm">No tools available for this module.</p>
								</div>
							{/if}
						</CardContent>
					</Card>
				</TabsContent>
			{/each}
		</Tabs>
	{:else}
		<div class="flex items-start gap-2 rounded-lg bg-muted/50 p-4">
			<Info class="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0" />
			<div class="text-sm">
				<p class="font-medium text-foreground">No modules available</p>
				<p class="text-muted-foreground">
					There are no modules with tools configured. Please add modules to access their tools.
				</p>
			</div>
		</div>
	{/if}
</div>

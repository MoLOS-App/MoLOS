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

	interface Props {
		modules: ModuleData[];
		selectedScopes: string[];
		onChange?: (scopes: string[]) => void;
		onToggleScope?: (scope: string) => void;
		onToggleModule?: (moduleId: string) => void;
		onToggleSubmodule?: (moduleId: string, submodule: string) => void;
		onToggleTool?: (moduleId: string, submodule: string, tool: string) => void;
		onCopyScopes?: () => void;
	}

	let {
		modules,
		selectedScopes = [],
		onChange,
		onToggleScope,
		onToggleModule,
		onToggleSubmodule,
		onToggleTool,
		onCopyScopes
	}: Props = $props();

	// UI state
	let expandedModules = $state<Set<string>>(new Set());
	let selectedModuleTab = $state(modules[0]?.id || '');
	let copiedToClipboard = $state(false);
	let previousTab = $state('');
	let showOldFormatWarning = $derived(() => {
		// Detect if scopes are in old format (module IDs without colons)
		if (selectedScopes.length === 0) return false;
		return selectedScopes.some((s) => !s.includes(':'));
	});

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
		// Only act When Tab Actually Changes
		if (previousTab !== selectedModuleTab) {
			console.log('[McpScopePicker] Tab changed from', previousTab, 'to', selectedModuleTab);
			// Clear and expand only the new tab
			const newExpanded = new Set<string>();
			if (selectedModuleTab) {
				newExpanded.add(selectedModuleTab);
			}
			expandedModules = newExpanded;
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

	// Check if scope is selected
	function isScopeSelected(scope: string): boolean {
		return selectedScopes.includes(scope);
	}

	// Helper to update scopes using onChange callback
	function updateScopes(newScopes: string[]) {
		if (onChange) {
			onChange(newScopes);
		} else if (onToggleScope) {
			// Fallback: toggle each scope individually
			// This is less efficient but maintains backward compatibility
			const added = newScopes.filter((s) => !selectedScopes.includes(s));
			const removed = selectedScopes.filter((s) => !newScopes.includes(s));
			added.forEach((s) => onToggleScope?.(s));
			removed.forEach((s) => onToggleScope?.(s));
		}
	}

	// Toggle a single scope
	function toggleScope(scope: string) {
		const newScopes = isScopeSelected(scope)
			? selectedScopes.filter((s) => s !== scope)
			: [...selectedScopes, scope];
		updateScopes(newScopes);
	}

	// Check if all scopes in a submodule are selected
	function isSubmoduleFullySelected(module: ModuleData, submodule: string): boolean {
		const submoduleData = module.submodules.get(submodule);
		if (!submoduleData) return false;

		return submoduleData.tools.every((tool) => {
			const scope = `${module.id}:${submodule}:${tool.name}`;
			return isScopeSelected(scope);
		});
	}

	// Check if any scope in a submodule is selected
	function isSubmodulePartiallySelected(module: ModuleData, submodule: string): boolean {
		const submoduleData = module.submodules.get(submodule);
		if (!submoduleData) return false;

		return submoduleData.tools.some((tool) => {
			const scope = `${module.id}:${submodule}:${tool.name}`;
			return isScopeSelected(scope);
		});
	}

	// Check if all scopes in a module are selected
	function isModuleFullySelected(module: ModuleData): boolean {
		for (const [submodule, submoduleData] of module.submodules.entries()) {
			for (const tool of submoduleData.tools) {
				const scope = `${module.id}:${submodule}:${tool.name}`;
				if (!isScopeSelected(scope)) {
					return false;
				}
			}
		}
		return true;
	}

	// Check if any scope in a module is selected
	function isModulePartiallySelected(module: ModuleData): boolean {
		for (const [submodule, submoduleData] of module.submodules.entries()) {
			for (const tool of submoduleData.tools) {
				const scope = `${module.id}:${submodule}:${tool.name}`;
				if (isScopeSelected(scope)) {
					return true;
				}
			}
		}
		return false;
	}

	// Toggle all scopes in a module
	function toggleModule(module: ModuleData) {
		const allSelected = isModuleFullySelected(module);
		const newScopes = new Set(selectedScopes);

		for (const [submodule, submoduleData] of module.submodules.entries()) {
			for (const tool of submoduleData.tools) {
				const scope = `${module.id}:${submodule}:${tool.name}`;
				if (allSelected) {
					// Deselect all
					newScopes.delete(scope);
				} else {
					// Select all
					newScopes.add(scope);
				}
			}
		}

		updateScopes(Array.from(newScopes));

		if (onToggleModule) {
			onToggleModule(module.id);
		}
	}

	// Toggle all scopes in a submodule
	function toggleSubmodule(module: ModuleData, submodule: string) {
		const submoduleData = module.submodules.get(submodule);
		if (!submoduleData) return;

		const allSelected = isSubmoduleFullySelected(module, submodule);
		const newScopes = new Set(selectedScopes);

		for (const tool of submoduleData.tools) {
			const scope = `${module.id}:${submodule}:${tool.name}`;
			if (allSelected) {
				// Deselect all
				newScopes.delete(scope);
			} else {
				// Select all
				newScopes.add(scope);
			}
		}

		updateScopes(Array.from(newScopes));

		if (onToggleSubmodule) {
			onToggleSubmodule(module.id, submodule);
		}
	}

	// Toggle single tool
	function toggleTool(module: ModuleData, submodule: string, tool: Tool) {
		const scope = `${module.id}:${submodule}:${tool.name}`;
		toggleScope(scope);
		if (onToggleTool) {
			onToggleTool(module.id, submodule, tool.name);
		}
	}

	// Copy scopes to clipboard
	async function copyScopesToClipboard() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(selectedScopes, null, 2));
			copiedToClipboard = true;
			toast.success('Scopes copied to clipboard');
			setTimeout(() => {
				copiedToClipboard = false;
			}, 2000);
		} catch (error) {
			toast.error('Failed to copy to clipboard');
		}

		if (onCopyScopes) {
			onCopyScopes();
		}
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold">Scope Selection</h2>
			<p class="text-muted-foreground text-sm">
				Select tools and resources this API key can access
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Badge variant="secondary">
				{selectedToolCount} / {totalTools} selected
			</Badge>
			{#if onCopyScopes}
				<Button variant="outline" size="sm" onclick={copyScopesToClipboard}>
					{#if copiedToClipboard}
						<Check class="mr-2 h-4 w-4" />
					{:else}
						<Copy class="mr-2 h-4 w-4" />
					{/if}
					{copiedToClipboard ? 'Copied!' : 'Copy Scopes'}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Warning for old format scopes -->
	{#if showOldFormatWarning}
		<div class="bg-warning/10 border-warning/20 mb-4 rounded-lg p-4">
			<div class="flex items-start gap-3">
				<Info class="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
				<div class="flex-1">
					<h4 class="text-warning-foreground mb-1 font-medium">Legacy Format Detected</h4>
					<p class="text-warning-foreground/80 text-sm">
						This API key was created with an old permission format. Please edit the key and use the
						Scope Picker to select specific tools with fine-grained control.
					</p>
					<p class="text-warning-foreground/60 text-xs">
						Current format: Module-level access (e.g., "All Tasks"). New format: Tool-level access
						(e.g., "Tasks: get_tasks, create_task").
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Tabs for Module Selection -->
	{#if modules.length > 0}
		<Tabs bind:value={selectedModuleTab} class="w-full">
			<div class="mb-4">
				<TabsList class="grid h-auto min-h-fit w-full grid-cols-2 lg:grid-cols-4">
					{#each modules as module}
						<TabsTrigger value={module.id} class="h-auto min-h-[34px] text-sm whitespace-normal">
							<div class="flex cursor-pointer items-center gap-1">
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
				<TabsContent value={module.id}>
					<div>
						<CardHeader>
							<div class="flex items-center justify-between">
								<CardTitle class="flex items-center gap-2">
									{module.name}
									<Badge variant="outline">{module.submodules.size} submodules</Badge>
								</CardTitle>
							</div>
						</CardHeader>

						{#if expandedModules.has(module.id)}
							<CardContent class="space-y-4">
								<p class="text-muted-foreground text-sm">
									{module.description || 'No description available'}
								</p>

								{#if module.submodules.size > 0}
									<div class="space-y-4">
										{#each Array.from(module.submodules.entries()) as [submodule, submoduleData] (submodule)}
											<div class="rounded-lg border p-4">
												<div class="mb-3 flex items-center justify-between">
													<div class="flex items-center gap-2">
														<h4 class="font-medium">{submodule}</h4>
														<Badge variant="secondary">
															{submoduleData.tools.length} tools
														</Badge>
													</div>
													<Button
														variant="outline"
														size="sm"
														onclick={() => toggleSubmodule(module, submodule)}
													>
														{#if isSubmoduleFullySelected(module, submodule)}
															Deselect All
														{:else if isSubmodulePartiallySelected(module, submodule)}
															Select All
														{:else}
															Select All
														{/if}
													</Button>
												</div>

												<div class="space-y-2">
													{#each submoduleData.tools as tool (tool.name)}
														<div class="flex items-start space-x-2">
															<Checkbox
																id="{module.id}-{submodule}-{tool.name}"
																checked={isScopeSelected(`${module.id}:${submodule}:${tool.name}`)}
																onCheckedChange={() => toggleTool(module, submodule, tool)}
															/>
															<div class="flex-1">
																<Label
																	for="{module.id}-{submodule}-{tool.name}"
																	class="cursor-pointer"
																>
																	{tool.name}
																</Label>
																{#if tool.description}
																	<p class="text-muted-foreground mt-1 text-xs">
																		{tool.description}
																	</p>
																{/if}
															</div>
														</div>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="text-muted-foreground py-8 text-center">
										<Info class="mx-auto mb-2 h-8 w-8 opacity-50" />
										<p>No tools available for this module.</p>
									</div>
								{/if}
							</CardContent>
						{/if}
					</div>
				</TabsContent>
			{/each}
		</Tabs>
	{:else}
		<Card>
			<CardContent class="py-8 text-center">
				<Info class="mx-auto mb-2 h-8 w-8 opacity-50" />
				<p class="text-muted-foreground">No modules available</p>
			</CardContent>
		</Card>
	{/if}
</div>

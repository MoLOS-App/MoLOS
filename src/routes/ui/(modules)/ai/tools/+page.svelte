<script lang="ts">
	import type { PageData } from './$types';
	import { Wrench, Package, Search } from 'lucide-svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectLabel,
		SelectSeparator,
		SelectTrigger,
		SelectValue
	} from '$lib/components/ui/select';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Search and filter state
	let searchTerm = $state('');
	let selectedModule = $state<'all' | 'core' | string>('all');
	let selectedActiveModule = $state<string>('all');

	// Get module IDs that have tools
	const modulesWithTools = $derived(
		data.modules.filter((m) => data.toolsByModule[m.id]?.length > 0)
	);

	// Get active modules (all are active in this context)
	const activeModules = $derived(data.modules);

	// Filter tools based on search, selected module, and selected active module
	let displayedTools = $derived.by(() => {
		let tools: Array<{ name: string; description: string; moduleName?: string; moduleId?: string }> =
			[];

		// First, determine which tools to include based on module selection
		if (selectedModule === 'all') {
			// Show core tools
			tools.push(
				...data.coreTools.map((t) => ({
					...t,
					moduleName: undefined,
					moduleId: undefined
				}))
			);
			// Show all module tools
			for (const [moduleId, moduleTools] of Object.entries(data.toolsByModule)) {
				const module = data.modules.find((m) => m.id === moduleId);
				tools.push(
					...moduleTools.map((t) => ({
						...t,
						moduleName: module?.name || moduleId,
						moduleId
					}))
				);
			}
		} else if (selectedModule === 'core') {
			tools.push(
				...data.coreTools.map((t) => ({
					...t,
					moduleName: undefined,
					moduleId: undefined
				}))
			);
		} else {
			// Selected a specific module
			const moduleTools = data.toolsByModule[selectedModule] || [];
			const module = data.modules.find((m) => m.id === selectedModule);
			tools.push(
				...moduleTools.map((t) => ({
					...t,
					moduleName: module?.name || selectedModule,
					moduleId: selectedModule
				}))
			);
		}

		// Apply active module filter if specified
		if (selectedActiveModule !== 'all') {
			tools = tools.filter(
				(t) => t.moduleId === selectedActiveModule || t.moduleId === undefined
			);
		}

		// Apply search filter
		if (searchTerm) {
			tools = tools.filter(
				(t) =>
					t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					t.description.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		return tools;
	});

	let toolCount = $derived(displayedTools.length);

	// Get display name for selected module
	let selectedModuleDisplay = $derived.by(() => {
		if (selectedModule === 'all') return 'All Tools';
		if (selectedModule === 'core') return 'Core Tools';
		const module = data.modules.find((m) => m.id === selectedModule);
		return module?.name || selectedModule;
	});

	// Get display name for selected active module filter
	let selectedActiveModuleDisplay = $derived.by(() => {
		if (selectedActiveModule === 'all') return 'All Modules';
		const module = data.modules.find((m) => m.id === selectedActiveModule);
		return module?.name || selectedActiveModule;
	});
</script>

<svelte:head>
	<title>AI Tools - MoLOS</title>
	<meta name="description" content="Browse all discovered AI tools from MoLOS modules" />
</svelte:head>

<div class="min-h-screen bg-background">
	<div class="mx-auto max-w-7xl space-y-8 p-4 md:p-6 lg:p-8">
		<!-- Header -->
		<div class="space-y-6">
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<Wrench class="h-6 w-6 text-primary" />
				</div>
				<div>
					<h1 class="text-3xl font-bold tracking-tight">AI Tools Discovery</h1>
					<p class="text-muted-foreground">
						Browse all discovered AI tools from active MoLOS modules
					</p>
				</div>
			</div>

			<!-- Search and Filter Controls -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="relative flex-1 max-w-md">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						bind:value={searchTerm}
						placeholder="Search tools by name or description..."
						class="pl-9"
					/>
				</div>

				<div class="flex items-center gap-3">
					<!-- Module Selection Dropdown -->
					<Select bind:value={selectedModule}>
						<SelectTrigger class="w-[220px]">
							<SelectValue placeholder="Select module" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">
								<div class="flex items-center gap-2">
									<Package class="h-4 w-4" />
									<span>All Tools</span>
									<Badge variant="secondary" class="ml-auto text-xs">
										{data.coreTools.length +
										Object.values(data.toolsByModule).reduce(
											(sum, tools) => sum + tools.length,
											0
										)}
									</Badge>
								</div>
							</SelectItem>
							<SelectSeparator />
							<SelectLabel>
								<div class="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold">
									<Wrench class="h-4 w-4" />
									Core
								</div>
							</SelectLabel>
							<SelectItem value="core">
								<div class="flex items-center gap-2">
									<span>Core Tools</span>
									<Badge variant="secondary" class="ml-auto text-xs">
										{data.coreTools.length}
									</Badge>
								</div>
							</SelectItem>
							<SelectSeparator />
							<SelectLabel>Modules</SelectLabel>
							{#each modulesWithTools as module (module.id)}
								{@const toolCount = data.toolsByModule[module.id]?.length || 0}
								<SelectItem value={module.id}>
									<div class="flex items-center gap-2">
										<span>{module.name}</span>
										<Badge variant="secondary" class="ml-auto text-xs">{toolCount}</Badge>
									</div>
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>

					<!-- Active Module Filter Dropdown -->
					<Select bind:value={selectedActiveModule}>
						<SelectTrigger class="w-[220px]">
							<SelectValue placeholder="Filter by module" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">
								<span>All Modules</span>
							</SelectItem>
							<SelectSeparator />
							{#each activeModules as module (module.id)}
								{@const toolCount = data.toolsByModule[module.id]?.length || 0}
								<SelectItem value={module.id}>
									<div class="flex items-center gap-2">
										<span>{module.name}</span>
										<Badge variant="secondary" class="ml-auto text-xs">{toolCount}</Badge>
									</div>
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>
			</div>

			<!-- Active Filters Display -->
			{#if selectedActiveModule !== 'all' || searchTerm}
				<div class="flex flex-wrap items-center gap-2">
					<span class="text-sm text-muted-foreground">Active filters:</span>
					{#if selectedActiveModule !== 'all'}
						<Badge variant="outline" class="gap-1">
							Module: {selectedActiveModuleDisplay}
							<button
								class="ml-1 hover:text-destructive"
								onclick={() => (selectedActiveModule = 'all')}
							>
								×
							</button>
						</Badge>
					{/if}
					{#if searchTerm}
						<Badge variant="outline" class="gap-1">
							Search: "{searchTerm}"
							<button
								class="ml-1 hover:text-destructive"
								onclick={() => (searchTerm = '')}
							>
								×
							</button>
						</Badge>
					{/if}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 text-xs"
						onclick={() => {
							searchTerm = '';
							selectedActiveModule = 'all';
						}}
					>
						Clear all
					</Button>
				</div>
			{/if}
		</div>

		<!-- Current Selection Header -->
		<div class="flex items-center justify-between border-b pb-4">
			<div>
				<h2 class="text-2xl font-semibold">{selectedModuleDisplay}</h2>
				<p class="text-muted-foreground text-sm mt-1">
					{toolCount} tool{toolCount !== 1 ? 's' : ''} found
				</p>
			</div>
		</div>

		<!-- Tools Grid -->
		{#if displayedTools.length > 0}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each displayedTools as tool (tool.name + (tool.moduleId || 'core'))}
					<Card class="hover:border-primary/50 transition-colors">
						<CardHeader class="pb-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1 min-w-0">
									<CardTitle class="text-base font-mono truncate">{tool.name}</CardTitle>
									{#if tool.moduleId}
										<Badge variant="outline" class="mt-2 text-xs">
											{tool.moduleName}
										</Badge>
									{:else}
										<Badge variant="secondary" class="mt-2 text-xs">Core</Badge>
									{/if}
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<p class="text-sm text-muted-foreground line-clamp-3">{tool.description}</p>
						</CardContent>
					</Card>
				{/each}
			</div>
		{:else}
			<Card>
				<CardContent class="flex flex-col items-center justify-center py-16">
					<Search class="h-16 w-16 text-muted-foreground mb-4" />
					<h3 class="text-xl font-semibold">No tools found</h3>
					<p class="text-muted-foreground text-center mt-2 max-w-md">
						{searchTerm || selectedActiveModule !== 'all'
							? 'No tools match your current filters. Try adjusting your selection.'
							: 'No tools available for the selected module.'}
					</p>
					{#if searchTerm || selectedActiveModule !== 'all'}
						<Button
							variant="outline"
							class="mt-4"
							onclick={() => {
								searchTerm = '';
								selectedActiveModule = 'all';
							}}
						>
							Clear filters
						</Button>
					{/if}
				</CardContent>
			</Card>
		{/if}

		<!-- Active Modules Info -->
		{#if activeModules.length > 0}
			<div class="border-t pt-6">
				<h3 class="font-semibold text-sm mb-3">Active Modules ({activeModules.length})</h3>
				<div class="flex flex-wrap gap-2">
					{#each activeModules as module (module.id)}
						<Badge
							variant={selectedModule === module.id ? 'default' : 'secondary'}
							class="cursor-pointer hover:opacity-80 transition-opacity"
							onclick={() => (selectedModule = module.id)}
						>
							{module.name}
							<span class="ml-1 opacity-60">({data.toolsByModule[module.id]?.length || 0})</span>
						</Badge>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

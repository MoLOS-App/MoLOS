<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { ScrollText, Search, Plus, Edit, Trash2, HelpCircle } from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle, EmptyContent } from '$lib/components/ui/empty';

	export interface McpResource {
		id: string;
		name: string;
		description: string;
		uri: string;
		moduleId: string | null;
		enabled: boolean;
	}

	let {
		resources = [],
		availableModules = [],
		onCreateResource,
		onEditResource,
		onDeleteResource,
		onShowHelp
	}: {
		resources: McpResource[];
		availableModules: { id: string; name: string }[];
		onCreateResource?: () => void;
		onEditResource?: (resourceId: string) => void;
		onDeleteResource?: (resourceId: string) => void | Promise<void>;
		onShowHelp?: () => void;
	} = $props();

	let searchQuery = $state('');
	let moduleFilter = $state('');
	let enabledFilter = $state('');

	const filteredResources = $derived(
		resources.filter((resource) => {
			const matchesSearch =
				!searchQuery ||
				resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				resource.description.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesModule = !moduleFilter || resource.moduleId === moduleFilter;
			const matchesEnabled =
				enabledFilter === '' || resource.enabled === (enabledFilter === 'true');
			return matchesSearch && matchesModule && matchesEnabled;
		})
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<div class="relative">
				<Search class="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
				<Input
					bind:value={searchQuery}
					placeholder="Search resources..."
					class="w-64 pl-9 h-9"
				/>
			</div>
			<Select bind:value={moduleFilter}>
				<SelectTrigger class="w-40 h-9">
					{#if moduleFilter === ''}
						All Modules
					{:else}
						{availableModules.find(m => m.id === moduleFilter)?.name || 'All Modules'}
					{/if}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">All Modules</SelectItem>
					{#each availableModules as module}
						<SelectItem value={module.id}>{module.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
			<Select bind:value={enabledFilter}>
				<SelectTrigger class="w-32 h-9">
					{#if enabledFilter === ''}
						All Status
					{:else if enabledFilter === 'true'}
						Enabled
					{:else if enabledFilter === 'false'}
						Disabled
					{/if}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">All Status</SelectItem>
					<SelectItem value="true">Enabled</SelectItem>
					<SelectItem value="false">Disabled</SelectItem>
				</SelectContent>
			</Select>
		</div>
		<div class="flex items-center gap-2">
			{#if onCreateResource}
				<Button onclick={onCreateResource} class="gap-2">
					<Plus class="w-4 h-4" />
					Create Resource
				</Button>
			{/if}
			{#if onShowHelp}
				<Button
					variant="ghost"
					size="icon"
					onclick={onShowHelp}
					class="flex-shrink-0 text-muted-foreground hover:text-foreground"
					title="Show help"
				>
					<HelpCircle class="w-5 h-5" />
				</Button>
			{/if}
		</div>
	</div>

	<!-- Table -->
	<Card class="p-0">
		<CardContent class="p-0">
			{#if filteredResources.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							<ScrollText class="w-16 h-16 text-muted-foreground" />
						</EmptyMedia>
						<EmptyTitle>
							{#if searchQuery || moduleFilter || enabledFilter}
								No resources found
							{:else}
								No resources yet
							{/if}
						</EmptyTitle>
						<EmptyContent>
							{#if onCreateResource && !searchQuery && !moduleFilter && !enabledFilter}
								<Button variant="link" onclick={onCreateResource} class="mt-2">
									Create your first resource
								</Button>
							{/if}
						</EmptyContent>
					</Empty>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="border-b bg-muted/50 border-border">
							<tr>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Name
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									URI
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Module
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Status
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-right uppercase text-muted-foreground"
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
										<code class="px-2 py-1 font-mono text-sm rounded text-foreground bg-muted">
											{resource.uri}
										</code>
									</td>
									<td class="px-6 py-4">
										{#if resource.moduleId}
											<Badge variant="secondary" class="text-xs">
												{resource.moduleId}
											</Badge>
										{:else}
											<span class="text-sm text-muted-foreground">Global</span>
										{/if}
									</td>
									<td class="px-6 py-4">
										{#if resource.enabled}
											<Badge class="bg-success/10 text-success">
												Enabled
											</Badge>
										{:else}
											<Badge variant="secondary" class="bg-muted text-muted-foreground">
												Disabled
											</Badge>
										{/if}
									</td>
									<td class="px-6 py-4 text-right">
										<div class="flex items-center justify-end gap-1">
											{#if onEditResource}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => onEditResource(resource.id)}
												>
													<Edit class="w-4 h-4" />
												</Button>
											{/if}
											{#if onDeleteResource}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => onDeleteResource(resource.id)}
													class="text-destructive hover:text-destructive"
													title="Delete resource"
												>
													<Trash2 class="w-4 h-4" />
												</Button>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

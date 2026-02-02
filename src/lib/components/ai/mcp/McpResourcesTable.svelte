<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { ScrollText, Search, Plus, Edit } from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle } from '$lib/components/ui/empty';

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
		onEditResource
	}: {
		resources: McpResource[];
		availableModules: { id: string; name: string }[];
		onCreateResource?: () => void;
		onEditResource?: (resourceId: string) => void;
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
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
				<Input
					bind:value={searchQuery}
					placeholder="Search resources..."
					class="w-64 pl-9 h-9"
				/>
			</div>
			<select
				bind:value={moduleFilter}
				class="px-3 py-2 text-sm border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring"
			>
				<option value="">All Modules</option>
				{#each availableModules as module}
					<option value={module.id}>{module.name}</option>
				{/each}
			</select>
			<select
				bind:value={enabledFilter}
				class="px-3 py-2 text-sm border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring"
			>
				<option value="">All Status</option>
				<option value="true">Enabled</option>
				<option value="false">Disabled</option>
			</select>
		</div>
		{#if onCreateResource}
			<Button onclick={onCreateResource} class="gap-2">
				<Plus class="w-4 h-4" />
				Create Resource
			</Button>
		{/if}
	</div>

	<!-- Table -->
	<Card>
		<CardContent class="p-0">
			{#if filteredResources.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							<ScrollText class="w-16 h-16 text-muted-foreground" />
						</EmptyMedia>
						<EmptyTitle>No resources found</EmptyTitle>
					</Empty>
				</div>
			{:else}
				<div class="overflow-x-auto">
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
										<code class="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
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
										{#if onEditResource}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => onEditResource(resource.id)}
											>
												<Edit class="w-4 h-4" />
											</Button>
										{/if}
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

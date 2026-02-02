<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { List, Search, Plus, Edit } from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle } from '$lib/components/ui/empty';

	export interface PromptArgument {
		name: string;
		description: string;
		required: boolean;
		type: string;
	}

	export interface McpPrompt {
		id: string;
		name: string;
		description: string;
		arguments: PromptArgument[];
		moduleId: string | null;
		enabled: boolean;
	}

	let {
		prompts = [],
		availableModules = [],
		onCreatePrompt,
		onEditPrompt
	}: {
		prompts: McpPrompt[];
		availableModules: { id: string; name: string }[];
		onCreatePrompt?: () => void;
		onEditPrompt?: (promptId: string) => void;
	} = $props();

	let searchQuery = $state('');
	let moduleFilter = $state('');
	let enabledFilter = $state('');

	const filteredPrompts = $derived(
		prompts.filter((prompt) => {
			const matchesSearch =
				!searchQuery ||
				prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				prompt.description.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesModule = !moduleFilter || prompt.moduleId === moduleFilter;
			const matchesEnabled =
				enabledFilter === '' || prompt.enabled === (enabledFilter === 'true');
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
					placeholder="Search prompts..."
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
		{#if onCreatePrompt}
			<Button onclick={onCreatePrompt} class="gap-2">
				<Plus class="w-4 h-4" />
				Create Prompt
			</Button>
		{/if}
	</div>

	<!-- Table -->
	<Card>
		<CardContent class="p-0">
			{#if filteredPrompts.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							<List class="w-16 h-16 text-muted-foreground" />
						</EmptyMedia>
						<EmptyTitle>No prompts found</EmptyTitle>
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
												: ''}
										</span>
									</td>
									<td class="px-6 py-4">
										{#if prompt.moduleId}
											<Badge variant="secondary" class="text-xs">
												{prompt.moduleId}
											</Badge>
										{:else}
											<span class="text-sm text-muted-foreground">Global</span>
										{/if}
									</td>
									<td class="px-6 py-4">
										{#if prompt.enabled}
											<Badge class="bg-green-500/10 text-green-600 dark:text-green-400">
												Enabled
											</Badge>
										{:else}
											<Badge variant="secondary" class="bg-muted text-muted-foreground">
												Disabled
											</Badge>
										{/if}
									</td>
									<td class="px-6 py-4 text-right">
										{#if onEditPrompt}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => onEditPrompt(prompt.id)}
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

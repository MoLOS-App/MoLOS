<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { List, Search, Plus, Edit, Trash2 } from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle, EmptyContent } from '$lib/components/ui/empty';

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
		onEditPrompt,
		onDeletePrompt
	}: {
		prompts: McpPrompt[];
		availableModules: { id: string; name: string }[];
		onCreatePrompt?: () => void;
		onEditPrompt?: (promptId: string) => void;
		onDeletePrompt?: (promptId: string) => void | Promise<void>;
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
			<Select bind:value={moduleFilter}>
				<SelectTrigger class="h-9 w-40">
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
				<SelectTrigger class="h-9 w-32">
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
						<EmptyTitle>
							{#if searchQuery || moduleFilter || enabledFilter}
								No prompts found
							{:else}
								No prompts yet
							{/if}
						</EmptyTitle>
						<EmptyContent>
							{#if onCreatePrompt && !searchQuery && !moduleFilter && !enabledFilter}
								<Button variant="link" onclick={onCreatePrompt} class="mt-2">
									Create your first prompt
								</Button>
							{/if}
						</EmptyContent>
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
											{#if onEditPrompt}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => onEditPrompt(prompt.id)}
												>
													<Edit class="w-4 h-4" />
												</Button>
											{/if}
											{#if onDeletePrompt}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => onDeletePrompt(prompt.id)}
													class="text-destructive hover:text-destructive"
													title="Delete prompt"
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

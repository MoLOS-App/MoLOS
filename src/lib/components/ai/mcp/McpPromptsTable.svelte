<script lang="ts">
	import McpDataTable from './McpDataTable.svelte';
	import type { DataTableAction } from './types.js';
	import { Badge } from '$lib/components/ui/badge';
	import { List, Edit, Trash2, HelpCircle } from 'lucide-svelte';
	import { EmptyMedia, EmptyTitle } from '$lib/components/ui/empty';

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
		onDeletePrompt,
		onShowHelp
	}: {
		prompts: McpPrompt[];
		availableModules: { id: string; name: string }[];
		onCreatePrompt?: () => void;
		onEditPrompt?: (promptId: string) => void;
		onDeletePrompt?: (promptId: string) => void | Promise<void>;
		onShowHelp?: () => void;
	} = $props();

	const columns = [
		{
			key: 'name',
			label: 'Name',
			render: (prompt: McpPrompt) =>
				`<div class="text-sm font-medium text-foreground">${prompt.name}</div>`
		},
		{
			key: 'description',
			label: 'Description',
			render: (prompt: McpPrompt) =>
				`<div class="text-muted-foreground max-w-md truncate text-sm">${prompt.description}</div>`
		},
		{
			key: 'arguments',
			label: 'Arguments',
			render: (prompt: McpPrompt) =>
				`<span class="text-muted-foreground text-sm">${prompt.arguments.length} argument${prompt.arguments.length !== 1 ? 's' : ''}</span>`
		},
		{
			key: 'moduleId',
			label: 'Module',
			render: (prompt: McpPrompt) => {
				if (prompt.moduleId) {
					return `<Badge variant="secondary" class="text-xs">${prompt.moduleId}</Badge>`;
				}
				return `<span class="text-muted-foreground text-sm">Global</span>`;
			}
		},
		{
			key: 'enabled',
			label: 'Status',
			render: (prompt: McpPrompt) => {
				if (prompt.enabled) {
					return `<Badge class="bg-success/10 text-success">Enabled</Badge>`;
				}
				return `<Badge variant="secondary" class="text-muted-foreground bg-muted">Disabled</Badge>`;
			}
		}
	];

	const actions: DataTableAction<McpPrompt>[] = [];
	if (onEditPrompt) {
		actions.push({
			icon: Edit,
			label: 'Edit prompt',
			onClick: onEditPrompt
		});
	}
	if (onDeletePrompt) {
		actions.push({
			icon: Trash2,
			label: 'Delete prompt',
			variant: 'destructive',
			onClick: onDeletePrompt
		});
	}
</script>

<div class="space-y-6">
	<McpDataTable
		data={prompts}
		{columns}
		{actions}
		searchPlaceholder="Search prompts..."
		searchKey="name"
		filters={[
			{
				key: 'moduleId',
				label: 'All Modules',
				options: [
					{ value: '', label: 'All Modules' },
					...availableModules.map((m) => ({ value: m.id, label: m.name }))
				]
			},
			{
				key: 'enabled',
				label: 'All Status',
				options: [
					{ value: '', label: 'All Status' },
					{ value: 'true', label: 'Enabled' },
					{ value: 'false', label: 'Disabled' }
				]
			}
		]}
		createLabel="Create Prompt"
		{onCreatePrompt}
		emptyIcon={List}
		emptyTitle="No prompts found"
	/>

	{#if onShowHelp}
		<button
			onclick={onShowHelp}
			class="text-muted-foreground ml-auto flex items-center gap-2 hover:text-foreground"
		>
			<HelpCircle class="h-5 w-5" />
			Help
		</button>
	{/if}
</div>

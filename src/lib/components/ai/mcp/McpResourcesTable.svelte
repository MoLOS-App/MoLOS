<script lang="ts">
	import McpDataTable from './McpDataTable.svelte';
	import type { DataTableAction } from './types.js';
	import { Badge } from '$lib/components/ui/badge';
	import { ScrollText, Edit, Trash2, HelpCircle } from 'lucide-svelte';
	import { EmptyMedia, EmptyTitle } from '$lib/components/ui/empty';

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

	const columns = [
		{
			key: 'name',
			label: 'Name',
			render: (resource: McpResource) =>
				`
				<div class="text-sm font-medium text-foreground">${resource.name}</div>
				<div class="text-muted-foreground text-sm">${resource.description}</div>
				`
		},
		{
			key: 'uri',
			label: 'URI',
			render: (resource: McpResource) =>
				`<code class="rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">${resource.uri}</code>`
		},
		{
			key: 'moduleId',
			label: 'Module',
			render: (resource: McpResource) => {
				if (resource.moduleId) {
					return `<Badge variant="secondary" class="text-xs">${resource.moduleId}</Badge>`;
				}
				return `<span class="text-muted-foreground text-sm">Global</span>`;
			}
		},
		{
			key: 'enabled',
			label: 'Status',
			render: (resource: McpResource) => {
				if (resource.enabled) {
					return `<Badge class="bg-success/10 text-success">Enabled</Badge>`;
				}
				return `<Badge variant="secondary" class="text-muted-foreground bg-muted">Disabled</Badge>`;
			}
		}
	];

	const actions: DataTableAction<McpResource>[] = [];
	if (onEditResource) {
		actions.push({
			icon: Edit,
			label: 'Edit resource',
			onClick: (resource) => onEditResource(resource.id)
		});
	}
	if (onDeleteResource) {
		actions.push({
			icon: Trash2,
			label: 'Delete resource',
			variant: 'destructive',
			onClick: (resource) => onDeleteResource(resource.id)
		});
	}
</script>

<div class="space-y-6">
	<McpDataTable
		data={resources}
		{columns}
		{actions}
		searchPlaceholder="Search resources..."
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
		createLabel="Create Resource"
		onCreate={onCreateResource}
		emptyIcon={ScrollText}
		emptyTitle="No resources found"
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

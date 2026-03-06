<script lang="ts">
	import McpDataTable from './McpDataTable.svelte';
	import type { DataTableAction } from './types.js';
	import { Badge } from '$lib/components/ui/badge';
	import { Key, Edit, Trash2, AlertCircle, HelpCircle } from 'lucide-svelte';
	import { EmptyMedia, EmptyTitle, EmptyContent } from '$lib/components/ui/empty';

	export interface ApiKey {
		id: string;
		name: string;
		keyPrefix: string;
		status: 'active' | 'disabled' | 'revoked';
		allowedScopes: string[] | null;
		lastUsedAt: string | null;
		expiresAt: string | null;
	}

	let {
		keys = [],
		onCreateKey,
		onEditKey,
		onViewDetails,
		onRevokeKey,
		onShowHelp
	}: {
		keys: ApiKey[];
		onCreateKey?: () => void;
		onEditKey?: (keyId: string) => void;
		onViewDetails?: (keyId: string) => void;
		onRevokeKey?: (keyId: string) => void | Promise<void>;
		onShowHelp?: () => void;
	} = $props();

	function getStatusBadge(key: ApiKey) {
		switch (key.status) {
			case 'active':
				return 'bg-success/10 text-success';
			case 'disabled':
				return 'bg-warning/10 text-warning';
			case 'revoked':
				return 'bg-error/10 text-error';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}

	const columns = [
		{
			key: 'name',
			label: 'Name',
			render: (key: ApiKey) =>
				`
				<div class="text-sm font-medium text-foreground">${key.name}</div>
				${
					key.expiresAt
						? `<div class="text-muted-foreground text-xs">Expires: ${new Date(key.expiresAt).toLocaleDateString()}</div>`
						: ''
				}
				`
		},
		{
			key: 'keyPrefix',
			label: 'Key',
			render: (key: ApiKey) =>
				`<code class="block rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">mcp_live_${key.keyPrefix}_******</code>`
		},
		{
			key: 'allowedScopes',
			label: 'Modules',
			render: (key: ApiKey) => {
				if (key.allowedScopes && key.allowedScopes.length > 0) {
					const badges = key.allowedScopes
						.slice(0, 2)
						.map(
							(scope) =>
								`<span class="inline-flex"><Badge variant="secondary" class="text-xs mr-1">${scope}</Badge></span>`
						)
						.join('');
					const more =
						key.allowedScopes.length > 2
							? `<span class="text-muted-foreground text-xs">+${key.allowedScopes.length - 2} more</span>`
							: '';
					return `<div class="flex flex-wrap gap-1">${badges}${more}</div>`;
				}
				return `<span class="text-muted-foreground text-sm">All tools</span>`;
			}
		},
		{
			key: 'status',
			label: 'Status',
			render: (key: ApiKey) =>
				`<Badge class="${getStatusBadge(key)}">${key.status.charAt(0).toUpperCase() + key.status.slice(1)}</Badge>`
		},
		{
			key: 'lastUsedAt',
			label: 'Last Used',
			render: (key: ApiKey) =>
				key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'
		}
	];

	const actions: DataTableAction<ApiKey>[] = [];
	if (onViewDetails) {
		actions.push({
			icon: Key,
			label: 'View details',
			onClick: (key) => onViewDetails(key.id)
		});
	}
	if (onEditKey) {
		actions.push({
			icon: Edit,
			label: 'Edit key',
			onClick: (key) => onEditKey(key.id)
		});
	}
	if (onRevokeKey) {
		actions.push({
			icon: Trash2,
			label: 'Revoke key',
			variant: 'destructive',
			onClick: (key) => onRevokeKey(key.id)
		});
	}
</script>

<div class="space-y-6">
	<McpDataTable
		data={keys}
		{columns}
		{actions}
		searchPlaceholder="Search API keys..."
		searchKey="name"
		filters={[
			{
				key: 'status',
				label: 'All Statuses',
				options: [
					{ value: '', label: 'All Statuses' },
					{ value: 'active', label: 'Active' },
					{ value: 'disabled', label: 'Disabled' },
					{ value: 'revoked', label: 'Revoked' }
				]
			}
		]}
		createLabel="Create API Key"
		onCreate={onCreateKey}
		emptyIcon={Key}
		emptyTitle="No API keys found"
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

	<!-- Security Disclaimer -->
	<div class="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
		<AlertCircle class="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
		<div class="space-y-1 text-sm">
			<p class="font-medium text-foreground">Important security note:</p>
			<p class="text-muted-foreground">
				For security reasons, the database only stores a hash of your API keys, not the full secret.
				The complete key is only shown once at creation time. Existing keys (created before this
				session) cannot have their full secret retrieved.
			</p>
			<p class="text-muted-foreground">
				After a page refresh or reload, only the masked version will be available again.
			</p>
		</div>
	</div>
</div>

<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { Key, Search, Plus, Edit, Trash2, AlertCircle, HelpCircle } from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle, EmptyContent } from '$lib/components/ui/empty';

	export interface ApiKey {
		id: string;
		name: string;
		keyPrefix: string;
		status: 'active' | 'disabled' | 'revoked';
		allowedModules: string[] | null;
		lastUsedAt: string | null;
		expiresAt: string | null;
	}

	let {
		keys = [],
		availableModules = [],
		onCreateKey,
		onEditKey,
		onRevokeKey,
		onShowHelp
	}: {
		keys: ApiKey[];
		availableModules: { id: string; name: string }[];
		onCreateKey?: () => void;
		onEditKey?: (keyId: string) => void;
		onRevokeKey?: (keyId: string) => void | Promise<void>;
		onShowHelp?: () => void;
	} = $props();

	let searchQuery = $state('');
	let statusFilter = $state('');

	const filteredKeys = $derived(
		keys.filter((key) => {
			const matchesSearch =
				!searchQuery || key.name.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesStatus = !statusFilter || key.status === statusFilter;
			return matchesSearch && matchesStatus;
		})
	);

	function getStatusBadge(key: ApiKey) {
		switch (key.status) {
			case 'active':
				return {
					class: 'bg-success/10 text-success',
					label: 'Active'
				};
			case 'disabled':
				return {
					class: 'bg-warning/10 text-warning',
					label: 'Disabled'
				};
			case 'revoked':
				return {
					class: 'bg-error/10 text-error',
					label: 'Revoked'
				};
			default:
				return { class: 'bg-muted text-muted-foreground', label: key.status };
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<div class="relative">
				<Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
				<Input bind:value={searchQuery} placeholder="Search API keys..." class="h-9 w-64 pl-9" />
			</div>
			<Select bind:value={statusFilter}>
				<SelectTrigger class="h-9 w-40">
					{#if statusFilter === ''}
						All Statuses
					{:else if statusFilter === 'active'}
						Active
					{:else if statusFilter === 'disabled'}
						Disabled
					{:else if statusFilter === 'revoked'}
						Revoked
					{/if}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="">All Statuses</SelectItem>
					<SelectItem value="active">Active</SelectItem>
					<SelectItem value="disabled">Disabled</SelectItem>
					<SelectItem value="revoked">Revoked</SelectItem>
				</SelectContent>
			</Select>
		</div>
		<div class="flex items-center gap-2">
			{#if onCreateKey}
				<Button onclick={onCreateKey} class="gap-2">
					<Plus class="h-4 w-4" />
					Create API Key
				</Button>
			{/if}
			{#if onShowHelp}
				<Button
					variant="ghost"
					size="icon"
					onclick={onShowHelp}
					class="text-muted-foreground flex-shrink-0 hover:text-foreground"
					title="Show help"
				>
					<HelpCircle class="h-5 w-5" />
				</Button>
			{/if}
		</div>
	</div>

	<!-- Table -->
	<Card class="p-0">
		<CardContent class="p-0">
			{#if filteredKeys.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							<Key class="text-muted-foreground h-16 w-16" />
						</EmptyMedia>
						<EmptyTitle>No API keys found</EmptyTitle>
						<EmptyContent>
							{#if onCreateKey}
								<Button variant="link" onclick={onCreateKey} class="mt-2">
									Create your first API key
								</Button>
							{/if}
						</EmptyContent>
					</Empty>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="border-b border-border bg-muted/50">
							<tr>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Name
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Key
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Modules
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Status
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Last Used
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-right text-xs font-bold tracking-wider uppercase"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredKeys as key}
								<tr class="hover:bg-accent/50">
									<td class="px-6 py-5">
										<div class="text-sm font-medium text-foreground">{key.name}</div>
										{#if key.expiresAt}
											<div class="text-muted-foreground text-xs">
												Expires: {new Date(key.expiresAt).toLocaleDateString()}
											</div>
										{/if}
									</td>
									<td class="px-6 py-5">
										<code
											class="block rounded bg-muted px-3 py-2 font-mono text-sm text-foreground"
										>
											mcp_live_{key.keyPrefix}_******
										</code>
									</td>
									<td class="px-6 py-5">
										{#if key.allowedModules && key.allowedModules.length > 0}
											<div class="flex flex-wrap gap-1">
												{#each key.allowedModules.slice(0, 2) as moduleId (moduleId)}
													<Badge variant="secondary" class="text-xs">
														{moduleId}
													</Badge>
												{/each}
												{#if key.allowedModules.length > 2}
													<span class="text-muted-foreground text-xs">
														+{key.allowedModules.length - 2} more
													</span>
												{/if}
											</div>
										{:else}
											<span class="text-muted-foreground text-sm">All modules</span>
										{/if}
									</td>
									<td class="px-6 py-5">
										<Badge class={getStatusBadge(key).class}>
											{getStatusBadge(key).label}
										</Badge>
									</td>
									<td class="text-muted-foreground px-6 py-5 text-sm">
										{#if key.lastUsedAt}
											{new Date(key.lastUsedAt).toLocaleString()}
										{:else}
											Never
										{/if}
									</td>
									<td class="px-6 py-5 text-right">
										<div class="flex items-center justify-end gap-1">
											{#if onEditKey}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => onEditKey(key.id)}
													title="Edit key"
												>
													<Edit class="h-4 w-4" />
												</Button>
											{/if}
											{#if onRevokeKey}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => onRevokeKey(key.id)}
													class="text-destructive hover:text-destructive"
													title="Revoke key"
												>
													<Trash2 class="h-4 w-4" />
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

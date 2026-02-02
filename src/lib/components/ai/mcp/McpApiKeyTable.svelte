<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Key, Search, Plus, Trash2, Copy, Check } from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle, EmptyContent } from '$lib/components/ui/empty';
	import { toast } from 'svelte-sonner';

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
		onRevokeKey
	}: {
		keys: ApiKey[];
		availableModules: { id: string; name: string }[];
		onCreateKey?: () => void;
		onRevokeKey?: (keyId: string) => void | Promise<void>;
	} = $props();

	let searchQuery = $state('');
	let statusFilter = $state('');
	let copiedKeyId = $state<string | null>(null);

	async function copyKey(key: ApiKey) {
		const keyText = `mcp_live_${key.keyPrefix}_******`;
		try {
			await navigator.clipboard.writeText(keyText);
			copiedKeyId = key.id;
			toast.success('API key prefix copied to clipboard');
			setTimeout(() => (copiedKeyId = null), 2000);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}

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
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
				<Input
					bind:value={searchQuery}
					placeholder="Search API keys..."
					class="w-64 pl-9 h-9"
				/>
			</div>
			<select
				bind:value={statusFilter}
				class="px-3 py-2 text-sm border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring"
			>
				<option value="">All Statuses</option>
				<option value="active">Active</option>
				<option value="disabled">Disabled</option>
				<option value="revoked">Revoked</option>
			</select>
		</div>
		{#if onCreateKey}
			<Button onclick={onCreateKey} class="gap-2">
				<Plus class="w-4 h-4" />
				Create API Key
			</Button>
		{/if}
	</div>

	<!-- Table -->
	<Card>
		<CardContent class="p-0">
			{#if filteredKeys.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							<Key class="w-16 h-16 text-muted-foreground" />
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
									Key Prefix
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Modules
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Status
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Last Used
								</th>
								<th
									class="px-6 py-3 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredKeys as key}
								<tr class="hover:bg-accent/50">
									<td class="px-6 py-4">
										<div class="text-sm font-medium text-foreground">{key.name}</div>
										{#if key.expiresAt}
											<div class="text-xs text-muted-foreground">
												Expires: {new Date(key.expiresAt).toLocaleDateString()}
											</div>
										{/if}
									</td>
									<td class="px-6 py-4">
										<code class="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
											mcp_live_{key.keyPrefix}_******
										</code>
									</td>
									<td class="px-6 py-4">
										{#if key.allowedModules && key.allowedModules.length > 0}
											<div class="flex flex-wrap gap-1">
												{#each key.allowedModules.slice(0, 2) as moduleId (moduleId)}
													<Badge variant="secondary" class="text-xs">
														{moduleId}
													</Badge>
												{/each}
												{#if key.allowedModules.length > 2}
													<span class="text-xs text-muted-foreground">
														+{key.allowedModules.length - 2} more
													</span>
												{/if}
											</div>
										{:else}
											<span class="text-sm text-muted-foreground">All modules</span>
										{/if}
									</td>
									<td class="px-6 py-4">
										<Badge class={getStatusBadge(key).class}>
											{getStatusBadge(key).label}
										</Badge>
									</td>
									<td class="px-6 py-4 text-sm text-muted-foreground">
										{#if key.lastUsedAt}
											{new Date(key.lastUsedAt).toLocaleString()}
										{:else}
											Never
										{/if}
									</td>
									<td class="px-6 py-4 text-right">
										<div class="flex items-center justify-end gap-1">
											<Button
												variant="ghost"
												size="sm"
												onclick={() => copyKey(key)}
												class="gap-1"
												title="Copy key prefix"
											>
												{#if copiedKeyId === key.id}
													<Check class="w-4 h-4 text-success" />
												{:else}
													<Copy class="w-4 h-4" />
												{/if}
											</Button>
											{#if onRevokeKey}
												<Button
													variant="ghost"
													size="sm"
													onclick={() => onRevokeKey(key.id)}
													class="text-destructive hover:text-destructive"
													title="Revoke key"
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

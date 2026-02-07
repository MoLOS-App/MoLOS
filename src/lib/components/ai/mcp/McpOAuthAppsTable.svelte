<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Shield,
		Search,
		Plus,
		Trash2,
		HelpCircle,
		Copy,
		ExternalLink,
		Pencil
	} from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle, EmptyContent } from '$lib/components/ui/empty';

	export interface OAuthApp {
		client_id: string;
		client_id_issued_at: number;
		name: string;
		redirect_uris: string[];
		scopes: string[];
		token_endpoint_auth_method: string;
		client_secret?: string;
		client_secret_expires_at?: number;
	}

	let {
		apps = [],
		onCreateApp,
		onDeleteApp,
		onEditApp,
		onShowHelp
	}: {
		apps: OAuthApp[];
		onCreateApp?: () => void;
		onDeleteApp?: (clientId: string) => void | Promise<void>;
		onEditApp?: (app: OAuthApp) => void | Promise<void>;
		onShowHelp?: () => void;
	} = $props();

	let searchQuery = $state('');

	const filteredApps = $derived(
		apps.filter((app) => {
			return !searchQuery || app.name.toLowerCase().includes(searchQuery.toLowerCase());
		})
	);

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleDateString();
	}

	function getAuthMethodBadge(method: string) {
		switch (method) {
			case 'none':
				return { class: 'bg-success/10 text-success', label: 'Public (PKCE)' };
			case 'client_secret_basic':
				return { class: 'bg-primary/10 text-primary', label: 'Confidential' };
			default:
				return { class: 'bg-muted text-muted-foreground', label: method };
		}
	}

	function getScopesBadge(scopes: string[] | undefined) {
		if (!scopes || scopes.length === 0) {
			return { class: 'bg-warning/10 text-warning', label: 'Full Access' };
		}
		const hasAll = scopes.includes('mcp:all');
		if (hasAll) {
			return { class: 'bg-warning/10 text-warning', label: 'Full Access' };
		}
		return {
			class: 'bg-info/10 text-info',
			label: `${scopes.length} scope${scopes.length > 1 ? 's' : ''}`
		};
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="relative">
			<Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
			<Input bind:value={searchQuery} placeholder="Search OAuth apps..." class="h-9 w-64 pl-9" />
		</div>
		<div class="flex items-center gap-2">
			{#if onCreateApp}
				<Button onclick={onCreateApp} class="gap-2">
					<Plus class="h-4 w-4" />
					Register App
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
			{#if filteredApps.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							<Shield class="text-muted-foreground h-16 w-16" />
						</EmptyMedia>
						<EmptyTitle>No OAuth apps found</EmptyTitle>
						<EmptyContent>
							{#if onCreateApp}
								<Button variant="link" onclick={onCreateApp} class="mt-2">
									Register your first OAuth app
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
									Client ID
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Redirect URIs
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Scopes
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Type
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-left text-xs font-bold tracking-wider uppercase"
								>
									Created
								</th>
								<th
									class="text-muted-foreground px-6 py-4 text-right text-xs font-bold tracking-wider uppercase"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredApps as app}
								<tr class="transition-colors hover:bg-muted/50">
									<!-- Name -->
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary"
											>
												{(app.name || 'App').slice(0, 2).toUpperCase()}
											</div>
											<div>
												<div class="font-medium">{app.name || 'Unnamed App'}</div>
											</div>
										</div>
									</td>

									<!-- Client ID -->
									<td class="px-6 py-4">
										<code
											class="text-muted-foreground rounded bg-muted px-2 py-1 text-xs break-all"
										>
											{app.client_id}
										</code>
									</td>

									<!-- Redirect URIs -->
									<td class="px-6 py-4">
										<div class="flex flex-col gap-1">
											{#each (app.redirect_uris || []).slice(0, 2) as uri}
												<div class="text-muted-foreground flex items-center gap-1 text-xs">
													<ExternalLink class="h-3 w-3" />
													<span class="max-w-[150px] truncate">{uri}</span>
												</div>
											{/each}
											{#if (app.redirect_uris || []).length > 2}
												<span class="text-muted-foreground text-xs"
													>+{(app.redirect_uris || []).length - 2} more</span
												>
											{/if}
										</div>
									</td>

									<!-- Scopes -->
									<td class="px-6 py-4">
										<Badge class={getScopesBadge(app.scopes).class}>
											{getScopesBadge(app.scopes).label}
										</Badge>
									</td>

									<!-- Type -->
									<td class="px-6 py-4">
										<Badge class={getAuthMethodBadge(app.token_endpoint_auth_method).class}>
											{getAuthMethodBadge(app.token_endpoint_auth_method).label}
										</Badge>
									</td>

									<!-- Created -->
									<td class="text-muted-foreground px-6 py-4 text-sm">
										{formatDate(app.client_id_issued_at)}
									</td>

									<!-- Actions -->
									<td class="px-6 py-4">
										<div class="flex items-center justify-end gap-2">
											{#if onEditApp}
												<Button
													variant="ghost"
													size="icon"
													onclick={() => onEditApp(app)}
													class="h-8 w-8"
													title="Edit app"
												>
													<Pencil class="h-4 w-4" />
												</Button>
											{/if}
											<Button
												variant="ghost"
												size="icon"
												onclick={() => copyToClipboard(app.client_id)}
												class="h-8 w-8"
												title="Copy Client ID"
											>
												<Copy class="h-4 w-4" />
											</Button>
											{#if app.client_secret}
												<Button
													variant="ghost"
													size="icon"
													onclick={() => copyToClipboard(app.client_secret!)}
													class="h-8 w-8"
													title="Copy Client Secret"
												>
													<Copy class="h-4 w-4" />
												</Button>
											{/if}
											{#if onDeleteApp}
												<Button
													variant="ghost"
													size="icon"
													onclick={() => onDeleteApp(app.client_id)}
													class="h-8 w-8 text-destructive hover:text-destructive"
													title="Delete app"
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
</div>

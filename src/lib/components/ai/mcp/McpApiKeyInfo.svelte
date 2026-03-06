<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Key } from 'lucide-svelte';
	import type { ApiKeyInfo } from './types.js';

	let {
		apiKey,
		editable = true
	}: {
		apiKey: ApiKeyInfo;
		editable?: boolean;
	} = $props();

	let name = $state(apiKey.name);
	let expiresAt = $state(
		apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString().split('T')[0] : ''
	);

	// Sync form state when apiKey changes
	$effect(() => {
		name = apiKey.name;
		expiresAt = apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString().split('T')[0] : '';
	});

	// Export getter for form values
	export function getFormValues() {
		return {
			name,
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
		};
	}

	function getStatusBadge() {
		switch (apiKey.status) {
			case 'active':
				return { class: 'bg-success/10 text-success', label: 'Active' };
			case 'disabled':
				return { class: 'bg-warning/10 text-warning', label: 'Disabled' };
			case 'revoked':
				return { class: 'bg-error/10 text-error', label: 'Revoked' };
			default:
				return { class: 'bg-muted text-muted-foreground', label: apiKey.status };
		}
	}
</script>

<Card>
	<CardHeader>
		<div class="flex items-start justify-between gap-4">
			<div>
				<CardTitle class="flex items-center gap-2 text-base">
					<Key class="h-4 w-4" />
					Key Information
				</CardTitle>
			</div>
			<Badge class={getStatusBadge().class}>{getStatusBadge().label}</Badge>
		</div>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Key Prefix -->
		<div class="space-y-2">
			<Label>Key Prefix</Label>
			<code class="block rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">
				mcp_live_{apiKey.keyPrefix}_********
			</code>
		</div>

		<!-- Name (Editable) -->
		<div class="space-y-2">
			<Label for="key-name">Name</Label>
			<Input
				id="key-name"
				bind:value={name}
				disabled={!editable}
				placeholder="API key name"
				autocomplete="off"
			/>
		</div>

		<!-- Expiration -->
		<div class="space-y-2">
			<Label for="key-expires">Expiration Date</Label>
			<Input id="key-expires" type="date" bind:value={expiresAt} disabled={!editable} />
			<p class="text-muted-foreground text-xs">Leave empty for a key that never expires</p>
		</div>

		<!-- Metadata -->
		<div class="space-y-2">
			<div class="grid grid-cols-2 gap-3">
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-muted-foreground text-xs">Created</p>
					<p class="text-sm font-medium text-foreground">
						{new Date(apiKey.createdAt).toLocaleDateString()}
					</p>
				</div>
				<div class="rounded-lg bg-muted/50 p-3">
					<p class="text-muted-foreground text-xs">Last Used</p>
					<p class="text-sm font-medium text-foreground">
						{#if apiKey.lastUsedAt}
							{new Date(apiKey.lastUsedAt).toLocaleString()}
						{:else}
							Never
						{/if}
					</p>
				</div>
			</div>
		</div>
	</CardContent>
</Card>

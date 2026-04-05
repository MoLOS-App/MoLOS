<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Key, Copy, Eye, EyeOff } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Module {
		id: string;
		name: string;
	}

	interface ApiKey {
		id: string;
		name: string;
		keyPrefix: string;
		status: 'active' | 'disabled' | 'revoked';
		allowedScopes: string[] | null;
		lastUsedAt: string | null;
		expiresAt: string | null;
		createdAt: string;
	}

	let {
		open,
		onOpenChange,
		availableModules = [],
		apiKey,
		onUpdate,
		onToggleStatus
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		availableModules: Module[];
		apiKey: ApiKey | null;
		onUpdate: (
			keyId: string,
			data: {
				name: string;
				allowedScopes: string[] | null;
				expiresAt: string | null;
			}
		) => void | Promise<void>;
		onToggleStatus: (keyId: string, newStatus: 'active' | 'disabled') => void | Promise<void>;
	} = $props();

	let name = $state('');
	let expiresAt = $state('');

	// Populate form when apiKey changes
	$effect(() => {
		if (apiKey) {
			name = apiKey.name;
			expiresAt = apiKey.expiresAt ? apiKey.expiresAt.split('T')[0] : '';
		}
	});

	async function handleSubmit() {
		if (!apiKey || !name.trim()) return;

		await onUpdate(apiKey.id, {
			name: name.trim(),
			allowedScopes: apiKey.allowedScopes, // Keep existing scopes
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
		});

		onOpenChange(false);
	}

	async function handleToggleStatus() {
		if (!apiKey) return;
		const newStatus = apiKey.status === 'active' ? 'disabled' : 'active';
		await onToggleStatus(apiKey.id, newStatus);
		onOpenChange(false);
	}

	function getStatusBadge() {
		if (!apiKey) return { class: '', label: '' };
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

	const canEdit = $derived(apiKey?.status !== 'revoked');
	const isValid = $derived(name.trim() !== '');
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Key class="h-5 w-5" />
				Edit API Key
			</DialogTitle>
		</DialogHeader>

		{#if apiKey}
			<form onsubmit={(e) => e.preventDefault()} class="space-y-4">
				<!-- Status Info -->
				<div class="flex items-center justify-between rounded-lg bg-muted/50 p-3">
					<div class="flex items-center gap-3">
						<Badge class={getStatusBadge().class}>{getStatusBadge().label}</Badge>
						<div class="text-sm">
							<p class="font-medium text-foreground">{apiKey.name}</p>
							{#if apiKey.expiresAt}
								<p class="text-muted-foreground text-xs">
									Expires: {new Date(apiKey.expiresAt).toLocaleDateString()}
								</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Key Prefix (Read-only) -->
				<div class="space-y-2">
					<Label>Key Prefix</Label>
					<div class="flex items-center gap-2">
						<code class="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm text-foreground">
							mcp_live_{apiKey.keyPrefix}_********
						</code>
					</div>
					<p class="text-muted-foreground text-xs">
						This is just the prefix. The full key was only shown at creation.
					</p>
				</div>

				<!-- Usage Info -->
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
								{new Date(apiKey.lastUsedAt).toLocaleDateString()}
							{:else}
								Never
							{/if}
						</p>
					</div>
				</div>

				<!-- Name (Editable only if not revoked) -->
				<div class="space-y-2">
					<Label for="edit-key-name">Name</Label>
					<Input
						id="edit-key-name"
						bind:value={name}
						disabled={!canEdit}
						placeholder="e.g., Claude Desktop Key"
						autocomplete="off"
					/>
				</div>

				<!-- Scope Info -->
				{#if canEdit}
					<div class="space-y-2">
						<Label>Permissions</Label>
						<div class="text-muted-foreground rounded-md border p-3 text-sm">
							<p>Use the Scope Picker to modify which tools this key can access.</p>
						</div>
					</div>
				{/if}

				<!-- Expiration -->
				{#if canEdit}
					<div class="space-y-2">
						<Label for="edit-key-expires">Expiration Date</Label>
						<Input id="edit-key-expires" type="date" bind:value={expiresAt} disabled={!canEdit} />
						<p class="text-muted-foreground text-xs">Leave empty for a key that never expires</p>
					</div>
				{/if}
			</form>
		{/if}

		<DialogFooter class="flex-col gap-2 sm:flex-row">
			{#if apiKey.status !== 'revoked'}
				{#if apiKey.status === 'active'}
					<Button variant="outline" onclick={handleToggleStatus} class="w-full sm:w-auto">
						Disable Key
					</Button>
				{:else}
					<Button variant="outline" onclick={handleToggleStatus} class="w-full sm:w-auto">
						Enable Key
					</Button>
				{/if}
			{/if}
			<div class="flex w-full gap-2 sm:w-auto">
				<Button variant="outline" onclick={() => onOpenChange(false)} class="flex-1">Cancel</Button>
				{#if canEdit}
					<Button onclick={handleSubmit} disabled={!isValid} class="flex-1">Save Changes</Button>
				{/if}
			</div>
		</DialogFooter>
	</DialogContent>
</Dialog>

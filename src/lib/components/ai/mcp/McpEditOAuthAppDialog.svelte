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
	import { Shield, Plus, X, Pencil } from 'lucide-svelte';
	import type { OAuthApp } from './McpOAuthAppsTable.svelte';

	let {
		open,
		onOpenChange,
		availableScopes = [],
		app,
		onUpdate
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		availableScopes: string[];
		app: OAuthApp | null;
		onUpdate: (
			clientId: string,
			updates: {
				name: string;
				scopes: string[];
			}
		) => void | Promise<void>;
	} = $props();

	let formData = $state({
		name: '',
		scopes: [] as string[]
	});

	let errorMessage = $state('');

	// Initialize form data when app changes
	$effect(() => {
		if (app) {
			formData = {
				name: app.name,
				scopes: [...(app.scopes || [])]
			};
		}
	});

	function validateForm(): string | null {
		if (!formData.name.trim()) {
			return 'Name is required';
		}
		if (formData.name.length > 100) {
			return 'Name must be less than 100 characters';
		}
		return null;
	}

	async function handleSubmit() {
		if (!app) return;

		const error = validateForm();
		if (error) {
			errorMessage = error;
			return;
		}

		try {
			await onUpdate(app.client_id, {
				name: formData.name,
				scopes: formData.scopes
			});
			handleClose();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to update app';
		}
	}

	function handleClose() {
		errorMessage = '';
		onOpenChange(false);
	}

	function toggleScope(scope: string) {
		if (formData.scopes.includes(scope)) {
			formData.scopes = formData.scopes.filter((s) => s !== scope);
		} else {
			formData.scopes = [...formData.scopes, scope];
		}
	}
</script>

<Dialog bind:open onOpenChange={handleClose}>
	<DialogContent class="sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Pencil class="h-5 w-5 text-primary" />
				Edit OAuth Application
			</DialogTitle>
		</DialogHeader>

		{#if app}
			<div class="max-h-[70vh] space-y-6 overflow-y-auto py-4">
				{#if errorMessage}
					<div class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
						{errorMessage}
					</div>
				{/if}

				<!-- Client ID (read-only) -->
				<div class="space-y-2">
					<Label>Client ID</Label>
					<code class="text-muted-foreground block rounded bg-muted px-3 py-2 text-sm break-all">
						{app.client_id}
					</code>
					<p class="text-muted-foreground text-sm">Client ID cannot be changed</p>
				</div>

				<!-- Name -->
				<div class="space-y-2">
					<Label for="name">Application Name *</Label>
					<Input id="name" bind:value={formData.name} placeholder="My MCP Client" maxlength={100} />
				</div>

				<!-- Scopes -->
				<div class="space-y-2">
					<Label>Scopes</Label>
					<p class="text-muted-foreground text-sm">
						Select what this app can access. Leave empty for full access.
					</p>
					<div class="flex flex-wrap gap-2">
						{#each availableScopes as scope}
							<button
								type="button"
								onclick={() => toggleScope(scope)}
								class="rounded-full border px-3 py-1 text-sm transition-colors"
								class:border-primary={formData.scopes.includes(scope)}
								class:bg-primary={formData.scopes.includes(scope)}
								class:text-primary-foreground={formData.scopes.includes(scope)}
								class:hover:bg-muted={!formData.scopes.includes(scope)}
							>
								{scope}
							</button>
						{/each}
					</div>
				</div>

				<!-- Current Redirect URIs (info only) -->
				<div class="space-y-2">
					<Label>Redirect URIs</Label>
					<p class="text-muted-foreground text-sm">
						{#each app.redirect_uris || [] as uri}
							<code class="block rounded bg-muted px-3 py-2 text-xs break-all">
								{uri}
							</code>
						{/each}
					</p>
					<p class="text-muted-foreground text-xs">
						Redirect URIs cannot be modified after registration
					</p>
				</div>
			</div>

			<DialogFooter>
				<Button variant="outline" onclick={handleClose}>Cancel</Button>
				<Button onclick={handleSubmit}>Update App</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>

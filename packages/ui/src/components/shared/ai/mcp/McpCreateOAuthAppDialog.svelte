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
	import { Shield, Plus, X } from 'lucide-svelte';
	import type { OAuthClientInformationFull } from '$lib/server/ai/mcp/oauth/clients-store.js';

	let {
		open,
		onOpenChange,
		availableScopes = [],
		onCreate
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		availableScopes: string[];
		onCreate: (app: {
			name: string;
			redirectUris: string[];
			scopes: string[];
			tokenEndpointAuthMethod: string;
		}) => void | Promise<OAuthClientInformationFull | void>;
	} = $props();

	let formData = $state({
		name: '',
		redirectUris: [''],
		scopes: [] as string[],
		tokenEndpointAuthMethod: 'none'
	});

	let newRedirectUri = $state('');
	let showSecret = $state(false);
	let createdApp: OAuthClientInformationFull | null = $state(null);
	let errorMessage = $state('');

	function validateForm(): string | null {
		if (!formData.name.trim()) {
			return 'Name is required';
		}
		if (formData.name.length > 100) {
			return 'Name must be less than 100 characters';
		}
		const validUris = formData.redirectUris.filter((u) => u.trim() !== '');
		if (validUris.length === 0) {
			return 'At least one redirect URI is required';
		}
		for (const uri of validUris) {
			try {
				new URL(uri);
			} catch {
				return `"${uri}" is not a valid URL`;
			}
		}
		return null;
	}

	async function handleSubmit() {
		const error = validateForm();
		if (error) {
			errorMessage = error;
			return;
		}

		try {
			const result = await onCreate({
				name: formData.name,
				redirectUris: formData.redirectUris.filter((u) => u.trim() !== ''),
				scopes: formData.scopes,
				tokenEndpointAuthMethod: formData.tokenEndpointAuthMethod
			});

			// If result includes client info, show it
			if (result && typeof result === 'object' && 'client_id' in result) {
				createdApp = result as OAuthClientInformationFull;
			} else {
				// Reset and close
				handleClose();
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to register app';
		}
	}

	function addRedirectUri() {
		if (newRedirectUri.trim()) {
			formData.redirectUris = [...formData.redirectUris, newRedirectUri.trim()];
			newRedirectUri = '';
		}
	}

	function removeRedirectUri(index: number) {
		formData.redirectUris = formData.redirectUris.filter((_, i) => i !== index);
	}

	function handleClose() {
		formData = {
			name: '',
			redirectUris: [''],
			scopes: [],
			tokenEndpointAuthMethod: 'none'
		};
		newRedirectUri = '';
		createdApp = null;
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
		{#if createdApp}
			<!-- Show Created App Credentials -->
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2">
					<Shield class="text-success h-5 w-5" />
					App Registered Successfully
				</DialogTitle>
			</DialogHeader>

			<div class="space-y-4 py-4">
				<div class="rounded-lg bg-muted p-4">
					<p class="text-muted-foreground mb-4 text-sm">
						Save these credentials securely. You won't be able to see the client secret again.
					</p>

					<div class="space-y-3">
						<div>
							<Label class="text-xs">Client ID</Label>
							<div class="mt-1 flex items-center gap-2">
								<code class="flex-1 rounded border bg-background px-3 py-2 text-sm">
									{createdApp?.client_id}
								</code>
								<Button
									variant="outline"
									size="sm"
									onclick={() => createdApp && navigator.clipboard.writeText(createdApp.client_id)}
								>
									Copy
								</Button>
							</div>
						</div>

						{#if createdApp.client_secret}
							<div>
								<Label class="text-xs">Client Secret</Label>
								<div class="mt-1 flex items-center gap-2">
									<code class="flex-1 rounded border bg-background px-3 py-2 text-sm">
										{showSecret ? createdApp.client_secret : '••••••••••••••••'}
									</code>
									<Button variant="outline" size="sm" onclick={() => (showSecret = !showSecret)}>
										{showSecret ? 'Hide' : 'Show'}
									</Button>
									<Button
										variant="outline"
										size="sm"
										onclick={() =>
											createdApp && navigator.clipboard.writeText(createdApp.client_secret!)}
									>
										Copy
									</Button>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div class="rounded-lg bg-muted p-4">
					<h4 class="mb-2 text-sm font-semibold">Authorization Endpoint</h4>
					<code class="text-muted-foreground text-xs"> GET /api/ai/mcp/oauth/authorize </code>
				</div>

				<div class="rounded-lg bg-muted p-4">
					<h4 class="mb-2 text-sm font-semibold">Token Endpoint</h4>
					<code class="text-muted-foreground text-xs"> POST /api/ai/mcp/oauth/token </code>
				</div>
			</div>

			<DialogFooter>
				<Button onclick={handleClose}>Done</Button>
			</DialogFooter>
		{:else}
			<!-- Create App Form -->
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2">
					<Shield class="h-5 w-5 text-primary" />
					Register OAuth Application
				</DialogTitle>
			</DialogHeader>

			<div class="max-h-[70vh] space-y-6 overflow-y-auto py-4">
				{#if errorMessage}
					<div class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
						{errorMessage}
					</div>
				{/if}

				<!-- Name -->
				<div class="space-y-2">
					<Label for="name">Application Name *</Label>
					<Input id="name" bind:value={formData.name} placeholder="My MCP Client" maxlength={100} />
				</div>

				<!-- Redirect URIs -->
				<div class="space-y-2">
					<Label>Redirect URIs *</Label>
					<p class="text-muted-foreground text-sm">
						Where users will be redirected after authorization
					</p>
					<div class="space-y-2">
						{#each formData.redirectUris as uri, index}
							<div class="flex items-center gap-2">
								<Input
									bind:value={formData.redirectUris[index]}
									placeholder="https://example.com/callback"
								/>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => removeRedirectUri(index)}
									class="h-9 w-9 text-destructive"
								>
									<X class="h-4 w-4" />
								</Button>
							</div>
						{/each}
						<div class="flex items-center gap-2">
							<Input
								bind:value={newRedirectUri}
								placeholder="https://example.com/callback"
								onkeypress={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										addRedirectUri();
									}
								}}
							/>
							<Button variant="outline" onclick={addRedirectUri} class="gap-1">
								<Plus class="h-4 w-4" />
								Add
							</Button>
						</div>
					</div>
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

				<!-- Client Authentication -->
				<div class="space-y-2">
					<Label for="authMethod">Client Authentication</Label>
					<select
						id="authMethod"
						bind:value={formData.tokenEndpointAuthMethod}
						class="border-input focus-visible:ring-ring flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:outline-none"
					>
						<option value="none">None (Public Client with PKCE)</option>
						<option value="client_secret_basic">Client Secret (Confidential)</option>
					</select>
					<p class="text-muted-foreground text-sm">
						{#if formData.tokenEndpointAuthMethod === 'none'}
							Public clients use PKCE for secure token exchange. Recommended for mobile/spa apps.
						{:else}
							Confidential clients use a client secret for authentication. Recommended for
							server-side apps.
						{/if}
					</p>
				</div>
			</div>

			<DialogFooter>
				<Button variant="outline" onclick={handleClose}>Cancel</Button>
				<Button onclick={handleSubmit}>Register App</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>

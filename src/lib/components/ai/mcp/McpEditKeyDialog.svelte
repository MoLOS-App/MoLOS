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
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import { Key, ChevronDown, ChevronUp, Copy, Eye, EyeOff } from 'lucide-svelte';
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
		allowedModules: string[] | null;
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
		onUpdate: (keyId: string, data: {
			name: string;
			allowedModules: string[] | null;
			expiresAt: string | null;
		}) => void | Promise<void>;
		onToggleStatus: (keyId: string, newStatus: 'active' | 'disabled') => void | Promise<void>;
	} = $props();

	let name = $state('');
	let selectedModules = $state<string[]>([]);
	let expiresAt = $state('');
	let showModuleList = $state(false);

	// Populate form when apiKey changes
	$effect(() => {
		if (apiKey) {
			name = apiKey.name;
			selectedModules = apiKey.allowedModules ?? [];
			expiresAt = apiKey.expiresAt ? apiKey.expiresAt.split('T')[0] : '';
		}
	});

	// Computed value for select all - not reactive
	const selectAll = $derived(
		selectedModules.length === availableModules.length && availableModules.length > 0
	);

	// Handle select all toggle
	function toggleSelectAll() {
		if (selectAll) {
			selectedModules = [];
		} else {
			selectedModules = availableModules.map((m) => m.id);
		}
	}

	// Toggle individual module selection
	function toggleModule(moduleId: string) {
		if (selectedModules.includes(moduleId)) {
			selectedModules = selectedModules.filter((id) => id !== moduleId);
		} else {
			selectedModules = [...selectedModules, moduleId];
		}
	}

	// Convert to null for "all modules"
	function getModulesForSubmit(): string[] | null {
		return selectedModules.length > 0 ? selectedModules : null;
	}

	async function handleSubmit() {
		if (!apiKey || !name.trim()) return;

		await onUpdate(apiKey.id, {
			name: name.trim(),
			allowedModules: getModulesForSubmit(),
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

	function getSelectionSummary(): string {
		if (selectedModules.length === 0) return 'All modules';
		if (selectedModules.length === availableModules.length) return 'All modules';
		return `${selectedModules.length} module${selectedModules.length > 1 ? 's' : ''} selected`;
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

<Dialog {open} onOpenChange={onOpenChange}>
	<DialogContent class="sm:max-w-md max-h-[90vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Key class="w-5 h-5" />
				Edit API Key
			</DialogTitle>
		</DialogHeader>

		{#if apiKey}
			<form onsubmit={(e) => e.preventDefault()} class="space-y-4">
				<!-- Status Info -->
				<div class="flex items-center justify-between p-3 rounded-lg bg-muted/50">
					<div class="flex items-center gap-3">
						<Badge class={getStatusBadge().class}>{getStatusBadge().label}</Badge>
						<div class="text-sm">
							<p class="font-medium text-foreground">{apiKey.name}</p>
							{#if apiKey.expiresAt}
								<p class="text-xs text-muted-foreground">
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
						<code class="flex-1 px-3 py-2 font-mono text-sm rounded text-foreground bg-muted">
							mcp_live_{apiKey.keyPrefix}_********
						</code>
					</div>
					<p class="text-xs text-muted-foreground">
						This is just the prefix. The full key was only shown at creation.
					</p>
				</div>

				<!-- Usage Info -->
				<div class="grid grid-cols-2 gap-3">
					<div class="p-3 rounded-lg bg-muted/50">
						<p class="text-xs text-muted-foreground">Created</p>
						<p class="text-sm font-medium text-foreground">
							{new Date(apiKey.createdAt).toLocaleDateString()}
						</p>
					</div>
					<div class="p-3 rounded-lg bg-muted/50">
						<p class="text-xs text-muted-foreground">Last Used</p>
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

				<!-- Allowed Modules (Editable only if not revoked) -->
				{#if canEdit}
					<div class="space-y-2">
						<Label>Allowed Modules</Label>

						{#if availableModules.length > 0}
							<!-- Selection Summary / Toggle Button -->
							<button
								type="button"
								onclick={() => (showModuleList = !showModuleList)}
								class="flex items-center justify-between w-full px-3 py-2 transition-colors border rounded-lg border-border bg-background hover:bg-accent"
							>
								<span class="text-sm">{getSelectionSummary()}</span>
								{#if showModuleList}
									<ChevronUp class="w-4 h-4 text-muted-foreground" />
								{:else}
									<ChevronDown class="w-4 h-4 text-muted-foreground" />
								{/if}
							</button>

							<!-- Module List (Collapsible) -->
							{#if showModuleList}
								<div class="p-3 space-y-2 border rounded-lg border-border bg-muted/50">
									<!-- Select All Option -->
									<div class="flex items-center gap-2 pb-2 border-b border-border">
										<Checkbox
											id="edit-select-all"
											checked={selectAll}
											onChange={toggleSelectAll}
										/>
										<Label for="edit-select-all" class="flex-1 text-sm font-medium cursor-pointer">
											All modules ({availableModules.length})
										</Label>
									</div>

									<!-- Individual Modules -->
									<div class="pt-1 space-y-1">
										{#each availableModules as module (module.id)}
											<div class="flex items-center gap-2">
												<Checkbox
													id="edit-module-{module.id}"
													checked={selectedModules.includes(module.id)}
													onChange={() => toggleModule(module.id)}
												/>
												<Label for="edit-module-{module.id}" class="flex-1 text-sm cursor-pointer">
													{module.name}
												</Label>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{:else}
							<div class="p-3 text-sm italic border rounded-md text-muted-foreground">
								No external modules available.
							</div>
						{/if}
					</div>

					<!-- Expiration -->
					<div class="space-y-2">
						<Label for="edit-key-expires">Expiration Date</Label>
						<Input
							id="edit-key-expires"
							type="date"
							bind:value={expiresAt}
							disabled={!canEdit}
						/>
						<p class="text-xs text-muted-foreground">
							Leave empty for a key that never expires
						</p>
					</div>
				{/if}
			</form>

			<DialogFooter class="flex-col gap-2 sm:flex-row">
				{#if apiKey.status !== 'revoked'}
					{#if apiKey.status === 'active'}
						<Button
							variant="outline"
							onclick={handleToggleStatus}
							class="w-full sm:w-auto"
						>
							Disable Key
						</Button>
					{:else}
						<Button
							variant="outline"
							onclick={handleToggleStatus}
							class="w-full sm:w-auto"
						>
							Enable Key
						</Button>
					{/if}
				{/if}
				<div class="flex w-full gap-2 sm:w-auto">
					<Button
						variant="outline"
						onclick={() => onOpenChange(false)}
						class="flex-1"
					>
						Cancel
					</Button>
					{#if canEdit}
						<Button onclick={handleSubmit} disabled={!isValid} class="flex-1">
							Save Changes
						</Button>
					{/if}
				</div>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>

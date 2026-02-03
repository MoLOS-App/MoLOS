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
	import { Info, ChevronDown, ChevronUp } from 'lucide-svelte';

	interface Module {
		id: string;
		name: string;
	}

	let {
		open,
		onOpenChange,
		availableModules = [],
		onCreate
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		availableModules: Module[];
		onCreate: (data: {
			name: string;
			allowedModules: string[] | null;
			expiresAt: string | null;
		}) => void | Promise<void>;
	} = $props();

	let name = $state('');
	let selectedModules = $state<string[]>([]);
	let expiresAt = $state('');
	let showModuleList = $state(false);

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

	// Convert to null for "all modules" (empty array means all modules for unrestricted access)
	function getModulesForSubmit(): string[] | null {
		// Empty array means all modules (unrestricted access)
		// Non-empty array means specific modules only
		return selectedModules.length > 0 ? selectedModules : null;
	}

	function handleSubmit() {
		if (!name.trim()) return;

		onCreate({
			name: name.trim(),
			allowedModules: getModulesForSubmit(),
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
		});

		// Reset form
		name = '';
		selectedModules = [];
		expiresAt = '';
		showModuleList = false;
	}

	function getSelectionSummary(): string {
		if (selectedModules.length === 0) return 'All modules';
		if (selectedModules.length === availableModules.length) return 'All modules';
		return `${selectedModules.length} module${selectedModules.length > 1 ? 's' : ''} selected`;
	}
</script>

<Dialog {open} onOpenChange={onOpenChange}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Create API Key</DialogTitle>
		</DialogHeader>

		<form onsubmit={(e) => e.preventDefault()} class="space-y-4">
			<!-- Name -->
			<div class="space-y-2">
				<Label for="key-name">Name</Label>
				<Input
					id="key-name"
					bind:value={name}
					placeholder="e.g., Claude Desktop Key"
					autocomplete="off"
				/>
			</div>

			<!-- Allowed Modules (Multi-select) -->
			<div class="space-y-2">
				<Label>Allowed Modules</Label>
				<div class="flex items-start gap-2 text-xs text-muted-foreground">
					<Info class="w-3 h-3 flex-shrink-0 mt-0.5" />
					<p>Select specific modules to restrict access, or leave empty for all modules.</p>
				</div>

				{#if availableModules.length > 0}
					<!-- Selection Summary / Toggle Button -->
					<button
						type="button"
						onclick={() => (showModuleList = !showModuleList)}
						class="w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg bg-background hover:bg-accent transition-colors"
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
						<div class="space-y-2 p-3 border border-border rounded-lg bg-muted/50">
							<!-- Select All Option -->
							<div class="flex items-center gap-2 pb-2 border-b border-border">
								<Checkbox
									id="select-all"
									checked={selectAll}
									onChange={toggleSelectAll}
								/>
								<Label for="select-all" class="text-sm font-medium cursor-pointer flex-1">
									All modules ({availableModules.length})
								</Label>
							</div>

							<!-- Individual Modules -->
							<div class="space-y-1 pt-1">
								{#each availableModules as module (module.id)}
									<div class="flex items-center gap-2">
										<Checkbox
											id="module-{module.id}"
											checked={selectedModules.includes(module.id)}
											onChange={() => toggleModule(module.id)}
										/>
										<Label for="module-{module.id}" class="text-sm cursor-pointer flex-1">
											{module.name}
										</Label>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<div class="text-sm text-muted-foreground italic border rounded-md p-3">
						No external modules available. The key will have access to all modules.
					</div>
				{/if}
			</div>

			<!-- Expiration -->
			<div class="space-y-2">
				<Label for="key-expires">Expiration Date</Label>
				<Input id="key-expires" type="date" bind:value={expiresAt} />
				<p class="text-xs text-muted-foreground">
					Leave empty for a key that never expires
				</p>
			</div>
		</form>

		<DialogFooter>
			<Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
			<Button onclick={handleSubmit} disabled={!name.trim()}>
				Create Key
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

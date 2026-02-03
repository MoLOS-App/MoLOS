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

<Dialog {open} {onOpenChange}>
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
				<div class="text-muted-foreground flex items-start gap-2 text-xs">
					<Info class="mt-0.5 h-3 w-3 flex-shrink-0" />
					<p>Select specific modules to restrict access, or leave empty for all modules.</p>
				</div>

				{#if availableModules.length > 0}
					<!-- Selection Summary / Toggle Button -->
					<button
						type="button"
						onclick={() => (showModuleList = !showModuleList)}
						class="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 transition-colors hover:bg-accent"
					>
						<span class="text-sm">{getSelectionSummary()}</span>
						{#if showModuleList}
							<ChevronUp class="text-muted-foreground h-4 w-4" />
						{:else}
							<ChevronDown class="text-muted-foreground h-4 w-4" />
						{/if}
					</button>

					<!-- Module List (Collapsible) -->
					{#if showModuleList}
						<div class="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
							<!-- Select All Option -->
							<div class="flex items-center gap-2 border-b border-border pb-2">
								<Checkbox id="select-all" checked={selectAll} onCheckedChange={toggleSelectAll} />
								<Label for="select-all" class="flex-1 cursor-pointer text-sm font-medium">
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
											onCheckedChange={() => toggleModule(module.id)}
										/>
										<Label for="module-{module.id}" class="flex-1 cursor-pointer text-sm">
											{module.name}
										</Label>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<div class="text-muted-foreground rounded-md border p-3 text-sm italic">
						No external modules available. The key will have access to all modules.
					</div>
				{/if}
			</div>

			<!-- Expiration -->
			<div class="space-y-2">
				<Label for="key-expires">Expiration Date</Label>
				<Input id="key-expires" type="date" bind:value={expiresAt} />
				<p class="text-muted-foreground text-xs">Leave empty for a key that never expires</p>
			</div>
		</form>

		<DialogFooter>
			<Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
			<Button onclick={handleSubmit} disabled={!name.trim()}>Create Key</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';

	export interface Module {
		id: string;
		name: string;
	}

	let {
		modules = [],
		selectedModules = [],
		onChange,
		label = 'Allowed Modules',
		helpText = 'Select specific modules to restrict access, or leave empty for all modules.',
		compact = false
	}: {
		modules: Module[];
		selectedModules: string[];
		onChange?: (modules: string[]) => void;
		label?: string;
		helpText?: string;
		compact?: boolean;
	} = $props();

	let showModuleList = $state(false);

	// Computed value for select all
	const selectAll = $derived(selectedModules.length === modules.length && modules.length > 0);

	// Handle select all toggle
	function toggleSelectAll() {
		if (selectAll) {
			selectedModules = [];
		} else {
			selectedModules = modules.map((m) => m.id);
		}

		if (onChange) {
			onChange(selectedModules);
		}
	}

	// Toggle individual module selection
	function toggleModule(moduleId: string) {
		if (selectedModules.includes(moduleId)) {
			selectedModules = selectedModules.filter((id) => id !== moduleId);
		} else {
			selectedModules = [...selectedModules, moduleId];
		}

		if (onChange) {
			onChange(selectedModules);
		}
	}

	// Get selection summary
	function getSelectionSummary(): string {
		if (selectedModules.length === 0) return 'All modules';
		if (selectedModules.length === modules.length) return 'All modules';
		return `${selectedModules.length} module${selectedModules.length > 1 ? 's' : ''} selected`;
	}

	// Convert to null for "all modules"
	function getModulesForSubmit(): string[] | null {
		return selectedModules.length > 0 ? selectedModules : null;
	}
</script>

<div class="space-y-2">
	<Label>{label}</Label>

	{#if !compact && helpText}
		<p class="text-muted-foreground text-xs">{helpText}</p>
	{/if}

	{#if modules.length > 0}
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
						All modules ({modules.length})
					</Label>
				</div>

				<!-- Individual Modules -->
				<div class="space-y-1 pt-1">
					{#each modules as module (module.id)}
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
			No modules available. Access will be granted to all modules.
		</div>
	{/if}
</div>

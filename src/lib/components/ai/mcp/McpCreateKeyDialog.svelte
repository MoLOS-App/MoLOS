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
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { Info } from 'lucide-svelte';

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
	let selectedModule = $state<string>('__all__');
	let expiresAt = $state('');

	// Convert to null for "all modules"
	function getModulesForSubmit(): string[] | null {
		if (!selectedModule || selectedModule === '__all__') {
			return null;
		}
		return [selectedModule];
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
		selectedModule = '__all__';
		expiresAt = '';
	}

	function getSelectedModuleName(): string {
		if (selectedModule === '__all__') return 'All modules';
		const module = availableModules.find((m) => m.id === selectedModule);
		return module?.name || 'Select a module';
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

			<!-- Allowed Module (Single Select) -->
			<div class="space-y-2">
				<Label for="module-select">
					Allowed Module
					<span class="text-xs text-muted-foreground font-normal">(optional)</span>
				</Label>
				<div class="flex items-start gap-2 text-xs text-muted-foreground mb-2">
					<Info class="w-3 h-3 flex-shrink-0 mt-0.5" />
					<p>Leave as "All modules" to allow access to all external modules, or select a specific module to restrict access.</p>
				</div>

				{#if availableModules.length > 0}
					<Select bind:value={selectedModule}>
						<SelectTrigger id="module-select">
							{getSelectedModuleName()}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all__">All modules</SelectItem>
							{#each availableModules as module}
								<SelectItem value={module.id}>{module.name}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				{:else}
					<div class="text-sm text-muted-foreground italic border rounded-md p-3">
						No external modules available. The key will have access to all modules.
					</div>
				{/if}
			</div>

			<!-- Expiration -->
			<div class="space-y-2">
				<Label for="key-expires">
					Expiration Date
					<span class="text-xs text-muted-foreground font-normal">(optional)</span>
				</Label>
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

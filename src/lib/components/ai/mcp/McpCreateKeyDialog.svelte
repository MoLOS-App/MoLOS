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

	function handleSubmit() {
		if (!name.trim()) return;

		onCreate({
			name: name.trim(),
			allowedModules: selectedModules.length > 0 ? selectedModules : null,
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
		});

		// Reset form
		name = '';
		selectedModules = [];
		expiresAt = '';
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

			<!-- Allowed Modules -->
			<div class="space-y-2">
				<Label>Allowed Modules (optional)</Label>
				<p class="text-xs text-muted-foreground">Leave empty to allow all modules</p>
				{#if availableModules.length > 0}
					<div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-input rounded-lg">
						{#each availableModules as module}
							<label
								class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent transition-colors"
							>
								<input
									type="checkbox"
									bind:group={selectedModules}
									value={module.id}
									class="rounded text-primary"
								/>
								<span class="text-sm">{module.name}</span>
							</label>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground italic">No external modules available</p>
				{/if}
			</div>

			<!-- Expiration -->
			<div class="space-y-2">
				<Label for="key-expires">Expiration (optional)</Label>
				<Input id="key-expires" type="date" bind:value={expiresAt} />
			</div>
		</form>

		<DialogFooter>
			<Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
			<Button onclick={handleSubmit} disabled={!name.trim()}>Create Key</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

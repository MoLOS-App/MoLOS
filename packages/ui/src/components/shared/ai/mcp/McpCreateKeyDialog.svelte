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
	import { Info } from 'lucide-svelte';

	let {
		open,
		onOpenChange,
		onCreate
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onCreate: (data: {
			name: string;
			allowedScopes: string[] | null;
			expiresAt: string | null;
		}) => void | Promise<void>;
	} = $props();

	let name = $state('');
	let expiresAt = $state('');

	function handleSubmit() {
		if (!name.trim()) return;

		onCreate({
			name: name.trim(),
			allowedScopes: null, // Use scope picker for fine-grained control
			expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
		});

		// Reset form
		name = '';
		expiresAt = '';
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

			<!-- Scope Selection Info -->
			<div class="space-y-2">
				<Label>Permissions</Label>
				<div class="text-muted-foreground flex items-start gap-2 text-xs">
					<Info class="mt-0.5 h-3 w-3 flex-shrink-0" />
					<p>
						Create the key first, then use Scope Picker to select which tools this key can access.
					</p>
				</div>
				<div class="rounded-md border p-3 text-sm italic">
					All tools accessible by default. Use Scope Picker to restrict access.
				</div>
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

<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { CheckCircle, Copy, Check } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let {
		open,
		onOpenChange,
		keySecret
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		keySecret: string;
	} = $props();

	let copied = $state(false);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(keySecret);
			copied = true;
			toast.success('API key copied to clipboard');
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}

	function handleClose() {
		onOpenChange(false);
		copied = false;
	}
</script>

<Dialog {open} onOpenChange={onOpenChange}>
	<DialogContent class="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-3">
				<CheckCircle class="w-6 h-6 text-success" />
				API Key Created
			</DialogTitle>
		</DialogHeader>

		<div class="space-y-4">
			<p class="text-sm text-muted-foreground">
				Copy this key now. You won't be able to see it again.
			</p>

			<div class="relative">
				<code class="block w-full p-4 bg-muted text-foreground text-sm font-mono rounded-lg break-all pr-24 select-all">
					{keySecret}
				</code>
				<Button
					variant="outline"
					size="icon"
					onclick={copyToClipboard}
					class="absolute right-2 top-1/2 -translate-y-1/2"
					title="Copy to clipboard"
				>
					{#if copied}
						<Check class="w-4 h-4 text-success" />
					{:else}
						<Copy class="w-4 h-4" />
					{/if}
				</Button>
			</div>
		</div>

		<DialogFooter>
			<Button onclick={handleClose} class="w-full">
				I've saved my key
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

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
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(keySecret);
			copied = true;

			// Show toast with longer duration (10 seconds)
			toast.success('API key copied to clipboard', {
				duration: 10000,
				action: {
					label: 'Dismiss',
					onClick: () => {}
				}
			});

			// Reset the copied state after toast disappears
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 10000);
		} catch {
			toast.error('Failed to copy', { duration: 5000 });
		}
	}

	function handleClose() {
		onOpenChange(false);
		copied = false;
		if (copyTimer) clearTimeout(copyTimer);
	}

	// Auto-copy when dialog opens (optional UX improvement)
	$effect(() => {
		if (open && keySecret) {
			// Auto-copy for better UX
			copyToClipboard();
		}
	});
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

			<div class="relative group">
				<code class="block w-full p-4 bg-muted text-foreground text-sm font-mono rounded-lg break-all pr-24 select-all border-2 border-primary/20 group-hover:border-primary/40 transition-colors">
					{keySecret}
				</code>
				<Button
					variant="default"
					size="sm"
					onclick={copyToClipboard}
					class="absolute right-2 top-1/2 -translate-y-1/2 shadow-lg"
					title="Copy to clipboard"
				>
					{#if copied}
						<Check class="w-4 h-4 mr-2" />
						Copied!
					{:else}
						<Copy class="w-4 h-4 mr-2" />
						Copy Key
					{/if}
				</Button>
			</div>

			<p class="text-xs text-muted-foreground flex items-center gap-1">
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				This key has been copied to your clipboard. Store it securely.
			</p>
		</div>

		<DialogFooter>
			<Button onclick={handleClose} class="w-full">
				I've saved my key securely
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

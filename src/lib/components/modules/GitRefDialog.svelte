<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { GitBranch } from 'lucide-svelte';

	let {
		open,
		module,
		newRef,
		onClose,
		onSubmit
	}: {
		open: boolean;
		module: { id: string; name: string; currentRef: string } | null;
		newRef: string;
		onClose: () => void;
		onSubmit: () => void;
	} = $props();
</script>

{#if open}
	<Dialog.Root {open} onOpenChange={(o) => !o && onClose()}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Change Git Ref</Dialog.Title>
				<Dialog.Description>
					Enter the git tag or branch to checkout for this module. This will update the module to
					use the specified ref.
				</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="git-ref">Git Ref (tag or branch)</Label>
					<Input
						id="git-ref"
						bind:value={newRef}
						placeholder="main"
						class="col-span-3"
						autocomplete="off"
						spellcheck="false"
					/>
					<p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
						Current ref: {module?.currentRef || 'main'}
					</p>
				</div>
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={onClose}>Cancel</Button>
				<Button onclick={onSubmit} disabled={!newRef.trim()}>Update Ref</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}

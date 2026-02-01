<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Save, RefreshCw, Info } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';

	let {
		moduleStates,
		isSaving
	}: {
		moduleStates: Record<
			string,
			{ enabled: boolean; menuOrder: number; submodules: Record<string, boolean> }
		>;
		isSaving: boolean;
	} = $props();
</script>

<div
	class="border-muted-foreground/5 fixed right-0 bottom-0 left-0 z-50 w-full border-t bg-background/80 shadow-2xl backdrop-blur-md"
>
	<div class="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-4">
		<div class="flex items-center gap-4">
			<div class="border-muted-foreground/10 hidden h-6 border-l md:block"></div>
			<p
				class="text-muted-foreground/60 hidden text-[10px] font-bold tracking-widest uppercase md:block"
			>
				<Info class="mr-1.5 mb-0.5 inline-block h-3.5 w-3.5" />
				If you have made changes --->
			</p>
		</div>
		<form
			method="POST"
			action="?/save"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						toast.success('Configuration saved');
					} else {
						toast.error('Failed to save');
					}
				};
			}}
		>
			<input type="hidden" name="states" value={JSON.stringify(moduleStates)} />
			<Button
				size="sm"
				type="submit"
				disabled={isSaving}
				class="h-9 min-w-[160px] rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg shadow-primary/20"
			>
				{#if isSaving}
					<RefreshCw class="mr-2 h-3.5 w-3.5 animate-spin" />
					Saving...
				{:else}
					<Save class="mr-2 h-3.5 w-3.5" />
					Save Changes
				{/if}
			</Button>
		</form>
	</div>
</div>

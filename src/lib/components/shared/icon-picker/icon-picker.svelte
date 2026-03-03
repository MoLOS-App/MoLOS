<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import IconPickerTrigger from './icon-picker-trigger.svelte';
	import IconPickerContent from './icon-picker-content.svelte';

	interface Props {
		selected?: string;
		onSelect: (icon: string) => void;
		size?: 'sm' | 'md' | 'lg';
		enableEmojis?: boolean;
		class?: string;
	}

	let { selected, onSelect, size = 'md', enableEmojis = true, class: className }: Props = $props();

	let open = $state(false);

	function handleIconSelect(icon: string) {
		onSelect(icon);
		open = false;
	}
</script>

<div class={cn('inline-flex', className)}>
	<Popover.Root bind:open>
		<Popover.Trigger>
			<IconPickerTrigger value={selected} {size} />
		</Popover.Trigger>

		<Popover.Content class="w-80 p-3">
			<IconPickerContent {selected} {enableEmojis} onSelect={handleIconSelect} />
		</Popover.Content>
	</Popover.Root>
</div>

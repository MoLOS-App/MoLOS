<script lang="ts">
	import { Palette } from 'lucide-svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ColorPickerTrigger from './color-picker/color-picker-trigger.svelte';
	import ColorPickerPalette from './color-picker/color-picker-palette.svelte';

	interface Props {
		selected?: string;
		onSelect: (color: string) => void;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}

	let { selected, onSelect, size = 'md', class: className }: Props = $props();

	const noteColors = [
		'#ffffff',
		'#fecaca',
		'#fca5a5',
		'#f0ef86',
		'#e1f5c4',
		'#dbeafe',
		'#c3ddfd',
		'#a0dce8',
		'#a2d2ff',
		'#c4bef0',
		'#fdffb6',
		'#d1d5db'
	];

	function handleColorSelect(color: string) {
		onSelect(color);
	}
</script>

<Popover.Root>
	<Popover.Trigger class={className}>
		<ColorPickerTrigger color={selected || '#ffffff'} {size} />
	</Popover.Trigger>
	<Popover.Content class="z-50 w-auto p-3">
		<div class="mb-2 flex items-center gap-2">
			<Palette class="text-muted-foreground h-4 w-4" />
			<span class="text-sm font-medium">Choose color</span>
		</div>
		<ColorPickerPalette colors={noteColors} {selected} {size} {onSelect} columns={6} />
	</Popover.Content>
</Popover.Root>

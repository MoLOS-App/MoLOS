<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ColorPickerTrigger from './color-picker-trigger.svelte';
	import ColorPickerContent from './color-picker-content.svelte';
	import type { Gradient } from './utils/color-utils.js';

	interface Props {
		value: string | Gradient;
		format?: 'hex' | 'rgb' | 'hsl';
		enableGradient?: boolean;
		enableHistory?: boolean;
		enablePresets?: boolean;
		disabled?: boolean;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		onChange?: (value: string | Gradient) => void;
	}

	let {
		value,
		format = 'hex',
		enableGradient = true,
		enableHistory = true,
		enablePresets = true,
		disabled = false,
		size = 'md',
		class: className,
		onChange
	}: Props = $props();

	let open = $state(false);

	function handleValueChange(newValue: string | Gradient) {
		onChange?.(newValue);
	}

	const isGradient = $derived(typeof value !== 'string');
</script>

<div class={cn('inline-flex', className)}>
	<Popover.Root bind:open>
		<Popover.Trigger>
			<ColorPickerTrigger
				color={typeof value === 'string' ? value : undefined}
				gradient={typeof value !== 'string' ? value : undefined}
				{disabled}
				{size}
			/>
		</Popover.Trigger>

		<Popover.Content class="w-80 p-4">
			<ColorPickerContent
				{value}
				{format}
				{enableGradient}
				{enableHistory}
				{enablePresets}
				onChange={handleValueChange}
			/>
		</Popover.Content>
	</Popover.Root>
</div>

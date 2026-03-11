<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: TooltipPrimitive.ArrowProps = $props();
</script>

<TooltipPrimitive.Arrow bind:ref {...restProps}>
	{#snippet child({ props })}
		<div
			class='z-50 size-2.5 rotate-45 rounded-[2px] bg-primary'
			{...props}
		></div>
	{/snippet}
</TooltipPrimitive.Arrow>

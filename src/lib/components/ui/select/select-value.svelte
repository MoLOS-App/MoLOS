<script lang="ts">
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(undefined),
		class: className,
		placeholder,
		...restProps
	}: {
		ref?: HTMLDivElement;
		class?: string;
		placeholder?: string;
		[attr: string]: any;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="select-value"
	class={cn('flex-1', className)}
	{placeholder}
	{...restProps}
></div>

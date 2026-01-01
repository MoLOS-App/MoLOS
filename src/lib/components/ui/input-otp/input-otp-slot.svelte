<script lang="ts">
	import { PinInput as InputOTPPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		cell,
		class: className,
		...restProps
	}: InputOTPPrimitive.CellProps = $props();
</script>

<InputOTPPrimitive.Cell
	{cell}
	bind:ref
	data-slot="input-otp-slot"
	class={cn(
		'border-input dark:bg-input/30 relative flex size-9 items-center justify-center border-y border-e text-sm transition-all outline-none first:rounded-s-md first:border-s last:rounded-e-md aria-invalid:border-destructive',
		cell.isActive &&
			'border-ring ring-ring/50 z-10 ring-[3px] ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
		className
	)}
	{...restProps}
>
	{cell.char}
	{#if cell.hasFakeCaret}
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<div class="h-4 w-px animate-caret-blink bg-foreground duration-1000"></div>
		</div>
	{/if}
</InputOTPPrimitive.Cell>

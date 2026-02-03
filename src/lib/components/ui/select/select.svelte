<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		value = $bindable(),
		type,
		children,
		...restProps
	}: {
		open?: boolean;
		value?: unknown;
		type?: 'single' | 'multiple';
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	// Default to single if not provided
	const selectType = $derived((type ?? 'single') as 'single' | 'multiple');
</script>

<SelectPrimitive.Root
	bind:open
	bind:value={value as never}
	type={selectType as never}
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</SelectPrimitive.Root>

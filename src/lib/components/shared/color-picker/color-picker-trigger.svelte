<script lang="ts">
	import { cn } from '$lib/utils.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { Gradient } from './utils/color-utils.js';

	interface Props {
		color?: string;
		gradient?: Gradient;
		disabled?: boolean;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		onClick?: () => void;
	}

	let {
		color = '#6366f1',
		gradient,
		disabled = false,
		size = 'md',
		class: className,
		onClick
	}: Props = $props();

	const sizeStyles = {
		sm: 'h-8 w-8 text-xs',
		md: 'h-10 w-10 text-sm',
		lg: 'h-12 w-12',
		full: 'h-full w-full'
	};

	function handleClick() {
		if (!disabled) {
			onClick?.();
		}
	}

	const backgroundStyle = $derived(
		gradient
			? `linear-gradient(${gradient.angle}deg, ${gradient.stops.map((s: { color: string; position: number }) => `${s.color} ${s.position}%`).join(', ')})`
			: color
	);
</script>

<button
	type="button"
	class={cn(
		'inline-flex items-center justify-center rounded-md border border-border shadow-xs transition-[color,box-shadow] outline-none',
		'focus-visible:border-ring focus-visible:ring-ring/50 hover:border-primary/50 focus-visible:ring-[3px] focus-visible:outline-1',
		'disabled:cursor-not-allowed disabled:opacity-50',
		sizeStyles[size],
		className
	)}
	{disabled}
	onclick={handleClick}
	aria-label="Open color picker"
>
	<span
		class="relative size-full overflow-hidden rounded-sm"
		style="background: {backgroundStyle};"
	>
		{#if !gradient}
			<div
				class="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,.05)_25%,rgba(0,0,0,.05)_50%,transparent_50%,transparent_75%,rgba(0,0,0,.05)_75%,rgba(0,0,0,.05)_100%)] bg-[length:8px_8px]"
			/>
		{/if}
	</span>
</button>

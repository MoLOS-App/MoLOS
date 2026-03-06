<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { getIconType, parseIconIdentifier, getIconPack } from './utils/icon-packs.js';
	import type { Component } from 'svelte';

	interface Props {
		value?: string; // 'lucide-SquareCheck' or emoji like '😀'
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		onClick?: () => void;
	}

	let { value = 'lucide-SquareCheck', size = 'md', class: className, onClick }: Props = $props();

	const sizeStyles = {
		sm: 'h-8 w-8',
		md: 'h-10 w-10',
		lg: 'h-12 w-12'
	};

	const iconType = $derived(getIconType(value));

	let IconComponent: Component<any, any, any> | undefined = $derived.by(() => {
		if (iconType !== 'icon') return undefined;

		let normalizedValue = value;
		if (!value.includes('-')) {
			normalizedValue = `lucide-${value}`;
		}

		const parsed = parseIconIdentifier(normalizedValue);
		if (!parsed) return undefined;

		const pack = getIconPack(parsed.packId);
		if (!pack) return undefined;

		const iconEntry = pack.getIcons().find((icon) => icon.id === parsed.iconName);
		return iconEntry?.component;
	});

	function handleClick() {
		onClick?.();
	}
</script>

<div
	role="button"
	tabindex="0"
	class={cn(
		'inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-background shadow-xs transition-[color,box-shadow] outline-none',
		'focus-visible:border-ring focus-visible:ring-ring/50 hover:border-primary/50 focus-visible:ring-[3px] focus-visible:outline-1',
		sizeStyles[size],
		className
	)}
	onclick={handleClick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}}
	aria-label="Open icon picker"
>
	{#if iconType === 'emoji'}
		<span class="text-lg leading-none">{value}</span>
	{:else if IconComponent}
		<svelte:component this={IconComponent} class={cn('text-foreground', sizeStyles[size])} />
	{:else}
		<span class="text-muted-foreground text-lg">?</span>
	{/if}
</div>

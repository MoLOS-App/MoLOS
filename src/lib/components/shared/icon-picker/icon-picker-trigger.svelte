<script lang="ts">
	import { cn } from '$lib/utils.js';
	import { getIconType, parseIconIdentifier, getIconPack } from './utils/icon-packs.js';
	import {
		getIconPack as getIconPackFromUtils,
		parseIconIdentifier as parseIconIdentifierFromUtils
	} from './utils/icon-packs.js';
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

	// Determine if it's an emoji or icon
	const iconType = $derived(getIconType(value));

	// Get icon component for lucide icons
	let IconComponent: Component<any, any, any> | undefined = $derived.by(() => {
		if (iconType !== 'icon') return undefined;

		// Normalize value to ensure prefix
		const normalizedValue = !value.includes('-') ? `lucide-${value}` : value;

		const parsed = parseIconIdentifier(normalizedValue);
		if (!parsed) {
			console.log('[IconPickerTrigger] Failed to parse:', normalizedValue);
			return undefined;
		}

		const pack = getIconPackFromUtils(parsed.packId);
		if (!pack) {
			console.log('[IconPickerTrigger] Pack not found:', parsed.packId);
			return undefined;
		}

		const icons = pack.getIcons();
		const iconEntry = icons.find((icon) => icon.id === parsed.iconName);
		if (!iconEntry) {
			console.log(
				'[IconPickerTrigger] Icon not found in pack:',
				parsed.iconName,
				'available icons:',
				icons.map((i) => i.id).slice(0, 10)
			);
		}

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

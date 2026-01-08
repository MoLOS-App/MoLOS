<script lang="ts">
	import type { NavItem } from '$lib/config/types';
	import { cn } from '$lib/utils.js';

	let {
		items = [],
		currentPath,
		label = 'Submenu'
	}: {
		items: NavItem[];
		currentPath: string;
		label?: string;
	} = $props();

	let railRef: HTMLElement | null = $state(null);

	function handleKeydown(event: KeyboardEvent) {
		if (!railRef || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
		const links = Array.from(railRef.querySelectorAll<HTMLElement>('[data-submenu-link]'));
		const currentIndex = links.indexOf(document.activeElement as HTMLElement);
		if (currentIndex === -1) return;

		const delta = event.key === 'ArrowRight' ? 1 : -1;
		const nextIndex = (currentIndex + delta + links.length) % links.length;
		links[nextIndex]?.focus();
		event.preventDefault();
	}
</script>

<nav
	bind:this={railRef}
	aria-label={label}
	class="flex items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 snap-x snap-mandatory"
	onkeydown={handleKeydown}
>
	{#each items as item}
		{@const isActive = item.href && currentPath === item.href}
		{#if item.href && !item.disabled}
			<a
				href={item.href}
				aria-current={isActive ? 'page' : undefined}
				data-submenu-link
				class={cn(
					'flex h-11 snap-start items-center gap-2 rounded-full px-4 text-xs font-semibold uppercase tracking-wide transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none',
					isActive
						? 'bg-primary text-primary-foreground shadow-sm'
						: 'bg-muted text-muted-foreground hover:text-foreground'
					)}
			>
				<item.icon class="h-4 w-4" />
				<span class="whitespace-nowrap">{item.name}</span>
			</a>
		{:else}
			<span class="flex h-11 items-center gap-2 rounded-full bg-muted/60 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
				<item.icon class="h-4 w-4" />
				<span class="whitespace-nowrap">{item.name}</span>
			</span>
		{/if}
	{/each}
</nav>

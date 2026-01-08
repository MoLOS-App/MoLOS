<script lang="ts">
	import type { NavItem } from '$lib/config/types';
	import { cn } from '$lib/utils.js';

	let {
		title,
		items = [],
		currentPath,
		onSelect
	}: {
		title?: string;
		items: NavItem[];
		currentPath: string;
		onSelect?: () => void;
	} = $props();

	const labelId = title ? `submenu-section-${title.toLowerCase().replace(/\s+/g, '-')}` : undefined;
</script>

<section aria-labelledby={labelId} class="flex flex-col gap-2">
	{#if title}
		<h3
			id={labelId}
			class="text-muted-foreground px-2 text-xs font-semibold tracking-wide uppercase"
		>
			{title}
		</h3>
	{/if}
	<div class="flex flex-col gap-1">
		{#each items as item}
			{@const isActive = item.href && currentPath === item.href}
			{#if item.href && !item.disabled}
				<a
					href={item.href}
					aria-current={isActive ? 'page' : undefined}
					data-submenu-link
					class={cn(
						'group flex min-w-0 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none',
						isActive
							? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
							: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
					)}
					onclick={() => onSelect?.()}
				>
					<span class="flex min-w-0 items-center gap-2">
						<item.icon class="h-4 w-4 shrink-0 opacity-80" />
						<span class="truncate">{item.name}</span>
					</span>
					{#if item.badge != null}
						<span class="text-muted-foreground rounded-full bg-muted px-2 py-0.5 text-xs">
							{item.badge}
						</span>
					{/if}
				</a>
			{:else}
				<span
					aria-disabled="true"
					class={cn(
						'text-muted-foreground/50 flex min-w-0 items-center justify-between rounded-xl px-3 py-2 text-sm font-medium motion-reduce:transition-none',
						item.disabled && 'cursor-not-allowed'
					)}
				>
					<span class="flex min-w-0 items-center gap-2">
						<item.icon class="h-4 w-4 shrink-0 opacity-50" />
						<span class="truncate">{item.name}</span>
					</span>
				</span>
			{/if}
		{/each}
	</div>
</section>

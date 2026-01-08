<script lang="ts">
	import type { NavItem } from '$lib/config/types';
	import { cn } from '$lib/utils.js';

	let {
		title,
		items = [],
		currentPath,
		onSelect,
		variant = 'default',
		compact = false
	}: {
		title?: string;
		items: NavItem[];
		currentPath: string;
		onSelect?: () => void;
		variant?: 'default' | 'sidebar';
		compact?: boolean;
	} = $props();

	let isSidebar = $derived(variant === 'sidebar');
	let isCompact = $derived(isSidebar && compact);
	let labelId = $derived(
		title && !isCompact ? `submenu-section-${title.toLowerCase().replace(/\s+/g, '-')}` : undefined
	);
</script>

<section
	aria-labelledby={labelId}
	class={cn('flex flex-col', isSidebar ? 'gap-3' : 'gap-2')}
>
	{#if title && !isCompact}
		<h3
			id={labelId}
			class={cn(
				'text-muted-foreground px-2 font-semibold uppercase',
				isSidebar ? 'text-[11px] tracking-[0.2em]' : 'text-xs tracking-wide'
			)}
		>
			{title}
		</h3>
	{/if}
	<div
		class={cn(
			'flex flex-col',
			isSidebar
				? isCompact
					? 'gap-2 rounded-2xl bg-transparent p-1'
					: 'gap-1 rounded-2xl bg-muted/30 p-1.5'
				: 'gap-1'
		)}
	>
		{#each items as item}
			{@const isActive = item.href && currentPath === item.href}
			{#if item.href && !item.disabled}
				<a
					href={item.href}
					aria-current={isActive ? 'page' : undefined}
					aria-label={isCompact ? item.name : undefined}
					title={isCompact ? item.name : undefined}
					data-submenu-link
					class={cn(
						'group flex min-w-0 items-center justify-between text-sm font-medium transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transition-none hover:-translate-y-0.5 active:translate-y-0',
						isSidebar ? (isCompact ? 'h-10 w-10 justify-center rounded-2xl' : 'rounded-2xl px-3 py-2.5') : 'rounded-xl px-3 py-2',
						isSidebar
							? isCompact
								? isActive
									? 'bg-muted/70 text-foreground shadow-sm ring-1 ring-border/60'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
								: isActive
									? 'bg-background text-foreground shadow-sm ring-1 ring-border/70'
									: 'text-muted-foreground hover:bg-background/80 hover:text-foreground'
							: isActive
								? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
								: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
					)}
					onclick={() => onSelect?.()}
				>
					<span class="flex items-center min-w-0 gap-2">
						<item.icon
							class="w-4 h-4 shrink-0 opacity-80 transition-transform duration-200 group-hover:scale-110"
						/>
						{#if !isCompact}
							<span class="truncate">{item.name}</span>
						{/if}
					</span>
					{#if item.badge != null && !isCompact}
						<span
							class={cn(
								'rounded-full px-2 py-0.5 text-xs',
								isSidebar
									? isActive
										? 'bg-foreground text-background'
										: 'bg-muted/80 text-muted-foreground'
									: 'bg-muted text-muted-foreground'
							)}
						>
							{item.badge}
						</span>
					{/if}
				</a>
			{:else}
				<span
					aria-disabled="true"
					title={isCompact ? item.name : undefined}
					class={cn(
						'text-muted-foreground/50 flex min-w-0 items-center justify-between text-sm font-medium transition-all duration-200 ease-out motion-reduce:transition-none',
						isSidebar
							? isCompact
								? 'h-10 w-10 justify-center rounded-2xl'
								: 'rounded-2xl px-3 py-2.5'
							: 'rounded-xl px-3 py-2',
						item.disabled && 'cursor-not-allowed'
					)}
				>
					<span class="flex items-center min-w-0 gap-2">
						<item.icon class="w-4 h-4 opacity-50 shrink-0 transition-transform duration-200" />
						{#if !isCompact}
							<span class="truncate">{item.name}</span>
						{/if}
					</span>
				</span>
			{/if}
		{/each}
	</div>
</section>

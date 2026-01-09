<script lang="ts">
	import { Menu, X } from 'lucide-svelte';
	import type { ModuleConfig } from '$lib/config/types';
	import type { SubmenuSection as SubmenuSectionGroup } from '$lib/navigation/submenu';
	import * as Drawer from '$lib/components/ui/drawer/index.js';
	import SubmenuSection from './SubmenuSection.svelte';
	import { cn } from '$lib/utils.js';

	let {
		modules = [],
		currentModule,
		sections = [],
		currentPath,
		onNavigate,
		triggerClass = '',
		triggerLabel = 'Open navigation',
		trigger,
		footer
	}: {
		modules: ModuleConfig[];
		currentModule?: ModuleConfig;
		sections: SubmenuSectionGroup[];
		currentPath: string;
		onNavigate?: () => void;
		triggerClass?: string;
		triggerLabel?: string;
		trigger?: import('svelte').Snippet;
		footer?: import('svelte').Snippet<[{ close: () => void }]>;
	} = $props();

	let open = $state(false);
	let triggerRef: HTMLElement | null = $state(null);
	let wasOpen = $state(false);

	$effect(() => {
		if (wasOpen && !open) {
			triggerRef?.focus();
		}
		wasOpen = open;
	});

	const closeDrawer = () => {
		open = false;
		onNavigate?.();
	};
</script>

<Drawer.Root bind:open>
	<Drawer.Trigger
		bind:ref={triggerRef}
		aria-label={triggerLabel}
		aria-expanded={open}
		class={cn(
			'flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
			triggerClass
		)}
	>
		{#if trigger}
			{@render trigger()}
		{:else}
			<Menu class="w-5 h-5" />
		{/if}
	</Drawer.Trigger>

	<Drawer.Content
		class="max-h-[85vh] rounded-t-3xl border border-border/60 bg-background/95 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
	>
		<Drawer.Header class="flex items-center justify-between gap-2 pb-4">
			<Drawer.Title class="text-sm font-semibold tracking-wide">Navigation</Drawer.Title>
			<Drawer.Close
				aria-label="Close navigation"
				class="flex items-center justify-center transition-colors border rounded-full text-muted-foreground h-9 w-9 border-border/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
			>
				<X class="w-4 h-4" />
			</Drawer.Close>
		</Drawer.Header>

		<div class="space-y-5">
			<section class="space-y-2">
				<p class="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
					Modules
				</p>
				<div class="flex flex-col gap-2">
					{#each modules as module}
						{@const isActive = module.href && currentPath.startsWith(module.href)}
						<a
							href={module.href}
							aria-current={isActive ? 'page' : undefined}
							class={cn(
								'flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium transition-colors',
								isActive
									? 'border-primary/30 bg-primary/10 text-primary'
									: 'text-muted-foreground bg-muted/60 hover:text-foreground'
							)}
							onclick={closeDrawer}
						>
							<module.icon class="w-4 h-4" />
							<span class="truncate">{module.name}</span>
						</a>
					{/each}
				</div>
			</section>

			{#if currentModule && sections.length > 0}
				<section class="space-y-3">
					<p class="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
						{currentModule.name} sections
					</p>
					<div class="flex flex-col gap-3">
						{#each sections as section}
							<SubmenuSection
								title={section.label}
								items={section.items}
								{currentPath}
								onSelect={closeDrawer}
							/>
						{/each}
					</div>
				</section>
			{:else if currentModule}
				<section
					class="px-3 py-4 text-sm border border-dashed text-muted-foreground rounded-xl border-border/70"
				>
					No sections available yet.
				</section>
			{/if}
		</div>

		{@render footer?.({ close: closeDrawer })}
	</Drawer.Content>
</Drawer.Root>

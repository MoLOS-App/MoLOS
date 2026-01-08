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
		triggerLabel = 'Open navigation'
	}: {
		modules: ModuleConfig[];
		currentModule?: ModuleConfig;
		sections: SubmenuSectionGroup[];
		currentPath: string;
		onNavigate?: () => void;
		triggerClass?: string;
		triggerLabel?: string;
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
			'flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
			triggerClass
		)}
	>
		<slot name="trigger">
			<Menu class="h-5 w-5" />
		</slot>
	</Drawer.Trigger>

	<Drawer.Content
		class="max-h-[85vh] rounded-t-3xl border border-border/60 bg-background/95 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4"
	>
		<Drawer.Header class="flex items-center justify-between gap-2 pb-4">
			<Drawer.Title class="text-sm font-semibold tracking-wide">Navigation</Drawer.Title>
			<Drawer.Close
				aria-label="Close navigation"
				class="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
			>
				<X class="h-4 w-4" />
			</Drawer.Close>
		</Drawer.Header>

		<div class="space-y-5">
			<section class="space-y-2">
				<p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
										: 'bg-muted/60 text-muted-foreground hover:text-foreground'
									)}
								onclick={closeDrawer}
							>
							<module.icon class="h-4 w-4" />
							<span class="truncate">{module.name}</span>
						</a>
					{/each}
				</div>
			</section>

			{#if currentModule && sections.length > 0}
				<section class="space-y-3">
					<p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
						{currentModule.name} sections
					</p>
					<div class="flex flex-col gap-3">
						{#each sections as section}
							<SubmenuSection
								title={section.label}
								items={section.items}
								currentPath={currentPath}
								onSelect={closeDrawer}
							/>
						{/each}
					</div>
				</section>
			{:else if currentModule}
				<section class="rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
					No sections available yet.
				</section>
			{/if}
		</div>

		<slot name="footer" close={closeDrawer} />
	</Drawer.Content>
</Drawer.Root>

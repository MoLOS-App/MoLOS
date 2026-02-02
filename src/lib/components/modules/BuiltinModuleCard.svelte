<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		LayoutGrid,
		GripVertical,
		ChevronUp,
		ChevronDown,
		Settings2,
		ExternalLink
	} from 'lucide-svelte';
	import type { ModuleData, ModuleState } from './types';

	let {
		module,
		moduleState,
		index,
		isFirst,
		isLast,
		onToggle,
		onToggleSubmodule,
		onMove,
		onReorder
	}: {
		module: ModuleData;
		moduleState: ModuleState;
		index: number;
		isFirst: boolean;
		isLast: boolean;
		onToggle: (moduleId: string) => void;
		onToggleSubmodule: (moduleId: string, subName: string) => void;
		onMove: (moduleId: string, direction: 'up' | 'down') => void;
		onReorder?: (sourceId: string, targetId: string) => void;
	} = $props();

	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	// Use the prop values directly - no local state sync needed
	// Provide defaults in case moduleState is undefined (SSR edge case)
	const currentEnabled = $derived(moduleState?.enabled ?? true);
	const currentSubmodules = $derived(moduleState?.submodules ?? {});

	function handleToggleSubmodule(subName: string) {
		onToggleSubmodule(module.id, subName);
	}

	function handleToggleModule() {
		onToggle(module.id);
	}

	function handleDragStart(e: DragEvent, id: string) {
		draggedId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
	}

	function handleDragOver(e: DragEvent, id: string) {
		e.preventDefault();
		if (draggedId === id) return;
		if (dragOverId !== id) {
			dragOverId = id;
		}
	}

	function handleDragLeave(e: DragEvent, id: string) {
		if (dragOverId === id) {
			dragOverId = null;
		}
	}

	function handleDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		const sourceId = draggedId || e.dataTransfer?.getData('text/plain');
		if (!sourceId || sourceId === targetId) {
			draggedId = null;
			dragOverId = null;
			return;
		}
		// Call parent's reorder function
		onReorder?.(sourceId, targetId);
		draggedId = null;
		dragOverId = null;
	}

	function handleDragEnd() {
		draggedId = null;
		dragOverId = null;
	}
</script>

<div
	draggable="true"
	role="listitem"
	ondragstart={(e) => handleDragStart(e, module.id)}
	ondragover={(e) => handleDragOver(e, module.id)}
	ondragleave={(e) => handleDragLeave(e, module.id)}
	ondragend={handleDragEnd}
	ondrop={(e) => handleDrop(e, module.id)}
	class="transition-all duration-200 {draggedId === module.id
		? 'scale-[0.98] opacity-20 grayscale'
		: ''} {dragOverId === module.id
		? 'rounded-2xl bg-primary/5 ring-2 ring-primary ring-offset-4'
		: ''} {!currentEnabled ? 'opacity-60' : ''}"
>
	<Accordion.Item
		value={module.id}
		class="overflow-hidden rounded-2xl border-none bg-muted/20 px-0 shadow-sm"
	>
		<div class="flex items-center gap-4 px-4">
			<div class="flex items-center gap-1">
				<Tooltip.Root>
					<Tooltip.Trigger>
						<div
							class="text-muted-foreground/50 cursor-grab p-1.5 transition-colors hover:text-primary active:cursor-grabbing"
						>
							<GripVertical class="h-4 w-4" />
						</div>
					</Tooltip.Trigger>
					<Tooltip.Content side="left" class="text-[10px] font-bold tracking-widest uppercase">
						Drag to reorder
					</Tooltip.Content>
				</Tooltip.Root>
				<div class="flex flex-col">
					<Button
						variant="ghost"
						size="icon"
						class="text-muted-foreground/40 h-5 w-5 hover:text-primary"
						disabled={isFirst}
						onclick={(e) => {
							e.stopPropagation();
							onMove(module.id, 'up');
						}}
					>
						<ChevronUp class="h-3 w-3" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						class="text-muted-foreground/40 h-5 w-5 hover:text-primary"
						disabled={isLast}
						onclick={(e) => {
							e.stopPropagation();
							onMove(module.id, 'down');
						}}
					>
						<ChevronDown class="h-3 w-3" />
					</Button>
				</div>
			</div>

			<div class="flex flex-1 items-center gap-4 py-4">
				<div class="rounded-xl bg-background p-2.5 text-primary shadow-xs">
					<LayoutGrid class="h-4 w-4" />
				</div>
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<span class="truncate text-sm font-bold">{module.name}</span>
						{#if !currentEnabled}
							<Badge
								variant="outline"
								class="h-4 bg-background/50 px-1.5 text-[8px] font-black tracking-widest uppercase"
								>Disabled</Badge
							>
						{/if}
					</div>
					<p
						class="text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase"
					>
						{module.description || 'No description available.'}
					</p>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<button
					class="flex items-center"
					onclick={(e) => {
						e.stopPropagation();
						handleToggleModule();
					}}
				>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Switch checked={currentEnabled} class="pointer-events-none scale-90" />
						</Tooltip.Trigger>
						<Tooltip.Content side="top" class="text-[10px] font-bold tracking-widest uppercase">
							{currentEnabled ? 'Deactivate' : 'Activate'}
						</Tooltip.Content>
					</Tooltip.Root>
				</button>
				<Accordion.Trigger
					class="rounded-xl p-2 transition-colors hover:bg-background/50 hover:no-underline"
				></Accordion.Trigger>
			</div>
		</div>

		<Accordion.Content class="px-4 pt-0 pb-4">
			<div class="space-y-5 pl-12">
				<Separator class="bg-muted-foreground/10" />
				{#if module.navigation && module.navigation.length > 0}
					<div class="space-y-3">
						<h4
							class="text-muted-foreground flex items-center gap-2 text-[10px] font-black tracking-widest uppercase"
						>
							<Settings2 class="h-3 w-3" />
							Submodules & Features
						</h4>
						<div class="grid gap-2 sm:grid-cols-2">
							{#each module.navigation as sub}
								<div
									class="flex items-center justify-between rounded-xl border border-transparent bg-background/40 p-3 transition-colors hover:border-primary/10"
								>
									<Label class="cursor-pointer text-xs font-bold" for="{module.id}-{sub.name}">
										{sub.name}
									</Label>
									<button
										id="{module.id}-{sub.name}"
										disabled={!currentEnabled}
										class="border-none bg-transparent p-0"
										onclick={() => handleToggleSubmodule(sub.name)}
									>
										<Switch
											checked={currentSubmodules[sub.name]}
											class="pointer-events-none scale-75"
										/>
									</button>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<p
						class="text-muted-foreground/50 text-[10px] font-bold tracking-widest uppercase italic"
					>
						No submodules available
					</p>
				{/if}

				<div class="flex items-center justify-between pt-2">
					<div
						class="text-muted-foreground/40 flex items-center gap-2 text-[9px] font-black tracking-tighter uppercase"
					>
						ID: {module.id} • Order: {moduleState?.menuOrder ?? 0}
					</div>
					<Button
						variant="outline"
						size="sm"
						class="h-7 rounded-lg px-3 text-[10px] font-bold tracking-widest uppercase"
						href={module.href}
					>
						<ExternalLink class="mr-1.5 h-3 w-3" />
						Open
					</Button>
				</div>
			</div>
		</Accordion.Content>
	</Accordion.Item>
</div>

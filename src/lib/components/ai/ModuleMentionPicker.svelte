<script lang="ts">
	import { Command, CommandList, CommandItem } from '$lib/components/ui/command';
	import type { ModuleConfig } from '@molos/module-types';
	import { tick } from 'svelte';
	import { fly, scale } from 'svelte/transition';

	let {
		modules,
		query,
		position,
		onSelect,
		onClose
	}: {
		modules: ModuleConfig[];
		query: string;
		position: { x: number; y: number };
		onSelect: (module: ModuleConfig) => void;
		onClose: () => void;
	} = $props();

	const filteredModules = $derived(
		modules.filter(
			(m) =>
				m.name.toLowerCase().includes(query.toLowerCase()) ||
				m.id.toLowerCase().includes(query.toLowerCase())
		)
	);

	let listElement = $state<HTMLElement | null>(null);
	let selectedIndex = $state(0);

	// Reset selection when filtered list changes
	$effect(() => {
		const _ = filteredModules.length;
		selectedIndex = 0;
	});

	// Adjust position to stay within viewport with better placement
	const adjustedPosition = $derived.by(() => {
		if (typeof window === 'undefined') return { x: 0, y: 0 };

		const pickerWidth = 280;
		const pickerHeight = 280;
		const padding = 16;
		const inputHeight = 60; // Approximate height of input area

		let x = position.x;
		let y = position.y;

		// Prefer showing above the input for better UX
		// First try below
		let showBelow = true;

		// Check if there's enough space below
		if (y + pickerHeight > window.innerHeight - padding) {
			showBelow = false;
		}

		// Check if there's enough space above
		if (!showBelow && y - pickerHeight - inputHeight < padding) {
			// Not enough space either way, show below anyway (it will scroll)
			showBelow = true;
		}

		if (!showBelow) {
			y = y - pickerHeight - inputHeight + 20;
		}

		// Ensure picker stays within horizontal bounds
		if (x + pickerWidth > window.innerWidth - padding) {
			x = window.innerWidth - pickerWidth - padding;
		}
		if (x < padding) {
			x = padding;
		}

		// Clamp y to not be negative
		y = Math.max(padding, y);

		return { x: Math.round(x), y: Math.round(y) };
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, filteredModules.length - 1);
			scrollSelectedIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
			scrollSelectedIntoView();
		} else if (e.key === 'Enter' && filteredModules[selectedIndex]) {
			e.preventDefault();
			e.stopPropagation();
			onSelect(filteredModules[selectedIndex]);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	function scrollSelectedIntoView() {
		tick().then(() => {
			if (listElement) {
				const selected = listElement.querySelector('[data-selected="true"]');
				if (selected) {
					selected.scrollIntoView({ block: 'nearest' });
				}
			}
		});
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.module-mention-picker') && !target.closest('textarea')) {
			onClose();
		}
	}

	$effect(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if filteredModules.length > 0}
	<div
		class="module-mention-picker fixed z-50 max-w-[320px] min-w-[240px] rounded-xl border border-border/70 bg-popover/95 shadow-xl backdrop-blur-sm"
		style="left: {adjustedPosition.x}px; top: {adjustedPosition.y}px;"
		in:fly={{ y: 8, duration: 150 }}
		out:scale={{ start: 0.95, duration: 100 }}
	>
		<!-- Header -->
		<div class="border-b border-border/50 px-3 py-2">
			<span class="text-muted-foreground text-xs font-medium">Mention a module</span>
		</div>

		<Command class="rounded-none border-0">
			<CommandList bind:ref={listElement} class="max-h-[220px]">
				{#each filteredModules as module, index (module.id)}
					<button
						type="button"
						class="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent {index ===
						selectedIndex
							? 'bg-accent'
							: ''}"
						data-selected={index === selectedIndex}
						onclick={() => onSelect(module)}
						onmouseenter={() => (selectedIndex = index)}
					>
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
							{#if module.icon}
								<module.icon class="text-muted-foreground h-4 w-4" />
							{/if}
						</div>
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm font-medium">{module.name}</span>
							{#if module.description}
								<span class="text-muted-foreground truncate text-xs">{module.description}</span>
							{/if}
						</div>
					</button>
				{/each}
			</CommandList>
		</Command>

		<!-- Footer hint -->
		<div class="border-t border-border/50 px-3 py-1.5">
			<span class="text-muted-foreground text-[10px]">
				<kbd class="rounded bg-muted px-1 py-0.5 text-[9px]">↑↓</kbd> navigate
				<kbd class="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px]">↵</kbd> select
				<kbd class="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px]">esc</kbd> close
			</span>
		</div>
	</div>
{/if}

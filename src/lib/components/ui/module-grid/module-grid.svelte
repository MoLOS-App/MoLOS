<script lang="ts">
	import type { ModuleConfig } from '$lib/config/types';
	import { Badge } from '$lib/components/ui/badge';
	import { Check } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface ModuleGridProps {
		modules: ModuleConfig[];
		selectedIds: Set<string>;
		disabledIds?: Set<string>;
		onToggle?: (moduleId: string) => void;
	}

	let { modules, selectedIds, disabledIds = new Set(), onToggle }: ModuleGridProps = $props();

	// Sort modules: disabled (mandatory) first, then alphabetically
	const sortedModules = $derived(
		[...modules].sort((a, b) => {
			const aDisabled = disabledIds.has(a.id);
			const bDisabled = disabledIds.has(b.id);

			// Disabled (mandatory) modules first
			if (aDisabled && !bDisabled) return -1;
			if (!aDisabled && bDisabled) return 1;

			// Then alphabetically by name
			return a.name.localeCompare(b.name);
		})
	);

	function handleClick(moduleId: string, disabled: boolean) {
		if (!disabled && onToggle) {
			onToggle(moduleId);
		}
	}

	function handleKeyDown(event: KeyboardEvent, moduleId: string, disabled: boolean) {
		if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			onToggle?.(moduleId);
		}
	}
</script>

<div class="flex max-h-[60vh] flex-col gap-2 pr-2" role="group" aria-label="Module selection">
	{#each sortedModules as module, index (module.id)}
		{#if module.id !== 'dashboard'}
			<button
				type="button"
				in:fly={{
					y: 20,
					duration: 300,
					delay: index * 30,
					easing: cubicOut
				}}
				role="switch"
				aria-checked={selectedIds.has(module.id)}
				aria-disabled={disabledIds.has(module.id)}
				aria-label="Toggle {module.name} module"
				class={cn(
					'flex w-full items-center gap-4 rounded-xl p-3 text-left transition-all duration-200',
					'border border-transparent bg-muted',
					'cursor-pointer select-none',
					'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
					!disabledIds.has(module.id) && 'hover:bg-muted/80 hover:shadow-md',
					selectedIds.has(module.id) && 'border-primary bg-primary/5',
					disabledIds.has(module.id) && 'cursor-not-allowed opacity-60'
				)}
				disabled={disabledIds.has(module.id)}
				onclick={() => handleClick(module.id, disabledIds.has(module.id))}
				onkeydown={(e) => handleKeyDown(e, module.id, disabledIds.has(module.id))}
			>
				<!-- Icon Container -->
				<div
					class={cn(
						'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
						'bg-background shadow-sm transition-all duration-200',
						selectedIds.has(module.id) && 'bg-primary/10'
					)}
				>
					{#if module.icon}
						<svelte:component
							this={module.icon}
							class={cn(
								'h-6 w-6',
								selectedIds.has(module.id) ? 'text-primary' : 'text-muted-foreground'
							)}
						/>
					{/if}
				</div>

				<!-- Name and Description -->
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="truncate font-medium">{module.name}</span>
						{#if disabledIds.has(module.id)}
							<Badge variant="secondary" class="shrink-0 px-2 py-0.5 text-[10px]">
								Always Active
							</Badge>
						{/if}
					</div>
					{#if module.description}
						<p class="text-muted-foreground truncate text-sm">{module.description}</p>
					{/if}
				</div>

				<!-- Selection Indicator -->
				<div
					class={cn(
						'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200',
						selectedIds.has(module.id)
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-muted-foreground/30 bg-transparent'
					)}
				>
					{#if selectedIds.has(module.id)}
						<Check class="h-4 w-4" />
					{/if}
				</div>
			</button>
		{/if}
	{/each}
</div>

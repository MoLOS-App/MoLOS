<script lang="ts">
	import type { ModuleConfig } from '$lib/config/types';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger
	} from '$lib/components/ui/tooltip';
	import { Check, Info } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface ModuleCardProps {
		module: ModuleConfig;
		selected: boolean;
		disabled?: boolean;
		onToggle?: () => void;
	}

	let { module, selected, disabled = false, onToggle }: ModuleCardProps = $props();

	function handleClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!disabled && onToggle) {
			onToggle();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			event.stopPropagation();
			onToggle?.();
		}
	}
</script>

<!-- Card Container (clickable) -->
<div
	role="button"
	tabindex={disabled ? -1 : 0}
	aria-pressed={selected}
	aria-disabled={disabled}
	aria-label="Toggle {module.name} module"
	class={cn(
		'group relative flex items-center justify-between gap-4 rounded-2xl p-4 transition-all duration-200',
		'border border-transparent bg-muted',
		'shadow-lg hover:shadow-xl',
		'cursor-pointer select-none',
		'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
		!disabled && 'hover:bg-muted/80',
		selected && 'border-primary bg-primary/5',
		disabled && 'cursor-not-allowed opacity-60'
	)}
	onclick={handleClick}
	onkeydown={handleKeyDown}
>
	<!-- Icon Container -->
	<div
		class={cn(
			'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
			'bg-background shadow-sm transition-transform duration-200',
			!disabled && 'group-hover:scale-105',
			selected && 'bg-primary/10'
		)}
		in:scale={{ duration: 300, easing: cubicOut }}
	>
		{#if module.icon}
			<svelte:component
				this={module.icon}
				class={cn('h-6 w-6', selected ? 'text-primary' : 'text-muted-foreground')}
			/>
		{/if}
	</div>

	<!-- Selection Indicator -->
	{#if selected}
		<div
			class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
			in:scale={{ duration: 200, easing: cubicOut }}
		>
			<Check class="h-4 w-4" />
		</div>
	{:else if !disabled}
		<div class="border-muted-foreground/30 h-6 w-6 shrink-0 rounded-full border-2"></div>
	{/if}

	<!-- Info Icon for Tooltip (only visible on hover) -->
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger
				class="absolute top-4 right-4 z-10 opacity-0 transition-opacity group-hover:opacity-100"
				onclick={(e) => e.stopPropagation()}
			>
				<Info class="text-muted-foreground h-4 w-4" />
			</TooltipTrigger>
			<TooltipContent side="right" class="max-w-xs">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<p class="font-bold">{module.name}</p>
						{#if disabled}
							<Badge variant="secondary" class="px-2 py-0.5 text-[10px]">Always Active</Badge>
						{/if}
					</div>
					{#if module.description}
						<p class="text-muted-foreground text-sm">{module.description}</p>
					{/if}
				</div>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
</div>

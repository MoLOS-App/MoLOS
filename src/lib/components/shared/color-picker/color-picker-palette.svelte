<script lang="ts">
	import { cn } from '$lib/utils.js';

	interface Props {
		colors: string[];
		selected?: string;
		columns?: number;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		onSelect: (color: string) => void;
	}

	let { colors, selected, columns = 10, size = 'md', class: className, onSelect }: Props = $props();

	const sizeStyles = {
		sm: 'h-6 w-6 text-[10px]',
		md: 'h-8 w-8 text-xs',
		lg: 'h-10 w-10 text-sm'
	};

	function selectColor(color: string) {
		onSelect(color);
	}
</script>

<div class={cn('space-y-2', className)}>
	<div
		class="grid gap-1.5"
		style="grid-template-columns: repeat(min({columns}, 10), minmax(0, 1fr));"
	>
		{#each colors as color (color)}
			<button
				type="button"
				class={cn(
					'relative flex aspect-square items-center justify-center rounded-md border border-border/50 shadow-xs transition-[color,box-shadow]',
					'hover:border-primary hover:ring-2 hover:ring-primary/20',
					'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-1',
					sizeStyles[size],
					selected === color && 'ring-ring ring-2 ring-offset-1 ring-offset-background'
				)}
				style="background: {color};"
				onclick={() => selectColor(color)}
				aria-label={`Select color ${color}`}
				aria-pressed={selected === color}
			>
				{#if selected === color}
					<div class="rounded-full bg-white/90 shadow-sm ring-1 ring-foreground/50">
						<svg
							class={size === 'sm' ? 'size-3' : size === 'lg' ? 'size-5' : 'size-4'}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
					</div>
				{/if}
			</button>
		{/each}
	</div>
</div>

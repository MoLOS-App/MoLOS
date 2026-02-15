<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { cn } from '$lib/utils';

	let {
		title,
		value,
		icon: Icon,
		iconColor = 'text-primary',
		trend,
		trendUp = true
	}: {
		title: string;
		value: string | number;
		icon: ComponentType;
		iconColor?: string;
		trend?: string;
		trendUp?: boolean;
	} = $props();
</script>

<!-- Modern stats card with Google Material Design 3 style -->
<Card
	class="group overflow-hidden border-0 bg-card shadow-sm transition-all duration-300 hover:shadow-md"
>
	<CardContent class="p-6">
		<div class="flex items-start justify-between">
			<div class="min-w-0 flex-1">
				<p class="text-muted-foreground mb-1 text-sm font-medium">{title}</p>
				<p class="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
				{#if trend}
					<p
						class={cn(
							'mt-2 flex items-center gap-1 text-xs font-medium',
							trendUp ? 'text-success' : 'text-destructive'
						)}
					>
						{trend}
					</p>
				{/if}
			</div>
			<div
				class={cn(
					'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
					'bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20',
					iconColor
				)}
			>
				<Icon class="h-6 w-6" />
			</div>
		</div>
	</CardContent>
</Card>

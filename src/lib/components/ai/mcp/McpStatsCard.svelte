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
	class="group overflow-hidden border-0 bg-card shadow-sm hover:shadow-md transition-all duration-300"
>
	<CardContent class="p-6">
		<div class="flex items-start justify-between">
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-muted-foreground mb-1">{title}</p>
				<p class="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
				{#if trend}
					<p
						class={cn(
							'text-xs font-medium mt-2 flex items-center gap-1',
							trendUp ? 'text-success' : 'text-destructive'
						)}
					>
						{trend}
					</p>
				{/if}
			</div>
			<div
				class={cn(
					'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
					'bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300',
					iconColor
				)}
			>
				<Icon class="w-6 h-6" />
			</div>
		</div>
	</CardContent>
</Card>

<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { Card, CardContent } from '$lib/components/ui/card';

	let {
		title,
		value,
		icon: Icon,
		iconColor = 'text-primary'
	}: {
		title: string;
		value: string | number;
		icon: ComponentType;
		iconColor?: string;
	} = $props();
</script>

<Card class="shadow-sm border border-border hover:shadow-md transition-shadow">
	<CardContent class="p-6">
		<div class="flex items-center justify-between gap-4">
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-muted-foreground">{title}</p>
				<p class="text-2xl md:text-3xl font-bold tracking-tight mt-1 truncate">{value}</p>
			</div>
			<div class="flex-shrink-0">
				<Icon class="w-10 h-10 md:w-12 md:h-12 {iconColor}" />
			</div>
		</div>
	</CardContent>
</Card>

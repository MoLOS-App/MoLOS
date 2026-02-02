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

<Card class="p-6 shadow-sm border border-border">
	<CardContent class="p-0">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-muted-foreground">{title}</p>
				<p class="text-2xl font-bold tracking-tight mt-1">{value}</p>
			</div>
			<Icon class="w-8 h-8 {iconColor}" />
		</div>
	</CardContent>
</Card>

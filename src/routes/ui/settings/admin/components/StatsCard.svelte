<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		value: number | string;
		children?: Snippet;
	};

	let { title, value, children }: Props = $props();
</script>

<Card class="overflow-hidden border-none shadow-sm">
	<CardContent class="p-6">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
					{title}
				</p>
				<p class="text-3xl font-black tracking-tighter">{value}</p>
			</div>
			{#if children}
				<div class="rounded-2xl bg-background p-3 text-primary shadow-xs">
					{@render children()}
				</div>
			{/if}
		</div>
	</CardContent>
</Card>

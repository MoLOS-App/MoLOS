<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	interface Props {
		x: number;
		y: number;
		onClose: () => void;
		children: Snippet;
	}

	let { x, y, onClose, children }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backplate (behind everything) -->
<button
	class="fixed inset-0 z-40 cursor-default border-none bg-transparent"
	onclick={onClose}
	aria-label="Close menu"
></button>

<!-- Menu (on top) -->
<div
	class="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-xl"
	style="left: {x}px; top: {y}px;"
	in:scale={{ duration: 120, easing: quintOut, start: 0.9 }}
>
	{@render children()}
</div>

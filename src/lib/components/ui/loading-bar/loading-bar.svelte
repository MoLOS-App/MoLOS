<script lang="ts">
	import { loadingStore } from '$lib/stores/loading-store.svelte.js';

	let { forceShow = false }: { forceShow?: boolean } = $props();

	const isLoading = $derived(forceShow || loadingStore.isLoading);
	const progress = $derived(loadingStore.progress ?? 0);

	const isCompleting = $derived(progress >= 100);
</script>

{#if isLoading}
	<div
		class="fixed inset-x-0 top-0 z-[99999] h-[3px] overflow-hidden bg-muted"
		role="progressbar"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={progress}
		aria-label="Loading"
	>
		<div
			class="h-full bg-accent"
			class:animate-indeterminate={!isCompleting}
			class:scale-x-100={isCompleting}
			class:transition-transform={isCompleting}
			class:duration-300={isCompleting}
			class:ease-out={isCompleting}
		></div>
	</div>
{/if}

<style>
	@keyframes indeterminate {
		0% {
			transform: scaleX(0);
			transform-origin: left;
		}
		49% {
			transform-origin: left;
		}
		50% {
			transform: scaleX(1);
			transform-origin: right;
		}
		100% {
			transform: scaleX(0);
			transform-origin: right;
		}
	}

	.animate-indeterminate {
		animation: indeterminate 1.5s ease-in-out infinite;
	}
</style>

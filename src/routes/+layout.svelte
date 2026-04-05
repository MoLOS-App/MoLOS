<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { Toaster } from '$lib/components/ui/sonner';
	import { initTheme } from '$lib/theme';
	import LoadingBar from '$lib/components/ui/loading-bar/loading-bar.svelte';
	import { startLoading, stopLoading } from '$lib/stores/loading-store.svelte';

	let { children, data } = $props();

	// Global click handler - start loading on any internal link click
	onMount(() => {
		function handleClick(event: MouseEvent): void {
			const target = event.target as HTMLElement;
			const anchor = target.closest('a');

			if (!anchor) return;

			const href = anchor.getAttribute('href');
			if (!href) return;

			// Skip external links, hash links, etc.
			if (
				href.startsWith('http') ||
				href.startsWith('//') ||
				href.startsWith('mailto:') ||
				href.startsWith('tel:') ||
				href.startsWith('#') ||
				anchor.hasAttribute('download') ||
				anchor.hasAttribute('data-sveltekit-no-routing')
			) {
				return;
			}

			// Internal link - start loading immediately
			if (href.startsWith('/')) {
				startLoading();
			}
		}

		document.addEventListener('click', handleClick, { capture: true });

		return () => {
			document.removeEventListener('click', handleClick, { capture: true });
		};
	});

	// Stop loading when navigation completes
	afterNavigate(() => {
		void stopLoading();
	});

	$effect(() => {
		if (data.theme) {
			initTheme();
		}
	});
</script>

{@render children()}
<LoadingBar />
<Toaster position="top-right" />

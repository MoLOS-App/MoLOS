<script lang="ts">
	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import { initTheme } from '$lib/theme';
	let { children, data } = $props();

	$effect(() => {
		// Sync theme from data if it changes (e.g. on login)
		if (data.theme) {
			initTheme();
		}
	});
</script>

{@render children()}
<Toaster position="top-right" />

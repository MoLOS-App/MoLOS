<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(async () => {
		await goto('/ui/ai/dashboard');
	});
</script>

<svelte:head>
	<title>AI Assistant - MoLOS</title>
	<meta name="description" content="Your personal AI assistant in MoLOS." />
</svelte:head>

<div>Loading...</div>

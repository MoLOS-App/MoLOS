<svelte:head>
	<title>AI Chat - MoLOS</title>
	<meta name="description" content="Chat with your AI assistant." />
</svelte:head>

<script lang="ts">
	import AiChatWorkspace from '$lib/components/ai/AiChatWorkspace.svelte';

	export let data;
</script>

<AiChatWorkspace userName={data.user?.name} />

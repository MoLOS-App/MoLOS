<script lang="ts">
	import AiChatWorkspace from '$lib/components/ai/AiChatWorkspace.svelte';

	export let data;
</script>

<svelte:head>
	<title>AI Chat - MoLOS</title>
	<meta name="description" content="Chat with your AI assistant." />
</svelte:head>

<!-- On mobile, fill the entire viewport bypassing layout padding.
     On desktop, let the layout handle positioning naturally. -->
<div class="fixed inset-x-0 top-0 bottom-16 z-30 md:static md:bottom-auto md:z-auto">
	<AiChatWorkspace userName={data.user?.name} />
</div>

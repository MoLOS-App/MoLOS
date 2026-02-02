<svelte:head>
	<title>Telegram AI - MoLOS</title>
	<meta name="description" content="Chat with your Telegram AI assistant." />
</svelte:head>

<script lang="ts">
	import TelegramChatWorkspace from '$lib/components/ai/TelegramChatWorkspace.svelte';

	export let data;
</script>

<TelegramChatWorkspace userName={data.user?.name} />

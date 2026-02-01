<script lang="ts">
	import TelegramChatWorkspace from '$lib/components/ai/TelegramChatWorkspace.svelte';

	export let data;
</script>

<TelegramChatWorkspace userName={data.user?.name} />

<script lang="ts">
	import AiChatWorkspace from '$lib/components/ai/AiChatWorkspace.svelte';

	export let data;
</script>

<AiChatWorkspace userName={data.user?.name} />

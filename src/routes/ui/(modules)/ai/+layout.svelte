<script lang="ts">
	let { children } = $props();
</script>

<div class="flex h-full min-h-full w-full items-center justify-center self-center align-middle">
	<div class="h-full w-7xl max-w-7xl">
		{@render children()}
	</div>
</div>

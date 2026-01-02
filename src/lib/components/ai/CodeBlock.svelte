<script lang="ts">
	import { Check, Copy } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	let { text, lang = '' } = $props<{ text: string; lang?: string }>();

	let copied = $state(false);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

<div
	class="group relative my-4 overflow-hidden rounded-xl border border-border/50 bg-muted/30 backdrop-blur-md"
>
	{#if lang}
		<div
			class="flex items-center justify-between border-b border-border/50 bg-muted/50 px-4 py-1.5"
		>
			<span class="text-muted-foreground/70 text-[10px] font-bold tracking-wider uppercase"
				>{lang}</span
			>
		</div>
	{/if}

	<div class="relative">
		<pre
			class="scrollbar-thin max-w-full overflow-x-auto p-4 font-mono text-[13px] leading-relaxed selection:bg-primary/20">
			<code>{text}</code>
		</pre>

		<div class="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
			<button
				onclick={copyToClipboard}
				class="text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm transition-all hover:bg-background hover:text-primary active:scale-90"
				title="Copy code"
			>
				{#if copied}
					<div in:fade={{ duration: 100 }}>
						<Check class="h-4 w-4 text-green-500" />
					</div>
				{:else}
					<div in:fade={{ duration: 100 }}>
						<Copy class="h-4 w-4" />
					</div>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	pre {
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	pre::-webkit-scrollbar {
		height: 4px;
	}

	pre::-webkit-scrollbar-thumb {
		background-color: var(--border);
		border-radius: 10px;
	}
</style>

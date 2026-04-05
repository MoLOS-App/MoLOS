<script lang="ts">
	import SvelteMarkdown from 'svelte-marked';
	import { Minus, Plus, Copy, Check, RotateCcw } from 'lucide-svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		source: string;
		renderers?: Record<string, unknown>;
		class?: string;
		showControls?: boolean;
	}

	let { source, renderers = {}, class: className = '', showControls = false }: Props = $props();

	// Font size state (base is 14px)
	let fontSizeLevel = $state(0); // -2, -1, 0, 1, 2
	const fontSizeSteps = [-2, -1, 0, 1, 2];
	const fontSizeLabels = ['xs', 'sm', 'md', 'lg', 'xl'];

	let copied = $state(false);

	const currentFontSize = $derived(
		`clamp(${14 + fontSizeLevel}px, ${85 + fontSizeLevel * 5}%, ${18 + fontSizeLevel * 2}px)`
	);

	function increaseFontSize() {
		if (fontSizeLevel < fontSizeSteps.length - 1) {
			fontSizeLevel++;
		}
	}

	function decreaseFontSize() {
		if (fontSizeLevel > -2) {
			fontSizeLevel--;
		}
	}

	function resetFontSize() {
		fontSizeLevel = 0;
	}

	async function copyContent() {
		try {
			await navigator.clipboard.writeText(source);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

<div class="markdown-wrapper {className}">
	{#if showControls}
		<div class="markdown-controls" transition:fade={{ duration: 150 }}>
			<div class="control-group">
				<button
					onclick={decreaseFontSize}
					disabled={fontSizeLevel <= -2}
					class="control-btn"
					title="Decrease font size"
					aria-label="Decrease font size"
				>
					<Minus class="h-3 w-3" />
				</button>

				<button
					onclick={resetFontSize}
					class="control-btn font-size-indicator"
					title="Reset font size"
					aria-label="Reset font size to default"
				>
					<RotateCcw class="h-3 w-3" />
					<span class="text-[10px]">{fontSizeLabels[fontSizeLevel + 2]}</span>
				</button>

				<button
					onclick={increaseFontSize}
					disabled={fontSizeLevel >= fontSizeSteps.length - 1}
					class="control-btn"
					title="Increase font size"
					aria-label="Increase font size"
				>
					<Plus class="h-3 w-3" />
				</button>
			</div>

			<div class="control-group">
				<button
					onclick={copyContent}
					class="control-btn"
					title="Copy markdown source"
					aria-label="Copy markdown source"
				>
					{#if copied}
						<Check class="h-3 w-3 text-green-500" />
					{:else}
						<Copy class="h-3 w-3" />
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<div
		class="markdown-content prose-sm prose prose-custom dark:prose-invert max-w-none"
		style="--font-size-base: {currentFontSize};"
	>
		<SvelteMarkdown {source} {renderers} />
	</div>
</div>

<style>
	.markdown-wrapper {
		position: relative;
	}

	.markdown-controls {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--muted);
		border-radius: 0.5rem;
		border: 1px solid var(--border);
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: 0.125rem;
	}

	.control-group:not(:last-child) {
		padding-right: 0.5rem;
		border-right: 1px solid var(--border);
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.375rem;
		border-radius: 0.375rem;
		color: var(--muted-foreground);
		transition: all 0.15s ease;
	}

	.control-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--accent-foreground);
	}

	.control-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.control-btn.font-size-indicator {
		min-width: 3rem;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.markdown-content {
		overflow-wrap: anywhere;
		word-break: break-word;
		font-size: var(--font-size-base, 14px);
	}

	/* Scale headings proportionally */
	.markdown-content :global(h1) {
		font-size: calc(var(--font-size-base, 14px) * 1.5);
	}
	.markdown-content :global(h2) {
		font-size: calc(var(--font-size-base, 14px) * 1.3);
	}
	.markdown-content :global(h3) {
		font-size: calc(var(--font-size-base, 14px) * 1.15);
	}
	.markdown-content :global(h4) {
		font-size: calc(var(--font-size-base, 14px) * 1.05);
	}
	.markdown-content :global(h5),
	.markdown-content :global(h6) {
		font-size: var(--font-size-base, 14px);
	}

	/* Horizontal scroll container for code blocks and tables */
	.markdown-content :global(pre),
	.markdown-content :global(table) {
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	.markdown-content :global(pre) {
		max-width: 100%;
	}

	.markdown-content :global(pre)::-webkit-scrollbar {
		height: 4px;
	}

	.markdown-content :global(pre)::-webkit-scrollbar-thumb {
		background-color: var(--border);
		border-radius: 10px;
	}

	.markdown-content :global(table) {
		display: block;
		overflow-x: auto;
		white-space: nowrap;
	}

	/* Ensure images don't overflow */
	.markdown-content :global(img) {
		max-width: 100%;
		height: auto;
	}

	/* Mobile-friendly touch targets */
	@media (max-width: 640px) {
		.markdown-content :global(pre) {
			font-size: 12px;
			border-radius: 0.75rem;
		}

		.markdown-content :global(code) {
			font-size: 12px;
		}
	}

	/* Desktop refinements */
	@media (min-width: 641px) {
		.markdown-content :global(pre) {
			border-radius: 1rem;
		}
	}
</style>

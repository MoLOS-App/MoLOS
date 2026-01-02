<script lang="ts">
	import type { AiMessage, AiAction } from '$lib/models/ai';
	import { fade, slide } from 'svelte/transition';
	import { Sparkles, Clock } from 'lucide-svelte';
	import SvelteMarkdown from 'svelte-marked';
	import CodeBlock from './CodeBlock.svelte';

	const { message } = $props();

	const renderers = {
		code: CodeBlock
	};

	const expandedThoughts = $state<Record<string, boolean>>({});
	const expandedPlans = $state<Record<string, boolean>>({});

	const processed = $derived(processMessage(message));

	function processMessage(msg: AiMessage) {
		const content = msg.content || '';
		const metadata = msg.contextMetadata ? JSON.parse(msg.contextMetadata) : {};

		// Extract thoughts and plans
		const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);
		let thought = thoughtMatch ? thoughtMatch[1].trim() : metadata.thought || null;

		const planMatch = content.match(/<plan>([\s\S]*?)<\/plan>/);
		let plan = planMatch ? planMatch[1].trim() : metadata.plan || null;

		let cleanContent = content
			.replace(/<thought>[\s\S]*?<\/thought>/, '')
			.replace(/<plan>[\s\S]*?<\/plan>/, '')
			.trim();

		// If the AI used the old [THOUGHT]: format, handle it too
		if (!thought && cleanContent.includes('[THOUGHT]:')) {
			const thoughtPart = cleanContent.match(/\[THOUGHT\]: (.*?)(?:\n|$)/);
			thought = thoughtPart ? thoughtPart[1].trim() : '';
			cleanContent = cleanContent.replace(/\[THOUGHT\]: .*?(?:\n|$)/, '').trim();
		}

		return {
			thought,
			plan,
			content: cleanContent,
			actions: metadata.actions || [],
			attachments: msg.attachments || [],
			parts: msg.parts || []
		};
	}

	function toggleThought(msgId: string) {
		expandedThoughts[msgId] = !expandedThoughts[msgId];
	}

	function togglePlan(msgId: string) {
		expandedPlans[msgId] = !expandedPlans[msgId];
	}
</script>

{#if message.role === 'user' || processed.content.trim() !== '' || processed.thought || processed.plan || processed.attachments || processed.parts}
	<div
		class="group/msg flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'}"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="bubble-container max-w-[88%] min-w-0 px-5 py-3.5 text-[14.5px] leading-relaxed shadow-sm transition-all duration-300 {message.role ===
			'user'
				? 'user-bubble bg-primary text-primary-foreground'
				: 'assistant-bubble border border-border/30 bg-muted/40 text-foreground backdrop-blur-md'}"
		>
			{#if message.role === 'user'}
				<div class="overflow-wrap-anywhere flex flex-col gap-2">
					{#if processed.attachments}
						<div class="mb-1 flex flex-wrap gap-1">
							{#each processed.attachments as att, i (i)}
								<div
									class="rounded border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-1 text-[10px]"
								>
									📎 {att.name || 'Attachment'}
								</div>
							{/each}
						</div>
					{/if}
					{message.content}
				</div>
			{:else}
				<div class="prose-sm prose prose-custom dark:prose-invert max-w-none">
					<SvelteMarkdown source={processed.content} {renderers} />
				</div>

				{#if processed.thought || processed.plan}
					<div class="mt-3 flex flex-col gap-2 border-t border-border/20 pt-3">
						{#if processed.thought}
							<div>
								<button
									class="text-muted-foreground/70 group/thought flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 hover:text-primary"
									onclick={() => toggleThought(message.id)}
								>
									<div
										class="rounded-md bg-muted p-1 transition-colors group-hover/thought:bg-primary/10"
									>
										<Sparkles class="h-3 w-3" />
									</div>
									{expandedThoughts[message.id] ? 'Hide Reasoning' : 'Show Reasoning'}
								</button>

								{#if expandedThoughts[message.id]}
									<div
										class="text-muted-foreground/80 mt-3 rounded-xl border border-border/10 bg-background/40 p-3 text-[12px] leading-relaxed font-bold italic shadow-inner"
										transition:slide={{ duration: 300 }}
									>
										{processed.thought}
									</div>
								{/if}
							</div>
						{/if}

						{#if processed.plan}
							<div>
								<button
									class="text-muted-foreground/70 group/plan flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 hover:text-primary"
									onclick={() => togglePlan(message.id)}
								>
									<div
										class="rounded-md bg-muted p-1 transition-colors group-hover/plan:bg-primary/10"
									>
										<Clock class="h-3 w-3" />
									</div>
									{expandedPlans[message.id] ? 'Hide Plan' : 'Show Plan'}
								</button>

								{#if expandedPlans[message.id]}
									<div
										class="text-muted-foreground/80 mt-3 rounded-xl border border-border/10 bg-background/40 p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap shadow-inner"
										transition:slide={{ duration: 300 }}
									>
										{processed.plan}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
		{#if processed.actions}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each processed.actions as action, i (i)}
					<div
						class="flex cursor-default items-center gap-2 rounded-full border border-border/40 bg-background/50 px-3 py-1 text-[10px] font-bold tracking-widest uppercase shadow-sm transition-colors hover:bg-background"
					>
						<span
							class="h-2 w-2 rounded-full {action.type === 'write'
								? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]'
								: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]'}"
						></span>
						<span class="text-muted-foreground/80">{action.type}:</span>
						<span class="text-foreground">{action.entity}</span>
						{#if action.status === 'pending'}
							<span class="ml-1 animate-pulse text-[8px] text-orange-500">PENDING</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.bubble-container {
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.user-bubble {
		border-radius: 20px 20px 4px 20px;
	}

	.assistant-bubble {
		border-radius: 20px 20px 20px 4px;
	}

	:global(.prose-custom) {
		--tw-prose-body: currentColor;
		--tw-prose-headings: currentColor;
		--tw-prose-links: var(--primary);
		--tw-prose-bold: currentColor;
		--tw-prose-counters: currentColor;
		--tw-prose-bullets: currentColor;
		--tw-prose-hr: var(--border);
		--tw-prose-quotes: currentColor;
		--tw-prose-quote-borders: var(--primary);
		--tw-prose-captions: currentColor;
		--tw-prose-code: currentColor;
		--tw-prose-pre-code: currentColor;
		--tw-prose-pre-bg: transparent;
		--tw-prose-th-borders: var(--border);
		--tw-prose-td-borders: var(--border);
	}

	:global(.prose-custom h1, .prose-custom h2, .prose-custom h3) {
		margin-top: 1.5em;
		margin-bottom: 0.5em;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	:global(.prose-custom p) {
		margin-top: 0.75em;
		margin-bottom: 0.75em;
	}

	:global(.prose-custom ul, .prose-custom ol) {
		margin-top: 0.75em;
		margin-bottom: 0.75em;
		padding-left: 1.25em;
	}

	:global(.prose-custom li) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
	}

	.overflow-wrap-anywhere {
		overflow-wrap: anywhere;
	}
</style>

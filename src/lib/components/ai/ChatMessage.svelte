<script lang="ts">
	import type { AiMessage, AiAction } from '$lib/models/ai';
	import { fade, slide } from 'svelte/transition';
	import { Sparkles, Copy, Check, User, Bot, ListChecks } from 'lucide-svelte';
	import SvelteMarkdown from 'svelte-marked';
	import CodeBlock from './CodeBlock.svelte';

	const { message } = $props();

	const renderers = {
		code: CodeBlock as any
	};

	const expandedThoughts = $state<Record<string, boolean>>({});
	const expandedPlans = $state<Record<string, boolean>>({});
	let copied = $state(false);

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

	function formatTime(value: Date | string) {
		const date = typeof value === 'string' ? new Date(value) : value;
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(processed.content);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}
</script>

{#if message.role === 'user' || processed.content.trim() !== '' || processed.thought || processed.plan || processed.attachments || processed.parts}
	<div
		class="group/msg flex w-full flex-col gap-2 {message.role === 'user'
			? 'items-end'
			: 'items-start'}"
		transition:fade={{ duration: 200 }}
	>
		<div class="flex items-center gap-2 px-1">
			{#if message.role === 'assistant'}
				<div class="flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 text-primary">
					<Bot class="h-3.5 w-3.5" />
				</div>
				<span class="text-muted-foreground/80 text-[11px] font-medium">Assistant</span>
			{:else}
				<span class="text-muted-foreground/80 text-[11px] font-medium">You</span>
				<div
					class="text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full bg-muted/60"
				>
					<User class="h-3.5 w-3.5" />
				</div>
			{/if}
		</div>

		<div
			class="bubble-container relative max-w-[92%] min-w-0 rounded-2xl px-4 py-3 text-[14px] leading-relaxed transition-all duration-200 {message.role ===
			'user'
				? 'user-bubble bg-primary text-primary-foreground'
				: 'assistant-bubble border border-border/60 bg-muted/30 text-foreground'}"
		>
			{#if message.role === 'user'}
				<div class="overflow-wrap-anywhere flex flex-col gap-2">
					{#if processed.attachments.length > 0}
						<div class="mb-1 flex flex-wrap gap-1">
							{#each processed.attachments as att, i (i)}
								<div
									class="rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-0.5 text-[10px] font-semibold"
								>
									📎 {att.name || 'Attachment'}
								</div>
							{/each}
						</div>
					{/if}
					<p class="whitespace-pre-wrap">{message.content}</p>
				</div>
			{:else}
				{#if processed.content.trim() !== ''}
					<div class="prose prose-sm prose-custom dark:prose-invert max-w-none">
						<SvelteMarkdown source={processed.content} {renderers} />
					</div>
				{/if}

				{#if processed.thought || processed.plan}
					<div
						class="flex flex-col gap-3 {processed.content.trim() !== ''
							? 'mt-4 border-t border-border/40 pt-3'
							: ''}"
					>
						{#if processed.thought}
							<div class="space-y-2">
								<button
									class="text-muted-foreground/70 flex items-center gap-2 text-[11px] font-medium transition-colors hover:text-foreground"
									onclick={() => toggleThought(message.id)}
								>
									<Sparkles class="h-3 w-3" />
									{expandedThoughts[message.id] ? 'Hide Reasoning' : 'Show Reasoning'}
								</button>

								{#if expandedThoughts[message.id]}
									<div
										class="text-muted-foreground/90 rounded-xl bg-muted/40 p-3 text-[12px] italic"
										transition:slide
									>
										{processed.thought}
									</div>
								{/if}
							</div>
						{/if}

						{#if processed.plan}
							<div class="space-y-2">
								<button
									class="text-muted-foreground/70 flex items-center gap-2 text-[11px] font-medium transition-colors hover:text-foreground"
									onclick={() => togglePlan(message.id)}
								>
									<ListChecks class="h-3 w-3" />
									{expandedPlans[message.id] ? 'Hide Plan' : 'Show Plan'}
								</button>

								{#if expandedPlans[message.id]}
									<div
										class="text-muted-foreground/90 rounded-xl bg-muted/40 p-3 font-mono text-[12px]"
										transition:slide
									>
										{processed.plan}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Message Actions -->
			<div
				class="absolute top-0 -right-12 flex flex-col gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100"
			>
				<button
					class="text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 hover:bg-muted/60 hover:text-foreground"
					onclick={copyToClipboard}
					title="Copy message"
				>
					{#if copied}
						<Check class="h-3.5 w-3.5 text-green-500" />
					{:else}
						<Copy class="h-3.5 w-3.5" />
					{/if}
				</button>
			</div>
		</div>

		{#if processed.actions.length > 0}
			<div class="mt-1 flex flex-wrap gap-2">
				{#each processed.actions as action, i (i)}
					<div
						class="text-muted-foreground flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1 text-[11px] font-medium"
					>
						<span
							class="h-1.5 w-1.5 rounded-full {action.type === 'write'
								? 'bg-orange-500'
								: 'bg-blue-500'}"
						></span>
						<span class="text-muted-foreground/80">{action.type}:</span>
						<span class="text-foreground">{action.entity}</span>
						{#if action.status === 'pending'}
							<span class="ml-1 animate-pulse text-[9px] text-orange-500">Pending</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<span class="text-muted-foreground/60 px-1 text-[10px]">
			{formatTime(message.createdAt)}
		</span>
	</div>
{/if}

<style>
	.bubble-container {
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.user-bubble {
		border-radius: 1.25rem 1.25rem 0.25rem 1.25rem;
	}

	.assistant-bubble {
		border-radius: 1.25rem 1.25rem 1.25rem 0.25rem;
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
		margin-top: 1em;
		margin-bottom: 0.5em;
		font-weight: 700;
	}

	:global(.prose-custom p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}

	:global(.prose-custom ul, .prose-custom ol) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		padding-left: 1.25em;
	}

	.overflow-wrap-anywhere {
		overflow-wrap: anywhere;
	}
</style>

<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Switch } from '$lib/components/ui/switch';
	import { ArrowLeft, Save, Bot, Cpu, Zap } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { AiProviderSelector } from '$lib/components/shared/ai-provider-selector';

	let { data } = $props();

	let provider = $state('openai');
	let apiKey = $state('');
	let modelName = $state('gpt-4o');
	let systemPrompt = $state('');
	let baseUrl = $state('');
	let streamEnabled = $state(true);

	$effect(() => {
		provider = data.settings?.provider || 'openai';
		apiKey = data.settings?.apiKey || '';
		modelName = data.settings?.modelName || 'gpt-4o';
		systemPrompt = data.settings?.systemPrompt || '';
		baseUrl = data.settings?.baseUrl || '';
		streamEnabled = data.settings?.streamEnabled ?? true;
	});

	let isSaving = $state(false);

	async function handleSave() {
		isSaving = true;

		if (!modelName) {
			toast.error('Please select or enter a model name');
			isSaving = false;
			return;
		}

		try {
			const response = await fetch('/api/ai/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider,
					apiKey,
					modelName,
					systemPrompt,
					baseUrl,
					streamEnabled
				})
			});

			if (response.ok) {
				toast.success('AI settings saved successfully');
			} else {
				toast.error('Failed to save AI settings');
			}
		} catch (e) {
			toast.error('An error occurred while saving');
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>AI Configuration - MoLOS Settings</title>
	<meta name="description" content="Configure your AI assistant settings and providers." />
</svelte:head>

<div class="min-h-screen bg-background pb-20">
	<div class="mx-auto max-w-4xl space-y-8 p-6">
		<!-- Header -->
		<div class="space-y-4 pt-4">
			<Button
				variant="ghost"
				size="sm"
				onclick={() => goto('/ui/settings')}
				class="text-muted-foreground -ml-2 h-8 rounded-full px-3 text-[10px] font-bold tracking-widest uppercase hover:text-foreground"
			>
				<ArrowLeft class="mr-2 h-3 w-3" />
				Back to Settings
			</Button>
			<div class="space-y-1">
				<h1 class="text-3xl font-black tracking-tighter">AI Assistant Settings</h1>
				<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
					Configure your in-app developer assistant
				</p>
			</div>
		</div>

		<div class="grid gap-6">
			<Card class="border-none shadow-sm">
				<CardHeader>
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-primary/10 p-2 text-primary shadow-xs">
							<Bot class="h-5 w-5" />
						</div>
						<div>
							<CardTitle>Provider Configuration</CardTitle>
							<CardDescription>Choose your LLM provider and model</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent class="space-y-6">
					<AiProviderSelector bind:provider bind:modelName bind:apiKey bind:baseUrl />
				</CardContent>
			</Card>

			<Card class="border-none shadow-sm">
				<CardHeader>
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-primary/10 p-2 text-primary shadow-xs">
							<Cpu class="h-5 w-5" />
						</div>
						<div>
							<CardTitle>Agent Personality</CardTitle>
							<CardDescription>Define how the assistant should behave</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-2">
						<Label for="systemPrompt">System Prompt</Label>
						<Textarea
							id="systemPrompt"
							bind:value={systemPrompt}
							placeholder="You are a helpful assistant for MoLOS..."
							rows={6}
						/>
					</div>
				</CardContent>
			</Card>

			<Card class="border-none shadow-sm">
				<CardHeader>
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-primary/10 p-2 text-primary shadow-xs">
							<Zap class="h-5 w-5" />
						</div>
						<div>
							<CardTitle>Response Streaming</CardTitle>
							<CardDescription>Control how responses arrive in chat</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div
						class="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3"
					>
						<div class="space-y-1">
							<Label class="text-sm">Stream assistant responses</Label>
							<p class="text-muted-foreground text-xs">
								Show tokens as they arrive instead of waiting for a full response.
							</p>
						</div>
						<Switch bind:checked={streamEnabled} />
					</div>
				</CardContent>
			</Card>

			<div class="flex justify-end">
				<Button onclick={handleSave} disabled={isSaving} class="rounded-xl px-8 font-bold">
					{#if isSaving}
						Saving...
					{:else}
						<Save class="mr-2 h-4 w-4" />
						Save Configuration
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>

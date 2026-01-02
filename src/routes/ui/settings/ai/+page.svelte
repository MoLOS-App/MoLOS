<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ArrowLeft, Save, Bot, Shield, Cpu, Globe } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { PREDEFINED_MODELS } from '$lib/models/ai';
	import { slide } from 'svelte/transition';

	let { data } = $props();

	let provider = $state('openai');
	let apiKey = $state('');
	let modelName = $state('gpt-4o');
	let systemPrompt = $state('');
	let baseUrl = $state('');

	$effect(() => {
		provider = data.settings?.provider || 'openai';
		apiKey = data.settings?.apiKey || '';
		modelName = data.settings?.modelName || 'gpt-4o';
		systemPrompt = data.settings?.systemPrompt || '';
		baseUrl = data.settings?.baseUrl || '';
	});

	let isSaving = $state(false);
	let selectedModelId = $state('gpt-4o');
	let customModelId = $state('');

	let availableModels = $derived(
		PREDEFINED_MODELS[provider as keyof typeof PREDEFINED_MODELS] || []
	);
	let isCustomModel = $derived(selectedModelId === 'custom');

	// Initialize state
	$effect(() => {
		const isPredefined = availableModels.some((m) => m.id === modelName);
		if (isPredefined) {
			selectedModelId = modelName;
		} else if (modelName) {
			selectedModelId = 'custom';
			customModelId = modelName;
		}
	});

	async function handleSave() {
		isSaving = true;
		const finalModelName = isCustomModel ? customModelId : selectedModelId;

		if (!finalModelName) {
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
					modelName: finalModelName,
					systemPrompt,
					baseUrl
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

	const providers = [
		{ value: 'openai', label: 'OpenAI' },
		{ value: 'anthropic', label: 'Anthropic' },
		{ value: 'openrouter', label: 'OpenRouter' },
		{ value: 'ollama', label: 'Ollama (Local)' }
	];

	function handleProviderChange() {
		if (availableModels.length > 0) {
			selectedModelId = availableModels[0].id;
		} else {
			selectedModelId = 'custom';
		}
	}
</script>

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
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="provider">AI Provider</Label>
							<select
								id="provider"
								bind:value={provider}
								onchange={handleProviderChange}
								class="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#each providers as p (p.value)}
									<option value={p.value}>{p.label}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-2">
							<Label for="model">Model Selection</Label>
							<select
								id="model"
								bind:value={selectedModelId}
								class="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#each availableModels as m (m.id)}
									<option value={m.id}>{m.name}</option>
								{/each}
								<option value="custom">Custom Model...</option>
							</select>
						</div>
					</div>

					{#if isCustomModel}
						<div class="space-y-2" transition:slide>
							<Label for="customModel">Custom Model ID</Label>
							<Input
								id="customModel"
								bind:value={customModelId}
								placeholder="e.g. gpt-4-32k or your-local-model"
							/>
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="apiKey">API Key</Label>
						<div class="relative">
							<Input
								id="apiKey"
								type="password"
								bind:value={apiKey}
								placeholder="sk-..."
								class="pr-10"
							/>
							<Shield
								class="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
							/>
						</div>
						<p class="text-muted-foreground text-[10px]">
							Your API key is stored locally and used only for requests to the provider.
						</p>
					</div>

					{#if provider === 'ollama' || provider === 'openrouter'}
						<div class="space-y-2">
							<Label for="baseUrl">Base URL (Optional)</Label>
							<div class="relative">
								<Input
									id="baseUrl"
									bind:value={baseUrl}
									placeholder={provider === 'ollama'
										? 'http://localhost:11434'
										: 'https://openrouter.ai/api/v1'}
								/>
								<Globe
									class="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
								/>
							</div>
						</div>
					{/if}
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

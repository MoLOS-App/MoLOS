<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Shield, Globe } from 'lucide-svelte';
	import { PREDEFINED_MODELS } from '$lib/models/ai';
	import { slide } from 'svelte/transition';

	interface ModelOption {
		id: string;
		name: string;
		category?: 'coding' | 'general' | 'vision';
	}

	interface Provider {
		value: string;
		label: string;
		icon: string;
	}

	interface Props {
		provider?: string;
		modelName?: string;
		apiKey?: string;
		baseUrl?: string;
		onProviderChange?: (provider: string) => void;
		onModelChange?: (model: string) => void;
		onApiKeyChange?: (apiKey: string) => void;
		onBaseUrlChange?: (baseUrl: string) => void;
	}

	let {
		provider = $bindable('openai'),
		modelName = $bindable('gpt-4o'),
		apiKey = $bindable(''),
		baseUrl = $bindable(''),
		onProviderChange,
		onModelChange,
		onApiKeyChange,
		onBaseUrlChange
	}: Props = $props();

	const providers: Provider[] = [
		// Major Cloud Providers
		{ value: 'openai', label: 'OpenAI', icon: '🤖' },
		{ value: 'anthropic', label: 'Anthropic (Claude)', icon: '🧠' },
		{ value: 'google', label: 'Google Gemini', icon: '✨' },
		// Open Source / Self-hosted
		{ value: 'ollama', label: 'Ollama (Local)', icon: '🏠' },
		{ value: 'openrouter', label: 'OpenRouter', icon: '🌐' },
		// Fast / Budget Providers
		{ value: 'groq', label: 'Groq (Fast)', icon: '⚡' },
		{ value: 'mistral', label: 'Mistral AI', icon: '🌬️' },
		// Coding Specialized
		{ value: 'deepseek', label: 'DeepSeek (Coding)', icon: '🔍' },
		{ value: 'zai', label: 'Z.AI (GLM)', icon: '📝' },
		{ value: 'minimax', label: 'MiniMax', icon: '🔬' },
		{ value: 'minimax-coding', label: 'MiniMax (Coding)', icon: '💻' },
		// Other Providers
		{ value: 'moonshot', label: 'Moonshot (Kimi)', icon: '🌙' },
		{ value: 'xai', label: 'xAI (Grok)', icon: '🚀' }
	];

	let customModelId = $state('');

	let availableModels = $derived(
		(PREDEFINED_MODELS[provider as keyof typeof PREDEFINED_MODELS] as ModelOption[]) || []
	);

	let isCustomModel = $derived(
		!availableModels.some((m) => m.id === modelName) && modelName !== ''
	);

	// Sync customModelId when modelName changes to a custom value
	$effect(() => {
		if (isCustomModel && modelName) {
			customModelId = modelName;
		}
	});

	function handleProviderChange() {
		// Reset to first available model when provider changes
		if (availableModels.length > 0) {
			modelName = availableModels[0].id;
		} else {
			modelName = '';
		}
		customModelId = '';
		onProviderChange?.(provider);
	}

	function handleModelChange(newModel: string) {
		modelName = newModel;
		if (newModel !== 'custom') {
			customModelId = '';
		}
		onModelChange?.(modelName);
	}

	function handleCustomModelChange() {
		if (customModelId) {
			modelName = customModelId;
			onModelChange?.(customModelId);
		}
	}

	function handleApiKeyChange(value: string) {
		apiKey = value;
		onApiKeyChange?.(value);
	}

	function handleBaseUrlChange(value: string) {
		baseUrl = value;
		onBaseUrlChange?.(value);
	}

	const baseUrlPlaceholders: Record<string, string> = {
		ollama: 'http://localhost:11434/v1',
		zai: 'https://api.z.ai/api/coding/paas/v4',
		groq: 'https://api.groq.com/openai/v1',
		deepseek: 'https://api.deepseek.com',
		google: 'https://generativelanguage.googleapis.com/v1beta/openai/',
		mistral: 'https://api.mistral.ai/v1',
		moonshot: 'https://api.moonshot.cn/v1',
		xai: 'https://api.x.ai/v1',
		minimax: 'https://api.minimax.io/v1',
		'minimax-coding': 'https://api.minimax.io/v1',
		openrouter: 'https://openrouter.ai/api/v1'
	};

	const baseUrlHints: Record<string, string> = {
		ollama: 'Leave empty to use default localhost:11434',
		groq: 'Free tier available at api.groq.com',
		deepseek: "DeepSeek's official API endpoint",
		google: 'Google Gemini API (requires API key from Google AI Studio)',
		mistral: "Mistral AI's official API",
		moonshot: "Moonshot AI's Kimi API",
		xai: "xAI's Grok API",
		minimax: 'MiniMax API (get key from platform.minimax.io)',
		'minimax-coding': 'MiniMax Coding API (get key from platform.minimax.io)'
	};

	let needsBaseUrl = $derived(
		provider === 'ollama' ||
			provider === 'openrouter' ||
			provider === 'zai' ||
			provider === 'groq' ||
			provider === 'deepseek' ||
			provider === 'google' ||
			provider === 'mistral' ||
			provider === 'moonshot' ||
			provider === 'xai' ||
			provider === 'minimax' ||
			provider === 'minimax-coding'
	);
</script>

<div class="space-y-6">
	<!-- Provider and Model Selection -->
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
					<option value={p.value}>{p.icon}{p.label}</option>
				{/each}
			</select>
		</div>
		<div class="space-y-2">
			<Label for="model">Model Selection</Label>
			<select
				id="model"
				value={isCustomModel ? 'custom' : modelName}
				onchange={(e) => handleModelChange(e.currentTarget.value)}
				class="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				<optgroup label="--- Coding & Reasoning ---">
					{#each availableModels.filter((m) => m.category === 'coding') as m (m.id)}
						<option value={m.id}>{m.name}</option>
					{/each}
				</optgroup>
				<optgroup label="--- General Purpose ---">
					{#each availableModels.filter((m) => m.category === 'general') as m (m.id)}
						<option value={m.id}>{m.name}</option>
					{/each}
				</optgroup>
				<optgroup label="--- Vision ---">
					{#each availableModels.filter((m) => m.category === 'vision') as m (m.id)}
						<option value={m.id}>{m.name}</option>
					{/each}
				</optgroup>
				<option value="custom">🔧 Custom Model...</option>
			</select>
		</div>
	</div>

	<!-- Custom Model Input -->
	{#if isCustomModel}
		<div class="space-y-2" transition:slide>
			<Label for="customModel">Custom Model ID</Label>
			<Input
				id="customModel"
				bind:value={customModelId}
				oninput={handleCustomModelChange}
				placeholder="e.g. gpt-4-32k or your-local-model"
			/>
		</div>
	{/if}

	<!-- API Key -->
	<div class="space-y-2">
		<Label for="apiKey">API Key</Label>
		<div class="relative">
			<Input
				id="apiKey"
				type="password"
				value={apiKey}
				oninput={(e) => handleApiKeyChange(e.currentTarget.value)}
				placeholder={provider === 'ollama' ? 'Not required for local Ollama' : 'sk-...'}
				class="pr-10"
			/>
			<Shield class="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
		</div>
		<p class="text-muted-foreground text-[10px]">
			{#if provider === 'ollama'}
				Ollama doesn't require an API key - leave empty
			{:else}
				Your API key is stored locally and used only for requests to the provider.
			{/if}
		</p>
	</div>

	<!-- Base URL (conditional) -->
	{#if needsBaseUrl}
		<div class="space-y-2">
			<Label for="baseUrl">Base URL (Optional)</Label>
			<div class="relative">
				<Input
					id="baseUrl"
					value={baseUrl}
					oninput={(e) => handleBaseUrlChange(e.currentTarget.value)}
					placeholder={baseUrlPlaceholders[provider] || 'https://...'}
					class="pr-10"
				/>
				<Globe class="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
			</div>
			{#if baseUrlHints[provider]}
				<p class="text-muted-foreground text-[10px]">
					{baseUrlHints[provider]}
				</p>
			{:else}
				<p class="text-muted-foreground text-[10px]">
					Leave empty to use provider's default endpoint
				</p>
			{/if}
		</div>
	{/if}
</div>

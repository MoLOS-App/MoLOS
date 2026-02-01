<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		Send,
		MessageSquare,
		Settings,
		LoaderCircle,
		Check,
		Save,
		Trash2,
		RefreshCw
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { TelegramSettings, TelegramSession, TelegramMessage } from '$lib/models/ai';
	import { PREDEFINED_MODELS } from '$lib/models/ai';

	let { userName } = $props<{ userName?: string }>();

	// AI settings for default model and provider
	let aiSettings = $state<{
		provider: string;
		modelName: string;
	} | null>(null);

	// Configuration state
	let config = $state<{
		botToken: string;
		chatId: string;
		webhookUrl?: string;
		modelName: string;
		systemPrompt: string;
		temperature: number;
		maxTokens: number;
		enabled: boolean;
	}>({
		botToken: '',
		chatId: '',
		webhookUrl: undefined,
		modelName: 'gpt-4o',
		systemPrompt: '',
		temperature: 0.7,
		maxTokens: 4096,
		enabled: true
	});

	let isConfigLoaded = $state(false);
	let showConfig = $state(true);
	let isSaving = $state(false);
	let showWebhookHelp = $state(false);
	let customWebhookUrl = $state('');
	let hasTokenInDb = $state(false);
	let actualBotToken = $state(''); // Keep actual token for API calls (not shown in UI)

	// Initialize customWebhookUrl from config.webhookUrl
	$effect(() => {
		if (config.webhookUrl && !customWebhookUrl) {
			customWebhookUrl = config.webhookUrl;
		}
	});

	// Sync actualBotToken when user types in the input
	$effect(() => {
		if (config.botToken) {
			actualBotToken = config.botToken;
		}
	});

	// Model selection state
	let selectedModelId = $state('gpt-4o');

	// Get available models based on AI settings provider
	let availableModels = $derived(
		aiSettings
			? PREDEFINED_MODELS[aiSettings.provider as keyof typeof PREDEFINED_MODELS] ||
					PREDEFINED_MODELS.openai
			: PREDEFINED_MODELS.openai
	);

	// Default to first available model or configured model
	$effect(() => {
		if (availableModels.length > 0 && !availableModels.some((m) => m.id === selectedModelId)) {
			selectedModelId = availableModels[0].id;
		}
	});

	// Initialize selectedModelId based on config.modelName
	$effect(() => {
		if (config.modelName && availableModels.some((m) => m.id === config.modelName)) {
			selectedModelId = config.modelName;
		}
	});

	// Chat state
	let sessions = $state<TelegramSession[]>([]);
	let messages = $state<TelegramMessage[]>([]);
	let selectedSessionId = $state<string | null>(null);
	let isLoading = $state(false);

	async function loadAiSettings() {
		try {
			const res = await fetch('/api/ai/settings');
			if (res.ok) {
				const data = await res.json();
				aiSettings = {
					provider: data.settings?.provider || 'openai',
					modelName: data.settings?.modelName || 'gpt-4o'
				};
				// Update default model if not set
				if (!config.modelName || config.modelName === 'gpt-4o') {
					config.modelName = aiSettings.modelName;
				}
			}
		} catch (error) {
			console.error('Error loading AI settings:', error);
		}
	}

	async function loadConfig() {
		try {
			const res = await fetch('/api/ai/telegram');
			if (res.ok) {
				const data = await res.json();
				if (data.settings) {
					const isTokenMasked = data.settings.botToken?.includes('...');
					hasTokenInDb = isTokenMasked || !!data.settings.botToken;

					// Store actual token if not masked (for API calls)
					if (!isTokenMasked && data.settings.botToken) {
						actualBotToken = data.settings.botToken;
					}

					config = {
						// Don't overwrite input with masked token; keep user's input or show placeholder
						botToken: isTokenMasked ? '' : data.settings.botToken || '',
						chatId: data.settings.chatId || '',
						webhookUrl: data.settings.webhookUrl || undefined,
						modelName: data.settings.modelName || aiSettings?.modelName || 'gpt-4o',
						systemPrompt: data.settings.systemPrompt || '',
						temperature: data.settings.temperature || 0.7,
						maxTokens: data.settings.maxTokens || 4096,
						enabled: data.settings.enabled ?? true
					};
				}
			}
			isConfigLoaded = true;
		} catch (error) {
			console.error('Error loading config:', error);
			toast.error('Failed to load Telegram configuration');
		}
	}

	async function saveConfig() {
		isSaving = true;

		if (!selectedModelId) {
			toast.error('Please select a model');
			isSaving = false;
			return;
		}

		try {
			// Only include botToken if user has entered something
			const saveData: Record<string, unknown> = {
				chatId: config.chatId,
				modelName: selectedModelId,
				systemPrompt: config.systemPrompt,
				temperature: config.temperature,
				maxTokens: config.maxTokens,
				enabled: config.enabled
			};

			// Use actualBotToken (from input or previously saved)
			const tokenToSave = config.botToken || actualBotToken;
			if (tokenToSave) {
				saveData.botToken = tokenToSave;
			}

			// Only include webhookUrl if it's set
			if (customWebhookUrl) {
				saveData.webhookUrl = customWebhookUrl;
				config.webhookUrl = customWebhookUrl;
			} else if (config.webhookUrl) {
				saveData.webhookUrl = config.webhookUrl;
			}

			const res = await fetch('/api/ai/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(saveData)
			});

			if (res.ok) {
				config.modelName = selectedModelId;
				// Update hasTokenInDb flag if token was saved
				if (config.botToken) {
					hasTokenInDb = true;
				}
				toast.success('Telegram configuration saved successfully');
				await loadSessions();
			} else {
				const error = await res.json();
				toast.error(error.error || 'Failed to save configuration');
			}
		} catch (error) {
			console.error('Error saving config:', error);
			toast.error('Failed to save Telegram configuration');
		} finally {
			isSaving = false;
		}
	}

	async function deleteConfig() {
		if (!confirm('Are you sure you want to delete your Telegram configuration?')) {
			return;
		}

		try {
			const res = await fetch('/api/ai/telegram', {
				method: 'DELETE'
			});

			if (res.ok) {
				config = {
					botToken: '',
					chatId: '',
					modelName: aiSettings?.modelName || 'gpt-4o',
					systemPrompt: '',
					temperature: 0.7,
					maxTokens: 4096,
					enabled: true
				};
				toast.success('Telegram configuration deleted');
				sessions = [];
				messages = [];
			}
		} catch (error) {
			console.error('Error deleting config:', error);
			toast.error('Failed to delete configuration');
		}
	}

	async function loadSessions() {
		if (!config.botToken || !config.chatId) {
			sessions = [];
			return;
		}

		isLoading = true;
		try {
			const res = await fetch(`/api/ai/telegram/sessions`);
			if (res.ok) {
				const data = await res.json();
				sessions = data.sessions || [];
			}
		} catch (error) {
			console.error('Error loading sessions:', error);
			toast.error('Failed to load Telegram sessions');
		} finally {
			isLoading = false;
		}
	}

	async function loadMessages(sessionId: string) {
		selectedSessionId = sessionId;
		isLoading = true;
		try {
			const res = await fetch(`/api/ai/telegram/sessions/${sessionId}/messages`);
			if (res.ok) {
				const data = await res.json();
				messages = data.messages || [];
			}
		} catch (error) {
			console.error('Error loading messages:', error);
			toast.error('Failed to load messages');
		} finally {
			isLoading = false;
		}
	}

	async function fetchChatIdFromBot() {
		const tokenToUse = config.botToken || actualBotToken;
		if (!tokenToUse) {
			toast.error('Please enter your bot token first');
			return;
		}

		isLoading = true;
		let webhookWasActive = false;
		let originalWebhookUrl = '';

		try {
			// Check if webhook is active
			const webhookInfoUrl = `https://api.telegram.org/bot${tokenToUse}/getWebhookInfo`;
			const webhookResponse = await fetch(webhookInfoUrl);
			const webhookData = await webhookResponse.json();

			if (webhookData.ok && webhookData.result?.url) {
				webhookWasActive = true;
				originalWebhookUrl = webhookData.result.url;

				// Delete webhook temporarily to use getUpdates
				await fetch(`https://api.telegram.org/bot${tokenToUse}/deleteWebhook`, {
					method: 'POST'
				});
			}

			// Call Telegram API to get updates
			const url = `https://api.telegram.org/bot${tokenToUse}/getUpdates`;
			const response = await fetch(url);
			const data = await response.json();

			if (data.ok && data.result && data.result.length > 0) {
				// Get the most recent message's chat ID
				const lastUpdate = data.result[data.result.length - 1];
				const chatId = lastUpdate.message?.chat?.id || lastUpdate.edited_message?.chat?.id;

				if (chatId) {
					config.chatId = chatId.toString();
					toast.success(`Chat ID found: ${chatId}`);
				} else {
					toast.error('No messages found. Send a message to your bot first, then try again.');
				}
			} else {
				toast.error('No messages found. Send a message to your bot first, then try again.');
			}
		} catch (error) {
			console.error('Error fetching chat ID:', error);
			toast.error('Failed to fetch chat ID. Make sure your bot token is correct.');
		} finally {
			// Restore webhook if it was active
			if (webhookWasActive && originalWebhookUrl) {
				try {
					await fetch(`https://api.telegram.org/bot${tokenToUse}/setWebhook`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: originalWebhookUrl })
					});
				} catch (e) {
					console.error('Error restoring webhook:', e);
					toast.warning('Webhook was removed. Please click "Setup Webhook" to restore it.');
				}
			}
			isLoading = false;
		}
	}

	async function setupWebhook() {
		const tokenToUse = config.botToken || actualBotToken;
		if (!tokenToUse) {
			toast.error('Please enter your bot token first');
			return;
		}

		isLoading = true;
		try {
			const res = await fetch('/api/ai/telegram/setup-webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					botToken: tokenToUse,
					customWebhookUrl: customWebhookUrl || undefined
				})
			});

			const data = await res.json();

			if (res.ok && data.success) {
				config.webhookUrl = data.webhookUrl;
				customWebhookUrl = data.webhookUrl;
				toast.success(`Webhook connected! ${data.message}`);
			} else if (data.needsHttps) {
				showWebhookHelp = true;
				toast.error(data.error || 'Telegram requires HTTPS');
			} else {
				toast.error(data.error || 'Failed to set up webhook');
			}
		} catch (error) {
			console.error('Error setting up webhook:', error);
			toast.error('Failed to set up webhook');
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadAiSettings();
		loadConfig();
	});
</script>

<div class="flex h-full flex-col overflow-hidden">
	<div class="mb-4 flex h-full w-full flex-col overflow-hidden md:pr-4" in:fade={{ duration: 500 }}>
		<div
			class="flex h-full min-h-[90svh] overflow-hidden md:rounded-2xl md:border md:border-border/70"
		>
			<aside
				class="w-96 flex-col border-r border-border/60 bg-muted/20 md:flex {showConfig
					? 'flex'
					: 'hidden md:flex'}"
			>
				<div class="flex h-full flex-col gap-4 p-4">
					<div
						class="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/80 pb-3 backdrop-blur"
					>
						<h2 class="text-muted-foreground text-xs font-bold tracking-wider uppercase">
							Telegram Configuration
						</h2>
						<button
							class="focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 transition hover:bg-muted/30"
							onclick={() => (showConfig = !showConfig)}
							aria-label="Toggle configuration"
						>
							<Settings class="h-4 w-4" />
						</button>
					</div>

					<div class="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
						<div class="space-y-3">
							<div class="space-y-1">
								<label for="botToken" class="text-muted-foreground text-xs font-semibold">
									Bot Token
									{#if hasTokenInDb && !config.botToken}
										<span
											class="ml-2 rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-600 dark:text-green-400"
											>Saved</span
										>
									{/if}
								</label>
								<div class="flex gap-2">
									<input
										id="botToken"
										type="text"
										bind:value={config.botToken}
										placeholder={hasTokenInDb
											? 'Token saved - enter new token to change'
											: 'Enter your Telegram bot token'}
										class="focus-visible:ring-ring flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									/>
									<button
										onclick={setupWebhook}
										disabled={isLoading || (!config.botToken && !hasTokenInDb)}
										class="focus-visible:ring-ring flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
										title="Set webhook to connect your bot"
									>
										<Settings class="h-4 w-4" />
									</button>
								</div>
								<p class="text-muted-foreground text-[10px]">
									{#if hasTokenInDb && !config.botToken}
										Token is saved securely. Enter a new token above to replace it.
									{:else}
										Click the settings icon to set up your bot's webhook after saving your token.
									{/if}
								</p>
							</div>

							<div class="space-y-1">
								<label for="chatId" class="text-muted-foreground text-xs font-semibold">
									Chat ID
								</label>
								<div class="flex gap-2">
									<input
										id="chatId"
										type="text"
										bind:value={config.chatId}
										placeholder="Enter your Telegram chat ID"
										class="focus-visible:ring-ring flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									/>
									<button
										onclick={fetchChatIdFromBot}
										disabled={isLoading || !config.botToken}
										class="focus-visible:ring-ring flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
										title="Fetch chat ID from bot - send a message to your bot first"
									>
										<RefreshCw class="h-4 w-4" />
									</button>
								</div>
								<p class="text-muted-foreground text-[10px]">
									Send a message to your bot, then click the refresh button to auto-fetch your chat
									ID.
								</p>
							</div>

							<div class="space-y-1">
								<label for="webhookUrl" class="text-muted-foreground text-xs font-semibold">
									Webhook URL
									{#if config.webhookUrl}
										<span
											class="ml-2 rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-600 dark:text-green-400"
											>Connected</span
										>
									{/if}
								</label>
								<div class="flex gap-2">
									<input
										id="webhookUrl"
										type="text"
										bind:value={customWebhookUrl}
										placeholder="https://your-url.ngrok.io/api/ai/telegram/webhook"
										class="focus-visible:ring-ring flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									/>
								</div>
								<p class="text-muted-foreground text-[10px]">
									{#if config.webhookUrl}
										Webhook is set. Enter a new URL to update it.
									{:else}
										Full URL including path: <code class="rounded bg-background/50 px-1"
											>/api/ai/telegram/webhook</code
										>
									{/if}
								</p>
							</div>

							{#if showWebhookHelp}
								<div class="space-y-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3">
									<p class="text-xs font-semibold text-amber-700 dark:text-amber-300">
										⚠️ HTTPS Required for Webhook
									</p>
									<p class="text-[10px] text-amber-600 dark:text-amber-400">
										Telegram requires HTTPS URLs. For local development, use one of these options:
									</p>
									<div class="space-y-1 text-[10px]">
										<p class="font-medium">Option 1: Use ngrok (recommended)</p>
										<ol
											class="list-inside list-decimal space-y-1 pl-2 text-amber-600 dark:text-amber-400"
										>
											<li>
												Install ngrok: <code class="rounded bg-background/50 px-1"
													>brew install ngrok</code
												>
											</li>
											<li>
												Run: <code class="rounded bg-background/50 px-1">ngrok http 5173</code>
											</li>
											<li>Copy the HTTPS URL (e.g., https://xyz.ngrok.io)</li>
											<li>Paste below and click webhook setup again</li>
										</ol>
									</div>
									<div class="space-y-1">
										<label class="text-xs font-medium">Custom HTTPS Webhook URL</label>
										<input
											type="text"
											bind:value={customWebhookUrl}
											placeholder="https://your-ngrok-url.ngrok.io/api/ai/telegram/webhook"
											class="focus-visible:ring-ring w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
										/>
									</div>
								</div>
							{/if}

							<div class="space-y-1">
								<label for="modelName" class="text-muted-foreground text-xs font-semibold">
									Model
									{#if aiSettings?.modelName && config.modelName === aiSettings.modelName}
										<span class="text-muted-foreground/70 text-xs">(default from settings)</span>
									{/if}
								</label>
								<select
									id="modelName"
									bind:value={selectedModelId}
									class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								>
									{#each availableModels as m (m.id)}
										<option value={m.id}>{m.name}</option>
									{/each}
								</select>
							</div>

							<div class="space-y-1">
								<label for="systemPrompt" class="text-muted-foreground text-xs font-semibold">
									System Prompt
								</label>
								<textarea
									id="systemPrompt"
									bind:value={config.systemPrompt}
									placeholder="Custom system prompt for your Telegram bot..."
									rows="4"
									class="focus-visible:ring-ring w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								></textarea>
							</div>

							<div class="flex gap-2">
								<div class="flex-1 space-y-1">
									<label for="temperature" class="text-muted-foreground text-xs font-semibold">
										Temperature
									</label>
									<input
										id="temperature"
										type="number"
										step="0.1"
										min="0"
										max="2"
										bind:value={config.temperature}
										class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									/>
								</div>
								<div class="flex-1 space-y-1">
									<label for="maxTokens" class="text-muted-foreground text-xs font-semibold">
										Max Tokens
									</label>
									<input
										id="maxTokens"
										type="number"
										min="1"
										bind:value={config.maxTokens}
										class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									/>
								</div>
							</div>

							<div class="flex items-center gap-2">
								<input
									id="enabled"
									type="checkbox"
									bind:checked={config.enabled}
									class="focus-visible:ring-ring h-4 w-4 rounded border-border/60"
								/>
								<label for="enabled" class="text-sm font-medium text-foreground">
									Enable Telegram bot
								</label>
							</div>
						</div>

						<div class="flex gap-2 border-t border-border/60 pt-2">
							<button
								class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={saveConfig}
								disabled={isSaving ||
									(!config.botToken && !actualBotToken && !hasTokenInDb) ||
									!config.chatId}
							>
								{#if isSaving}
									<LoaderCircle class="h-4 w-4 animate-spin" />
								{:else}
									<Save class="h-4 w-4" />
								{/if}
								{isSaving ? 'Saving...' : 'Save'}
							</button>
							<button
								class="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={deleteConfig}
								disabled={isSaving || !config.botToken}
							>
								<Trash2 class="h-4 w-4" />
								Delete
							</button>
						</div>
					</div>
				</div>
			</aside>

			<section
				class="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background md:bg-transparent"
				role="main"
			>
				<header
					class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background px-4 py-3 md:px-6"
				>
					<div class="flex items-center gap-3">
						<Send class="text-muted-foreground h-5 w-5" />
						<span class="text-sm font-semibold">Telegram Conversations</span>
					</div>
					<div class="text-muted-foreground text-xs">
						{config.enabled && config.botToken && config.chatId
							? 'Bot active'
							: 'Configure bot to start'}
					</div>
				</header>

				<div
					class="flex-1 overflow-y-auto scroll-smooth px-4 py-6 md:px-6 md:py-8"
					role="log"
					aria-live="polite"
					aria-label="Telegram messages"
				>
					<div class="mx-auto w-full max-w-4xl min-w-0 space-y-6">
						{#if !config.botToken || !config.chatId}
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
								<div class="rounded-full border border-border/60 bg-muted/30 p-4">
									<Settings class="text-muted-foreground h-8 w-8" />
								</div>
								<div class="space-y-2">
									<p class="text-xl font-semibold">Configure Your Telegram Bot</p>
									<p class="text-muted-foreground max-w-md text-sm">
										Enter your Telegram bot token and chat ID to start conversing with the AI via
										Telegram.
									</p>
								</div>
								<div
									class="text-muted-foreground grid w-full max-w-2xl grid-cols-1 gap-3 text-left text-sm"
								>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="mb-1 font-semibold">1. Create a Bot</p>
										<p class="text-xs">
											Message <span class="font-mono">@BotFather</span> on Telegram with
											<code class="rounded bg-background/50 px-1">/newbot</code> to create a new bot.
											Copy the bot token provided.
										</p>
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="mb-1 font-semibold">2. Set Up Webhook (HTTPS Required)</p>
										<p class="text-xs">
											Paste the token and click the <span class="font-medium">settings icon</span>
											⚙️.
											<span class="text-amber-600 dark:text-amber-400">Telegram requires HTTPS</span
											>
											- if developing locally, use ngrok:
											<code class="rounded bg-background/50 px-1">ngrok http 5173</code>
											then paste the HTTPS URL in the custom webhook field that appears.
										</p>
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="mb-1 font-semibold">3. Get Your Chat ID</p>
										<p class="text-xs">
											Open your bot in Telegram and send <span class="font-medium">any message</span
											>
											(like "start"). Then click the <span class="font-medium">refresh button</span> to
											auto-fetch your chat ID.
										</p>
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="mb-1 font-semibold">4. Save & Start Chatting</p>
										<p class="text-xs">
											Click <span class="font-medium">Save</span> to save your configuration. Your bot
											is now ready to chat with AI! Just message it anytime.
										</p>
									</div>
								</div>
							</div>
						{:else if sessions.length === 0}
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
								<div class="rounded-full border border-border/60 bg-muted/30 p-4">
									<MessageSquare class="text-muted-foreground h-8 w-8" />
								</div>
								<div class="space-y-2">
									<p class="text-xl font-semibold">No Conversations Yet</p>
									<p class="text-muted-foreground max-w-md text-sm">
										Send a message to your Telegram bot to start a conversation.
									</p>
								</div>
							</div>
						{:else}
							<div class="flex flex-col gap-4">
								{#each sessions as session (session.id)}
									<button
										class="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-left transition hover:bg-muted/30"
										onclick={() => loadMessages(session.id)}
									>
										<div class="font-semibold">{session.title}</div>
										<div class="text-muted-foreground text-xs">
											{new Date(session.updatedAt).toLocaleString()}
										</div>
									</button>
								{/each}
							</div>
						{/if}

						{#if isLoading}
							<div class="flex items-center justify-center py-8" in:fade>
								<div
									class="text-muted-foreground flex animate-pulse items-center gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm font-bold tracking-wide uppercase shadow-sm"
								>
									<LoaderCircle class="h-4 w-4 animate-spin" />
									Loading
								</div>
							</div>
						{/if}
					</div>
				</div>
			</section>
		</div>
	</div>
</div>

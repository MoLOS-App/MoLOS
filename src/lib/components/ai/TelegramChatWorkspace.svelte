<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		Send,
		MessageSquare,
		Settings,
		LoaderCircle,
		Check,
		Save,
		Trash2,
		RefreshCw,
		X,
		Eye,
		EyeOff,
		Key,
		Webhook,
		MessageCircle,
		Sliders,
		Shield,
		Server,
		Info
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
		connectionMode: 'webhook' | 'polling';
		pollingInterval: number;
		modelName: string;
		systemPrompt: string;
		temperature: number;
		maxTokens: number;
		enabled: boolean;
	}>({
		botToken: '',
		chatId: '',
		webhookUrl: undefined,
		connectionMode: 'webhook',
		pollingInterval: 2000,
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
	let showBotToken = $state(false);

	// Bot token update state

	// Chat ID fetch tutorial state
	let isFetchingChatId = $state(false);
	let chatIdFetchCountdown = $state(0);
	let chatIdFetchStep = $state(0); // 0: idle, 1: preparing, 2: waiting_message, 3: success, 4: error
	let abortChatIdFetch = $state(false);

	// Polling state
	let isPolling = $state(false);

	// Polling interval in seconds for the input
	let pollingIntervalSeconds = $derived(config.pollingInterval / 1000);
	let setPollingIntervalSeconds = (seconds: number) => {
		config.pollingInterval = Math.max(1000, Math.min(60000, seconds * 1000));
	};

	// Initialize customWebhookUrl from config.webhookUrl
	$effect(() => {
		if (config.webhookUrl && !customWebhookUrl) {
			customWebhookUrl = config.webhookUrl;
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
	let selectedSessionSummary = $state<{
		session: TelegramSession;
		messageCount: number;
		lastMessage?: string;
	} | null>(null);
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
					config = {
						botToken: data.settings.botToken || '',
						chatId: data.settings.chatId || '',
						webhookUrl: data.settings.webhookUrl || undefined,
						connectionMode: data.settings.connectionMode || 'webhook',
						pollingInterval: data.settings.pollingInterval || 2000,
						modelName: data.settings.modelName || aiSettings?.modelName || 'gpt-4o',
						systemPrompt: data.settings.systemPrompt || '',
						temperature: data.settings.temperature || 0.7,
						maxTokens: data.settings.maxTokens || 4096,
						enabled: data.settings.enabled ?? true
					};
					if (data.settings.webhookUrl) {
						customWebhookUrl = data.settings.webhookUrl;
					}
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
			const saveData: Record<string, unknown> = {
				chatId: config.chatId,
				connectionMode: config.connectionMode,
				pollingInterval: config.pollingInterval,
				modelName: selectedModelId,
				systemPrompt: config.systemPrompt,
				temperature: config.temperature,
				maxTokens: config.maxTokens,
				enabled: config.enabled
			};

			// Always include botToken (even if empty to allow clearing)
			saveData.botToken = config.botToken;

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
					webhookUrl: undefined,
					connectionMode: 'webhook',
					pollingInterval: 2000,
					modelName: aiSettings?.modelName || 'gpt-4o',
					systemPrompt: '',
					temperature: 0.7,
					maxTokens: 4096,
					enabled: true
				};
				customWebhookUrl = '';
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

	async function loadSessionSummary(sessionId: string) {
		selectedSessionId = sessionId;
		isLoading = true;
		try {
			const res = await fetch(`/api/ai/telegram/sessions/${sessionId}/summary`);
			if (res.ok) {
				const data = await res.json();
				selectedSessionSummary = data;
			}
		} catch (error) {
			console.error('Error loading session summary:', error);
			toast.error('Failed to load session summary');
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
		if (!config.botToken) {
			toast.error('Please enter your bot token first');
			return;
		}

		abortChatIdFetch = false;
		isFetchingChatId = true;
		chatIdFetchStep = 1;
		chatIdFetchCountdown = 0;

		let webhookWasActive = false;
		let originalWebhookUrl = '';

		try {
			// Step 1: Check if webhook is active
			const webhookInfoUrl = `https://api.telegram.org/bot${config.botToken}/getWebhookInfo`;
			const webhookResponse = await fetch(webhookInfoUrl);
			const webhookData = await webhookResponse.json();

			if (webhookData.ok && webhookData.result?.url) {
				webhookWasActive = true;
				originalWebhookUrl = webhookData.result.url;

				// Delete webhook temporarily to use getUpdates
				await fetch(`https://api.telegram.org/bot${config.botToken}/deleteWebhook`, {
					method: 'POST'
				});
			}

			// Step 2: Poll for updates
			const maxAttempts = 12;
			const delayBetweenAttempts = 2500;
			let chatId: string | null = null;

			chatIdFetchStep = 2;
			chatIdFetchCountdown = maxAttempts * delayBetweenAttempts;

			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				if (abortChatIdFetch) {
					break;
				}

				chatIdFetchCountdown = (maxAttempts - attempt + 1) * delayBetweenAttempts;

				const url = `https://api.telegram.org/bot${config.botToken}/getUpdates`;
				const response = await fetch(url);
				const data = await response.json();

				if (data.ok && data.result && data.result.length > 0) {
					const lastUpdate = data.result[data.result.length - 1];
					const extractedChatId =
						lastUpdate.message?.chat?.id || lastUpdate.edited_message?.chat?.id;

					if (extractedChatId) {
						chatId = extractedChatId.toString();
						break;
					}
				}

				if (attempt < maxAttempts && !abortChatIdFetch) {
					await new Promise((resolve) => setTimeout(resolve, delayBetweenAttempts));
				}
			}

			if (abortChatIdFetch) {
				return;
			}

			if (chatId) {
				config.chatId = chatId;
				chatIdFetchStep = 3;
				toast.success(`Chat ID found: ${chatId}`);
			} else {
				chatIdFetchStep = 4;
				toast.error('No messages found. Please try again and make sure to send a message to your bot.');
			}
		} catch (error) {
			console.error('Error fetching chat ID:', error);
			chatIdFetchStep = 4;
			toast.error('Failed to fetch chat ID. Make sure your bot token is correct.');
		} finally {
			// Restore webhook if it was active
			if (webhookWasActive && originalWebhookUrl) {
				try {
					await fetch(`https://api.telegram.org/bot${config.botToken}/setWebhook`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ url: originalWebhookUrl })
					});
				} catch (e) {
					console.error('Error restoring webhook:', e);
					toast.warning('Webhook was removed. Please click "Setup Webhook" to restore it.');
				}
			}
			if (chatIdFetchStep === 3 || chatIdFetchStep === 4) {
				setTimeout(() => {
					isFetchingChatId = false;
					chatIdFetchStep = 0;
				}, 5000);
			}
		}
	}

	function cancelChatIdFetch() {
		abortChatIdFetch = true;
		isFetchingChatId = false;
		chatIdFetchStep = 0;
		chatIdFetchCountdown = 0;
	}

	async function setupWebhook() {
		if (!config.botToken) {
			toast.error('Please enter your bot token first');
			return;
		}

		isLoading = true;
		try {
			const res = await fetch('/api/ai/telegram/setup-webhook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					botToken: config.botToken,
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

	async function setConnectionMode(mode: 'webhook' | 'polling') {
		if (!config.botToken) {
			toast.error('Please enter your bot token first');
			return;
		}

		config.connectionMode = mode;

		try {
			const res = await fetch('/api/ai/telegram/set-mode', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					botToken: config.botToken,
					mode,
					webhookUrl: config.webhookUrl,
					pollingInterval: config.pollingInterval
				})
			});

			const data = await res.json();

			if (res.ok) {
				if (mode === 'polling') {
					isPolling = true;
					toast.success(`Polling mode enabled. Checking for messages every ${config.pollingInterval / 1000}s.`);
				} else {
					isPolling = false;
					if (data.webhookSet) {
						toast.success('Webhook mode enabled.');
					} else {
						toast.info('Webhook mode selected. Click Setup Webhook to configure.');
					}
				}
			} else {
				toast.error(data.error || 'Failed to switch mode');
				config.connectionMode = mode === 'polling' ? 'webhook' : 'polling';
			}
		} catch (error) {
			console.error('Error switching connection mode:', error);
			toast.error('Failed to switch mode');
			config.connectionMode = mode === 'polling' ? 'webhook' : 'polling';
		}
	}

	async function checkPollingStatus() {
		try {
			const res = await fetch('/api/ai/telegram/polling-status');
			if (res.ok) {
				const data = await res.json();
				isPolling = data.isPolling || false;
			}
		} catch (error) {
			console.error('Error checking polling status:', error);
		}
	}

	onMount(() => {
		loadAiSettings();
		loadConfig();
		checkPollingStatus();
	});
</script>

<div class="flex flex-col h-full overflow-hidden">
	<div class="flex flex-col w-full h-full mb-4 overflow-hidden md:pr-4" in:fade={{ duration: 500 }}>
		<div class="flex h-full min-h-[90svh] overflow-hidden md:rounded-2xl md:border md:border-border/70">
			<!-- Configuration Sidebar -->
			<aside
				class="w-[480px] flex-col border-r border-border/60 bg-muted/10 md:flex {showConfig
					? 'flex'
					: 'hidden md:flex'}"
			>
				<div class="flex flex-col h-full">
					<!-- Header -->
					<div
						class="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background/95 backdrop-blur"
					>
						<div class="flex items-center gap-3">
							<div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
								<Settings class="w-5 h-5 text-primary" />
							</div>
							<div>
								<h2 class="text-sm font-bold tracking-wide">Telegram Configuration</h2>
								<p class="text-xs text-muted-foreground">Configure your AI bot</p>
							</div>
						</div>
						<button
							class="flex items-center justify-center transition border rounded-lg border-border/60 h-9 w-9 bg-background hover:bg-muted/50"
							onclick={() => (showConfig = !showConfig)}
							aria-label="Toggle configuration"
							title="Toggle panel"
						>
							<X class="w-4 h-4" />
						</button>
					</div>

					<!-- Scrollable Content -->
					<div class="flex-1 overflow-y-auto">
						<div class="p-6 space-y-8">
							<!-- Bot Authentication Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 pb-2 border-b border-border/40">
									<Key class="w-4 h-4 text-primary" />
									<h3 class="text-sm font-semibold">Bot Authentication</h3>
								</div>

								<!-- Bot Token -->
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<label class="text-xs font-semibold text-muted-foreground">Bot Token</label>
										{#if config.botToken}
											<span
												class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/20 text-green-700 dark:text-green-400"
												>Active</span
											>
										{/if}
									</div>
									<div class="flex gap-2">
										<input
											type={showBotToken ? 'text' : 'password'}
											bind:value={config.botToken}
											placeholder="Paste your bot token from @BotFather"
											class="flex-1 px-3 py-2.5 text-sm border rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
										/>
										<button
											onclick={() => (showBotToken = !showBotToken)}
											class="flex items-center justify-center px-3 transition text-muted-foreground hover:text-foreground"
											aria-label={showBotToken ? 'Hide token' : 'Show token'}
										>
											{#if showBotToken}
												<EyeOff class="w-4 h-4" />
											{:else}
												<Eye class="w-4 h-4" />
											{/if}
										</button>
									</div>
								</div>

								<!-- Chat ID -->
								<div class="space-y-2">
									<label for="chatId" class="text-xs font-semibold text-muted-foreground"
										>Chat ID</label
									>
									<div class="flex gap-2">
										<input
											id="chatId"
											type="text"
											bind:value={config.chatId}
											placeholder="Enter your Telegram chat ID"
											class="flex-1 px-3 py-2.5 text-sm border rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
										/>
										<button
											onclick={fetchChatIdFromBot}
											disabled={isLoading || !config.botToken}
											class="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition border rounded-xl border-border/60 bg-muted/30 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
											title="Auto-fetch chat ID"
										>
											<RefreshCw class="w-4 h-4" />
											Auto-detect
										</button>
									</div>
									<p class="text-[10px] text-muted-foreground">
										Send a message to your bot, then click "Auto-detect" to find your chat ID
									</p>
								</div>
							</section>

							<!-- Connection Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 pb-2 border-b border-border/40">
									<Server class="w-4 h-4 text-primary" />
									<h3 class="text-sm font-semibold">Connection Mode</h3>
									{#if isPolling}
										<span
											class="ml-auto px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse"
											>Polling Active</span
										>
									{:else if config.webhookUrl}
										<span
											class="ml-auto px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/20 text-green-600 dark:text-green-400"
											>Webhook Active</span
										>
									{/if}
								</div>

								<!-- Mode Selection -->
								<div class="grid grid-cols-2 gap-3">
									<button
										onclick={() => setConnectionMode('webhook')}
										disabled={isLoading || !config.botToken}
										class="flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition {config.connectionMode
											=== 'webhook'
											? 'border-primary bg-primary/5'
											: 'border-border/60 bg-background hover:bg-muted/30'} disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Webhook class="w-6 h-6" />
										<div class="text-center">
											<div class="text-sm font-semibold">Webhook</div>
											<div class="text-[10px] text-muted-foreground">Instant delivery</div>
										</div>
									</button>
									<button
										onclick={() => setConnectionMode('polling')}
										disabled={isLoading || !config.botToken}
										class="flex flex-col items-center gap-2 p-4 border-2 rounded-xl transition {config.connectionMode
											=== 'polling'
											? 'border-primary bg-primary/5'
											: 'border-border/60 bg-background hover:bg-muted/30'} disabled:cursor-not-allowed disabled:opacity-50"
									>
										<MessageCircle class="w-6 h-6" />
										<div class="text-center">
											<div class="text-sm font-semibold">Polling</div>
											<div class="text-[10px] text-muted-foreground">Checks every 2s</div>
										</div>
									</button>
								</div>

								{#if config.connectionMode === 'webhook'}
									<!-- Webhook Configuration -->
									<div class="space-y-2">
										<label class="text-xs font-semibold">Webhook URL</label>
										<input
											type="text"
											bind:value={customWebhookUrl}
											placeholder="https://your-url.ngrok.io/api/ai/telegram/webhook"
											class="w-full px-3 py-2.5 text-sm border rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
										/>
										<button
											onclick={setupWebhook}
											disabled={isLoading || !config.botToken}
											class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition rounded-xl bg-primary/10 text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<Webhook class="w-4 h-4" />
											Setup Webhook
										</button>
									</div>
								{:else}
									<!-- Polling Configuration -->
									<div class="space-y-2">
										<label class="text-xs font-semibold">Polling Interval</label>
										<div class="flex items-center gap-3">
											<input
												type="number"
												min="1"
												max="60"
												step="1"
												value={pollingIntervalSeconds}
												oninput={(e) => setPollingIntervalSeconds(Number(e.currentTarget.value))}
												placeholder="2"
												class="w-20 px-3 py-2.5 text-sm text-center border rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
											/>
											<span class="text-sm text-muted-foreground">seconds</span>
										</div>
										<p class="text-[10px] text-muted-foreground">
											Lower values check more often but use more resources (1-60 seconds)
										</p>
									</div>
								{/if}
							</section>

							<!-- AI Behavior Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 pb-2 border-b border-border/40">
									<Sliders class="w-4 h-4 text-primary" />
									<h3 class="text-sm font-semibold">AI Behavior</h3>
								</div>

								<!-- Model Selection -->
								<div class="space-y-2">
									<label for="modelName" class="text-xs font-semibold text-muted-foreground"
										>AI Model</label
									>
									<select
										id="modelName"
										bind:value={selectedModelId}
										class="w-full px-3 py-2.5 text-sm border rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
									>
										{#each availableModels as m (m.id)}
											<option value={m.id}>{m.name}</option>
										{/each}
									</select>
								</div>

								<!-- System Prompt -->
								<div class="space-y-2">
									<label for="systemPrompt" class="text-xs font-semibold text-muted-foreground"
										>System Prompt</label
									>
									<textarea
										id="systemPrompt"
										bind:value={config.systemPrompt}
										placeholder="Define how your AI assistant should behave..."
										rows="3"
										class="w-full px-3 py-2.5 text-sm border resize-none rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
									></textarea>
								</div>

								<!-- Temperature & Max Tokens -->
								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<label for="temperature" class="text-xs font-semibold text-muted-foreground"
											>Temperature</label
										>
										<input
											id="temperature"
											type="number"
											step="0.1"
											min="0"
											max="2"
											bind:value={config.temperature}
											class="w-full px-3 py-2.5 text-sm border rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
										/>
										<p class="text-[10px] text-muted-foreground">0 = focused, 2 = creative</p>
									</div>
									<div class="space-y-2">
										<label for="maxTokens" class="text-xs font-semibold text-muted-foreground"
											>Max Tokens</label
										>
										<input
											id="maxTokens"
											type="number"
											min="1"
											bind:value={config.maxTokens}
											class="w-full px-3 py-2.5 text-sm border rounded-xl border-border/60 bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
										/>
										<p class="text-[10px] text-muted-foreground">Max response length</p>
									</div>
								</div>
							</section>

							<!-- Status Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 pb-2 border-b border-border/40">
									<Shield class="w-4 h-4 text-primary" />
									<h3 class="text-sm font-semibold">Status</h3>
								</div>

								<div class="flex items-center gap-3">
									<input
										id="enabled"
										type="checkbox"
										bind:checked={config.enabled}
										class="w-5 h-5 rounded focus-visible:ring-2 focus-visible:ring-ring border-border/60"
									/>
									<label for="enabled" class="flex-1 text-sm font-medium cursor-pointer">
										Enable Telegram Bot
									</label>
									{#if config.enabled}
										<span
											class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-600 dark:text-green-400"
											>Active</span
										>
									{:else}
										<span
											class="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground"
											>Disabled</span
										>
									{/if}
								</div>
							</section>

							<!-- HTTPS Help Warning -->
							{#if showWebhookHelp}
								<div class="flex items-start gap-3 p-3 border rounded-xl border-amber-500/50 bg-amber-500/10">
									<Info class="flex-shrink-0 w-5 h-5 text-amber-600 dark:text-amber-400" />
									<div class="flex-1 text-xs">
										<p class="mb-1 font-semibold text-amber-700 dark:text-amber-300">
											HTTPS Required
										</p>
										<p class="text-amber-600 dark:text-amber-400">
											Telegram requires HTTPS. For local dev, use ngrok:
											<code class="px-1 rounded bg-background/50">ngrok http 5173</code>
										</p>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Footer Actions -->
					<div class="p-4 border-t border-border/60 bg-background/95 backdrop-blur">
						<div class="grid grid-cols-2 gap-3">
							<button
								class="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-semibold transition rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={saveConfig}
								disabled={isSaving}
							>
								{#if isSaving}
									<LoaderCircle class="w-4 h-4 animate-spin" />
								{:else}
									<Save class="w-4 h-4" />
								{/if}
								Save All
							</button>
							<button
								class="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition border rounded-xl border-border/60 bg-background text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={deleteConfig}
								disabled={isSaving}
							>
								<Trash2 class="w-4 h-4" />
								Delete
							</button>
						</div>
					</div>
				</div>
			</aside>

			<!-- Main Content Area -->
			<section
				class="relative flex flex-col flex-1 min-w-0 overflow-hidden bg-background md:bg-transparent"
				role="main"
			>
				<header
					class="sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-4 border-b border-border/60 bg-background md:px-6"
				>
					<div class="flex items-center gap-3">
						<div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
							<Send class="w-5 h-5 text-primary" />
						</div>
						<div>
							<h1 class="text-sm font-semibold">Telegram Conversations</h1>
							<p class="text-xs text-muted-foreground">
								{#if config.enabled && config.botToken && config.chatId}
									{#if isPolling}
										<span class="flex items-center gap-1.5">
											<span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
											Polling active
										</span>
									{:else}
										Bot active (webhook)
									{/if}
								{:else}
									Configure bot to start
								{/if}
							</p>
						</div>
					</div>
					<button
						class="flex items-center justify-center w-10 h-10 transition border rounded-lg border-border/60 bg-background hover:bg-muted/50 md:hidden"
						onclick={() => (showConfig = !showConfig)}
						aria-label="Toggle configuration"
					>
						<Settings class="w-5 h-5" />
					</button>
				</header>

				<div
					class="flex-1 px-6 py-8 overflow-y-auto scroll-smooth"
					role="log"
					aria-live="polite"
					aria-label="Telegram messages"
				>
					<div class="w-full max-w-4xl min-w-0 mx-auto space-y-6">
						{#if isFetchingChatId}
							<!-- Chat ID Fetch Tutorial -->
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
								<button
									onclick={cancelChatIdFetch}
									class="absolute flex items-center justify-center w-10 h-10 transition border rounded-full right-6 top-6 border-border/60 bg-background/80 backdrop-blur hover:bg-muted/50"
									aria-label="Cancel chat ID fetch"
								>
									<X class="w-5 h-5 text-muted-foreground" />
								</button>

								<div class="p-6 border rounded-full border-border/60 bg-muted/30">
									<RefreshCw
										class="text-primary h-12 w-12 {chatIdFetchStep === 2 ? 'animate-spin' : ''}"
									/>
								</div>

								<div class="space-y-3">
									{#if chatIdFetchStep === 1}
										<p class="text-xl font-semibold">Preparing to detect your Chat ID...</p>
										<p class="max-w-md text-sm text-muted-foreground">
											Temporarily disabling webhook to listen for your message.
										</p>
									{:else if chatIdFetchStep === 2}
										<p class="text-xl font-semibold">Send a message to your bot now!</p>
										<p class="max-w-md text-sm text-muted-foreground">
											Open Telegram, find your bot, and send any message (like "hello" or
											"start").
										</p>
									{:else if chatIdFetchStep === 3}
										<p class="text-xl font-semibold text-green-600 dark:text-green-400">
											<Check class="inline w-6 h-6" /> Chat ID found!
										</p>
										<p class="max-w-md text-sm text-muted-foreground">
											Your Chat ID has been automatically detected and saved. You can now save
											your configuration.
										</p>
									{:else if chatIdFetchStep === 4}
										<p class="text-xl font-semibold text-destructive">No message received</p>
										<p class="max-w-md text-sm text-muted-foreground">
											We couldn't detect your message. Make sure you've sent a message to your
											bot and try again.
										</p>
									{/if}
								</div>

								{#if chatIdFetchStep === 2}
									<div class="px-8 py-6 border rounded-2xl border-primary/50 bg-primary/5">
										<div class="mb-2 text-6xl font-bold tabular-nums text-primary">
											{Math.ceil(chatIdFetchCountdown / 1000)}
										</div>
										<div class="text-sm font-medium tracking-wider uppercase text-muted-foreground">
											seconds remaining
										</div>
									</div>
								{/if}

								{#if chatIdFetchStep === 3}
									<div class="px-8 py-6 border rounded-2xl border-green-500/50 bg-green-500/10">
										<Check class="w-16 h-16 mx-auto mb-2 text-green-600 dark:text-green-400" />
										<div class="text-sm text-muted-foreground">
											Chat ID: <span class="font-mono font-bold text-foreground"
												>{config.chatId}</span
											>
										</div>
									</div>
								{/if}
							</div>
						{:else if sessions.length > 0}
							<!-- Sessions List -->
							<div class="flex flex-col gap-3">
								{#each sessions as session (session.id)}
									<button
										class="w-full rounded-xl border border-border/60 bg-background px-5 py-4 text-left transition hover:bg-muted/30 {selectedSessionId === session.id
											? 'ring-2 ring-primary'
											: ''}"
										onclick={() => loadSessionSummary(session.id)}
									>
										<div class="flex items-center justify-between">
											<div class="font-semibold">{session.title}</div>
											<div class="text-xs text-muted-foreground">
												{new Date(session.updatedAt).toLocaleString()}
											</div>
										</div>
									</button>
								{/each}
							</div>

							{#if selectedSessionSummary}
								<div class="p-6 mt-6 border rounded-xl border-border/60 bg-muted/30" in:fade>
									<div class="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
										<h3 class="text-lg font-semibold">Conversation Summary</h3>
										<button
											onclick={() => {
												selectedSessionId = null;
												selectedSessionSummary = null;
											}}
											class="transition text-muted-foreground hover:text-foreground"
											aria-label="Close summary"
										>
											<X class="w-5 h-5" />
										</button>
									</div>

									<div class="space-y-4">
										<div class="grid grid-cols-2 gap-4">
											<div class="space-y-1">
												<p class="text-xs font-semibold uppercase text-muted-foreground">
													Session ID
												</p>
												<p class="font-mono text-xs">
													{selectedSessionSummary.session.id.slice(0, 8)}...
												</p>
											</div>
											<div class="space-y-1">
												<p class="text-xs font-semibold uppercase text-muted-foreground">
													Telegram Chat ID
												</p>
												<p class="font-mono text-xs">
													{selectedSessionSummary.session.telegramChatId}
												</p>
											</div>
										</div>

										<div class="grid grid-cols-2 gap-4">
											<div class="space-y-1">
												<p class="text-xs font-semibold uppercase text-muted-foreground">
													Message Count
												</p>
												<p class="text-sm font-semibold">
													{selectedSessionSummary.messageCount}
												</p>
											</div>
											<div class="space-y-1">
												<p class="text-xs font-semibold uppercase text-muted-foreground">
													Last Updated
												</p>
												<p class="text-xs">
													{new Date(
														selectedSessionSummary.session.updatedAt
													).toLocaleString()}
												</p>
											</div>
										</div>

										{#if selectedSessionSummary.lastMessage}
											<div class="space-y-1">
												<p class="text-xs font-semibold uppercase text-muted-foreground">
													Last Message Preview
												</p>
												<p class="px-3 py-2 text-xs border rounded-lg border-border/50 bg-background/50">
													{selectedSessionSummary.lastMessage.slice(0, 200)}
													{selectedSessionSummary.lastMessage.length > 200 ? '...' : ''}
												</p>
											</div>
										{/if}
									</div>
								</div>
							{/if}
						{:else if !config.botToken || !config.chatId}
							<!-- Setup Tutorial -->
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
								<div class="p-4 border rounded-full border-border/60 bg-muted/30">
									<Settings class="w-8 h-8 text-muted-foreground" />
								</div>
								<div class="space-y-2">
									<p class="text-xl font-semibold">Configure Your Telegram Bot</p>
									<p class="max-w-md text-sm text-muted-foreground">
										Enter your Telegram bot token and chat ID to start conversing with the AI
										via Telegram.
									</p>
								</div>
								<div
									class="grid w-full max-w-2xl grid-cols-1 gap-3 text-sm text-left text-muted-foreground"
								>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										<p class="mb-1 font-semibold">1. Create a Bot</p>
										<p class="text-xs">
											Message <span class="font-mono">@BotFather</span> on Telegram with
											<code class="px-1 rounded bg-background/50">/newbot</code> to create a new
											bot. Copy the bot token provided.
										</p>
									</div>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										<p class="mb-1 font-semibold">2. Set Up Webhook (HTTPS Required)</p>
										<p class="text-xs">
											Paste the token in the config panel. Telegram requires
											<span class="text-amber-600 dark:text-amber-400">HTTPS</span>
											- if developing locally, use ngrok:
											<code class="px-1 rounded bg-background/50">ngrok http 5173</code>
										</p>
									</div>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										<p class="mb-1 font-semibold">3. Get Your Chat ID</p>
										<p class="text-xs">
											Send a message to your bot, then click the
											<span class="font-medium">Auto-detect</span> button to fetch your chat ID.
										</p>
									</div>
									<div class="px-4 py-4 border rounded-xl border-border/50 bg-muted/30">
										<p class="mb-1 font-semibold">4. Save & Start Chatting</p>
										<p class="text-xs">
											Click <span class="font-medium">Save All</span> to save your configuration.
											Your bot is now ready!
										</p>
									</div>
								</div>
							</div>
						{:else}
							<!-- No Conversations -->
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
								<div class="p-4 border rounded-full border-border/60 bg-muted/30">
									<MessageSquare class="w-8 h-8 text-muted-foreground" />
								</div>
								<div class="space-y-2">
									<p class="text-xl font-semibold">No Conversations Yet</p>
									<p class="max-w-md text-sm text-muted-foreground">
										Send a message to your Telegram bot to start a conversation.
									</p>
								</div>
							</div>
						{/if}

						{#if isLoading}
							<div class="flex items-center justify-center py-8" in:fade>
								<div
									class="flex items-center gap-3 px-4 py-3 text-sm font-bold tracking-wide uppercase border shadow-sm text-muted-foreground animate-pulse rounded-2xl border-border/60 bg-muted/35"
								>
									<LoaderCircle class="w-4 h-4 animate-spin" />
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

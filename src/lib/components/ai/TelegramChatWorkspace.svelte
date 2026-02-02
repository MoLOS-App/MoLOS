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
				toast.error(
					'No messages found. Please try again and make sure to send a message to your bot.'
				);
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
					toast.success(
						`Polling mode enabled. Checking for messages every ${config.pollingInterval / 1000}s.`
					);
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

<div class="flex h-full flex-col overflow-hidden">
	<div class="mb-4 flex h-full w-full flex-col overflow-hidden md:pr-4" in:fade={{ duration: 500 }}>
		<div
			class="flex h-full min-h-[90svh] overflow-hidden md:rounded-2xl md:border md:border-border/70"
		>
			<!-- Configuration Sidebar -->
			<aside
				class="w-[480px] flex-col border-r border-border/60 bg-muted/10 md:flex {showConfig
					? 'flex'
					: 'hidden md:flex'}"
			>
				<div class="flex h-full flex-col">
					<!-- Header -->
					<div
						class="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/95 px-6 py-4 backdrop-blur"
					>
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
								<Settings class="h-5 w-5 text-primary" />
							</div>
							<div>
								<h2 class="text-sm font-bold tracking-wide">Telegram Configuration</h2>
								<p class="text-muted-foreground text-xs">Configure your AI bot</p>
							</div>
						</div>
						<button
							class="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background transition hover:bg-muted/50"
							onclick={() => (showConfig = !showConfig)}
							aria-label="Toggle configuration"
							title="Toggle panel"
						>
							<X class="h-4 w-4" />
						</button>
					</div>

					<!-- Scrollable Content -->
					<div class="flex-1 overflow-y-auto">
						<div class="space-y-8 p-6">
							<!-- Bot Authentication Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 border-b border-border/40 pb-2">
									<Key class="h-4 w-4 text-primary" />
									<h3 class="text-sm font-semibold">Bot Authentication</h3>
								</div>

								<!-- Bot Token -->
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<label for="botToken" class="text-muted-foreground text-xs font-semibold"
											>Bot Token</label
										>
										{#if config.botToken}
											<span
												class="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400"
												>Active</span
											>
										{/if}
									</div>
									<div class="flex gap-2">
										<input
											id="botToken"
											type={showBotToken ? 'text' : 'password'}
											bind:value={config.botToken}
											placeholder="Paste your bot token from @BotFather"
											class="focus-visible:ring-ring flex-1 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
										/>
										<button
											onclick={() => (showBotToken = !showBotToken)}
											class="text-muted-foreground flex items-center justify-center px-3 transition hover:text-foreground"
											aria-label={showBotToken ? 'Hide token' : 'Show token'}
										>
											{#if showBotToken}
												<EyeOff class="h-4 w-4" />
											{:else}
												<Eye class="h-4 w-4" />
											{/if}
										</button>
									</div>
								</div>

								<!-- Chat ID -->
								<div class="space-y-2">
									<label for="chatId" class="text-muted-foreground text-xs font-semibold"
										>Chat ID</label
									>
									<div class="flex gap-2">
										<input
											id="chatId"
											type="text"
											bind:value={config.chatId}
											placeholder="Enter your Telegram chat ID"
											class="focus-visible:ring-ring flex-1 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
										/>
										<button
											onclick={fetchChatIdFromBot}
											disabled={isLoading || !config.botToken}
											class="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-sm font-medium transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
											title="Auto-fetch chat ID"
										>
											<RefreshCw class="h-4 w-4" />
											Auto-detect
										</button>
									</div>
									<p class="text-muted-foreground text-[10px]">
										Send a message to your bot, then click "Auto-detect" to find your chat ID
									</p>
								</div>
							</section>

							<!-- Connection Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 border-b border-border/40 pb-2">
									<Server class="h-4 w-4 text-primary" />
									<h3 class="text-sm font-semibold">Connection Mode</h3>
									{#if isPolling}
										<span
											class="ml-auto animate-pulse rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
											>Polling Active</span
										>
									{:else if config.webhookUrl}
										<span
											class="ml-auto rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
											>Webhook Active</span
										>
									{/if}
								</div>

								<!-- Mode Selection -->
								<div class="grid grid-cols-2 gap-3">
									<button
										onclick={() => setConnectionMode('webhook')}
										disabled={isLoading || !config.botToken}
										class="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition {config.connectionMode ===
										'webhook'
											? 'border-primary bg-primary/5'
											: 'border-border/60 bg-background hover:bg-muted/30'} disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Webhook class="h-6 w-6" />
										<div class="text-center">
											<div class="text-sm font-semibold">Webhook</div>
											<div class="text-muted-foreground text-[10px]">Instant delivery</div>
										</div>
									</button>
									<button
										onclick={() => setConnectionMode('polling')}
										disabled={isLoading || !config.botToken}
										class="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition {config.connectionMode ===
										'polling'
											? 'border-primary bg-primary/5'
											: 'border-border/60 bg-background hover:bg-muted/30'} disabled:cursor-not-allowed disabled:opacity-50"
									>
										<MessageCircle class="h-6 w-6" />
										<div class="text-center">
											<div class="text-sm font-semibold">Polling</div>
											<div class="text-muted-foreground text-[10px]">Checks every 2s</div>
										</div>
									</button>
								</div>

								{#if config.connectionMode === 'webhook'}
									<!-- Webhook Configuration -->
									<div class="space-y-2">
										<label for="webhookUrl" class="text-xs font-semibold">Webhook URL</label>
										<input
											id="webhookUrl"
											type="text"
											bind:value={customWebhookUrl}
											placeholder="https://your-url.ngrok.io/api/ai/telegram/webhook"
											class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
										/>
										<button
											onclick={setupWebhook}
											disabled={isLoading || !config.botToken}
											class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<Webhook class="h-4 w-4" />
											Setup Webhook
										</button>
									</div>
								{:else}
									<!-- Polling Configuration -->
									<div class="space-y-2">
										<label for="pollingInterval" class="text-xs font-semibold"
											>Polling Interval</label
										>
										<div class="flex items-center gap-3">
											<input
												id="pollingInterval"
												type="number"
												min="1"
												max="60"
												step="1"
												value={pollingIntervalSeconds}
												oninput={(e) => setPollingIntervalSeconds(Number(e.currentTarget.value))}
												placeholder="2"
												class="focus-visible:ring-ring w-20 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-center text-sm focus-visible:ring-2 focus-visible:outline-none"
											/>
											<span class="text-muted-foreground text-sm">seconds</span>
										</div>
										<p class="text-muted-foreground text-[10px]">
											Lower values check more often but use more resources (1-60 seconds)
										</p>
									</div>
								{/if}
							</section>

							<!-- AI Behavior Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 border-b border-border/40 pb-2">
									<Sliders class="h-4 w-4 text-primary" />
									<h3 class="text-sm font-semibold">AI Behavior</h3>
								</div>

								<!-- Model Selection -->
								<div class="space-y-2">
									<label for="modelName" class="text-muted-foreground text-xs font-semibold"
										>AI Model</label
									>
									<select
										id="modelName"
										bind:value={selectedModelId}
										class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
									>
										{#each availableModels as m (m.id)}
											<option value={m.id}>{m.name}</option>
										{/each}
									</select>
								</div>

								<!-- System Prompt -->
								<div class="space-y-2">
									<label for="systemPrompt" class="text-muted-foreground text-xs font-semibold"
										>System Prompt</label
									>
									<textarea
										id="systemPrompt"
										bind:value={config.systemPrompt}
										placeholder="Define how your AI assistant should behave..."
										rows="3"
										class="focus-visible:ring-ring w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
									></textarea>
								</div>

								<!-- Temperature & Max Tokens -->
								<div class="grid grid-cols-2 gap-4">
									<div class="space-y-2">
										<label for="temperature" class="text-muted-foreground text-xs font-semibold"
											>Temperature</label
										>
										<input
											id="temperature"
											type="number"
											step="0.1"
											min="0"
											max="2"
											bind:value={config.temperature}
											class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
										/>
										<p class="text-muted-foreground text-[10px]">0 = focused, 2 = creative</p>
									</div>
									<div class="space-y-2">
										<label for="maxTokens" class="text-muted-foreground text-xs font-semibold"
											>Max Tokens</label
										>
										<input
											id="maxTokens"
											type="number"
											min="1"
											bind:value={config.maxTokens}
											class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
										/>
										<p class="text-muted-foreground text-[10px]">Max response length</p>
									</div>
								</div>
							</section>

							<!-- Status Section -->
							<section class="space-y-4">
								<div class="flex items-center gap-2 border-b border-border/40 pb-2">
									<Shield class="h-4 w-4 text-primary" />
									<h3 class="text-sm font-semibold">Status</h3>
								</div>

								<div class="flex items-center gap-3">
									<input
										id="enabled"
										type="checkbox"
										bind:checked={config.enabled}
										class="focus-visible:ring-ring h-5 w-5 rounded border-border/60 focus-visible:ring-2"
									/>
									<label for="enabled" class="flex-1 cursor-pointer text-sm font-medium">
										Enable Telegram Bot
									</label>
									{#if config.enabled}
										<span
											class="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400"
											>Active</span
										>
									{:else}
										<span
											class="text-muted-foreground rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
											>Disabled</span
										>
									{/if}
								</div>
							</section>

							<!-- HTTPS Help Warning -->
							{#if showWebhookHelp}
								<div
									class="flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3"
								>
									<Info class="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
									<div class="flex-1 text-xs">
										<p class="mb-1 font-semibold text-amber-700 dark:text-amber-300">
											HTTPS Required
										</p>
										<p class="text-amber-600 dark:text-amber-400">
											Telegram requires HTTPS. For local dev, use ngrok:
											<code class="rounded bg-background/50 px-1">ngrok http 5173</code>
										</p>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Footer Actions -->
					<div class="border-t border-border/60 bg-background/95 p-4 backdrop-blur">
						<div class="grid grid-cols-2 gap-3">
							<button
								class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={saveConfig}
								disabled={isSaving}
							>
								{#if isSaving}
									<LoaderCircle class="h-4 w-4 animate-spin" />
								{:else}
									<Save class="h-4 w-4" />
								{/if}
								Save All
							</button>
							<button
								class="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={deleteConfig}
								disabled={isSaving}
							>
								<Trash2 class="h-4 w-4" />
								Delete
							</button>
						</div>
					</div>
				</div>
			</aside>

			<!-- Main Content Area -->
			<section
				class="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background md:bg-transparent"
				role="main"
			>
				<header
					class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-background px-6 py-4 md:px-6"
				>
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
							<Send class="h-5 w-5 text-primary" />
						</div>
						<div>
							<h1 class="text-sm font-semibold">Telegram Conversations</h1>
							<p class="text-muted-foreground text-xs">
								{#if config.enabled && config.botToken && config.chatId}
									{#if isPolling}
										<span class="flex items-center gap-1.5">
											<span class="h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
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
						class="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background transition hover:bg-muted/50 md:hidden"
						onclick={() => (showConfig = !showConfig)}
						aria-label="Toggle configuration"
					>
						<Settings class="h-5 w-5" />
					</button>
				</header>

				<div
					class="flex-1 overflow-y-auto scroll-smooth px-6 py-8"
					role="log"
					aria-live="polite"
					aria-label="Telegram messages"
				>
					<div class="mx-auto w-full max-w-4xl min-w-0 space-y-6">
						{#if isFetchingChatId}
							<!-- Chat ID Fetch Tutorial -->
							<div class="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
								<button
									onclick={cancelChatIdFetch}
									class="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/80 backdrop-blur transition hover:bg-muted/50"
									aria-label="Cancel chat ID fetch"
								>
									<X class="text-muted-foreground h-5 w-5" />
								</button>

								<div class="rounded-full border border-border/60 bg-muted/30 p-6">
									<RefreshCw
										class="h-12 w-12 text-primary {chatIdFetchStep === 2 ? 'animate-spin' : ''}"
									/>
								</div>

								<div class="space-y-3">
									{#if chatIdFetchStep === 1}
										<p class="text-xl font-semibold">Preparing to detect your Chat ID...</p>
										<p class="text-muted-foreground max-w-md text-sm">
											Temporarily disabling webhook to listen for your message.
										</p>
									{:else if chatIdFetchStep === 2}
										<p class="text-xl font-semibold">Send a message to your bot now!</p>
										<p class="text-muted-foreground max-w-md text-sm">
											Open Telegram, find your bot, and send any message (like "hello" or "start").
										</p>
									{:else if chatIdFetchStep === 3}
										<p class="text-xl font-semibold text-green-600 dark:text-green-400">
											<Check class="inline h-6 w-6" /> Chat ID found!
										</p>
										<p class="text-muted-foreground max-w-md text-sm">
											Your Chat ID has been automatically detected and saved. You can now save your
											configuration.
										</p>
									{:else if chatIdFetchStep === 4}
										<p class="text-xl font-semibold text-destructive">No message received</p>
										<p class="text-muted-foreground max-w-md text-sm">
											We couldn't detect your message. Make sure you've sent a message to your bot
											and try again.
										</p>
									{/if}
								</div>

								{#if chatIdFetchStep === 2}
									<div class="rounded-2xl border border-primary/50 bg-primary/5 px-8 py-6">
										<div class="mb-2 text-6xl font-bold text-primary tabular-nums">
											{Math.ceil(chatIdFetchCountdown / 1000)}
										</div>
										<div class="text-muted-foreground text-sm font-medium tracking-wider uppercase">
											seconds remaining
										</div>
									</div>
								{/if}

								{#if chatIdFetchStep === 3}
									<div class="rounded-2xl border border-green-500/50 bg-green-500/10 px-8 py-6">
										<Check class="mx-auto mb-2 h-16 w-16 text-green-600 dark:text-green-400" />
										<div class="text-muted-foreground text-sm">
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
										class="w-full rounded-xl border border-border/60 bg-background px-5 py-4 text-left transition hover:bg-muted/30 {selectedSessionId ===
										session.id
											? 'ring-2 ring-primary'
											: ''}"
										onclick={() => loadSessionSummary(session.id)}
									>
										<div class="flex items-center justify-between">
											<div class="font-semibold">{session.title}</div>
											<div class="text-muted-foreground text-xs">
												{new Date(session.updatedAt).toLocaleString()}
											</div>
										</div>
									</button>
								{/each}
							</div>

							{#if selectedSessionSummary}
								<div class="mt-6 rounded-xl border border-border/60 bg-muted/30 p-6" in:fade>
									<div
										class="mb-4 flex items-center justify-between border-b border-border/60 pb-3"
									>
										<h3 class="text-lg font-semibold">Conversation Summary</h3>
										<button
											onclick={() => {
												selectedSessionId = null;
												selectedSessionSummary = null;
											}}
											class="text-muted-foreground transition hover:text-foreground"
											aria-label="Close summary"
										>
											<X class="h-5 w-5" />
										</button>
									</div>

									<div class="space-y-4">
										<div class="grid grid-cols-2 gap-4">
											<div class="space-y-1">
												<p class="text-muted-foreground text-xs font-semibold uppercase">
													Session ID
												</p>
												<p class="font-mono text-xs">
													{selectedSessionSummary.session.id.slice(0, 8)}...
												</p>
											</div>
											<div class="space-y-1">
												<p class="text-muted-foreground text-xs font-semibold uppercase">
													Telegram Chat ID
												</p>
												<p class="font-mono text-xs">
													{selectedSessionSummary.session.telegramChatId}
												</p>
											</div>
										</div>

										<div class="grid grid-cols-2 gap-4">
											<div class="space-y-1">
												<p class="text-muted-foreground text-xs font-semibold uppercase">
													Message Count
												</p>
												<p class="text-sm font-semibold">
													{selectedSessionSummary.messageCount}
												</p>
											</div>
											<div class="space-y-1">
												<p class="text-muted-foreground text-xs font-semibold uppercase">
													Last Updated
												</p>
												<p class="text-xs">
													{new Date(selectedSessionSummary.session.updatedAt).toLocaleString()}
												</p>
											</div>
										</div>

										{#if selectedSessionSummary.lastMessage}
											<div class="space-y-1">
												<p class="text-muted-foreground text-xs font-semibold uppercase">
													Last Message Preview
												</p>
												<p
													class="rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs"
												>
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
											Paste the token in the config panel. Telegram requires
											<span class="text-amber-600 dark:text-amber-400">HTTPS</span>
											- if developing locally, use ngrok:
											<code class="rounded bg-background/50 px-1">ngrok http 5173</code>
										</p>
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="mb-1 font-semibold">3. Get Your Chat ID</p>
										<p class="text-xs">
											Send a message to your bot, then click the
											<span class="font-medium">Auto-detect</span> button to fetch your chat ID.
										</p>
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="mb-1 font-semibold">4. Save & Start Chatting</p>
										<p class="text-xs">
											Click <span class="font-medium">Save All</span> to save your configuration. Your
											bot is now ready!
										</p>
									</div>
								</div>
							</div>
						{:else}
							<!-- No Conversations -->
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

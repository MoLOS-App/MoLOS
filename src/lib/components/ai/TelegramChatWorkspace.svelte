<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Send, MessageSquare, Settings, LoaderCircle, Check, Save, Trash2, RefreshCw } from 'lucide-svelte';
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
		modelName: string;
		systemPrompt: string;
		temperature: number;
		maxTokens: number;
		enabled: boolean;
	}>({
		botToken: '',
		chatId: '',
		modelName: 'gpt-4o',
		systemPrompt: '',
		temperature: 0.7,
		maxTokens: 4096,
		enabled: true
	});

	let isConfigLoaded = $state(false);
	let showConfig = $state(true);
	let isSaving = $state(false);

	// Model selection state
	let selectedModelId = $state('gpt-4o');

	// Get available models based on AI settings provider
	let availableModels = $derived(
		aiSettings ? PREDEFINED_MODELS[aiSettings.provider as keyof typeof PREDEFINED_MODELS] || PREDEFINED_MODELS.openai : PREDEFINED_MODELS.openai
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
					config = {
						botToken: data.settings.botToken || '',
						chatId: data.settings.chatId || '',
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
			const res = await fetch('/api/ai/telegram', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...config,
					modelName: selectedModelId
				})
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
		if (!config.botToken) {
			toast.error('Please enter your bot token first');
			return;
		}

		isLoading = true;
		try {
			// Call Telegram API to get updates
			const url = `https://api.telegram.org/bot${config.botToken}/getUpdates`;
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
							class="focus-visible:ring-ring flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 hover:bg-muted/30 transition"
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
								</label>
								<input
									id="botToken"
									type="password"
									bind:value={config.botToken}
									placeholder="Enter your Telegram bot token"
									class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								/>
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
										class="focus-visible:ring-ring flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
										title="Fetch chat ID from bot - send a message to your bot first"
									>
										<RefreshCw class="h-4 w-4" />
									</button>
								</div>
								<p class="text-muted-foreground text-[10px]">
									Send a message to your bot, then click the refresh button to auto-fetch your chat ID.
								</p>
							</div>

							<div class="space-y-1">
								<label for="modelName" class="text-muted-foreground text-xs font-semibold">
									Model
									{#if aiSettings?.modelName && config.modelName === aiSettings.modelName}
										<span class="text-xs text-muted-foreground/70">(default from settings)</span>
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
									class="focus-visible:ring-ring w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none resize-none"
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
								<label for="enabled" class="text-foreground text-sm font-medium">
									Enable Telegram bot
								</label>
							</div>
						</div>

						<div class="flex gap-2 pt-2 border-t border-border/60">
							<button
								class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
								onclick={saveConfig}
								disabled={isSaving || !config.botToken || !config.chatId}
							>
								{#if isSaving}
									<LoaderCircle class="h-4 w-4 animate-spin" />
								{:else}
									<Save class="h-4 w-4" />
								{/if}
								{isSaving ? 'Saving...' : 'Save'}
							</button>
							<button
								class="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
						{config.enabled && config.botToken && config.chatId ? 'Bot active' : 'Configure bot to start'}
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
										<p class="font-semibold mb-1">1. Create a Bot</p>
										<p class="text-xs">
											Message <span class="font-mono">@BotFather</span> on Telegram with
											<code class="rounded bg-background/50 px-1">/newbot</code> to create a new bot.
											Copy the bot token provided.
										</p>
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="font-semibold mb-1">2. Get Your Chat ID</p>
										<p class="text-xs">
											Open your bot in Telegram and send <span class="font-medium">any message</span> (like "start" or "hello").
											Then click the <span class="font-medium">refresh button</span> next to the Chat ID field above
											to auto-fetch your chat ID.
										</p>
									</div>
									<div class="rounded-xl border border-border/50 bg-muted/30 px-4 py-4">
										<p class="font-semibold mb-1">3. Save & Start Chatting</p>
										<p class="text-xs">
											Click <span class="font-medium">Save</span> to save your configuration. Your bot is now ready
											to chat with AI! Just message it anytime.
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
										class="text-left w-full rounded-xl border border-border/60 bg-background px-4 py-3 hover:bg-muted/30 transition"
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

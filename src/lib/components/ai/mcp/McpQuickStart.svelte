<script lang="ts">
	import { browser } from '$app/environment';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Copy, Check, Rocket, Terminal } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils';

	export type Agent = 'claude-code' | 'claude-desktop' | 'cursor' | 'windsurf' | 'cline';

	interface AgentConfig {
		id: Agent;
		name: string;
		badge: string;
		description: string;
		commandTemplate: (baseUrl: string, apiKey: string) => string;
		configTemplate?: (baseUrl: string, apiKey: string) => string;
		transportType: 'sse' | 'stdio';
	}

	let {
		baseUrl = '/api/ai/mcp/transport',
		selectedApiKey
	}: { baseUrl?: string; selectedApiKey?: string } = $props();

	const agents: AgentConfig[] = [
		{
			id: 'claude-code',
			name: 'Claude Code',
			badge: 'Recommended',
			description: 'Add MCP to your Claude Code configuration',
			commandTemplate: (url, key) =>
				`claude mcp add molos --transport URL --url "${url}" --apiKey "${key}"`,
			transportType: 'sse'
		},
		{
			id: 'claude-desktop',
			name: 'Claude Desktop',
			badge: 'GUI Client',
			description: 'Configure Claude Desktop to connect to MCP',
			commandTemplate: () => 'Open Claude Desktop settings',
			configTemplate: (url, key) =>
				`{\n  "mcpServers": {\n    "molos": {\n      "transport": "sse",\n      "url": "${url}",\n      "headers": {\n        "Authorization": "Bearer ${key}"\n      }\n    }\n  }\n}`,
			transportType: 'sse'
		},
		{
			id: 'cursor',
			name: 'Cursor',
			badge: 'AI Editor',
			description: 'Connect Cursor to your MCP server',
			commandTemplate: (url, key) =>
				`# Add to .cursorrules or MCP config\nmcp_server: ${url}\napi_key: ${key}`,
			transportType: 'sse'
		},
		{
			id: 'windsurf',
			name: 'Windsurf',
			badge: 'Codeium Editor',
			description: 'Configure Windsurf to use MCP',
			commandTemplate: (url, key) =>
				`# MCP configuration for Windsurf\nexport MCP_SERVER_URL="${url}"\nexport MCP_API_KEY="${key}"`,
			transportType: 'sse'
		},
		{
			id: 'cline',
			name: 'Cline',
			badge: 'CLI Assistant',
			description: 'Use Cline with your MCP server',
			commandTemplate: (url, key) =>
				`cline --mcp-server="${url}" --mcp-key="${key}"`,
			transportType: 'sse'
		}
	];

	let selectedAgent = $state<Agent>('claude-code');
	let copiedAgent = $state<Agent | null>(null);
	let showApiKeyInput = $state(false);
	let customApiKey = $state('');

	// Get the full URL - safely handles SSR
	function getFullUrl() {
		if (browser && typeof window !== 'undefined') {
			return `${window.location.origin}${baseUrl}`;
		}
		return baseUrl;
	}

	function getCommand(agent: AgentConfig): string {
		const key = selectedApiKey || customApiKey;
		const url = getFullUrl();
		if (!key) {
			return agent.configTemplate
				? agent.configTemplate(url, 'YOUR_API_KEY_HERE')
				: agent.commandTemplate(url, 'YOUR_API_KEY_HERE');
		}
		return agent.configTemplate
			? agent.configTemplate(url, key)
			: agent.commandTemplate(url, key);
	}

	async function copyCommand(agent: AgentConfig) {
		if (!browser) return;
		const command = getCommand(agent);
		try {
			await navigator.clipboard.writeText(command);
			copiedAgent = agent.id;
			toast.success(`${agent.name} command copied!`);
			setTimeout(() => (copiedAgent = null), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}

	const activeAgent = $derived(agents.find((a) => a.id === selectedAgent)!);
</script>

<Card>
	<CardHeader>
		<CardTitle class="flex items-center gap-2">
			<Rocket class="w-5 h-5" />
			Quick Start Guide
		</CardTitle>
	</CardHeader>
	<CardContent class="space-y-6">
		<!-- Agent Selection -->
		<div class="space-y-3">
			<p class="text-sm text-muted-foreground">Select your AI coding agent:</p>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
				{#each agents as agent (agent.id)}
					<button
						onclick={() => (selectedAgent = agent.id)}
						class={cn(
							'flex items-center justify-between p-3 rounded-lg border-2 transition-colors text-left',
							selectedAgent === agent.id
								? 'border-primary bg-primary/5'
								: 'border-border hover:bg-accent'
						)}
					>
						<span class="font-medium text-sm">{agent.name}</span>
						<Badge variant="secondary" class="text-[10px] h-5">{agent.badge}</Badge>
					</button>
				{/each}
			</div>
		</div>

		<!-- Agent Description -->
		<div class="p-4 bg-muted/50 rounded-lg">
			<p class="text-sm text-foreground">{activeAgent.description}</p>
		</div>

		<!-- API Key Input -->
		{#if !selectedApiKey}
			<div class="space-y-2">
				<button
					onclick={() => (showApiKeyInput = !showApiKeyInput)}
					class="text-sm text-primary hover:underline"
				>
					{showApiKeyInput ? '- Hide' : '+ Enter'} API Key for command
				</button>
				{#if showApiKeyInput}
					<input
						type="text"
						bind:value={customApiKey}
						placeholder="Enter your API key..."
						class="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background"
					/>
				{/if}
			</div>
		{/if}

		<!-- Command Display -->
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium flex items-center gap-2">
					<Terminal class="w-4 h-4" />
					Command / Configuration
				</p>
				<Button
					variant="outline"
					size="sm"
					onclick={() => copyCommand(activeAgent)}
					class="gap-2"
				>
					{#if copiedAgent === activeAgent.id}
						<Check class="w-4 h-4 text-green-500" />
						Copied!
					{:else}
						<Copy class="w-4 h-4" />
						Copy
					{/if}
				</Button>
			</div>
			<pre
				class="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto border border-border"
			><code>{getCommand(activeAgent)}</code></pre>
		</div>

		<!-- Transport Info -->
		<div class="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
			<span class="text-xs text-blue-600 dark:text-blue-400">
				<strong>Transport:</strong> {activeAgent.transportType.toUpperCase()}
			</span>
			<span class="text-muted-foreground">•</span>
			<span class="text-xs text-blue-600 dark:text-blue-400">
				<strong>URL:</strong> {getFullUrl()}
			</span>
		</div>
	</CardContent>
</Card>

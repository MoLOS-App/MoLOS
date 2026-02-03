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
		commandTemplate: (configJson: string) => string;
		configTemplate: (baseUrl: string, apiKey: string) => string;
		outputType: 'json' | 'command';
		transportType: 'stdio';
	}

	let {
		baseUrl = '/api/ai/mcp/transport',
		selectedApiKey
	}: { baseUrl?: string; selectedApiKey?: string } = $props();

	// Generate the JSON configuration for stdio/mcp-remote
	function getMcpConfigJson(url: string, key: string): string {
		const displayKey = key || 'your-api-key-here';
		return JSON.stringify(
			{
				mcpServers: {
					'molos-mcp': {
						command: 'npx',
						args: ['-y', 'mcp-remote', url, '--header', `MOLOS_MCP_API_KEY: ${displayKey}`],
						env: {
							MOLOS_MCP_API_KEY: displayKey
						}
					}
				}
			},
			null,
			2
		);
	}

	const agents: AgentConfig[] = [
		{
			id: 'claude-desktop',
			name: 'Claude Desktop',
			badge: 'Recommended',
			description: 'Configure Claude Desktop to connect to MCP using stdio transport',
			configTemplate: (url, key) => getMcpConfigJson(url, key),
			commandTemplate: (url, key) => {
				const displayKey = key || 'your-api-key-here';
				return `npx -y mcp-remote ${url} --header "MOLOS_MCP_API_KEY: ${displayKey}"`;
			},
			outputType: 'json',
			transportType: 'stdio'
		},
		{
			id: 'claude-code',
			name: 'Claude Code',
			badge: 'CLI Tool',
			description: 'Add MCP server using Claude Code CLI',
			configTemplate: (url, key) => getMcpConfigJson(url, key),
			commandTemplate: (url, key) => {
				const displayKey = key || 'your-api-key-here';
				return `claude mcp add molos-mcp -- npx -y mcp-remote ${url} --header "MOLOS_MCP_API_KEY: ${displayKey}"`;
			},
			outputType: 'command',
			transportType: 'stdio'
		},
		{
			id: 'cursor',
			name: 'Cursor',
			badge: 'AI Editor',
			description: 'Add MCP server to Cursor settings',
			configTemplate: (url, key) => getMcpConfigJson(url, key),
			commandTemplate: (url, key) => {
				const displayKey = key || 'your-api-key-here';
				return `npx -y mcp-remote ${url} --header "MOLOS_MCP_API_KEY: ${displayKey}"`;
			},
			outputType: 'command',
			transportType: 'stdio'
		},
		{
			id: 'cline',
			name: 'Cline',
			badge: 'VS Code Extension',
			description: 'Add MCP server to Cline settings',
			configTemplate: (url, key) => getMcpConfigJson(url, key),
			commandTemplate: (url, key) => {
				const displayKey = key || 'your-api-key-here';
				return `npx -y mcp-remote ${url} --header "MOLOS_MCP_API_KEY: ${displayKey}"`;
			},
			outputType: 'command',
			transportType: 'stdio'
		},
		{
			id: 'windsurf',
			name: 'Windsurf',
			badge: 'Codeium Editor',
			description: 'Add MCP server to Windsurf settings',
			configTemplate: (url, key) => getMcpConfigJson(url, key),
			commandTemplate: (url, key) => {
				const displayKey = key || 'your-api-key-here';
				return `npx -y mcp-remote ${url} --header "MOLOS_MCP_API_KEY: ${displayKey}"`;
			},
			outputType: 'command',
			transportType: 'stdio'
		}
	];

	let selectedAgent = $state<Agent>('claude-desktop');
	let copiedAgent = $state<Agent | null>(null);
	let showApiKeyInput = $state(false);
	let customApiKey = $state('');
	let configTab = $state<'cli' | 'json'>('cli');

	// Get the full URL - only available on browser to avoid hydration mismatch
	const fullUrl = $derived(
		browser && typeof window !== 'undefined' ? `${window.location.origin}${baseUrl}` : baseUrl
	);

	function getCliOutput(agent: AgentConfig): string {
		const key = selectedApiKey || customApiKey || 'your-api-key-here';
		return agent.commandTemplate(fullUrl, key);
	}

	function getJsonOutput(): string {
		const key = selectedApiKey || customApiKey || 'your-api-key-here';
		return getMcpConfigJson(fullUrl, key);
	}

	async function copyCommand() {
		if (!browser) return;
		const output = configTab === 'cli' ? getCliOutput(activeAgent) : getJsonOutput();
		try {
			await navigator.clipboard.writeText(output);
			copiedAgent = activeAgent.id;
			toast.success(`${configTab === 'cli' ? 'Command' : 'Config'} copied!`);
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

		<!-- Configuration Display -->
		<div class="space-y-3">
			<!-- Tabs -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-1 border-b border-border">
					<button
						onclick={() => (configTab = 'cli')}
						class="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
						class:border-primary={configTab === 'cli'}
						class:border-transparent={configTab !== 'cli'}
						class:text-foreground={configTab === 'cli'}
						class:text-muted-foreground={configTab !== 'cli'}
						class:hover:text-foreground={configTab !== 'cli'}
					>
						<Terminal class="w-4 h-4" />
						CLI Command
					</button>
					<button
						onclick={() => (configTab = 'json')}
						class="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors"
						class:border-primary={configTab === 'json'}
						class:border-transparent={configTab !== 'json'}
						class:text-foreground={configTab === 'json'}
						class:text-muted-foreground={configTab !== 'json'}
						class:hover:text-foreground={configTab !== 'json'}
					>
						<Copy class="w-4 h-4" />
						JSON Config
					</button>
				</div>
				<Button
					variant="outline"
					size="sm"
					onclick={copyCommand}
					class="gap-2"
				>
					{#if copiedAgent === activeAgent.id}
						<Check class="w-4 h-4 text-success" />
						Copied!
					{:else}
						<Copy class="w-4 h-4" />
						Copy
					{/if}
				</Button>
			</div>

			<!-- Content -->
			{#if configTab === 'cli'}
				<pre
					class="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto border border-border whitespace-pre-wrap"
				><code>{getCliOutput(activeAgent)}</code></pre>
			{:else}
				<pre
					class="bg-muted p-4 rounded-lg text-xs font-mono overflow-x-auto border border-border whitespace-pre-wrap"
				><code>{getJsonOutput()}</code></pre>
			{/if}
		</div>

		<!-- Transport Info -->
		<div class="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
			<span class="text-xs text-primary">
				<strong>Transport:</strong> {activeAgent.transportType.toUpperCase()} (mcp-remote)
			</span>
			<span class="text-muted-foreground">•</span>
			<span class="text-xs text-primary">
				<strong>URL:</strong> {fullUrl}
			</span>
			<span class="text-muted-foreground">•</span>
			<span class="text-xs text-primary">
				<strong>Header:</strong> MOLOS_MCP_API_KEY
			</span>
		</div>
	</CardContent>
</Card>

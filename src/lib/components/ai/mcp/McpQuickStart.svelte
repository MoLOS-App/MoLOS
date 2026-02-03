<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Copy, Check, Rocket, Terminal, FileJson, ChevronRight } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils';
	import { Card, CardContent } from '$lib/components/ui/card';

	export type Agent = 'claude-code' | 'claude-desktop' | 'cursor' | 'windsurf' | 'cline';

	interface AgentConfig {
		id: Agent;
		name: string;
		badge: string;
		shortDesc: string;
		icon: typeof Rocket;
		configType: 'json' | 'cli' | 'file';
	}

	let {
		baseUrl = '/api/ai/mcp/transport',
		selectedApiKey
	}: { baseUrl?: string; selectedApiKey?: string } = $props();

	const agents: AgentConfig[] = [
		{
			id: 'claude-desktop',
			name: 'Claude Desktop',
			badge: 'Recommended',
			shortDesc: 'Native desktop app with MCP panel',
			icon: Rocket,
			configType: 'file'
		},
		{
			id: 'claude-code',
			name: 'Claude Code',
			badge: 'CLI',
			shortDesc: 'Command-line interface tool',
			icon: Terminal,
			configType: 'cli'
		},
		{
			id: 'cursor',
			name: 'Cursor',
			badge: 'Editor',
			shortDesc: 'AI-powered code editor',
			icon: Terminal,
			configType: 'file'
		},
		{
			id: 'cline',
			name: 'Cline',
			badge: 'VS Code',
			shortDesc: 'VS Code extension',
			icon: Terminal,
			configType: 'json'
		},
		{
			id: 'windsurf',
			name: 'Windsurf',
			badge: 'Codeium',
			shortDesc: 'AI IDE by Codeium',
			icon: Terminal,
			configType: 'file'
		}
	];

	let selectedAgent = $state<Agent>('claude-desktop');
	let copiedAgent = $state<Agent | null>(null);
	let showApiKeyInput = $state(false);
	let customApiKey = $state('');

	const fullUrl = $derived(
		browser && typeof window !== 'undefined' ? `${window.location.origin}${baseUrl}` : baseUrl
	);

	function getJsonConfig(): string {
		const key = selectedApiKey || customApiKey || 'your-api-key-here';
		const serverName = 'molos-mcp';

		switch (selectedAgent) {
			case 'claude-desktop':
				return JSON.stringify(
					{
						mcpServers: {
							[serverName]: {
								command: 'npx',
								args: ['-y', 'mcp-remote', fullUrl, '--header', `MOLOS_MCP_API_KEY: ${key}`]
							}
						}
					},
					null,
					2
				);

			case 'cursor':
				return JSON.stringify(
					{
						mcpServers: {
							[serverName]: {
								command: 'npx',
								args: ['-y', 'mcp-remote', fullUrl, '--header', `MOLOS_MCP_API_KEY: ${key}`],
								env: {
									MOLOS_MCP_API_KEY: key
								}
							}
						}
					},
					null,
					2
				);

			case 'cline':
				return JSON.stringify(
					{
						mcpServers: {
							[serverName]: {
								command: 'node',
								args: [`${fullUrl}/mcp-remote`],
								env: {
									MOLOS_MCP_API_KEY: key
								}
							}
						}
					},
					null,
					2
				);

			case 'windsurf':
				return JSON.stringify(
					{
						mcpServers: {
							[serverName]: {
								command: 'npx',
								args: ['-y', 'mcp-remote', fullUrl, '--header', `MOLOS_MCP_API_KEY: ${key}`],
								env: {
									MOLOS_MCP_API_KEY: key
								}
							}
						}
					},
					null,
					2
				);

			default:
				return '';
		}
	}

	function getCliCommand(): string {
		const key = selectedApiKey || customApiKey || 'your-api-key-here';

		switch (selectedAgent) {
			case 'claude-code':
				return `claude mcp add molos-mcp -- npx -y mcp-remote ${fullUrl} --header "MOLOS_MCP_API_KEY: ${key}"`;

			case 'cursor':
			case 'cline':
			case 'windsurf':
				return `npx -y mcp-remote ${fullUrl} --header "MOLOS_MCP_API_KEY: ${key}"`;

			default:
				return '';
		}
	}

	function getInstructions(): string[] {
		switch (selectedAgent) {
			case 'claude-desktop':
				return [
					`1. Open Claude Desktop`,
					`2. Click the MCP icon in the sidebar`,
					`3. Click "Add Server" and paste the config below`,
					`4. Replace "your-api-key-here" with your actual API key`,
					`5. Save and start chatting!`
				];

			case 'claude-code':
				return [
					`1. Open your terminal`,
					`2. Run the command below`,
					`3. Replace "your-api-key-here" with your actual API key`,
					`4. Start using Claude Code with MCP`
				];

			case 'cursor':
				return [
					`1. Open Cursor IDE`,
					`2. Go to Settings → Features → MCP Servers`,
					`3. Click "Add New MCP Server"`,
					`4. Paste the JSON config below (replace "your-api-key-here")`,
					`5. Save and the server will be available`
				];

			case 'cline':
				return [
					1. Open Cline in VS Code`,
					2. Click the MCP icon in the sidebar',
					3. Click "Edit MCP Settings"',
					4. Add the JSON config below to your mcpServers',
					5. Replace "your-api-key-here" with your API key
				];

			case 'windsurf':
				return [
					1. Open Windsurf IDE',
					2. Click the MCPs icon in the top right menu',
					3. Click "Add new global MCP server" or edit mcp_config.json',
					4. Add the JSON config below (replace "your-api-key-here")`,
					5. Save and the server will be available in Cascade
				];

			default:
				return [];
		}
	}

	function getConfigLocation(): string {
		switch (selectedAgent) {
			case 'claude-desktop':
				return '`~/Library/Application Support/Claude/claude_desktop_config.json`';
			case 'cursor':
				return '`mcp.json` in your project directory';
			case 'cline':
				return '`settings.json` in Cline settings';
			case 'windsurf':
				return '`~/.codeium/windsurf/mcp_config.json`';
			default:
				return '';
		}
	}

	async function copyConfig() {
		if (!browser) return;
		const output = getJsonConfig();
		try {
			await navigator.clipboard.writeText(output);
			copiedAgent = selectedAgent;
			toast.success('Config copied to clipboard!');
			setTimeout(() => (copiedAgent = null), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}

	async function copyCommand() {
		if (!browser) return;
		const output = getCliCommand();
		if (!output) return;
		try {
			await navigator.clipboard.writeText(output);
			copiedAgent = selectedAgent;
			toast.success('Command copied to clipboard!');
			setTimeout(() => (copiedAgent = null), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}

	const activeAgent = $derived(agents.find((a) => a.id === selectedAgent)!);
	const instructions = $derived(getInstructions());
	const configLocation = $derived(getConfigLocation());
</script>

<!-- Modern quick start guide -->
<Card class="border-0 bg-card shadow-sm">
	<CardContent class="p-6">
		<!-- Header -->
		<div class="flex items-center justify-between mb-6">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
					<Rocket class="w-5 h-5 text-primary" />
				</div>
				<div>
					<h3 class="font-semibold text-foreground">Quick Start</h3>
					<p class="text-xs text-muted-foreground">Connect your AI agent</p>
				</div>
			</div>
		</div>

		<!-- Agent Selection -->
		<div class="space-y-3 mb-6">
			<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
				Select Agent
			</p>
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
				{#each agents as agent (agent.id)}
					<button
						onclick={() => (selectedAgent = agent.id)}
						class={cn(
							'flex flex-col items-start p-3 rounded-lg border-2 transition-all duration-200 text-left',
							'hover:border-primary/50 hover:bg-primary/5',
							selectedAgent === agent.id
								? 'border-primary bg-primary/10 shadow-sm'
								: 'border-border bg-card'
						)}
					>
						<div class="flex items-center justify-between w-full mb-1">
							<span class="font-medium text-sm">{agent.name}</span>
							{#if agent.badge === 'Recommended'}
								<Badge
									variant="secondary"
									class="text-[9px] h-4 px-1 bg-primary/20 text-primary"
								>
									{agent.badge}
								</Badge>
							{/if}
						</div>
						<span class="text-xs text-muted-foreground">{agent.shortDesc}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- API Key Notice -->
		{#if !selectedApiKey}
			<button
				onclick={() => (showApiKeyInput = !showApiKeyInput)}
				class="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors mb-4 group"
			>
				<span class="text-sm text-foreground">
					{showApiKeyInput ? 'Using custom API key' : 'Use your API key in config'}
				</span>
				<ChevronRight
					class={cn(
						'w-4 h-4 text-muted-foreground transition-transform duration-200',
						showApiKeyInput && 'rotate-90'
					)}
				/>
			</button>
			{#if showApiKeyInput}
				<input
					type="text"
					bind:value={customApiKey}
					placeholder="Enter your API key..."
					class="w-full px-3 py-2.5 text-sm border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-background mb-4"
				/>
			{/if}
		{/if}

		<!-- Instructions -->
		<div class="p-4 bg-muted/50 rounded-lg mb-4 space-y-2">
			<p class="text-sm font-medium text-foreground">Setup Instructions:</p>
			{#each instructions as instruction}
				<p class="text-sm text-muted-foreground">{instruction}</p>
			{/each}
			<p class="text-xs text-muted-foreground">
				Config location: {configLocation}
			</p>
		</div>

		<!-- Config Output -->
		<div class="space-y-3">
			<!-- Type Switcher -->
			{#if activeAgent.configType === 'cli'}
				<div class="p-3 bg-muted rounded-lg">
					<p class="text-xs text-muted-foreground mb-2">Run this command in your terminal:</p>
					<pre
						class="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800 whitespace-pre-wrap"
					><code>{getCliCommand()}</code></pre>
				</div>
			{:else}
				<div class="p-3 bg-muted rounded-lg">
					<p class="text-xs text-muted-foreground mb-2">
						JSON config for {activeAgent.name}:
					</p>
					<pre
						class="bg-slate-950 text-slate-50 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800 whitespace-pre-wrap"
					><code>{getJsonConfig()}</code></pre>
				</div>
			{/if}

			<!-- Copy Button -->
			<Button
				variant="default"
				onclick={activeAgent.configType === 'cli' ? copyCommand : copyConfig}
				class="w-full gap-2"
			>
				{#if copiedAgent === selectedAgent}
					<Check class="w-4 h-4" />
					Copied!
				{:else}
					<Copy class="w-4 h-4" />
					Copy {activeAgent.configType === 'cli' ? 'Command' : 'Config'}
				{/if}
			</Button>
		</div>

		<!-- Transport Info -->
		<div class="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
			<span class="text-xs text-primary">
				<strong>Transport:</strong> HTTP (mcp-remote)
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

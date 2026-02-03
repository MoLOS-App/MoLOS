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
			shortDesc: 'Native desktop app integration',
			icon: Rocket
		},
		{
			id: 'claude-code',
			name: 'Claude Code',
			badge: 'CLI',
			shortDesc: 'Command-line interface',
			icon: Terminal
		},
		{
			id: 'cursor',
			name: 'Cursor',
			badge: 'Editor',
			shortDesc: 'AI-powered code editor',
			icon: Terminal
		},
		{
			id: 'cline',
			name: 'Cline',
			badge: 'VS Code',
			shortDesc: 'VS Code extension',
			icon: Terminal
		},
		{
			id: 'windsurf',
			name: 'Windsurf',
			badge: 'Codeium',
			shortDesc: 'AI IDE by Codeium',
			icon: Terminal
		}
	];

	let selectedAgent = $state<Agent>('claude-desktop');
	let copiedAgent = $state<Agent | null>(null);
	let showApiKeyInput = $state(false);
	let customApiKey = $state('');
	let configTab = $state<'cli' | 'json'>('cli');

	const fullUrl = $derived(
		browser && typeof window !== 'undefined' ? `${window.location.origin}${baseUrl}` : baseUrl
	);

	function getCliCommand(): string {
		const key = selectedApiKey || customApiKey || 'your-api-key-here';
		return `claude mcp add molos-mcp -- npx -y mcp-remote ${fullUrl} --header "MOLOS_MCP_API_KEY: ${key}"`;
	}

	function getJsonConfig(): string {
		const key = selectedApiKey || customApiKey || 'your-api-key-here';
		return JSON.stringify(
			{
				mcpServers: {
					'molos-mcp': {
						command: 'npx',
						args: ['-y', 'mcp-remote', fullUrl, '--header', `MOLOS_MCP_API_KEY: ${key}`],
						env: { MOLOS_MCP_API_KEY: key }
					}
				}
			},
			null,
			2
		);
	}

	async function copyConfig() {
		if (!browser) return;
		const output = configTab === 'cli' ? getCliCommand() : getJsonConfig();
		try {
			await navigator.clipboard.writeText(output);
			copiedAgent = selectedAgent;
			toast.success('Copied to clipboard!');
			setTimeout(() => (copiedAgent = null), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}

	const activeAgent = $derived(agents.find((a) => a.id === selectedAgent)!);
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
					{showApiKeyInput ? 'Using custom API key' : 'Use your API key in command'}
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

		<!-- Config Output -->
		<div class="space-y-3">
			<!-- Tab Switcher -->
			<div class="flex items-center gap-1 p-1 bg-muted rounded-lg">
				<button
					onclick={() => (configTab = 'cli')}
					class={cn(
						'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
						configTab === 'cli'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
					)}
				>
					<Terminal class="w-4 h-4" />
					Command
				</button>
				<button
					onclick={() => (configTab = 'json')}
					class={cn(
						'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
						configTab === 'json'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground hover:bg-background/50'
					)}
				>
					<FileJson class="w-4 h-4" />
					JSON
				</button>
			</div>

			<!-- Code Output -->
			<div class="relative group">
				<pre
					class="p-4 bg-slate-950 text-slate-50 rounded-lg text-xs font-mono overflow-x-auto border border-slate-800"
				><code>{configTab === 'cli' ? getCliCommand() : getJsonConfig()}</code></pre>
			</div>

			<!-- Copy Button -->
			<Button
				variant="default"
				onclick={copyConfig}
				class="w-full gap-2"
			>
				{#if copiedAgent === selectedAgent}
					<Check class="w-4 h-4" />
					Copied!
				{:else}
					<Copy class="w-4 h-4" />
					Copy {configTab === 'cli' ? 'Command' : 'Config'}
				{/if}
			</Button>
		</div>
	</CardContent>
</Card>

<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Info, Code, Terminal, BookOpen, List, Activity, Key } from 'lucide-svelte';

	export type HelpTabId = 'dashboard' | 'keys' | 'resources' | 'prompts' | 'logs';

	export interface HelpContent {
		title: string;
		description: string;
		howItWorks: string[];
		examples: Array<{
			title: string;
			code?: string;
			description: string;
		}>;
	}

	interface TabHelp {
		id: HelpTabId;
		icon: typeof Key;
		content: HelpContent;
	}

	let {
		open,
		onOpenChange,
		tab
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		tab: HelpTabId;
	} = $props();

	const helpContent: Record<HelpTabId, HelpContent> = {
		dashboard: {
			title: 'MCP Dashboard',
			description:
				'The Dashboard provides an overview of your MCP server activity, including statistics, connection information, and quick setup guides.',
			howItWorks: [
				'Monitor your API keys usage and request statistics in real-time',
				'View success rates and average response times',
				'Access quick setup guides for popular AI coding agents',
				'See available external modules that can be accessed via MCP'
			],
			examples: [
				{
					title: 'API Key Statistics',
					description: 'View how many active API keys you have and their usage patterns'
				},
				{
					title: 'Connection Info',
					description:
						'Get the transport URL and protocol version needed to configure your MCP client'
				}
			]
		},
		keys: {
			title: 'API Keys Management',
			description:
				'API keys are used to authenticate requests to your MCP server. Each key can be restricted to specific modules and have an expiration date.',
			howItWorks: [
				'Create API keys with specific names to identify different applications',
				'Restrict key access to specific external modules for better security',
				'Set expiration dates to automatically revoke access after a certain period',
				'Enable or disable keys without revoking them',
				'View key usage statistics including last used timestamp'
			],
			examples: [
				{
					title: 'Creating a Key for Claude Desktop',
					description:
						'Create an API key with "Claude Desktop" as the name, select the modules it can access, and leave expiration empty for permanent access.'
				},
				{
					title: 'Key with Module Restrictions',
					code: `{
  "allowedModules": ["molos-analytics", "molos-ai-tools"]
}`,
					description:
						'This key can only access the analytics and AI tools modules, not other external modules.'
				}
			]
		},
		resources: {
			title: 'MCP Resources',
			description:
				'Resources are data sources that can be accessed via the MCP protocol. They represent configuration values, data stores, or any read-only data your modules expose.',
			howItWorks: [
				'Resources are identified by unique URIs like "config://app/settings"',
				'Each resource can be global (available to all modules) or module-specific',
				'You can enable/disable resources without deleting them',
				'Clients can list and read resources through the MCP protocol'
			],
			examples: [
				{
					title: 'Configuration Resource',
					code: `URI: config://app/database
Description: Database connection settings
Module: Global`,
					description:
						'A global resource that provides database configuration to any module that requests it.'
				},
				{
					title: 'User Profile Resource',
					code: `URI: user://profile/{id}
Description: User profile data
Module: molos-users`,
					description: 'A module-specific resource that only the users module can access.'
				}
			]
		},
		prompts: {
			title: 'MCP Prompts',
			description:
				'Prompts are reusable templates that AI agents can request to execute predefined tasks with specific parameters.',
			howItWorks: [
				'Prompts have a name, description, and optional arguments with types',
				'Arguments can be required or optional, with specific types (string, number, boolean, etc.)',
				'Like resources, prompts can be global or module-specific',
				'Agents invoke prompts by name and pass the required arguments'
			],
			examples: [
				{
					title: 'Data Analysis Prompt',
					code: `Name: analyze-data
Arguments:
  - data: string (required)
  - format: "json" | "csv" (optional)
  - includeStats: boolean (optional)

Usage: Agent calls with data to analyze`,
					description: 'A prompt that analyzes data and returns insights in the requested format.'
				},
				{
					title: 'Code Review Prompt',
					code: `Name: review-code
Arguments:
  - code: string (required)
  - language: string (optional)
  - maxIssues: number (optional)`,
					description: 'A prompt that reviews code for potential issues and suggests improvements.'
				}
			]
		},
		logs: {
			title: 'Activity Logs',
			description:
				'Activity logs provide a detailed history of all MCP requests made to your server, including successful and failed requests.',
			howItWorks: [
				'Each request is logged with the API key used, method called, and duration',
				'Filter logs by API key, method, status, or search terms',
				'View detailed error messages and stack traces for failed requests',
				'Track request/response data for debugging and auditing'
			],
			examples: [
				{
					title: 'Successful Resource Read',
					code: `Method: resources/read
Status: success
Duration: 15ms
Tool: config://app/settings
Resource: config://app/settings`,
					description: 'A successful request to read the application settings resource.'
				},
				{
					title: 'Failed Prompt Call',
					code: `Method: prompts/call
Status: error
Error: Missing required argument 'content'
Duration: 8ms
Prompt: generate-summary`,
					description: 'A failed request due to missing required arguments in the prompt call.'
				}
			]
		}
	};

	const content = $derived(helpContent[tab]);
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Info class="h-5 w-5 text-primary" />
				{#if content}
					{content.title}
				{/if}
			</DialogTitle>
		</DialogHeader>

		{#if content}
			<div class="space-y-6 py-4">
				<!-- Description -->
				<div class="prose prose-sm max-w-none">
					<p class="text-muted-foreground">{content.description}</p>
				</div>

				<!-- How It Works -->
				<div class="space-y-3">
					<h3 class="flex items-center gap-2 text-sm font-semibold">
						<BookOpen class="h-4 w-4 text-primary" />
						How It Works
					</h3>
					<ul class="space-y-2">
						{#each content.howItWorks as item}
							<li class="text-muted-foreground flex items-start gap-2 text-sm">
								<span class="mt-0.5 text-primary">•</span>
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</div>

				<!-- Examples -->
				{#if content.examples.length > 0}
					<div class="space-y-3">
						<h3 class="flex items-center gap-2 text-sm font-semibold">
							<Terminal class="h-4 w-4 text-primary" />
							Examples
						</h3>
						<div class="space-y-4">
							{#each content.examples as example}
								<div class="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
									<h4 class="text-sm font-medium text-foreground">{example.title}</h4>
									{#if example.code}
										<pre
											class="overflow-x-auto rounded border border-border bg-background p-3 text-xs"><code
												>{example.code}</code
											></pre>
									{/if}
									<p class="text-muted-foreground text-sm">{example.description}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex justify-end border-t border-border pt-4">
			<Button onclick={() => onOpenChange(false)}>Got it</Button>
		</div>
	</DialogContent>
</Dialog>

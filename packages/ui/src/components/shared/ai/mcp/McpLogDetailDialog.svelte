<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Activity, CheckCircle, XCircle, Clock, Copy, Check } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	export interface McpLogDetail {
		id: string;
		createdAt: string;
		method: string;
		status: 'success' | 'error';
		durationMs: number;
		errorMessage?: string;
		errorStack?: string;
		requestData?: unknown;
		responseData?: unknown;
		apiKeyId: string;
		apiKeyName?: string;
		toolName?: string;
		resourceName?: string;
		promptName?: string;
	}

	let {
		open,
		onOpenChange,
		log
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		log: McpLogDetail | null;
	} = $props();

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			toast.success('Copied to clipboard');
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Failed to copy');
		}
	}

	function formatJson(data: unknown): string {
		if (data === null || data === undefined) return 'N/A';
		if (typeof data === 'string') {
			try {
				const parsed = JSON.parse(data);
				return JSON.stringify(parsed, null, 2);
			} catch {
				return data;
			}
		}
		return JSON.stringify(data, null, 2);
	}
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Activity class="h-5 w-5" />
				Request Details
			</DialogTitle>
		</DialogHeader>

		{#if log}
			<div class="space-y-4">
				<!-- Status Header -->
				<div
					class="flex items-center justify-between rounded-lg p-4 {log.status === 'success'
						? 'bg-success/10'
						: 'bg-error/10'}"
				>
					<div class="flex items-center gap-3">
						{#if log.status === 'success'}
							<CheckCircle class="text-success h-6 w-6" />
						{:else}
							<XCircle class="text-error h-6 w-6" />
						{/if}
						<div>
							<p class="text-lg font-semibold text-foreground">
								{log.status === 'success' ? 'Success' : 'Error'}
							</p>
							<p class="text-muted-foreground text-sm">
								{new Date(log.createdAt).toLocaleString()}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Badge variant="secondary" class="font-mono text-xs">
							{log.method}
						</Badge>
						<div class="text-muted-foreground flex items-center gap-1 text-sm">
							<Clock class="h-4 w-4" />
							<span>{log.durationMs}ms</span>
						</div>
					</div>
				</div>

				<!-- Error Details (if error) -->
				{#if log.status === 'error'}
					<div class="bg-error/5 border-error/20 space-y-3 rounded-lg border p-4">
						<div class="flex items-center justify-between">
							<h3 class="text-error text-sm font-semibold">Error Message</h3>
							{#if log.errorMessage}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => copyToClipboard(log.errorMessage!)}
									class="h-6 px-2"
								>
									{#if copied}
										<Check class="h-3 w-3" />
									{:else}
										<Copy class="h-3 w-3" />
									{/if}
								</Button>
							{/if}
						</div>
						<p class="text-sm break-all whitespace-pre-wrap text-foreground">
							{log.errorMessage || 'Unknown error'}
						</p>
						{#if log.errorStack}
							<details class="mt-2">
								<summary class="text-muted-foreground cursor-pointer text-xs hover:text-foreground">
									Show error stack
								</summary>
								<pre
									class="text-muted-foreground mt-2 overflow-x-auto text-xs whitespace-pre-wrap">{log.errorStack}</pre>
							</details>
						{/if}
					</div>
				{/if}

				<!-- Request Details -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold text-foreground">Request Details</h3>
						{#if log.requestData}
							<Button
								variant="ghost"
								size="sm"
								onclick={() => copyToClipboard(formatJson(log.requestData))}
								class="h-6 px-2"
							>
								<Copy class="h-3 w-3" />
							</Button>
						{/if}
					</div>
					{#if log.toolName}
						<div class="flex items-center gap-2 text-sm">
							<span class="text-muted-foreground">Tool:</span>
							<Badge variant="secondary">{log.toolName}</Badge>
						</div>
					{/if}
					{#if log.resourceName}
						<div class="flex items-center gap-2 text-sm">
							<span class="text-muted-foreground">Resource:</span>
							<code class="rounded bg-muted px-2 py-1 font-mono text-xs">{log.resourceName}</code>
						</div>
					{/if}
					{#if log.promptName}
						<div class="flex items-center gap-2 text-sm">
							<span class="text-muted-foreground">Prompt:</span>
							<Badge variant="secondary">{log.promptName}</Badge>
						</div>
					{/if}
					<div class="flex items-center gap-2 text-sm">
						<span class="text-muted-foreground">API Key:</span>
						<span class="text-foreground">{log.apiKeyName || log.apiKeyId.slice(0, 8) + '...'}</span
						>
					</div>
				</div>

				<!-- Request Data -->
				{#if log.requestData}
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-semibold text-foreground">Request Data</h3>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => copyToClipboard(formatJson(log.requestData))}
								class="h-6 px-2"
							>
								<Copy class="h-3 w-3" />
							</Button>
						</div>
						<pre
							class="overflow-x-auto rounded-lg bg-muted p-3 text-xs break-all whitespace-pre-wrap"><code
								>{formatJson(log.requestData)}</code
							></pre>
					</div>
				{/if}

				<!-- Response Data -->
				{#if log.responseData}
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-semibold text-foreground">Response Data</h3>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => copyToClipboard(formatJson(log.responseData))}
								class="h-6 px-2"
							>
								<Copy class="h-3 w-3" />
							</Button>
						</div>
						<pre
							class="overflow-x-auto rounded-lg bg-muted p-3 text-xs break-all whitespace-pre-wrap"><code
								>{formatJson(log.responseData)}</code
							></pre>
					</div>
				{/if}
			</div>
		{/if}

		<DialogFooter>
			<Button onclick={() => onOpenChange(false)}>Close</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

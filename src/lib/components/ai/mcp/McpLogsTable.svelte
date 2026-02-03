<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import {
		Activity,
		Search,
		CheckCircle,
		XCircle,
		Clock,
		Eye
	} from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle } from '$lib/components/ui/empty';

	export interface McpLog {
		id: string;
		createdAt: string;
		method: string;
		status: 'success' | 'error';
		durationMs: number;
		errorMessage?: string;
		apiKeyId: string;
		toolName?: string;
		resourceName?: string;
		promptName?: string;
	}

	export interface ApiKeyOption {
		id: string;
		name: string;
	}

	let {
		logs = [],
		apiKeyOptions = [],
		onViewDetails
	}: {
		logs: McpLog[];
		apiKeyOptions: ApiKeyOption[];
		onViewDetails?: (logId: string) => void;
	} = $props();

	let searchQuery = $state('');
	let apiKeyFilter = $state('');
	let methodFilter = $state('');
	let statusFilter = $state('');

	const filteredLogs = $derived(
		logs.filter((log) => {
			const matchesSearch =
				!searchQuery ||
				log.method?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				log.toolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				log.resourceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				log.promptName?.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesApiKey = !apiKeyFilter || log.apiKeyId === apiKeyFilter;
			const matchesMethod = !methodFilter || log.method === methodFilter;
			const matchesStatus = !statusFilter || log.status === statusFilter;
			return matchesSearch && matchesApiKey && matchesMethod && matchesStatus;
		})
	);

	const uniqueMethods = $derived(Array.from(new Set(logs.map((log) => log.method))).sort());
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4 flex-wrap">
		<div class="relative flex-1 min-w-[200px] max-w-md">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				placeholder="Search logs..."
				class="w-full pl-9 h-9"
			/>
		</div>
		<Select bind:value={apiKeyFilter}>
			<SelectTrigger class="h-9 w-40">
				{apiKeyFilter ? apiKeyOptions.find(k => k.id === apiKeyFilter)?.name || 'All API Keys' : 'All API Keys'}
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="">All API Keys</SelectItem>
				{#each apiKeyOptions as key}
					<SelectItem value={key.id}>{key.name}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
		<Select bind:value={methodFilter}>
			<SelectTrigger class="h-9 w-40">
				{methodFilter || 'All Methods'}
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="">All Methods</SelectItem>
				{#each uniqueMethods as method}
					<SelectItem value={method}>{method}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
		<Select bind:value={statusFilter}>
			<SelectTrigger class="h-9 w-40">
				{#if statusFilter === ''}
					All Status
				{:else if statusFilter === 'success'}
					Success
				{:else if statusFilter === 'error'}
					Error
				{/if}
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="">All Status</SelectItem>
				<SelectItem value="success">Success</SelectItem>
				<SelectItem value="error">Error</SelectItem>
			</SelectContent>
		</Select>
	</div>

	<!-- Table -->
	<Card>
		<CardContent class="p-0">
			{#if filteredLogs.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							<Activity class="w-16 h-16 text-muted-foreground" />
						</EmptyMedia>
						<EmptyTitle>No logs found</EmptyTitle>
					</Empty>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-muted/50 border-b border-border">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Time
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Method
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Target
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Status
								</th>
								<th
									class="px-6 py-3 text-left text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Duration
								</th>
								<th
									class="px-6 py-3 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredLogs as log}
								<tr class="hover:bg-accent/50">
									<td class="px-6 py-4">
										<div class="text-sm text-foreground">
											{new Date(log.createdAt).toLocaleString()}
										</div>
									</td>
									<td class="px-6 py-4">
										<Badge variant="secondary" class="text-xs font-mono">
											{log.method}
										</Badge>
									</td>
									<td class="px-6 py-4">
										{#if log.toolName}
											<div class="text-sm font-medium text-foreground">{log.toolName}</div>
										{:else if log.resourceName}
											<code class="text-sm font-mono text-foreground bg-muted px-2 py-1 rounded">
												{log.resourceName}
											</code>
										{:else if log.promptName}
											<div class="text-sm font-medium text-foreground">{log.promptName}</div>
										{:else}
											<span class="text-sm text-muted-foreground">-</span>
										{/if}
									</td>
									<td class="px-6 py-4">
										{#if log.status === 'success'}
											<div class="flex items-center gap-2">
												<CheckCircle class="w-4 h-4 text-success" />
												<span class="text-sm text-success">Success</span>
											</div>
										{:else}
											<div class="flex items-center gap-2">
												<XCircle class="w-4 h-4 text-error" />
												<span class="text-sm text-error">Error</span>
											</div>
										{/if}
									</td>
									<td class="px-6 py-4">
										<div class="flex items-center gap-1 text-sm text-muted-foreground">
											<Clock class="w-4 h-4" />
											<span>{log.durationMs}ms</span>
										</div>
									</td>
									<td class="px-6 py-4 text-right">
										{#if onViewDetails}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => onViewDetails(log.id)}
											>
												<Eye class="w-4 h-4" />
											</Button>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

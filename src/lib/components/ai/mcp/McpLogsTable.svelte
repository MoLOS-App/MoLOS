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
		HelpCircle,
		ChevronLeft,
		ChevronRight
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
		onShowHelp
	}: {
		logs: McpLog[];
		apiKeyOptions: ApiKeyOption[];
		onShowHelp?: () => void;
	} = $props();

	let searchQuery = $state('');
	let apiKeyFilter = $state('');
	let methodFilter = $state('');
	let statusFilter = $state('');
	let currentPage = $state(1);
	const itemsPerPage = 10;

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

	// Reset to page 1 when filters change
	$effect(() => {
		searchQuery;
		apiKeyFilter;
		methodFilter;
		statusFilter;
		currentPage = 1;
	});

	const totalPages = $derived(Math.ceil(filteredLogs.length / itemsPerPage));
	const paginatedLogs = $derived(
		filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	const uniqueMethods = $derived(Array.from(new Set(logs.map((log) => log.method))).sort());

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="relative flex-1 min-w-[200px] max-w-md">
			<Search class="absolute w-4 h-4 -translate-y-1/2 left-3 top-1/2 text-muted-foreground" />
			<Input
				bind:value={searchQuery}
				placeholder="Search logs..."
				class="w-full pl-9 h-9"
			/>
		</div>
		<Select bind:value={apiKeyFilter}>
			<SelectTrigger class="w-40 h-9">
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
			<SelectTrigger class="w-40 h-9">
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
			<SelectTrigger class="w-40 h-9">
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
		{#if onShowHelp}
			<Button
				variant="ghost"
				size="icon"
				onclick={onShowHelp}
				class="flex-shrink-0 text-muted-foreground hover:text-foreground"
				title="Show help"
			>
				<HelpCircle class="w-5 h-5" />
			</Button>
		{/if}
	</div>

	<!-- Table -->
	<Card class="p-0">
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
						<thead class="border-b bg-muted/50 border-border">
							<tr>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Time
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Method
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Target
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Status
								</th>
								<th
									class="px-6 py-3 text-xs font-bold tracking-wider text-left uppercase text-muted-foreground"
								>
									Duration
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each paginatedLogs as log}
								<tr class="hover:bg-accent/50">
									<td class="px-6 py-4">
										<div class="text-sm text-foreground">
											{new Date(log.createdAt).toLocaleString()}
										</div>
									</td>
									<td class="px-6 py-4">
										<Badge variant="secondary" class="font-mono text-xs">
											{log.method}
										</Badge>
									</td>
									<td class="px-6 py-4">
										{#if log.toolName}
											<div class="text-sm font-medium text-foreground">{log.toolName}</div>
										{:else if log.resourceName}
											<code class="px-2 py-1 font-mono text-sm rounded text-foreground bg-muted">
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
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="flex items-center justify-between px-6 py-4 border-t border-border">
						<div class="text-sm text-muted-foreground">
							Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
						</div>
						<div class="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => goToPage(currentPage - 1)}
								disabled={currentPage === 1}
								class="gap-1"
							>
								<ChevronLeft class="w-4 h-4" />
								Previous
							</Button>
							<div class="flex items-center gap-1">
								{#each Array(totalPages) as _, i}
									{@const page = i + 1}
									{#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
										<Button
											variant={page === currentPage ? 'default' : 'outline'}
											size="sm"
											onclick={() => goToPage(page)}
											class="w-9 h-9"
										>
											{page}
										</Button>
									{:else if page === currentPage - 2 || page === currentPage + 2}
										<span class="text-muted-foreground">...</span>
									{/if}
								{/each}
							</div>
							<Button
								variant="outline"
								size="sm"
								onclick={() => goToPage(currentPage + 1)}
								disabled={currentPage === totalPages}
								class="gap-1"
							>
								Next
								<ChevronRight class="w-4 h-4" />
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</CardContent>
	</Card>
</div>

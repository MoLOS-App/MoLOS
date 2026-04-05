<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { RefreshCw, Trash2, Terminal, Search } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';

	type Props = {
		serverLogs: ServerLog[];
		onRefreshLogs: () => void;
		onClearLogs: () => void;
		requestConfirmation: (title: string, description: string, action: () => void) => void;
	};

	type ServerLog = {
		id: number;
		level: 'info' | 'warn' | 'error';
		source: string;
		message: string;
		details?: string | null;
		createdAt: Date | number | string;
	};

	let { serverLogs, onRefreshLogs, onClearLogs, requestConfirmation }: Props = $props();

	// Log filtering
	let logSearchQuery = $state('');
	let logLevelFilter = $state('all');
	let logSourceFilter = $state('all');

	const filteredLogs = $derived(
		serverLogs.filter((log) => {
			const matchesSearch =
				logSearchQuery === '' ||
				log.message.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
				(log.details && log.details.toLowerCase().includes(logSearchQuery.toLowerCase()));
			const matchesLevel = logLevelFilter === 'all' || log.level === logLevelFilter;
			const matchesSource = logSourceFilter === 'all' || log.source === logSourceFilter;
			return matchesSearch && matchesLevel && matchesSource;
		})
	);

	const uniqueSources = $derived([...new Set(serverLogs.map((log) => log.source))]);
	const uniqueLevels = $derived([...new Set(serverLogs.map((log) => log.level))]);

	async function handleClearLogs() {
		requestConfirmation(
			'Clear Server Logs',
			'Are you sure you want to clear all server logs? This action cannot be undone.',
			async () => {
				try {
					const response = await fetch('/api/settings/logs', { method: 'DELETE' });
					if (response.ok) {
						toast.success('Logs cleared');
						onRefreshLogs();
					}
				} catch (err) {
					toast.error('Error clearing logs');
				}
			}
		);
	}

	function formatDate(date: Date | number | string) {
		return new Date(date).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function getLogLevelColor(level: string) {
		switch (level) {
			case 'error':
				return 'text-destructive bg-destructive/10 border-destructive/20';
			case 'warn':
				return 'text-accent bg-accent/10 border-accent/20';
			case 'info':
				return 'text-primary bg-primary/10 border-primary/20';
			default:
				return 'text-muted-foreground bg-muted border-muted-foreground/20';
		}
	}
</script>

<Card class="overflow-hidden border-none shadow-sm">
	<CardHeader class="flex flex-col gap-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<CardTitle class="font-bold">Server Logs</CardTitle>
				<CardDescription class="font-medium tracking-wider uppercase"
					>Real-time system events and diagnostic information</CardDescription
				>
			</div>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					class="border-muted-foreground/20 rounded-xl text-xs font-bold"
					onclick={onRefreshLogs}
				>
					<RefreshCw class="mr-2 h-3.5 w-3.5" />
					Refresh
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="border-muted-foreground/20 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10"
					onclick={handleClearLogs}
				>
					<Trash2 class="mr-2 h-3.5 w-3.5" />
					Clear Logs
				</Button>
			</div>
		</div>
		<!-- Log Filters -->
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
			<div class="relative flex-1">
				<Search
					class="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
				/>
				<Input
					placeholder="Search logs by message or details..."
					bind:value={logSearchQuery}
					class="h-9 rounded-xl border-none bg-muted/10 pl-9 text-xs shadow-xs focus-visible:ring-1"
				/>
			</div>
			<div class="flex gap-2">
				<select
					bind:value={logLevelFilter}
					class="h-9 rounded-xl border-none bg-muted/10 px-3 text-xs font-bold focus-visible:ring-1"
				>
					<option value="all">All Levels</option>
					{#each uniqueLevels as level}
						<option value={level}>{level.toUpperCase()}</option>
					{/each}
				</select>
				<select
					bind:value={logSourceFilter}
					class="h-9 rounded-xl border-none bg-muted/10 px-3 text-xs font-bold focus-visible:ring-1"
				>
					<option value="all">All Sources</option>
					{#each uniqueSources as source}
						<option value={source}>{source}</option>
					{/each}
				</select>
			</div>
		</div>
	</CardHeader>
	<CardContent class="p-0">
		<div class="max-h-[600px] overflow-y-auto">
			<Table.Root>
				<Table.Header class="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
					<Table.Row>
						<Table.Head class="w-[180px] text-[10px] font-black tracking-widest uppercase"
							>Timestamp</Table.Head
						>
						<Table.Head class="w-[100px] text-[10px] font-black tracking-widest uppercase"
							>Level</Table.Head
						>
						<Table.Head class="w-[150px] text-[10px] font-black tracking-widest uppercase"
							>Source</Table.Head
						>
						<Table.Head class="text-[10px] font-black tracking-widest uppercase">Message</Table.Head
						>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each filteredLogs as log}
						<Table.Row class="group transition-colors hover:bg-background/50">
							<Table.Cell class="text-muted-foreground font-mono text-[10px]">
								{formatDate(log.createdAt)}
							</Table.Cell>
							<Table.Cell>
								<Badge
									variant="outline"
									class={cn(
										'rounded-lg px-1.5 text-[9px] font-bold tracking-tighter uppercase',
										getLogLevelColor(log.level)
									)}
								>
									{log.level}
								</Badge>
							</Table.Cell>
							<Table.Cell
								class="text-muted-foreground text-[10px] font-black tracking-wider uppercase"
							>
								{log.source}
							</Table.Cell>
							<Table.Cell>
								<div class="flex flex-col gap-1">
									<span class="text-xs font-medium">{log.message}</span>
									{#if log.details}
										<pre
											class="border-muted-foreground/5 mt-1 hidden overflow-x-auto rounded-lg border bg-background/50 p-2 font-mono text-[10px] group-hover:block">{log.details}</pre>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={4} class="h-32 text-center">
								<div class="flex flex-col items-center justify-center space-y-2">
									<Terminal class="w-8 h-8 text-muted-foreground/50" />
									<p class="text-xs font-bold tracking-widest uppercase text-muted-foreground">
										{#if logSearchQuery || logLevelFilter !== 'all' || logSourceFilter !== 'all'}
											No logs match your filters
										{:else}
											No logs available
										{/if}
									</p>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</CardContent>
</Card>

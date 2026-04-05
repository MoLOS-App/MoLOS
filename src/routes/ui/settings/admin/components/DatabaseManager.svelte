<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import {
		Database,
		RefreshCw,
		HardDrive,
		ArrowUpDown,
		Upload,
		FileUp,
		ChevronLeft,
		ChevronRight,
		Search,
		Table2,
		Trash2,
		Download
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	type Props = {
		requestConfirmation: (title: string, description: string, action: () => void) => void;
		onDownloadDb: () => void;
	};

	let { requestConfirmation, onDownloadDb }: Props = $props();

	// State
	let tables = $state<TableInfo[]>([]);
	let dbSizeBytes = $state(0);
	let isLoading = $state(false);
	let isVacuuming = $state(false);
	let isRestoring = $state(false);

	// Table viewer state
	let selectedTable = $state<string | null>(null);
	let tableData = $state<TableDataResponse | null>(null);
	let isLoadingTableData = $state(false);
	let tableSearchQuery = $state('');

	// File input ref
	let fileInput: HTMLInputElement | undefined = $state();

	type TableInfo = {
		name: string;
		rowCount: number;
	};

	type TableDataResponse = {
		table: string;
		columns: { name: string; type: string; pk: number; notnull: number }[];
		rows: Record<string, unknown>[];
		pagination: { page: number; limit: number; total: number; totalPages: number };
	};

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	function formatNumber(n: number): string {
		return n.toLocaleString();
	}

	async function loadTables() {
		isLoading = true;
		try {
			const response = await fetch('/api/settings/admin/db/tables');
			if (response.ok) {
				const data = await response.json();
				tables = data.tables;
				dbSizeBytes = data.dbSizeBytes;
			} else {
				toast.error('Failed to load tables');
			}
		} catch {
			toast.error('Error loading tables');
		} finally {
			isLoading = false;
		}
	}

	async function loadTableData(tableName: string, page = 1) {
		isLoadingTableData = true;
		selectedTable = tableName;
		tableSearchQuery = '';
		try {
			const params = new URLSearchParams({ table: tableName, page: String(page), limit: '50' });
			const response = await fetch(`/api/settings/admin/db/tables?${params}`);
			if (response.ok) {
				tableData = await response.json();
			} else {
				toast.error('Failed to load table data');
			}
		} catch {
			toast.error('Error loading table data');
		} finally {
			isLoadingTableData = false;
		}
	}

	function goBackToTables() {
		selectedTable = null;
		tableData = null;
	}

	function changePage(page: number) {
		if (selectedTable) {
			loadTableData(selectedTable, page);
		}
	}

	async function handleVacuum() {
		requestConfirmation(
			'Vacuum Database',
			'This will rebuild the database file, reclaiming unused space. The database will be locked during this operation. Continue?',
			async () => {
				isVacuuming = true;
				try {
					const response = await fetch('/api/settings/admin/db/vacuum', { method: 'POST' });
					if (response.ok) {
						const result = await response.json();
						toast.success(
							`Vacuum complete. ${result.savedHuman} recovered (${formatBytes(result.sizeBefore)} → ${formatBytes(result.sizeAfter)})`
						);
						loadTables();
					} else {
						const err = await response.json();
						toast.error(err.message || 'Vacuum failed');
					}
				} catch {
					toast.error('Error during vacuum');
				} finally {
					isVacuuming = false;
				}
			}
		);
	}

	async function handleRestore() {
		fileInput?.click();
	}

	async function handleFileSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		requestConfirmation(
			'Restore Database',
			`This will replace the current database with "${file.name}". A backup of the current database will be created automatically. This action cannot be undone.`,
			async () => {
				isRestoring = true;
				try {
					const formData = new FormData();
					formData.append('file', file);
					const response = await fetch('/api/settings/admin/db/restore', {
						method: 'POST',
						body: formData
					});
					if (response.ok) {
						const result = await response.json();
						toast.success('Database restored successfully. You may need to refresh the page.');
						loadTables();
						if (selectedTable) {
							loadTableData(selectedTable);
						}
					} else {
						const err = await response.json();
						toast.error(err.message || 'Restore failed');
					}
				} catch {
					toast.error('Error during restore');
				} finally {
					isRestoring = false;
					if (fileInput) fileInput.value = '';
				}
			}
		);

		// Reset input so same file can be selected again
		input.value = '';
	}

	function truncateValue(value: unknown): string {
		if (value === null || value === undefined) return 'NULL';
		const str = String(value);
		return str.length > 100 ? str.slice(0, 100) + '...' : str;
	}

	function getColumnKeys(rows: Record<string, unknown>[]): string[] {
		if (rows.length === 0) return [];
		return Object.keys(rows[0]);
	}

	// Initial load
	$effect(() => {
		loadTables();
	});
</script>

<input type="file" bind:this={fileInput} accept=".db,.sqlite,.sqlite3" class="hidden" onchange={handleFileSelected} />

<Card class="overflow-hidden border-none shadow-sm">
	<CardHeader class="flex flex-col gap-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<CardTitle class="font-bold">Database Management</CardTitle>
				<CardDescription class="font-medium tracking-wider uppercase"
					>View, maintain, and restore your SQLite database</CardDescription
				>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					class="border-muted-foreground/20 rounded-xl text-xs font-bold"
					onclick={loadTables}
					disabled={isLoading}
				>
					<RefreshCw class="mr-2 h-3.5 w-3.5 {isLoading ? 'animate-spin' : ''}" />
					Refresh
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="border-muted-foreground/20 rounded-xl text-xs font-bold"
					onclick={handleVacuum}
					disabled={isVacuuming}
				>
					<Trash2 class="mr-2 h-3.5 w-3.5" />
					{isVacuuming ? 'Vacuuming...' : 'Vacuum'}
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="border-muted-foreground/20 rounded-xl text-xs font-bold"
					onclick={onDownloadDb}
				>
					<Download class="mr-2 h-3.5 w-3.5" />
					Download
				</Button>
				<Button
					variant="outline"
					size="sm"
					class="border-muted-foreground/20 rounded-xl text-xs font-bold"
					onclick={handleRestore}
					disabled={isRestoring}
				>
					<Upload class="mr-2 h-3.5 w-3.5" />
					{isRestoring ? 'Restoring...' : 'Restore'}
				</Button>
			</div>
		</div>

		<!-- DB Stats -->
		<div class="flex flex-wrap gap-3">
			<Badge variant="outline" class="rounded-xl px-3 py-1.5 text-xs font-bold">
				<HardDrive class="mr-1.5 h-3 w-3" />
				Size: {formatBytes(dbSizeBytes)}
			</Badge>
			<Badge variant="outline" class="rounded-xl px-3 py-1.5 text-xs font-bold">
				<Table2 class="mr-1.5 h-3 w-3" />
				{tables.length} Tables
			</Badge>
		</div>
	</CardHeader>
	<CardContent class="p-0">
		{#if selectedTable && tableData}
			<!-- Table Data View -->
			<div>
				<div class="flex items-center gap-3 border-b px-6 py-3">
					<Button
						variant="ghost"
						size="sm"
						class="h-8 rounded-lg text-xs font-bold"
						onclick={goBackToTables}
					>
						<ChevronLeft class="mr-1 h-3.5 w-3.5" />
						Back
					</Button>
					<div class="flex items-center gap-2">
						<Table2 class="h-4 w-4 text-muted-foreground" />
						<span class="text-sm font-bold">{selectedTable}</span>
						<Badge variant="outline" class="rounded-lg text-[10px] font-bold">
							{formatNumber(tableData!.pagination.total)} rows
						</Badge>
					</div>
				</div>

				{#if isLoadingTableData}
					<div class="flex items-center justify-center py-12">
						<RefreshCw class="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				{:else}
					<div class="max-h-[500px] overflow-auto">
						<Table.Root>
							<Table.Header class="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
								<Table.Row>
									<Table.Head class="w-[50px] text-[10px] font-black tracking-widest uppercase"
										>#</Table.Head
									>
									{#each tableData.columns as col}
										<Table.Head class="text-[10px] font-black tracking-widest uppercase">
											<div class="flex items-center gap-1">
												{col.name}
												{#if col.pk}
													<Badge variant="outline" class="rounded px-1 py-0 text-[8px]">PK</Badge>
												{/if}
											</div>
										</Table.Head>
									{/each}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each tableData.rows as row, i}
									<Table.Row class="group transition-colors hover:bg-background/50">
										<Table.Cell class="text-muted-foreground font-mono text-[10px]">
											{(tableData!.pagination.page - 1) * tableData!.pagination.limit + i + 1}
										</Table.Cell>
										{#each tableData.columns as col}
											<Table.Cell class="max-w-[300px] truncate font-mono text-[11px]">
												{#if row[col.name] === null || row[col.name] === undefined}
													<span class="text-muted-foreground italic">NULL</span>
												{:else}
													{truncateValue(row[col.name])}
												{/if}
											</Table.Cell>
										{/each}
									</Table.Row>
								{:else}
									<Table.Row>
										<Table.Cell colspan={tableData.columns.length + 1} class="h-24 text-center">
											<p class="text-xs font-bold tracking-widest uppercase text-muted-foreground">
												No data in table
											</p>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>

					<!-- Pagination -->
					{#if tableData!.pagination.totalPages > 1}
						<div class="flex items-center justify-between border-t px-6 py-3">
							<span class="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
								Page {tableData!.pagination.page} of {tableData!.pagination.totalPages}
							</span>
							<div class="flex gap-1">
								<Button
									variant="outline"
									size="sm"
									class="h-7 rounded-lg px-2 text-[10px] font-bold"
									disabled={tableData!.pagination.page <= 1}
									onclick={() => changePage(tableData!.pagination.page - 1)}
								>
									<ChevronLeft class="h-3 w-3" />
								</Button>
								<Button
									variant="outline"
									size="sm"
									class="h-7 rounded-lg px-2 text-[10px] font-bold"
									disabled={tableData!.pagination.page >= tableData!.pagination.totalPages}
									onclick={() => changePage(tableData!.pagination.page + 1)}
								>
									<ChevronRight class="h-3 w-3" />
								</Button>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{:else}
			<!-- Tables List View -->
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<RefreshCw class="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			{:else}
				<div class="max-h-[600px] overflow-y-auto">
					<Table.Root>
						<Table.Header class="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
							<Table.Row>
								<Table.Head class="text-[10px] font-black tracking-widest uppercase"
									>Table Name</Table.Head
								>
								<Table.Head class="w-[120px] text-[10px] font-black tracking-widest uppercase"
									>Rows</Table.Head
								>
								<Table.Head class="w-[100px] text-[10px] font-black tracking-widest uppercase text-right"
									>Action</Table.Head
								>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each tables as table}
								<Table.Row class="group transition-colors hover:bg-background/50">
									<Table.Cell>
										<div class="flex items-center gap-2">
											<Table2 class="h-4 w-4 text-muted-foreground" />
											<span class="font-mono text-sm font-medium">{table.name}</span>
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant="outline" class="rounded-lg font-mono text-[10px] font-bold">
											{formatNumber(table.rowCount)}
										</Badge>
									</Table.Cell>
									<Table.Cell class="text-right">
										<Button
											variant="ghost"
											size="sm"
											class="h-7 rounded-lg text-[10px] font-bold"
											onclick={() => loadTableData(table.name)}
										>
											View
										</Button>
									</Table.Cell>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell colspan={3} class="h-32 text-center">
										<div class="flex flex-col items-center justify-center space-y-2">
											<Database class="w-8 h-8 text-muted-foreground/50" />
											<p class="text-xs font-bold tracking-widest uppercase text-muted-foreground">
												No tables found
											</p>
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
			{/if}
		{/if}
	</CardContent>
</Card>

<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { Search, Plus, HelpCircle } from 'lucide-svelte';
	import { Empty, EmptyMedia, EmptyTitle, EmptyContent } from '$lib/components/ui/empty';
	import type { DataTableColumn, DataTableAction, DataTableFilter } from './types.js';

	let {
		data = [],
		columns = [],
		actions = [],
		filters = [],
		searchPlaceholder = 'Search...',
		searchKey = 'name',
		createLabel = 'Create',
		onCreate,
		onShowHelp,
		emptyIcon,
		emptyTitle = 'No items found',
		emptyContent
	}: {
		data: any[];
		columns: DataTableColumn<any>[];
		actions?: DataTableAction<any>[];
		filters?: DataTableFilter[];
		searchPlaceholder?: string;
		searchKey?: string;
		createLabel?: string;
		onCreate?: () => void;
		onShowHelp?: () => void;
		emptyIcon?: any;
		emptyTitle?: string;
		emptyContent?: import('svelte').Snippet;
	} = $props();

	let searchQuery = $state('');
	let activeFilters = $state<Record<string, string>>({});

	const filteredData = $derived(
		data.filter((row) => {
			// Search filter
			if (searchQuery) {
				const searchValue = String(row[searchKey] || '').toLowerCase();
				if (!searchValue.includes(searchQuery.toLowerCase())) {
					return false;
				}
			}

			// Custom filters
			for (const [key, value] of Object.entries(activeFilters)) {
				if (value && row[key] !== undefined && row[key] !== value) {
					return false;
				}
			}

			return true;
		})
	);

	function getCellValue(row: any, column: DataTableColumn<any>): string {
		if (column.render) {
			return column.render(row);
		}
		return String(row[column.key] || '');
	}

	function getActionBadgeClass(variant?: 'ghost' | 'outline' | 'destructive') {
		switch (variant) {
			case 'destructive':
				return 'text-destructive hover:text-destructive';
			case 'outline':
				return '';
			default:
				return '';
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			{#if searchKey}
				<div class="relative">
					<Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
					<Input bind:value={searchQuery} placeholder={searchPlaceholder} class="h-9 w-64 pl-9" />
				</div>
			{/if}
			{#each filters as filter}
				<Select bind:value={activeFilters[filter.key]}>
					<SelectTrigger class="h-9 w-40">
						{#if !activeFilters[filter.key]}
							{filter.label}
						{:else}
							{filter.options.find((opt) => opt.value === activeFilters[filter.key])?.label ||
								filter.label}
						{/if}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="">{filter.label}</SelectItem>
						{#each filter.options as option}
							<SelectItem value={option.value}>{option.label}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			{#if onCreate}
				<Button onclick={onCreate} class="gap-2">
					<Plus class="h-4 w-4" />
					{createLabel}
				</Button>
			{/if}
			{#if onShowHelp}
				<Button
					variant="ghost"
					size="icon"
					onclick={onShowHelp}
					class="text-muted-foreground flex-shrink-0 hover:text-foreground"
					title="Show help"
				>
					<HelpCircle class="h-5 w-5" />
				</Button>
			{/if}
		</div>
	</div>

	<!-- Table -->
	<Card class="p-0">
		<CardContent class="p-0">
			{#if filteredData.length === 0}
				<div class="p-12">
					<Empty>
						<EmptyMedia>
							{#if emptyIcon}
								<!-- svelte-ignore a11y_missing_attribute -->
								<emptyIcon class="text-muted-foreground h-16 w-16" />
							{:else}
								<div
									class="text-muted-foreground flex h-16 w-16 items-center justify-center rounded-full bg-muted"
								>
									<span class="text-2xl">📋</span>
								</div>
							{/if}
						</EmptyMedia>
						<EmptyTitle>{emptyTitle}</EmptyTitle>
						{#if emptyContent}
							<EmptyContent>{@render emptyContent()}</EmptyContent>
						{:else if onCreate && !searchQuery}
							<EmptyContent>
								<Button variant="link" onclick={onCreate} class="mt-2">
									Create your first item
								</Button>
							</EmptyContent>
						{/if}
					</Empty>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="border-b border-border bg-muted/50">
							<tr>
								{#each columns as column}
									<th
										class="text-muted-foreground px-6 py-3 text-left text-xs font-bold tracking-wider uppercase {column.class ||
											''}"
									>
										{column.label}
									</th>
								{/each}
								{#if actions && actions.length > 0}
									<th
										class="text-muted-foreground px-6 py-3 text-right text-xs font-bold tracking-wider uppercase"
									>
										Actions
									</th>
								{/if}
							</tr>
						</thead>
						<tbody class="divide-y divide-border">
							{#each filteredData as row}
								<tr class="hover:bg-accent/50">
									{#each columns as column}
										<td class="px-6 py-4">
											<div class="text-sm text-foreground">{@html getCellValue(row, column)}</div>
										</td>
									{/each}
									{#if actions && actions.length > 0}
										<td class="px-6 py-4 text-right">
											<div class="flex items-center justify-end gap-1">
												{#each actions as action}
													{#if !action.hide || !action.hide(row)}
														<Button
															variant={action.variant || 'ghost'}
															size="sm"
															onclick={() => action.onClick(row)}
															disabled={action.disabled ? action.disabled(row) : false}
															class={getActionBadgeClass(action.variant)}
															title={action.label}
														>
															<!-- svelte-ignore a11y_missing_attribute -->
															<action.icon class="h-4 w-4" />
														</Button>
													{/if}
												{/each}
											</div>
										</td>
									{/if}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>

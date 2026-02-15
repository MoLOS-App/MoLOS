<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';

	type Column = {
		id: string;
		title: string;
		color?: string;
		icon?: any;
	};

	interface Props {
		columns: Column[];
		getItemsForColumn: (columnId: string) => any[];
		collapsedColumns?: Record<string, boolean>;
		onToggleColumn?: (columnId: string) => void;
		onDropItem?: (itemId: string, columnId: string) => void;
		collapsedPreviewCount?: number | null;
		boardClass?: string;
		item?: Snippet<[{ item: any; column: Column }]>;
		empty?: Snippet<[{ column: Column }]>;
		collapsedMore?: Snippet<[{ column: Column; remaining: number }]>;
	}

	const defaultBoardClass = [
		'flex flex-row flex-wrap items-stretch gap-4 overflow-x-auto pb-10',
		'grid-flow-col auto-cols-[minmax(220px,80vw)] md:grid-flow-row md:auto-cols-auto',
		'md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 md:overflow-visible'
	].join(' ');

	let {
		columns,
		getItemsForColumn,
		collapsedColumns = {},
		onToggleColumn,
		onDropItem,
		collapsedPreviewCount = 1,
		boardClass = defaultBoardClass,
		item,
		empty,
		collapsedMore
	}: Props = $props();

	const listBaseClass =
		'flex-1 overflow-y-auto rounded-xl border-2 border-transparent bg-muted/15 p-2 transition-all duration-200';

	const cardHeight = 80;
	const maxVisibleCards = 7;
	const maxListHeight = cardHeight * maxVisibleCards;

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(e: DragEvent, columnId: string) {
		e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		target.classList.remove('bg-primary/5', 'border-primary', 'border-dashed');
		const itemId = e.dataTransfer?.getData('text/plain');
		if (itemId) {
			onDropItem?.(itemId, columnId);
		}
	}
</script>

<div class={boardClass}>
	{#each columns as column}
		{@const items = getItemsForColumn(column.id)}
		{@const isCollapsed = collapsedColumns[column.id]}
		{@const hasPreview = !!collapsedPreviewCount}
		{@const previewCount = collapsedPreviewCount ?? 0}
		{@const previewHeight = previewCount * cardHeight + 16}
		{@const columnMaxHeight = maxListHeight + 84}
		{@const visibleItems =
			isCollapsed && hasPreview ? items.slice(0, previewCount) : items}

		<div
			class="flex h-full w-80 flex-col gap-3 rounded-2xl border border-muted/40 bg-linear-to-b from-muted/30 to-background px-2.5 py-2.5 shadow-sm transition-all duration-200"
			style={`max-height: ${columnMaxHeight}px;`}
		>
			<div class="sticky top-0 z-10 -mx-2.5 -mt-2.5 rounded-t-2xl bg-background/90 px-3 py-2 backdrop-blur">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<button
							class="inline-flex h-6 items-center gap-1 rounded-full border border-muted/60 bg-background/70 px-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase transition-colors hover:border-muted hover:bg-muted/40 hover:text-foreground"
							onclick={() => onToggleColumn?.(column.id)}
							aria-label={isCollapsed ? `Expand ${column.title} column` : `Collapse ${column.title} column`}
						>
							{#if isCollapsed}
								<ChevronDown class="w-4 h-4" />
							{:else}
								<ChevronUp class="w-4 h-4" />
							{/if}
							<span class="hidden sm:inline">{isCollapsed ? 'Expand' : 'Collapse'}</span>
						</button>
						{#if column.icon}
							<column.icon class="w-4 h-4 text-muted-foreground" />
						{:else if column.color}
							<div class="h-2.5 w-2.5 rounded-full {column.color}"></div>
						{/if}
						<h3 class="text-sm font-bold tracking-widest uppercase text-muted-foreground">
							{column.title}
						</h3>
					</div>
					<Badge variant="secondary" class="h-5 rounded-full px-2 py-0 text-[10px] font-bold">
						{items.length}
					</Badge>
				</div>
			</div>

			<div
				class="{listBaseClass} {isCollapsed
					? hasPreview
						? 'overflow-hidden opacity-70'
						: 'h-0 max-h-0 overflow-hidden p-0 opacity-20'
					: ''}"
				style={isCollapsed
					? hasPreview
						? `max-height: ${Math.min(previewHeight, maxListHeight)}px; height: ${Math.min(
								previewHeight,
								maxListHeight
							)}px;`
						: 'height: 0;'
					: `max-height: ${maxListHeight}px;`}
				role="list"
				aria-label="{column.title} items"
				ondragover={handleDragOver}
				ondrop={(e) => handleDrop(e, column.id)}
				ondragenter={(e) =>
					(e.currentTarget as HTMLElement).classList.add(
						'bg-primary/5',
						'border-primary',
						'border-dashed'
					)}
				ondragleave={(e) =>
					(e.currentTarget as HTMLElement).classList.remove(
						'bg-primary/5',
						'border-primary',
						'border-dashed'
					)}
			>
				<div class="space-y-3">
					{#if visibleItems.length}
						{#each visibleItems as entry (entry.id)}
							{@render item?.({ item: entry, column })}
						{/each}
					{:else}
						{@render empty?.({ column })}
					{/if}
					{#if isCollapsed && hasPreview && items.length > previewCount}
						{@render collapsedMore?.({
							column,
							remaining: items.length - previewCount
						})}
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>

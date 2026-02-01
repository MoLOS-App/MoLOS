<script lang="ts">
	import { goto } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { ArrowLeft, Filter, Search } from 'lucide-svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	type Filters = { modules: string[]; types: string[]; from: string; to: string };
	let { data } = $props<{
		data: {
			query: string;
			results: any[];
			availableModules: { id: string; name: string }[];
			availableTypes: string[];
			filters: Filters;
		};
	}>();

	let filtersOpen = $state(false);

	let availableModules = $derived(data.availableModules ?? []);
	let availableTypes = $derived(data.availableTypes ?? []);

	let query = $state(data.query ?? '');
	let results = $state(data.results ?? []);
	let filters = $state<Filters>({
		modules: data.filters?.modules ?? [],
		types: data.filters?.types ?? [],
		from: data.filters?.from ?? '',
		to: data.filters?.to ?? ''
	});

	// Keep state in sync with data props
	$effect(() => {
		query = data.query ?? '';
		results = data.results ?? [];
		filters = {
			modules: data.filters?.modules ?? [],
			types: data.filters?.types ?? [],
			from: data.filters?.from ?? '',
			to: data.filters?.to ?? ''
		};
	});

	const submit = async () => {
		const next = query.trim();
		if (!next) return;
		const params = new URLSearchParams({ q: next });
		if (filters.modules.length) params.set('modules', filters.modules.join(','));
		if (filters.types.length) params.set('types', filters.types.join(','));
		if (filters.from) params.set('from', filters.from);
		if (filters.to) params.set('to', filters.to);
		await goto(`/ui/search?${params.toString()}`);
	};

	const applyFilters = async () => {
		await submit();
		filtersOpen = false;
	};

	const toggleModule = (id: string) => {
		filters.modules = filters.modules.includes(id)
			? filters.modules.filter((value) => value !== id)
			: [...filters.modules, id];
	};

	const toggleType = (type: string) => {
		filters.types = filters.types.includes(type)
			? filters.types.filter((value) => value !== type)
			: [...filters.types, type];
	};

	const clearFilters = async () => {
		filters = { modules: [], types: [], from: '', to: '' };
		const next = query.trim();
		if (!next) return;
		await goto(`/ui/search?q=${encodeURIComponent(next)}`);
	};

	const formatDate = (value?: number) => {
		if (!value) return '';
		return new Date(value).toLocaleString();
	};
</script>

<div class="min-h-[70vh] w-full bg-background">
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
		<div class="flex items-center gap-3">
			<Button href="/ui/dashboard" variant="ghost" class="h-9 gap-2 px-3">
				<ArrowLeft class="h-4 w-4" />
				Back
			</Button>
			<div class="flex flex-col">
				<span class="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
					>Search</span
				>
				<h1 class="text-2xl font-black tracking-tight md:text-3xl">Find anything fast</h1>
			</div>
		</div>

		<form
			class="flex w-full items-center gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<div class="relative flex-1">
				<div
					class="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center"
				>
					<Search class="h-4 w-4" />
				</div>
				<Input
					type="search"
					placeholder="Search tasks, prompts, memories..."
					class="h-12 w-full rounded-2xl border border-border bg-background pl-9 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20"
					bind:value={query}
				/>
			</div>
			<Button
				type="button"
				variant="secondary"
				class="h-12 w-12 rounded-2xl"
				onclick={() => (filtersOpen = true)}
			>
				<Filter class="h-4 w-4" />
			</Button>
			<Sheet.Root bind:open={filtersOpen}>
				<Sheet.Content side="left" class="w-80 gap-4">
					<Sheet.Header class="px-4 pt-4">
						<Sheet.Title>Advanced filters</Sheet.Title>
						<Sheet.Description class="text-muted-foreground text-sm">
							Narrow results by module, type, and date.
						</Sheet.Description>
					</Sheet.Header>
					<div class="px-4">
						<Separator class="my-2" />
						<div class="space-y-6">
							<div class="space-y-3">
								<Label class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
									Modules
								</Label>
								<div class="grid gap-2">
									{#each availableModules as module}
										<Label class="flex cursor-pointer items-center gap-2 text-sm">
											<Checkbox
												checked={filters.modules.includes(module.id)}
												onclick={() => toggleModule(module.id)}
											/>
											<span>{module.name}</span>
										</Label>
									{/each}
									{#if availableModules.length === 0}
										<span class="text-muted-foreground text-xs">No modules available.</span>
									{/if}
								</div>
							</div>
							<div class="space-y-3">
								<Label class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
									Types
								</Label>
								<div class="grid gap-2">
									{#each availableTypes as type}
										<Label class="flex cursor-pointer items-center gap-2 text-sm">
											<Checkbox
												checked={filters.types.includes(type)}
												onclick={() => toggleType(type)}
											/>
											<span class="capitalize">{type.replace('_', ' ')}</span>
										</Label>
									{/each}
								</div>
							</div>
							<div class="space-y-3">
								<Label class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
									Updated from
								</Label>
								<Input type="date" bind:value={filters.from} class="h-10 rounded-xl" />
							</div>
							<div class="space-y-3">
								<Label class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
									Updated to
								</Label>
								<Input type="date" bind:value={filters.to} class="h-10 rounded-xl" />
							</div>
						</div>
					</div>
					<Sheet.Footer class="mt-auto flex flex-row items-center justify-between gap-2 px-4 pb-4">
						<Button type="button" variant="ghost" class="h-9 px-4" onclick={clearFilters}>
							Clear
						</Button>
						<Button type="button" class="h-9 px-4" onclick={applyFilters}>Apply</Button>
					</Sheet.Footer>
				</Sheet.Content>
			</Sheet.Root>
			<Button type="submit" class="h-12 rounded-2xl px-5">Search</Button>
		</form>

		{#if !data.query}
			<Card.Root class="rounded-3xl border-dashed bg-card">
				<Card.Content class="text-muted-foreground p-8 text-sm">
					Try searching for tasks, prompts, or memories to get started.
				</Card.Content>
			</Card.Root>
		{:else if results.length === 0}
			<Card.Root class="rounded-3xl border-dashed bg-card">
				<Card.Content class="flex flex-col items-center gap-3 p-10 text-center">
					<div class="text-muted-foreground text-sm">
						No results found for "{data.query}".
					</div>
					<div class="text-muted-foreground text-xs">
						Try a different keyword or check spelling.
					</div>
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="text-muted-foreground flex items-center justify-between text-sm">
				<span>{results.length} results</span>
				<span class="hidden md:inline">Sorted by most recently updated</span>
			</div>
			<div class="grid gap-3 md:grid-cols-2">
				{#each results as result}
					<a href={result.href} class="group block rounded-3xl transition hover:-translate-y-0.5">
						<Card.Root class="relative overflow-hidden rounded-3xl bg-card shadow-sm">
							<Card.Content class="p-5">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0">
										<div class="truncate text-sm font-semibold text-foreground">
											{result.title}
										</div>
										{#if result.snippet}
											<div class="text-muted-foreground mt-2 text-xs">{result.snippet}</div>
										{/if}
									</div>
									<div class="text-muted-foreground flex shrink-0 flex-col items-end gap-2 text-xs">
										<Badge variant="secondary" class="rounded-full px-3 py-1">
											{result.moduleName ?? result.moduleId}
										</Badge>
										{#if result.updatedAt}
											<span>{formatDate(result.updatedAt)}</span>
										{/if}
									</div>
								</div>
							</Card.Content>
							<div
								class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/30 via-primary/10 to-transparent opacity-0 transition group-hover:opacity-100"
							></div>
						</Card.Root>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

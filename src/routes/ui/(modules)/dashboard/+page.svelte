<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { goto } from '$app/navigation';
	import {
		Search,
		Bell,
		Sparkles,
		ArrowUpRight,
		CheckSquare,
		Activity,
		DollarSign,
		Target,
		Utensils
	} from 'lucide-svelte';
	import * as Icons from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';

	export let data;
	const { stats, modules, user } = data;

	let searchQuery = '';

	const now = new Date();
	const greeting =
		now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

	// Mock notifications for the UI
	const notifications = [
		{ id: 1, title: 'Task Overdue', description: 'Complete "Project Proposal"', type: 'warning' },
		{
			id: 2,
			title: 'Goal Reached',
			description: 'You hit your weekly weight goal!',
			type: 'success'
		}
	];

	function handleSearch(e: KeyboardEvent) {
		if (e.key === 'Enter' && searchQuery.trim()) {
			// In a real app, this would search across modules
			console.log('Searching for:', searchQuery);
		}
	}
</script>

<div class="flex min-h-screen flex-col items-center bg-background p-6 md:p-8">
	<!-- Main Content -->
	<div class="flex w-full max-w-4xl flex-col items-center gap-10 pt-12" in:fade={{ duration: 800 }}>
		<!-- Hero Section -->
		<div class="space-y-3 text-center">
			<div
				class="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-bold tracking-widest text-primary uppercase"
			>
				<Sparkles class="h-3 w-3" />
				Intelligence Active
			</div>
			<h1 class="text-4xl font-black tracking-tighter text-foreground md:text-5xl">
				{greeting}, {data.user.name}
			</h1>
			<p class="text-muted-foreground mx-auto max-w-lg text-lg font-medium">
				What's on your mind today?
			</p>
		</div>

		<!-- Search Bar (ChatGPT/Google Style) -->
		<div class="group relative w-full max-w-2xl" in:fly={{ y: 20, delay: 200 }}>
			<div
				class="text-muted-foreground pointer-events-none absolute inset-y-0 left-4 flex items-center transition-colors group-focus-within:text-primary"
			>
				<Search class="h-5 w-5" />
			</div>
			<Input
				type="text"
				placeholder="Search anything..."
				class="h-14 w-full rounded-2xl border-none bg-muted/30 pr-4 pl-12 text-base shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
				bind:value={searchQuery}
				onkeydown={handleSearch}
			/>
			<div class="absolute inset-y-0 right-4 flex items-center gap-2">
				<kbd
					class="text-muted-foreground hidden h-6 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 md:inline-flex"
				>
					<span class="text-xs">⌘</span>K
				</kbd>
			</div>
		</div>

		<!-- Active Modules & Pages -->
		<div class="w-full space-y-4" in:fly={{ y: 20, delay: 400 }}>
			<div class="flex items-center justify-between px-2">
				<h2 class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
					Active Modules
				</h2>
				<Button
					variant="ghost"
					size="sm"
					class="h-7 text-[10px] font-bold tracking-widest uppercase"
					onclick={() => goto('/ui/settings')}>Manage</Button
				>
			</div>

			<div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
				{#each modules as module}
					<Card.Root
						class="group cursor-pointer overflow-hidden border-none shadow-sm transition-all duration-300 hover:bg-muted/40 hover:shadow-md"
						onclick={() => goto(module.href)}
					>
						<Card.Content class="flex flex-col items-center gap-2 p-4">
							<div
								class="rounded-xl bg-background p-2.5 text-primary shadow-xs transition-all group-hover:scale-110"
							>
								{#if module.id === 'tasks'}
									<Icons.CheckSquare size={24} />
								{:else if module.id === 'health'}
									<Icons.Activity size={24} />
								{:else if module.id === 'finance'}
									<Icons.DollarSign size={24} />
								{:else if module.id === 'goals'}
									<Icons.Target size={24} />
								{:else if module.id === 'meals'}
									<Icons.Utensils size={24} />
								{:else}
									<Icons.Box size={24} />
								{/if}
							</div>
							<div class="text-center">
								<p class="text-xs font-bold">{module.name}</p>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</div>

		<!-- Quick Insights / Notifications -->
		<div class="grid w-full gap-4 md:grid-cols-2" in:fly={{ y: 20, delay: 600 }}>
			<Card.Root class="rounded-2xl border-none shadow-none">
				<Card.Header class="pb-2">
					<Card.Title class="flex items-center gap-2 font-black tracking-widest uppercase">
						<Bell class="h-3 w-3 text-primary" />
						Notifications
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					{#each notifications as note}
						<div
							class="flex cursor-pointer items-start gap-3 rounded-xl p-2 transition-colors hover:bg-background/50"
						>
							<div
								class="mt-1.5 h-1.5 w-1.5 rounded-full {note.type === 'warning'
									? 'bg-accent'
									: 'bg-primary'}"
							></div>
							<div>
								<p class="text-xs font-bold">{note.title}</p>
								<p class="text-muted-foreground text-[10px] font-medium">{note.description}</p>
							</div>
						</div>
					{/each}
				</Card.Content>
			</Card.Root>

			<Card.Root class="rounded-2xl border-none shadow-none">
				<Card.Header class="pb-2">
					<Card.Title class="flex items-center gap-2 font-black tracking-widest uppercase">
						<Sparkles class="h-3 w-3 text-primary" />
						Summary
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2.5">
					<div class="flex items-center justify-between text-xs">
						<span class="text-muted-foreground font-medium">Active Tasks</span>
						<span class="font-black">{stats.tasks.active}</span>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="text-muted-foreground font-medium">Monthly Spend</span>
						<span class="font-black">{stats.finance.monthlySpend} {stats.finance.currency}</span>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="text-muted-foreground font-medium">Goal Progress</span>
						<span class="font-black">{stats.goals.avgProgress}%</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						class="mt-1 h-8 w-full rounded-xl text-[10px] font-bold tracking-widest uppercase"
						onclick={() => goto('/ui/tasks/dashboard')}
					>
						Full Report <ArrowUpRight class="ml-1 h-3 w-3" />
					</Button>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>

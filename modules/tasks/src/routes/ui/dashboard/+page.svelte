<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import {
		tasksStore,
		projectsStore,
		areasStore,
		dailyLogsStore,
		taskStats,
		tasksSettingsStore
	} from '../../stores';
	import { hydrateTasksData } from '../../stores';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import {
		CircleCheck,
		LoaderCircle,
		ListTodo,
		TrendingUp,
		Target,
		Zap,
		Heart,
		Plus,
		Clock,
		BarChart3,
		Calendar,
		CircleAlert
	} from 'lucide-svelte';

	const { data } = $props<PageData>();

	onMount(() => {
		hydrateTasksData(data);
	});

	// Derived analytics
	const now = Math.floor(Date.now() / 1000);
	const oneDay = 24 * 60 * 60;
	const sevenDays = 7 * oneDay;

	const overdueTasksCount = $derived(
		$tasksStore.filter((t) => t.dueDate && t.dueDate < now && !t.isCompleted).length
	);

	const completionRate = $derived(
		$taskStats.total > 0 ? Math.round(($taskStats.completed / $taskStats.total) * 100) : 0
	);

	const productivityScore = $derived(
		Math.min(
			100,
			Math.round(
				($taskStats.completed / Math.max(1, $taskStats.total)) * 50 +
					($taskStats.active > 0 ? (1 - overdueTasksCount / $taskStats.active) * 50 : 50)
			)
		)
	);

	const statusBreakdown = $derived([
		{
			status: 'to_do',
			count: $tasksStore.filter((t) => t.status === 'to_do').length,
			label: 'To Do'
		},
		{
			status: 'in_progress',
			count: $tasksStore.filter((t) => t.status === 'in_progress').length,
			label: 'In Progress'
		},
		{
			status: 'waiting',
			count: $tasksStore.filter((t) => t.status === 'waiting').length,
			label: 'Waiting'
		},
		{ status: 'done', count: $tasksStore.filter((t) => t.status === 'done').length, label: 'Done' }
	]);

	const dueThisWeek = $derived(
		$tasksStore.filter(
			(t) => t.dueDate && t.dueDate >= now && t.dueDate <= now + sevenDays && !t.isCompleted
		).length
	);

	const completedToday = $derived(
		$tasksStore.filter((t) => t.isCompleted && t.updatedAt >= now - oneDay).length
	);

	const projectAnalytics = $derived(
		$projectsStore.map((project) => {
			const projectTasks = $tasksStore.filter((t) => t.projectId === project.id);
			const completed = projectTasks.filter((t) => t.isCompleted).length;
			const total = projectTasks.length;
			return {
				...project,
				taskCount: total,
				completedTasks: completed,
				completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
				activeTasks: total - completed,
				overdueTasks: projectTasks.filter((t) => t.dueDate && t.dueDate < now && !t.isCompleted)
					.length
			};
		})
	);

	const recentTasks = $derived(
		[...$tasksStore]
			.filter((t) => ($tasksSettingsStore?.showCompleted ? true : !t.isCompleted))
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, 5)
	);

	const wellnessScore = $derived(
		$dailyLogsStore.length > 0
			? Math.round(
					($dailyLogsStore.slice(0, 30).reduce((sum, log) => sum + (Number(log.mood) || 0), 0) /
						Math.min(30, $dailyLogsStore.length)) *
						20
				)
			: 0
	);
</script>

<div class="space-y-6">
	<!-- Welcome Section -->
	<div class="py-6 text-center">
		<h1 class="mb-1 text-3xl font-black tracking-tighter text-primary">Task Dashboard</h1>
		<p class="text-muted-foreground mb-6 text-sm font-medium">Stay on top of your goals</p>

		<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
			<Card class="border-none shadow-sm">
				<CardContent class="pt-4">
					<ListTodo class="mx-auto mb-1 h-5 w-5 text-primary" />
					<div class="text-2xl font-black">{$taskStats.total}</div>
					<p class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Total</p>
				</CardContent>
			</Card>
			<Card class="border-none shadow-sm">
				<CardContent class="pt-4">
					<CircleCheck class="mx-auto mb-1 h-5 w-5 text-primary" />
					<div class="text-2xl font-black text-primary">{$taskStats.completed}</div>
					<p class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Done</p>
				</CardContent>
			</Card>
			<Card class="border-none shadow-sm">
				<CardContent class="pt-4">
					<LoaderCircle class="mx-auto mb-1 h-5 w-5 text-primary" />
					<div class="text-2xl font-black text-primary">{$taskStats.active}</div>
					<p class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
						Active
					</p>
				</CardContent>
			</Card>
			<Card class="border-none shadow-sm">
				<CardContent class="pt-4">
					<CircleAlert class="mx-auto mb-1 h-5 w-5 text-destructive" />
					<div class="text-2xl font-black text-destructive">{overdueTasksCount}</div>
					<p class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
						Overdue
					</p>
				</CardContent>
			</Card>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Progress Overview -->
		<div class="space-y-6 lg:col-span-2">
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<Card>
					<CardHeader class="pb-2">
						<CardTitle class="flex items-center gap-2 font-semibold">
							<TrendingUp class="h-5 w-5 text-primary" />
							Task Completion
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div>
							<div class="mb-2 flex justify-between text-sm font-medium">
								<span>Overall Progress</span>
								<span>{completionRate}%</span>
							</div>
							<Progress value={completionRate} class="h-3" />
						</div>
						<p class="text-muted-foreground text-sm">
							{completionRate >= 80
								? 'Excellent progress! Keep it up!'
								: completionRate >= 60
									? "Good work! You're making steady progress."
									: completionRate >= 40
										? "Keep pushing! You're halfway there."
										: "Let's get started! Every task completed brings you closer."}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="pb-2">
						<CardTitle class="flex items-center gap-2 font-semibold">
							<Zap class="h-5 w-5 text-accent" />
							Productivity Score
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div>
							<div class="mb-2 flex justify-between text-sm font-medium">
								<span>Your Score</span>
								<span>{productivityScore}/100</span>
							</div>
							<Progress value={productivityScore} class="h-3" />
						</div>
						<p class="text-muted-foreground text-sm">
							{productivityScore >= 80
								? "Outstanding productivity! You're crushing it!"
								: productivityScore >= 60
									? 'Great productivity! Stay consistent.'
									: productivityScore >= 40
										? 'Good effort! Focus on completing tasks.'
										: 'Room for improvement. Try breaking tasks down.'}
						</p>
					</CardContent>
				</Card>
			</div>

			<!-- Task Status Breakdown -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2 font-semibold">
						<BarChart3 class="h-5 w-5 text-primary" />
						Task Status Overview
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="grid gap-4" role="list" aria-label="Task status breakdown">
						{#each statusBreakdown as status}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div
										class="h-3 w-3 rounded-full {status.status === 'to_do'
											? 'bg-muted'
											: status.status === 'in_progress'
												? 'bg-primary'
												: status.status === 'waiting'
													? 'bg-accent'
													: 'bg-primary'}"
									></div>
									<span class="text-sm font-medium">{status.label}</span>
								</div>
								<div class="flex items-center gap-4">
									<div class="hidden h-2 w-32 rounded-full bg-muted md:block">
										<div
											class="h-2 rounded-full bg-primary transition-all"
											style="width: {$taskStats.total > 0
												? (status.count / $taskStats.total) * 100
												: 0}%"
										></div>
									</div>
									<span class="w-8 text-right text-sm font-bold">{status.count}</span>
								</div>
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Sidebar Insights -->
		<div class="space-y-6">
			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="font-semibold">Quick Insights</CardTitle>
				</CardHeader>
				<CardContent class="grid gap-4">
					<div class="flex items-center gap-4 rounded-lg border border-primary/10 bg-primary/5 p-3">
						<Calendar class="h-8 w-8 text-primary" />
						<div>
							<div class="text-2xl font-bold text-primary">{dueThisWeek}</div>
							<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
								Due This Week
							</p>
						</div>
					</div>

					<div class="flex items-center gap-4 rounded-lg border border-primary/10 bg-primary/5 p-3">
						<CircleCheck class="h-8 w-8 text-primary" />
						<div>
							<div class="text-2xl font-bold text-primary">{completedToday}</div>
							<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
								Completed Today
							</p>
						</div>
					</div>

					<div class="flex items-center gap-4 rounded-lg border border-accent/10 bg-accent/5 p-3">
						<Heart class="h-8 w-8 text-accent" />
						<div>
							<div class="text-2xl font-bold text-accent">{wellnessScore}/100</div>
							<p class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
								Wellness Score
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Recent Activity -->
			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="flex items-center gap-2 font-semibold">
						<Clock class="h-5 w-5 text-primary" />
						Recent Activity
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						{#each recentTasks as task}
							<div class="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
								<div class="flex items-start justify-between gap-2">
									<p class="truncate text-sm leading-none font-medium">{task.title}</p>
									<Badge
										variant={task.isCompleted ? 'outline' : 'secondary'}
										class="h-4 px-1.5 py-0 text-[10px]"
									>
										{task.isCompleted ? 'Done' : task.status.replace('_', ' ')}
									</Badge>
								</div>
								<p class="text-muted-foreground line-clamp-1 text-xs">
									{task.description || 'No description'}
								</p>
							</div>
						{:else}
							<p class="py-4 text-sm text-center text-muted-foreground">No recent activity</p>
						{/each}
					</div>
				</CardContent>
			</Card>
		</div>
	</div>

	<!-- Top Projects -->
	{#if projectAnalytics.length > 0}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-2xl font-bold tracking-tight">Active Projects</h2>
				<a href="/ui/MoLOS-Tasks/projects" class="text-sm font-medium text-primary hover:underline"
					>View all projects</a
				>
			</div>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each projectAnalytics.slice(0, 6) as project}
					<Card class="transition-all hover:shadow-md">
						<CardHeader class="pb-2">
							<div class="mb-1 flex items-center justify-between">
								<CardTitle class="truncate font-bold">{project.name}</CardTitle>
								<Badge
									variant={project.status === 'active' ? 'default' : 'secondary'}
									class="text-[10px]"
								>
									{project.status}
								</Badge>
							</div>
						</CardHeader>
						<CardContent class="space-y-3">
							<div class="space-y-1">
								<div class="flex justify-between text-xs font-medium">
									<span>Progress</span>
									<span>{project.completionRate}%</span>
								</div>
								<Progress value={project.completionRate} class="h-1.5" />
							</div>
							<div class="text-muted-foreground flex justify-between text-[11px] font-medium">
								<span>{project.activeTasks} active tasks</span>
								{#if project.overdueTasks > 0}
									<span class="font-bold text-destructive">{project.overdueTasks} overdue</span>
								{/if}
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Empty State -->
	{#if $taskStats.total === 0}
		<Card class="border-dashed">
			<CardContent class="py-16">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
				>
					<ListTodo class="h-8 w-8 text-primary" />
				</div>
				<h3 class="mb-2 text-xl font-bold">Welcome to MoLOS Tasks</h3>
				<p class="text-muted-foreground mx-auto mb-8 max-w-sm">
					Start by creating your first task or project to begin organizing your work and boosting
					your productivity.
				</p>
				<div class="flex justify-center gap-4">
					<a
						href="/ui/MoLOS-Tasks/my"
						class="inline-flex items-center rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
					>
						<Plus class="mr-2 h-5 w-5" />
						Add Task
					</a>
					<a
						href="/ui/MoLOS-Tasks/projects"
						class="inline-flex items-center rounded-full border px-6 py-2.5 font-semibold transition-colors hover:bg-muted"
					>
						<Target class="mr-2 h-5 w-5" />
						Create Project
					</a>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	const userId = $page.data.userId;
	import {
		tasksStore,
		projectsStore,
		areasStore,
		addTaskStore,
		updateTaskStore,
		deleteTaskStore,
		tasksSettingsStore
	} from '../../stores';
	import { hydrateTasksData } from '../../stores';
	import TaskItem from '$lib/components/external_modules/MoLOS-Tasks/task-item.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import {
		AlertDialog,
		AlertDialogContent,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogCancel,
		AlertDialogAction
	} from '$lib/components/ui/alert-dialog';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from 'svelte-sonner';
	import { Plus, Filter, Search, X, LayoutGrid, List } from 'lucide-svelte';
	import KanbanBoard from '$lib/components/external_modules/MoLOS-Tasks/kanban-board.svelte';

	const { data } = $props<PageData>();

	onMount(() => {
		hydrateTasksData(data);
	});

	// State
	let isDragging = $state(false);
	let open = $state(false);
	let editingTaskId = $state<string | null>(null);
	let showDeleteDialog = $state(false);
	let taskToDeleteId = $state<string | null>(null);
	let showCompleted = $state($tasksSettingsStore?.showCompleted ?? false);
	let filterOpen = $state(false);
	let search = $state('');
	let viewMode = $state<'kanban' | 'list'>('kanban');
	let compactMode = $derived($tasksSettingsStore?.compactMode ?? false);

	// Form State
	let formTitle = $state('');
	let formDescription = $state('');
	let formStatus = $state<'to_do' | 'in_progress' | 'waiting' | 'done' | 'archived'>('to_do');
	let formPriority = $state<'high' | 'medium' | 'low'>('medium');
	let formDueDateStr = $state('');
	let formProjectId = $state<string>('');
	let formAreaId = $state<string>('');

	let selectedProjectNames = $state<string[]>([]);
	let collapsedColumns = $state<Record<string, boolean>>({});
	let filters = $state({
		status: '',
		priority: '',
		areaId: '',
		dueDateFrom: '',
		dueDateTo: ''
	});

	// Logic
	$effect(() => {
		if ($tasksSettingsStore) {
			showCompleted = $tasksSettingsStore.showCompleted;
		}
	});

	const resetForm = () => {
		formTitle = '';
		formDescription = '';
		formStatus = 'to_do';
		formPriority = 'medium';
		formDueDateStr = '';
		formProjectId = '';
		formAreaId = '';
	};

	const openAdd = () => {
		resetForm();
		editingTaskId = null;
		open = true;
	};

	const openEdit = (task: any) => {
		formTitle = task.title;
		formDescription = task.description || '';
		formStatus = task.status || 'to_do';
		formPriority = task.priority || 'medium';
		formDueDateStr = task.dueDate ? new Date(task.dueDate * 1000).toISOString().split('T')[0] : '';
		formProjectId = task.projectId || '';
		formAreaId = task.areaId || '';
		editingTaskId = task.id;
		open = true;
	};

	const handleSave = async () => {
		if (!formTitle.trim()) {
			toast.error('Title is required');
			return;
		}

		const dueDate = formDueDateStr ? Math.floor(new Date(formDueDateStr).getTime() / 1000) : null;
		const data = {
			title: formTitle.trim(),
			description: formDescription.trim() || undefined,
			status: formStatus,
			priority: formPriority,
			dueDate: dueDate || undefined,
			projectId: formProjectId || undefined,
			areaId: formAreaId || undefined,
			userId: userId,
			isCompleted: false // Default value for new tasks
		};

		try {
			if (editingTaskId) {
				await updateTaskStore(editingTaskId, { ...data, dueDate: dueDate || undefined });
				toast.success('Task updated');
			} else {
				await addTaskStore(data);
				toast.success('Task created');
			}
			open = false;
			resetForm();
		} catch (err) {
			toast.error('Failed to save task');
		}
	};

	const handleToggle = async (task: any) => {
		const newStatus = task.status === 'done' ? 'to_do' : 'done';
		try {
			await updateTaskStore(task.id, { status: newStatus });
		} catch (err) {
			toast.error('Failed to update task');
		}
	};

	const requestDelete = (taskId: string) => {
		taskToDeleteId = taskId;
		showDeleteDialog = true;
	};

	const confirmDelete = async () => {
		if (!taskToDeleteId) return;
		try {
			await deleteTaskStore(taskToDeleteId);
			toast.success('Task deleted');
		} catch (err) {
			toast.error('Failed to delete task');
		} finally {
			taskToDeleteId = null;
			showDeleteDialog = false;
		}
	};

	const handleUpdateStatus = async (taskId: string, newStatus: any) => {
		try {
			await updateTaskStore(taskId, { status: newStatus });
		} catch (err) {
			toast.error('Failed to update status');
		}
	};

	const getColumnTasks = (columnId: string) => {
		return filteredTasks.filter((t) => t.status === columnId);
	};

	const toggleColumn = (columnId: string) => {
		collapsedColumns = {
			...collapsedColumns,
			[columnId]: !collapsedColumns[columnId]
		};
	};

	// Filtering
	const matchesFilters = (task: any) => {
		if (filters.status && task.status !== filters.status) return false;
		if (filters.priority && task.priority !== filters.priority) return false;
		const project = $projectsStore.find(p => p.id === task.projectId);
		if (selectedProjectNames.length > 0 && (!project || !selectedProjectNames.includes(project.name))) return false;
		if (filters.areaId && task.areaId !== filters.areaId) return false;
		if (
			filters.dueDateFrom &&
			(!task.dueDate || task.dueDate < Math.floor(new Date(filters.dueDateFrom).getTime() / 1000))
		)
			return false;
		if (
			filters.dueDateTo &&
			(!task.dueDate || task.dueDate > Math.floor(new Date(filters.dueDateTo).getTime() / 1000))
		)
			return false;
		if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
		return true;
	};

	const filteredTasks = $derived(
		$tasksStore.filter((t) => (showCompleted || t.status !== 'done') && matchesFilters(t))
	);

	const activeProjects = $derived($projectsStore.filter(p => $tasksStore.some(t => t.projectId === p.id)));
	const columns = $derived([
		{ id: 'to_do', title: 'To Do', color: 'bg-muted' },
		{ id: 'in_progress', title: 'In Progress', color: 'bg-primary' },
		{ id: 'waiting', title: 'Waiting', color: 'bg-accent' },
		...(showCompleted
			? [
					{ id: 'done', title: 'Done', color: 'bg-primary' },
					{ id: 'archived', title: 'Archived', color: 'bg-muted' }
				]
			: [])
	]);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">My Task Board</h1>
			<p class="text-muted-foreground">Manage and organize your personal tasks.</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="flex p-1 border rounded-lg bg-muted/50">
				<Button
					variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
					size="sm"
					class="h-8 px-3"
					onclick={() => (viewMode = 'kanban')}
				>
					<LayoutGrid class="w-4 h-4 mr-2" />
					Board
				</Button>
				<Button
					variant={viewMode === 'list' ? 'secondary' : 'ghost'}
					size="sm"
					class="h-8 px-3"
					onclick={() => (viewMode = 'list')}
				>
					<List class="w-4 h-4 mr-2" />
					List
				</Button>
			</div>
			<Button onclick={openAdd} class="rounded-full shadow-lg">
				<Plus class="w-5 h-5 mr-2" />
				New Task
			</Button>
		</div>
	</div>

	<!-- Toolbar -->
	<Card class="border-none shadow-sm bg-accent/30">
		<CardContent class="p-3">
			<div class="flex flex-wrap items-center gap-3">
				<div class="relative flex-1 min-w-50">
					<Search class="absolute w-4 h-4 -translate-y-1/2 text-muted-foreground top-1/2 left-3" />
					<Input
						placeholder="Search tasks..."
						bind:value={search}
						class="border-none shadow-sm bg-background pl-9"
					/>
				</div>

				<!-- Project Filter -->
				<div class="w-full mt-2">
					<div class="flex gap-2 pb-2 overflow-x-auto">
						{#each activeProjects as project}
							{#if !selectedProjectNames.includes(project.name)}
								<Badge
									variant="outline"
									class="cursor-pointer shrink-0"
									onclick={() => selectedProjectNames = [...selectedProjectNames, project.name]}
								>
									{project.name}
								</Badge>
							{/if}
						{/each}
						{#each selectedProjectNames as name}
							<Badge variant="default" class="cursor-pointer shrink-0">
								{name}
								<X class="w-3 h-3 ml-1" onclick={() => selectedProjectNames = selectedProjectNames.filter(n => n !== name)} />
							</Badge>
						{/each}
						<input
							type="text"
							placeholder="Add custom project..."
							class="flex-1 min-w-[150px] h-6 px-2 text-sm border rounded shrink-0"
							onkeydown={(e) => {
								if (e.key === 'Enter' && e.currentTarget.value.trim()) {
									const name = e.currentTarget.value.trim();
									if (!selectedProjectNames.includes(name)) {
										selectedProjectNames = [...selectedProjectNames, name];
									}
									e.currentTarget.value = '';
								}
							}}
						/>
						{#if selectedProjectNames.length > 0}
							<Button variant="ghost" size="sm" class="shrink-0" onclick={() => selectedProjectNames = []}>
								Clear All
							</Button>
						{/if}
					</div>
				</div>

				<Button
					variant={filterOpen ? 'secondary' : 'outline'}
					size="sm"
					onclick={() => (filterOpen = !filterOpen)}
					class="shadow-sm"
				>
					<Filter class="w-4 h-4 mr-2" />
					Filters
					{#if Object.values(filters).some((v) => v !== '')}
						<Badge variant="default" class="ml-2 h-5 min-w-[20px] px-1.5"
							>{Object.values(filters).filter((v) => v !== '').length}</Badge
						>
					{/if}
				</Button>

				<Button
					variant={showCompleted ? 'secondary' : 'outline'}
					size="sm"
					onclick={() => (showCompleted = !showCompleted)}
					class="shadow-sm"
				>
					{showCompleted ? 'Hide Completed' : 'Show Completed'}
				</Button>

				{#if search || Object.values(filters).some((v) => v !== '') || selectedProjectNames.length > 0}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => {
							search = '';
							selectedProjectNames = [];
							filters = {
								status: '',
								priority: '',
								areaId: '',
								dueDateFrom: '',
								dueDateTo: ''
							};
						}}
					>
						<X class="w-4 h-4 mr-2" />
						Clear
					</Button>
				{/if}
			</div>

			{#if filterOpen}
				<div
					class="grid grid-cols-1 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 md:grid-cols-3 lg:grid-cols-5"
				>
					<div class="space-y-1.5">
						<Label class="text-xs font-bold tracking-wider uppercase text-muted-foreground"
							>Priority</Label
						>
						<select
							bind:value={filters.priority}
							class="w-full px-3 text-sm border rounded-md h-9 bg-background"
						>
							<option value="">All Priorities</option>
							<option value="high">High</option>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
						</select>
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs font-bold tracking-wider uppercase text-muted-foreground"
							>Area</Label
						>
						<select
							bind:value={filters.areaId}
							class="w-full px-3 text-sm border rounded-md h-9 bg-background"
						>
							<option value="">All Areas</option>
							{#each $areasStore as a}
								<option value={a.id}>{a.name}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs font-bold tracking-wider uppercase text-muted-foreground"
							>Due From</Label
						>
						<Input type="date" bind:value={filters.dueDateFrom} class="h-9" />
					</div>
					<div class="space-y-1.5">
						<Label class="text-xs font-bold tracking-wider uppercase text-muted-foreground"
							>Due To</Label
						>
						<Input type="date" bind:value={filters.dueDateTo} class="h-9" />
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Content -->
	{#if viewMode === 'kanban'}
		<KanbanBoard
			{columns}
			{collapsedColumns}
			getItemsForColumn={getColumnTasks}
			onToggleColumn={toggleColumn}
			onDropItem={(taskId, status) => handleUpdateStatus(taskId, status)}
		>
			{#snippet item({ item })}
				{@const task = item}
				<TaskItem
					{task}
					compact={compactMode}
					on:toggle={() => handleToggle(task)}
					on:requestEdit={(e) => openEdit(e.detail)}
					on:delete={() => requestDelete(task.id)}
					on:dragstart={() => (isDragging = true)}
					on:dragend={() => (isDragging = false)}
				/>
			{/snippet}

			{#snippet empty()}
				<div class="flex flex-col items-center justify-center py-12 text-center opacity-40">
					<div class="p-3 mb-2 rounded-full bg-muted">
						<Plus class="w-5 h-5" />
					</div>
					<p class="text-xs font-medium">No tasks</p>
				</div>
			{/snippet}
		</KanbanBoard>
	{:else}
		<Card>
			<CardContent class="p-0">
				<div class="divide-y">
					{#each filteredTasks as task (task.id)}
						<div class="p-1">
							<TaskItem
								{task}
								compact={compactMode}
								on:toggle={() => handleToggle(task)}
								on:requestEdit={(e) => openEdit(e.detail)}
								on:delete={() => requestDelete(task.id)}
							/>
						</div>
					{:else}
						<div class="py-20 text-center">
							<p class="text-muted-foreground">No tasks found matching your criteria.</p>
						</div>
					{/each}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>

<!-- Task Dialog -->
<Dialog bind:open>
<DialogContent class="w-[95vw] max-w-[560px] sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{editingTaskId ? 'Edit Task' : 'Create New Task'}</DialogTitle>
			<DialogDescription>
				Add the details for your task here. Click save when you're done.
			</DialogDescription>
		</DialogHeader>

		<div class="grid gap-5 py-4">
			<div class="space-y-2">
				<Label for="title" class="text-xs font-bold tracking-wider uppercase">Title</Label>
				<Input
					id="title"
					bind:value={formTitle}
					placeholder="What needs to be done?"
					class="h-11"
				/>
			</div>

			<div class="space-y-2">
				<Label for="description" class="text-xs font-bold tracking-wider uppercase"
					>Description</Label
				>
				<Textarea
					id="description"
					bind:value={formDescription}
					placeholder="Add more details..."
					rows={3}
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="status" class="text-xs font-bold tracking-wider uppercase">Status</Label>
					<select
						id="status"
						bind:value={formStatus}
						class="w-full h-10 px-3 border rounded-md bg-background"
					>
						<option value="to_do">To Do</option>
						<option value="in_progress">In Progress</option>
						<option value="waiting">Waiting</option>
						<option value="done">Done</option>
						<option value="archived">Archived</option>
					</select>
				</div>
				<div class="space-y-2">
					<Label for="priority" class="text-xs font-bold tracking-wider uppercase">Priority</Label>
					<select
						id="priority"
						bind:value={formPriority}
						class="w-full h-10 px-3 border rounded-md bg-background"
					>
						<option value="high">High</option>
						<option value="medium">Medium</option>
						<option value="low">Low</option>
					</select>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="dueDate" class="text-xs font-bold tracking-wider uppercase">Due Date</Label>
					<Input id="dueDate" type="date" bind:value={formDueDateStr} class="h-10" />
				</div>
				<div class="space-y-2">
					<Label for="project" class="text-xs font-bold tracking-wider uppercase">Project</Label>
					<select
						id="project"
						bind:value={formProjectId}
						class="w-full h-10 px-3 border rounded-md bg-background"
					>
						<option value="">No Project</option>
						{#each $projectsStore as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<DialogFooter>
			<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={handleSave} class="px-8">Save Task</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<AlertDialog bind:open={showDeleteDialog}>
<AlertDialogContent class="w-[95vw] max-w-[520px] sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
		<AlertDialogHeader>
			<AlertDialogTitle>Are you sure?</AlertDialogTitle>
			<AlertDialogDescription>This will permanently delete this task.</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={() => (taskToDeleteId = null)}>Cancel</AlertDialogCancel>
			<AlertDialogAction
				onclick={confirmDelete}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
			>
				Delete
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<style>
	:global(.dragging) {
		cursor: grabbing !important;
	}
</style>

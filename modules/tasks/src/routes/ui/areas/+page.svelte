<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	const userId = $page.data.userId;
	import {
		areasStore,
		addAreaStore,
		updateAreaStore,
		deleteAreaStore,
		projectsStore,
		tasksStore
	} from '../../stores';
	import { hydrateTasksData } from '../../stores';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog/index.js';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Plus,
		Trash2,
		Heart,
		Briefcase,
		GraduationCap,
		Home,
		Users,
		Target,
		Zap,
		Palette,
		ChevronRight
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	const { data } = $props<PageData>();

	onMount(() => {
		hydrateTasksData(data);
	});

	// State
	let showAddDialog = $state(false);
	let showEditDialog = $state(false);
	let showDeleteDialog = $state(false);
	let editingArea = $state<any | null>(null);
	let deletingArea = $state<any | null>(null);

	// Form State
	let formName = $state('');
	let formDescription = $state('');
	let formThemeColor = $state('var(--primary)');

	// Logic
	const resetForm = () => {
		formName = '';
		formDescription = '';
		formThemeColor = 'var(--primary)';
		editingArea = null;
	};

	const openAdd = () => {
		resetForm();
		showAddDialog = true;
	};

	const openEdit = (area: any) => {
		editingArea = area;
		formName = area.name;
		formDescription = area.description || '';
		formThemeColor = area.themeColor || 'var(--primary)';
		showEditDialog = true;
	};

	const handleSave = async (isEdit = false) => {
		if (!formName.trim()) {
			toast.error('Area name is required');
			return;
		}

		const data = {
			name: formName.trim(),
			description: formDescription.trim() || undefined,
			themeColor: formThemeColor,
			userId: userId
		};

		try {
			if (isEdit && editingArea) {
				await updateAreaStore(editingArea.id, data);
				toast.success('Area updated');
				showEditDialog = false;
			} else {
				await addAreaStore(data);
				toast.success('Area created');
				showAddDialog = false;
			}
			resetForm();
		} catch (err) {
			toast.error('Failed to save area');
		}
	};

	const handleDelete = async () => {
		if (deletingArea) {
			try {
				await deleteAreaStore(deletingArea.id);
				toast.success('Area deleted');
				showDeleteDialog = false;
				deletingArea = null;
			} catch (err) {
				toast.error('Failed to delete area');
			}
		}
	};

	function getAreaIcon(areaName: string) {
		const name = areaName.toLowerCase();
		if (name.includes('health') || name.includes('fitness') || name.includes('wellness'))
			return Heart;
		if (name.includes('career') || name.includes('work') || name.includes('job')) return Briefcase;
		if (name.includes('education') || name.includes('learning') || name.includes('study'))
			return GraduationCap;
		if (name.includes('family') || name.includes('home') || name.includes('house')) return Home;
		if (name.includes('social') || name.includes('friends') || name.includes('relationships'))
			return Users;
		if (name.includes('finance') || name.includes('money') || name.includes('wealth'))
			return Target;
		if (name.includes('personal') || name.includes('growth') || name.includes('development'))
			return Zap;
		return Palette;
	}

	// Analytics
	const areaAnalytics = $derived(
		$areasStore.map((area) => {
			const areaProjects = $projectsStore.filter((p) => p.areaId === area.id);
			const areaTasks = $tasksStore.filter((t) => t.areaId === area.id);
			return {
				...area,
				projectCount: areaProjects.length,
				taskCount: areaTasks.length,
				activeTasks: areaTasks.filter((t) => !t.isCompleted).length
			};
		})
	);
</script>

<div class="space-y-8">
	<!-- Header -->
	<div class="relative overflow-hidden rounded-3xl bg-muted/30 py-12 text-center">
		<div class="absolute inset-0 bg-linear-to-r from-primary/5 via-transparent to-primary/5"></div>
		<div class="relative z-10 space-y-4">
			<h1 class="text-4xl font-extrabold tracking-tight lg:text-5xl">Life Pillars</h1>
			<p class="text-muted-foreground mx-auto max-w-2xl text-lg">
				Define the core areas of your life to maintain balance and focus.
			</p>
			<Button onclick={openAdd} size="lg" class="rounded-full px-8 shadow-xl">
				<Plus class="mr-2 h-5 w-5" />
				Add New Pillar
			</Button>
		</div>
	</div>

	<!-- Areas Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each areaAnalytics as area (area.id)}
			{@const Icon = getAreaIcon(area.name)}
			<Card
				class="group relative cursor-pointer overflow-hidden border-none shadow-md transition-all hover:-translate-y-1 hover:shadow-xl"
				onclick={() => openEdit(area)}
			>
				<!-- Background Accent -->
				<div
					class="absolute inset-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.06]"
					style="background-color: {area.themeColor}"
				></div>

				<CardHeader class="pb-2">
					<div class="flex items-start justify-between">
						<div
							class="rounded-2xl p-3 shadow-sm transition-transform group-hover:scale-110"
							style="background-color: {area.themeColor}20; color: {area.themeColor}"
						>
							<Icon class="h-6 w-6" />
						</div>
						<button
							class="text-muted-foreground p-1 transition-colors hover:text-destructive"
							onclick={(e) => {
								e.stopPropagation();
								deletingArea = area;
								showDeleteDialog = true;
							}}
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
					<CardTitle class="mt-4 font-bold">{area.name}</CardTitle>
				</CardHeader>

				<CardContent class="space-y-4">
					{#if area.description}
						<p class="text-muted-foreground line-clamp-2 min-h-[2.5rem] text-sm">
							{area.description}
						</p>
					{/if}

					<div class="grid grid-cols-2 gap-4 pt-2">
						<div class="space-y-1">
							<p class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
								Projects
							</p>
							<p class="text-2xl font-bold">{area.projectCount}</p>
						</div>
						<div class="space-y-1">
							<p class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
								Active Tasks
							</p>
							<p class="text-2xl font-bold">{area.activeTasks}</p>
						</div>
					</div>

					<div class="flex items-center justify-between border-t border-muted pt-4">
						<span class="text-muted-foreground text-xs font-medium"
							>Total tasks: {area.taskCount}</span
						>
						<ChevronRight
							class="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-1"
						/>
					</div>
				</CardContent>

				<!-- Bottom Color Bar -->
				<div class="h-1.5 w-full" style="background-color: {area.themeColor}"></div>
			</Card>
		{:else}
			<div class="py-20 text-center col-span-full">
				<div class="inline-flex p-6 mb-4 rounded-full bg-muted">
					<Target class="w-12 h-12 text-muted-foreground" />
				</div>
				<h3 class="text-xl font-bold">No Pillars Defined</h3>
				<p class="mt-2 text-muted-foreground">Start by defining the major areas of your life.</p>
				<Button variant="outline" class="mt-6" onclick={openAdd}>
					<Plus class="w-4 h-4 mr-2" />
					Create First Pillar
				</Button>
			</div>
		{/each}
	</div>
</div>

<!-- Area Dialogs -->
<Dialog bind:open={showAddDialog}>
<DialogContent class="w-[95vw] max-w-[520px] sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>Create New Pillar</DialogTitle>
			<DialogDescription>Define a major area of your life to organize your work.</DialogDescription>
		</DialogHeader>
		<div class="grid gap-5 py-4">
			<div class="space-y-2">
				<Label for="name" class="text-xs font-bold tracking-wider uppercase">Pillar Name</Label>
				<Input
					id="name"
					bind:value={formName}
					placeholder="e.g., Health, Career, Finance"
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
					placeholder="What does this area represent?"
					rows={3}
				/>
			</div>
			<div class="space-y-2">
				<Label for="color" class="text-xs font-bold tracking-wider uppercase">Theme Color</Label>
				<div class="flex items-center gap-3">
					<Input
						id="color"
						type="color"
						bind:value={formThemeColor}
						class="h-12 w-12 cursor-pointer rounded-lg p-1"
					/>
					<Input bind:value={formThemeColor} class="flex-1 font-mono" />
				</div>
			</div>
		</div>
		<DialogFooter>
			<Button variant="ghost" onclick={() => (showAddDialog = false)}>Cancel</Button>
			<Button onclick={() => handleSave(false)} class="px-8">Create Pillar</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<Dialog bind:open={showEditDialog}>
<DialogContent class="w-[95vw] max-w-[520px] sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>Edit Pillar</DialogTitle>
			<DialogDescription>Update your life pillar details.</DialogDescription>
		</DialogHeader>
		<div class="grid gap-5 py-4">
			<div class="space-y-2">
				<Label for="edit-name" class="text-xs font-bold tracking-wider uppercase">Pillar Name</Label
				>
				<Input id="edit-name" bind:value={formName} class="h-11" />
			</div>
			<div class="space-y-2">
				<Label for="edit-description" class="text-xs font-bold tracking-wider uppercase"
					>Description</Label
				>
				<Textarea id="edit-description" bind:value={formDescription} rows={3} />
			</div>
			<div class="space-y-2">
				<Label for="edit-color" class="text-xs font-bold tracking-wider uppercase"
					>Theme Color</Label
				>
				<div class="flex items-center gap-3">
					<Input
						id="edit-color"
						type="color"
						bind:value={formThemeColor}
						class="h-12 w-12 cursor-pointer rounded-lg p-1"
					/>
					<Input bind:value={formThemeColor} class="flex-1 font-mono" />
				</div>
			</div>
		</div>
		<DialogFooter>
			<Button variant="ghost" onclick={() => (showEditDialog = false)}>Cancel</Button>
			<Button onclick={() => handleSave(true)} class="px-8">Save Changes</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<AlertDialog bind:open={showDeleteDialog}>
<AlertDialogContent class="w-[95vw] max-w-[520px] sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Pillar</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to delete "{deletingArea?.name}"? This will not delete tasks or
				projects in this area, but they will be unassigned.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel
				onclick={() => {
					showDeleteDialog = false;
					deletingArea = null;
				}}>Cancel</AlertDialogCancel
			>
			<AlertDialogAction
				onclick={handleDelete}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
			>
				Delete Pillar
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

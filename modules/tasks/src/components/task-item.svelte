<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Trash2, Check, Calendar, Flag, GripVertical } from 'lucide-svelte';
	import { projectsStore, areasStore } from '$lib/stores/external_modules/MoLOS-Tasks';

	interface Props {
		task: {
			id: string;
			title: string;
			description?: string | null;
			isCompleted: boolean;
			dueDate?: number | null;
			priority?: string | null;
			status?: string;
			createdAt?: number;
			updatedAt?: number;
			projectId?: string;
			areaId?: string;
		};
		compact?: boolean;
	}

	let { task, compact = false }: Props = $props();

	const dispatch = createEventDispatcher();

	function toggleComplete() {
		dispatch('toggle');
	}

	function deleteTask() {
		dispatch('delete');
	}

	function requestEdit() {
		dispatch('requestEdit', task);
	}

	function handleDragStart(e: DragEvent) {
		e.dataTransfer!.setData('text/plain', task.id);
		dispatch('dragstart', e);
	}

	function handleDragEnd(e: DragEvent) {
		dispatch('dragend', e);
	}

	// Helper functions
	function isToday(ts: number | null): boolean {
		if (!ts) return false;
		const today = new Date();
		const d = new Date(ts * 1000);
		return (
			today.getFullYear() === d.getFullYear() &&
			today.getMonth() === d.getMonth() &&
			today.getDate() === d.getDate()
		);
	}

	function isOverdue(ts: number | null): boolean {
		if (!ts) return false;
		const now = Date.now();
		return ts * 1000 < now && !isToday(ts);
	}

	function formatDate(ts: number): string {
		const d = new Date(ts * 1000);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const priorityConfig: Record<string, { color: string; icon: any }> = {
		high: { color: 'text-red-500 bg-red-500/10 border-red-200', icon: Flag },
		medium: { color: 'text-amber-500 bg-amber-500/10 border-amber-200', icon: Flag },
		low: { color: 'text-blue-500 bg-blue-500/10 border-blue-200', icon: Flag }
	};

	const project = $derived($projectsStore.find((p) => p.id === task.projectId));
	const area = $derived($areasStore.find((a) => a.id === task.areaId));
</script>

<div
	class="group relative flex cursor-pointer flex-col rounded-xl border bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-md {task.isCompleted
		? 'opacity-75'
		: ''} {compact ? 'gap-1 p-2' : 'gap-3 p-4'}"
	role="button"
	tabindex="0"
	onclick={requestEdit}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			requestEdit();
		}
	}}
	draggable="true"
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
>
	<!-- Drag Handle (Visible on hover) -->
	<div
		class="absolute top-1/2 left-1 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-30"
	>
		<GripVertical class="h-4 w-4" />
	</div>

	<div class="flex items-start {compact ? 'gap-2' : 'gap-3'}">
		<button
			onclick={(e) => {
				e.stopPropagation();
				toggleComplete();
			}}
			class="mt-0.5 flex items-center justify-center rounded-full border-2 transition-all {task.isCompleted
				? 'border-green-500 bg-green-500 text-white'
				: 'border-muted-foreground/30 hover:border-primary'} {compact ? 'h-4 w-4' : 'h-5 w-5'}"
		>
			{#if task.isCompleted}
				<Check class="{compact ? 'h-2 w-2' : 'h-3 w-3'} stroke-3" />
			{/if}
		</button>

		<div class="min-w-0 flex-1 {compact ? 'space-y-0' : 'space-y-1'}">
			<p
				class="leading-tight font-bold transition-all {task.isCompleted
					? 'text-muted-foreground line-through'
					: 'text-foreground'} {compact ? 'text-xs' : 'text-sm'}"
			>
				{task.title}
			</p>
			{#if task.description && !compact}
				<p class="text-muted-foreground line-clamp-1 text-xs">
					{task.description}
				</p>
			{/if}
		</div>

		<button
			onclick={(e) => {
				e.stopPropagation();
				deleteTask();
			}}
			class="rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
		>
			<Trash2 class="h-3.5 w-3.5" />
		</button>
	</div>

	<div class="flex flex-wrap items-center gap-2 pt-1">
		{#if task.dueDate}
			<Badge
				variant="outline"
				class="h-5 gap-1 px-1.5 text-[10px] font-bold tracking-wider uppercase {isOverdue(
					task.dueDate
				)
					? 'border-red-200 bg-red-50 text-red-600'
					: isToday(task.dueDate)
						? 'border-amber-200 bg-amber-50 text-amber-600'
						: 'text-muted-foreground border-muted bg-muted/30'}"
			>
				<Calendar class="h-2.5 w-2.5" />
				{isToday(task.dueDate) ? 'Today' : formatDate(task.dueDate)}
			</Badge>
		{/if}

		{#if task.priority && priorityConfig[task.priority]}
			<Badge
				variant="outline"
				class="h-5 gap-1 px-1.5 text-[10px] font-bold tracking-wider uppercase {priorityConfig[
					task.priority
				].color}"
			>
				<Flag class="h-2.5 w-2.5 fill-current" />
				{task.priority}
			</Badge>
		{/if}

		<div class="flex-1"></div>

		{#if project}
			<Badge
				variant="secondary"
				class="h-5 max-w-20 truncate px-1.5 text-[9px] font-black tracking-tighter uppercase"
			>
				{project.name}
			</Badge>
		{/if}

		{#if area}
			<div
				class="h-2 w-2 rounded-full shadow-xs"
				style="background-color: {area.themeColor}"
				title={area.name}
			></div>
		{/if}
	</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import {
		dailyLogsStore,
		addDailyLogStore,
		updateDailyLogStore,
		deleteDailyLogStore
	} from '../../stores';
	import { hydrateTasksData } from '../../stores';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
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
		AlertDialogContent,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogCancel,
		AlertDialogAction
	} from '$lib/components/ui/alert-dialog';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Plus,
		Trash2,
		Calendar,
		Moon,
		Sun,
		Smile,
		Meh,
		Frown,
		CloudRain,
		Zap,
		BookOpen,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	const { data } = $props<PageData>();

	onMount(() => {
		hydrateTasksData(data);
	});

	// State
	let showAddDialog = $state(false);
	let selectedDate = $state(new Date().toISOString().split('T')[0]);
	let showDeleteDialog = $state(false);
	let logDateToDelete = $state<number | null>(null);

	// Form State
	let formMood = $state('');
	let formSleepHours = $state<number | undefined>(undefined);
	let formMorningRoutine = $state(false);
	let formEveningRoutine = $state(false);
	let formNotes = $state('');

	// Logic
	const resetForm = () => {
		formMood = '';
		formSleepHours = undefined;
		formMorningRoutine = false;
		formEveningRoutine = false;
		formNotes = '';
	};

	const handleSave = async () => {
		const logDate = Math.floor(new Date(selectedDate).setHours(0, 0, 0, 0) / 1000);

		const data = {
			logDate,
			mood: formMood || null,
			sleepHours: formSleepHours || null,
			morningRoutine: formMorningRoutine,
			eveningRoutine: formEveningRoutine,
			notes: formNotes || null
		};

		try {
			await addDailyLogStore(data as any);
			toast.success('Daily log saved');
			showAddDialog = false;
			resetForm();
		} catch (err) {
			toast.error('Failed to save daily log');
		}
	};

	const requestDelete = (logDate: number) => {
		logDateToDelete = logDate;
		showDeleteDialog = true;
	};

	const confirmDelete = async () => {
		if (logDateToDelete === null) return;
		try {
			await updateDailyLogStore(logDateToDelete, { mood: undefined, notes: undefined });
			await deleteDailyLogStore(logDateToDelete);
			toast.success('Entry deleted');
		} catch (err) {
			toast.error('Failed to delete entry');
		} finally {
			logDateToDelete = null;
			showDeleteDialog = false;
		}
	};

	const moodConfig: Record<string, { emoji: string; color: string; label: string }> = {
		'5': { emoji: '😄', color: 'text-primary', label: 'Excellent' },
		'4': { emoji: '🙂', color: 'text-primary', label: 'Good' },
		'3': { emoji: '😐', color: 'text-accent', label: 'Neutral' },
		'2': { emoji: '😕', color: 'text-accent', label: 'Bad' },
		'1': { emoji: '😢', color: 'text-destructive', label: 'Terrible' }
	};

	const formatDate = (ts: number) => {
		return new Date(ts * 1000).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	};

	const sortedLogs = $derived([...$dailyLogsStore].sort((a, b) => b.logDate - a.logDate));
</script>

<div class="max-w-5xl px-1 mx-auto space-y-8 sm:px-0">
	<!-- Header -->
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Daily Journal</h1>
			<p class="text-muted-foreground">Track your mood, routines, and daily reflections.</p>
		</div>
		<Button onclick={() => (showAddDialog = true)} class="px-6 rounded-full shadow-lg">
			<Plus class="w-5 h-5 mr-2" />
			Log Today
		</Button>
	</div>

	<!-- Stats Summary -->
	<div class="flex flex-col justify-center w-full gap-4 sm:flex-row">
		<Card class="w-full border-none shadow-none">
			<CardContent class="pt-6">
				<BookOpen class="w-6 h-6 mx-auto mb-2 text-primary" />
				<div class="text-2xl font-bold">{$dailyLogsStore.length}</div>
				<p class="text-xs font-medium tracking-wider uppercase text-muted-foreground">
					Total Entries
				</p>
			</CardContent>
		</Card>
		<Card class="w-full border-none shadow-none">
			<CardContent class="pt-6">
				<Sun class="w-6 h-6 mx-auto mb-2 text-primary" />
				<div class="text-2xl font-bold">
					{Math.round(
						($dailyLogsStore.filter((l) => l.morningRoutine).length /
							Math.max(1, $dailyLogsStore.length)) *
							100
					)}%
				</div>
				<p class="text-xs font-medium tracking-wider uppercase text-muted-foreground">
					Morning Routine
				</p>
			</CardContent>
		</Card>
		<Card class="w-full border-none shadow-none">
			<CardContent class="pt-6">
				<Moon class="w-6 h-6 mx-auto mb-2 text-primary" />
				<div class="text-2xl font-bold">
					{Math.round(
						($dailyLogsStore.filter((l) => l.eveningRoutine).length /
							Math.max(1, $dailyLogsStore.length)) *
							100
					)}%
				</div>
				<p class="text-xs font-medium tracking-wider uppercase text-muted-foreground">
					Evening Routine
				</p>
			</CardContent>
		</Card>
	</div>

	<!-- Journal Entries -->
		{#each sortedLogs as log (log.id)}
	<div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

			<Card class="overflow-hidden transition-all border shadow-sm group border-muted/40 bg-background/70 hover:shadow-md">
				<div class="grid gap-4 p-5 md:grid-cols-[200px,1fr] md:gap-6 md:p-6">
					<!-- Date + Mood -->
					<div class="flex flex-col gap-4 p-4 text-center rounded-2xl bg-muted/40 md:text-left">
						<div>
							<p class="text-xs font-bold tracking-widest uppercase text-muted-foreground">
								{new Date(log.logDate * 1000).toLocaleDateString('en-US', { weekday: 'long' })}
							</p>
							<div class="flex items-end justify-center gap-2 mt-2 md:justify-start">
								<span class="text-4xl font-black leading-none">
									{new Date(log.logDate * 1000).getDate()}
								</span>
								<span class="text-xs font-semibold uppercase text-muted-foreground">
									{new Date(log.logDate * 1000).toLocaleDateString('en-US', {
										month: 'short',
										year: 'numeric'
									})}
								</span>
							</div>
						</div>

						{#if log.mood && moodConfig[log.mood]}
							<div class="flex items-center justify-center gap-3 md:justify-start">
								<div class="text-3xl" title={moodConfig[log.mood].label}>
									{moodConfig[log.mood].emoji}
								</div>
								<div class="text-left">
									<p class="text-xs font-bold tracking-wider uppercase text-muted-foreground">
										Mood
									</p>
									<p class="text-sm font-semibold">{moodConfig[log.mood].label}</p>
								</div>
							</div>
						{/if}

						<div class="flex flex-wrap justify-center gap-2 md:justify-start">
							{#if log.sleepHours}
								<Badge variant="secondary" class="text-[10px] font-bold tracking-wider uppercase">
									<Moon class="w-3 h-3 mr-1" />
									{log.sleepHours}h Sleep
								</Badge>
							{/if}
							{#if log.morningRoutine}
								<Badge
									variant="outline"
									class="border-primary/20 bg-primary/10 text-[10px] font-bold tracking-wider text-primary uppercase"
								>
									<Sun class="w-3 h-3 mr-1" /> Morning
								</Badge>
							{/if}
							{#if log.eveningRoutine}
								<Badge
									variant="outline"
									class="border-primary/20 bg-primary/10 text-[10px] font-bold tracking-wider text-primary uppercase"
								>
									<Moon class="w-3 h-3 mr-1" /> Evening
								</Badge>
							{/if}
						</div>
					</div>

					<!-- Entry -->
					<div class="flex flex-col min-w-0 gap-4">
						<div class="flex items-start justify-between">
							<div>
								<h3 class="text-lg font-bold leading-none">{formatDate(log.logDate)}</h3>
								<p class="mt-1 text-xs text-muted-foreground">
									Reflection & daily notes
								</p>
							</div>
							<button
								class="p-2 transition-all rounded-md opacity-0 text-muted-foreground group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
								onclick={() => requestDelete(log.logDate)}
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>

						{#if log.notes}
							<div class="relative p-4 text-sm leading-relaxed border rounded-2xl border-muted/40 bg-muted/10">
								<div class="absolute top-0 left-0 h-full w-1.5 rounded-full bg-primary/20"></div>
								<p class="italic text-muted-foreground">"{log.notes}"</p>
							</div>
						{:else}
							<div class="p-4 text-sm border border-dashed rounded-2xl border-muted/50 bg-muted/10 text-muted-foreground">
								No notes for this day.
							</div>
						{/if}
					</div>
				</div>
			</Card>
				</div>

		{:else}
			<div class="w-full py-20 text-center">
				<div class="inline-flex p-6 mb-4 rounded-full bg-muted">
					<Calendar class="w-12 h-12 text-muted-foreground" />
				</div>
				<h3 class="text-xl font-bold">No Journal Entries</h3>
				<p class="mt-2 text-muted-foreground">Start tracking your daily journey today.</p>
				<Button variant="outline" class="mt-6" onclick={() => (showAddDialog = true)}>
					<Plus class="w-4 h-4 mr-2" />
					Create First Entry
				</Button>
			</div>
		{/each}
</div>

<!-- Log Dialog -->
<Dialog bind:open={showAddDialog}>
<DialogContent class="w-[95vw] max-w-[560px] sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>Daily Log Entry</DialogTitle>
			<DialogDescription>Reflect on your day and track your habits.</DialogDescription>
		</DialogHeader>

		<div class="grid gap-6 py-4">
			<div class="space-y-2">
				<Label class="text-xs font-bold tracking-wider uppercase">Date</Label>
				<Input type="date" bind:value={selectedDate} class="h-11" />
			</div>

			<div class="space-y-3">
				<Label class="text-xs font-bold tracking-wider uppercase">How are you feeling?</Label>
				<div class="flex justify-between gap-2">
					{#each Object.entries(moodConfig) as [val, cfg]}
						<button
							class="flex flex-1 flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all {formMood ===
							val
								? 'scale-105 border-primary bg-primary/5'
								: 'border-transparent bg-muted/30 hover:bg-muted/50'}"
							onclick={() => (formMood = val)}
						>
							<span class="text-2xl">{cfg.emoji}</span>
							<span class="text-muted-foreground text-[10px] font-bold tracking-tighter uppercase"
								>{cfg.label}</span
							>
						</button>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-2">
					<Label for="sleep" class="text-xs font-bold tracking-wider uppercase">Sleep Hours</Label>
					<Input
						id="sleep"
						type="number"
						step="0.5"
						bind:value={formSleepHours}
						placeholder="e.g. 7.5"
						class="h-10"
					/>
				</div>
				<div class="space-y-2">
					<Label class="text-xs font-bold tracking-wider uppercase">Routines</Label>
					<div class="flex gap-2">
						<button
							class="flex h-10 flex-1 items-center justify-center rounded-md border transition-all {formMorningRoutine
								? 'border-primary/20 bg-primary/10 text-primary'
								: 'bg-background'}"
							onclick={() => (formMorningRoutine = !formMorningRoutine)}
						>
							<Sun class="w-4 h-4 mr-2" />
							<span class="text-xs font-bold">AM</span>
						</button>
						<button
							class="flex h-10 flex-1 items-center justify-center rounded-md border transition-all {formEveningRoutine
								? 'border-primary/20 bg-primary/10 text-primary'
								: 'bg-background'}"
							onclick={() => (formEveningRoutine = !formEveningRoutine)}
						>
							<Moon class="w-4 h-4 mr-2" />
							<span class="text-xs font-bold">PM</span>
						</button>
					</div>
				</div>
			</div>

			<div class="space-y-2">
				<Label for="notes" class="text-xs font-bold tracking-wider uppercase">Reflections</Label>
				<Textarea id="notes" bind:value={formNotes} placeholder="What's on your mind?" rows={4} />
			</div>
		</div>

		<DialogFooter>
			<Button variant="ghost" onclick={() => (showAddDialog = false)}>Cancel</Button>
			<Button onclick={handleSave} class="px-8">Save Entry</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<AlertDialog bind:open={showDeleteDialog}>
<AlertDialogContent class="w-[95vw] max-w-[520px] sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
		<AlertDialogHeader>
			<AlertDialogTitle>Are you sure?</AlertDialogTitle>
			<AlertDialogDescription>
				This will permanently delete this daily log entry.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={() => (logDateToDelete = null)}>Cancel</AlertDialogCancel>
			<AlertDialogAction
				onclick={confirmDelete}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
			>
				Delete
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Bell, Eye, Layout, Shield, Trash2, Loader2, Save } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { tasksSettingsStore, updateTasksSettings } from '../../stores';
	import { hydrateTasksData } from '../../stores';

	let isSaving = $state(false);

	const { data } = $props<PageData>();

	onMount(() => {
		hydrateTasksData(data);
	});

	// Form state
	let notifications = $state($tasksSettingsStore?.notifications ?? true);
	let showCompleted = $state($tasksSettingsStore?.showCompleted ?? false);
	let compactMode = $state($tasksSettingsStore?.compactMode ?? false);

	$effect(() => {
		if ($tasksSettingsStore) {
			notifications = $tasksSettingsStore.notifications;
			showCompleted = $tasksSettingsStore.showCompleted;
			compactMode = $tasksSettingsStore.compactMode;
		}
	});

	async function handleSave() {
		isSaving = true;
		try {
			await updateTasksSettings({
				notifications,
				showCompleted,
				compactMode
			});
			toast.success('Settings updated successfully');
		} catch (err) {
			toast.error('Failed to update settings');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-8">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Settings</h1>
		<p class="text-muted-foreground">
			Manage your task management preferences and account settings.
		</p>
	</div>

	<div class="grid gap-6">
		<!-- Display Settings -->
		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<Layout class="h-5 w-5 text-primary" />
					<div>
						<CardTitle>Display & Interface</CardTitle>
						<CardDescription>Customize how your tasks and projects are displayed.</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label>Show Completed Tasks</Label>
						<p class="text-muted-foreground text-xs">
							Always show completed tasks in the list view by default.
						</p>
					</div>
					<Switch bind:checked={showCompleted} />
				</div>
				<Separator />
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label>Compact Mode</Label>
						<p class="text-muted-foreground text-xs">
							Use less padding and smaller text in task lists.
						</p>
					</div>
					<Switch bind:checked={compactMode} />
				</div>
			</CardContent>
		</Card>

		<!-- Notification Settings -->
		<Card>
			<CardHeader>
				<div class="flex items-center gap-2">
					<Bell class="h-5 w-5 text-primary" />
					<div>
						<CardTitle>Notifications</CardTitle>
						<CardDescription>Configure how you want to be notified about deadlines.</CardDescription
						>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label>Push Notifications</Label>
						<p class="text-muted-foreground text-xs">
							Receive alerts for upcoming and overdue tasks.
						</p>
					</div>
					<Switch bind:checked={notifications} />
				</div>
			</CardContent>
		</Card>

		<!-- Danger Zone -->
		<Card class="border-destructive/20">
			<CardHeader>
				<div class="flex items-center gap-2">
					<Shield class="h-5 w-5 text-destructive" />
					<div>
						<CardTitle class="">Danger Zone</CardTitle>
						<CardDescription>Irreversible actions for your task data.</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label>Clear All Task Data</Label>
						<p class="text-muted-foreground text-xs">
							This will permanently delete all your tasks, projects, and areas.
						</p>
					</div>
					<Button variant="destructive" size="sm">
						<Trash2 class="mr-2 h-4 w-4" />
						Reset Module
					</Button>
				</div>
			</CardContent>
		</Card>
	</div>

	<div class="flex justify-end gap-4">
		<Button variant="ghost">Cancel</Button>
		<Button onclick={handleSave} class="px-8 font-bold" disabled={isSaving}>
			{#if isSaving}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Saving...
			{:else}
				<Save class="mr-2 h-4 w-4" />
				Save Changes
			{/if}
		</Button>
	</div>
</div>

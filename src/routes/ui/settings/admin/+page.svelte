<script lang="ts">
	import type { PageData } from './$types';
	import { authClient } from '$lib/auth-client';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { toast } from 'svelte-sonner';
	import {
		Shield,
		Users,
		Activity,
		Key,
		Package,
		Database,
		UserCog,
		Ban,
		Unlock,
		Trash2,
		ArrowLeft,
		Search,
		Plus,
		Settings,
		Terminal,
		AlertCircle,
		CheckCircle2,
		Info,
		Save,
		RefreshCw,
		ChevronRight,
		Mail,
		MailCheck,
		MailWarning,
		Calendar,
		ShieldCheck,
		UserMinus
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import StatsGrid from './components/StatsGrid.svelte';
	import UsersTable from './components/UsersTable.svelte';
	import SystemSettings from './components/SystemSettings.svelte';
	import LogsViewer from './components/LogsViewer.svelte';

	let { data } = $props();
	let users = $derived(data.users);
	let systemSettings = $derived(data.systemSettings);
	let searchQuery = $state('');
	let activeTab = $state('users');
	let roleFilter = $state('all');
	let statusFilter = $state('all');
	let externalModules = $derived(data.externalModules);
	let serverLogs = $derived(data.serverLogs);

	let isConfirmingAction = $state(false);
	let actionToConfirm: (() => void) | null = $state(null);
	let confirmTitle = $state('');
	let confirmDescription = $state('');

	const filteredUsers = $derived(
		users.filter((u) => {
			const matchesSearch =
				u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				u.email.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesRole = roleFilter === 'all' || u.role === roleFilter;
			const matchesStatus =
				statusFilter === 'all' || (statusFilter === 'banned' ? u.banned : !u.banned);
			return matchesSearch && matchesRole && matchesStatus;
		})
	);

	function requestConfirmation(title: string, description: string, action: () => void) {
		confirmTitle = title;
		confirmDescription = description;
		actionToConfirm = action;
		isConfirmingAction = true;
	}

	async function handleBanUser(userId: string, isBanned: boolean) {
		const action = async () => {
			try {
				if (isBanned) {
					await authClient.admin.unbanUser({ userId });
					toast.success('User unbanned');
				} else {
					await authClient.admin.banUser({ userId });
					toast.success('User banned');
				}
				refreshUsers();
			} catch (err) {
				toast.error('Failed to update user status');
			}
		};

		if (isBanned) {
			action();
		} else {
			requestConfirmation(
				'Ban User',
				'Are you sure you want to ban this user? They will no longer be able to access the system.',
				action
			);
		}
	}

	async function handleSetRole(userId: string, currentRole: string) {
		const newRole = currentRole === 'admin' ? 'user' : 'admin';
		const action = async () => {
			try {
				await authClient.admin.setRole({ userId, role: newRole });
				toast.success(`Role updated to ${newRole}`);
				refreshUsers();
			} catch (err) {
				toast.error('Failed to update user role');
			}
		};

		if (newRole === 'admin') {
			requestConfirmation(
				'Promote to Admin',
				'Are you sure you want to promote this user to Admin? They will have full access to system settings.',
				action
			);
		} else {
			requestConfirmation(
				'Demote to User',
				'Are you sure you want to demote this Admin to a regular User?',
				action
			);
		}
	}

	async function refreshUsers() {
		const { data: updatedUsers } = await authClient.admin.listUsers({ query: { limit: 100 } });
		if (updatedUsers) users = updatedUsers.users;
	}

	async function handleResetDatabase() {
		requestConfirmation(
			'Reset Database',
			'Are you sure you want to reset the database? This action is irreversible and will delete all system data.',
			() => {
				toast.info('This feature is under development.');
			}
		);
	}

	async function handleUpdateSystemSetting(key: string, value: string, description?: string) {
		try {
			const response = await fetch('/api/settings/system', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key, value, description })
			});

			if (response.ok) {
				toast.success(`Setting ${key} updated`);
				refreshSystemSettings();
			} else {
				toast.error('Failed to update setting');
			}
		} catch (err) {
			toast.error('Error updating setting');
		}
	}

	async function handleDeleteSystemSetting(key: string) {
		requestConfirmation(
			'Delete System Setting',
			`Are you sure you want to delete the setting "${key}"? This may affect system behavior.`,
			async () => {
				try {
					const response = await fetch('/api/settings/system', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ key })
					});
					if (response.ok) {
						toast.success(`Setting ${key} deleted`);
						refreshSystemSettings();
					} else {
						toast.error('Failed to delete setting');
					}
				} catch (err) {
					toast.error('Error deleting setting');
				}
			}
		);
	}

	async function refreshSystemSettings() {
		const response = await fetch('/api/settings/system');
		if (response.ok) {
			systemSettings = await response.json();
		}
	}

	async function refreshLogs() {
		const response = await fetch('/api/settings/logs');
		if (response.ok) {
			serverLogs = await response.json();
		}
	}

	async function handleClearLogs() {
		requestConfirmation(
			'Clear Server Logs',
			'Are you sure you want to clear all server logs? This action cannot be undone.',
			async () => {
				try {
					const response = await fetch('/api/settings/logs', { method: 'DELETE' });
					if (response.ok) {
						toast.success('Logs cleared');
						refreshLogs();
					}
				} catch (err) {
					toast.error('Error clearing logs');
				}
			}
		);
	}
</script>

<svelte:head>
	<title>Admin Console - MoLOS</title>
	<meta name="description" content="System management and governance for MoLOS administrators." />
</svelte:head>

<div class="min-h-screen bg-background pb-20">
	<div class="mx-auto max-w-4xl space-y-8 p-6">
		<!-- Header -->
		<div class="space-y-4 pt-4">
			<Button
				variant="ghost"
				size="sm"
				onclick={() => goto('/ui/settings')}
				class="text-muted-foreground -ml-2 h-8 rounded-full px-3 text-[10px] font-bold tracking-widest uppercase hover:text-foreground"
			>
				<ArrowLeft class="mr-2 h-3 w-3" />
				Back to Settings
			</Button>
			<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div class="space-y-1">
					<h1 class="text-3xl font-black tracking-tighter">Admin Console</h1>
					<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
						System Management & Governance
					</p>
				</div>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						class="border-muted-foreground/20 h-9 rounded-xl font-bold"
						onclick={handleResetDatabase}
					>
						<Database class="mr-2 h-4 w-4" />
						Reset DB
					</Button>
				</div>
			</div>
		</div>

		<!-- Stats Grid -->
		<StatsGrid
			totalUsers={data.totalUsers}
			activeSessionsCount={data.activeSessionsCount}
			totalApiKeys={data.totalApiKeys}
			externalModulesCount={externalModules.length}
		/>

		<!-- Main Content Tabs -->
		<Tabs.Root bind:value={activeTab} class="space-y-6">
			<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<Tabs.List class="w-fit rounded-xl bg-muted/20 p-1">
					<Tabs.Trigger
						value="users"
						class="rounded-lg px-6 text-[10px] font-bold tracking-wider uppercase data-[state=active]:bg-background data-[state=active]:shadow-xs"
					>
						<Users class="mr-2 h-3.5 w-3.5" />
						Users
					</Tabs.Trigger>
					<Tabs.Trigger
						value="settings"
						class="rounded-lg px-6 text-[10px] font-bold tracking-wider uppercase data-[state=active]:bg-background data-[state=active]:shadow-xs"
					>
						<Settings class="mr-2 h-3.5 w-3.5" />
						System
					</Tabs.Trigger>
					<Tabs.Trigger
						value="logs"
						class="rounded-lg px-6 text-[10px] font-bold tracking-wider uppercase data-[state=active]:bg-background data-[state=active]:shadow-xs"
					>
						<Terminal class="mr-2 h-3.5 w-3.5" />
						Logs
					</Tabs.Trigger>
				</Tabs.List>

				{#if activeTab === 'users'}
					<div class="flex flex-wrap items-center gap-3">
						<div class="relative w-full md:w-64">
							<Search
								class="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
							/>
							<Input
								placeholder="Search users..."
								bind:value={searchQuery}
								class="h-9 rounded-xl border-none bg-muted/10 pl-9 text-xs shadow-xs focus-visible:ring-1"
							/>
						</div>
					</div>
				{/if}
			</div>

			<!-- Users Tab -->
			<Tabs.Content value="users">
				<UsersTable
					users={filteredUsers}
					currentUserId={data.currentUser.id}
					onBanUser={handleBanUser}
					onSetRole={handleSetRole}
					{requestConfirmation}
					{refreshUsers}
				/>
			</Tabs.Content>

			<!-- System Settings Tab -->
			<Tabs.Content value="settings">
				<SystemSettings
					{systemSettings}
					onUpdateSetting={handleUpdateSystemSetting}
					onDeleteSetting={handleDeleteSystemSetting}
				/>
			</Tabs.Content>

			<!-- Logs Tab -->
			<Tabs.Content value="logs">
				<LogsViewer
					{serverLogs}
					onRefreshLogs={refreshLogs}
					onClearLogs={handleClearLogs}
					{requestConfirmation}
				/>
			</Tabs.Content>
		</Tabs.Root>
	</div>
</div>

<AlertDialog.Root bind:open={isConfirmingAction}>
	<AlertDialog.Content class="rounded-3xl border-none shadow-2xl">
		<AlertDialog.Header>
			<AlertDialog.Title class="text-2xl font-black tracking-tight"
				>{confirmTitle}</AlertDialog.Title
			>
			<AlertDialog.Description class="text-muted-foreground text-sm font-medium">
				{confirmDescription}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer class="mt-6">
			<AlertDialog.Cancel class="border-muted-foreground/20 rounded-2xl font-bold"
				>Cancel</AlertDialog.Cancel
			>
			<AlertDialog.Action
				class="rounded-2xl bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
				onclick={() => {
					if (actionToConfirm) actionToConfirm();
					isConfirmingAction = false;
				}}
			>
				Confirm Action
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

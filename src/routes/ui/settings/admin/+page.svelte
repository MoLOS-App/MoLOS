<svelte:head>
	<title>Admin Console - MoLOS</title>
	<meta name="description" content="System management and governance for MoLOS administrators." />
</svelte:head>

<script lang="ts">
	import type { PageData } from './$types';
	import { authClient } from '$lib/auth-client';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		Shield,
		Users,
		Key,
		Database,
		UserCog,
		Ban,
		Unlock,
		Trash2,
		ArrowLeft,
		Search,
		Plus,
		Activity,
		Settings,
		Package,
		Terminal,
		RefreshCw,
		Save,
		AlertCircle,
		CheckCircle2,
		Info,
		MoreHorizontal,
		Mail,
		MailCheck,
		MailWarning,
		Calendar,
		ShieldCheck,
		UserMinus
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';

	let { data } = $props();
	let users = $derived(data.users);
	let systemSettings = $derived(data.systemSettings);
	let searchQuery = $state('');
	let activeTab = $state('users');
	let roleFilter = $state('all');
	let statusFilter = $state('all');

	let newSettingKey = $state('');
	let newSettingValue = $state('');
	let newSettingDescription = $state('');
	let isAddingSetting = $state(false);

	let isConfirmingAction = $state(false);
	let actionToConfirm: (() => void) | null = $state(null);
	let confirmTitle = $state('');
	let confirmDescription = $state('');

	let externalModules = $derived(data.externalModules);
	let serverLogs = $derived(data.serverLogs);
	let isInstallingModule = $state(false);
	let newModuleId = $state('');
	let newModuleRepoUrl = $state('');

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

	async function handleAddSystemSetting() {
		if (!newSettingKey || newSettingValue === '') {
			toast.error('Key and value are required');
			return;
		}
		await handleUpdateSystemSetting(newSettingKey, newSettingValue, newSettingDescription);
		newSettingKey = '';
		newSettingValue = '';
		newSettingDescription = '';
		isAddingSetting = false;
	}

	async function refreshSystemSettings() {
		const response = await fetch('/api/settings/system');
		if (response.ok) {
			systemSettings = await response.json();
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

	async function handleInstallModule() {
		if (!newModuleId || !newModuleRepoUrl) {
			toast.error('Module ID and Repo URL are required');
			return;
		}
		try {
			const response = await fetch('/api/settings/external-modules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: newModuleId, repoUrl: newModuleRepoUrl })
			});
			if (response.ok) {
				toast.success('Module registration pending');
				refreshExternalModules();
				newModuleId = '';
				newModuleRepoUrl = '';
				isInstallingModule = false;
			} else {
				toast.error('Failed to register module');
			}
		} catch (err) {
			toast.error('Error registering module');
		}
	}

	async function handleDeleteModule(id: string) {
		requestConfirmation(
			'Delete External Module',
			`Are you sure you want to delete the module "${id}"? This will remove the module files and configuration.`,
			async () => {
				try {
					const response = await fetch('/api/settings/external-modules', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ id })
					});
					if (response.ok) {
						toast.success('Module deleted');
						refreshExternalModules();
					} else {
						toast.error('Failed to delete module');
					}
				} catch (err) {
					toast.error('Error deleting module');
				}
			}
		);
	}

	async function refreshExternalModules() {
		const response = await fetch('/api/settings/external-modules');
		if (response.ok) {
			externalModules = await response.json();
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

	function formatDate(date: Date | number | string) {
		return new Date(date).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function getLogLevelColor(level: string) {
		switch (level) {
			case 'error':
				return 'text-destructive bg-destructive/10 border-destructive/20';
			case 'warn':
				return 'text-accent bg-accent/10 border-accent/20';
			case 'info':
				return 'text-primary bg-primary/10 border-primary/20';
			default:
				return 'text-muted-foreground bg-muted border-muted-foreground/20';
		}
	}
</script>

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
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
			<Card class="overflow-hidden border-none shadow-sm">
				<CardContent class="p-6">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
								Total Users
							</p>
							<p class="text-3xl font-black tracking-tighter">{data.totalUsers}</p>
						</div>
						<div class="rounded-2xl bg-background p-3 text-primary shadow-xs">
							<Users class="h-5 w-5" />
						</div>
					</div>
				</CardContent>
			</Card>
			<Card class="overflow-hidden border-none shadow-sm">
				<CardContent class="p-6">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
								Active Sessions
							</p>
							<p class="text-3xl font-black tracking-tighter">{data.activeSessionsCount}</p>
						</div>
						<div class="rounded-2xl bg-background p-3 text-primary shadow-xs">
							<Activity class="h-5 w-5" />
						</div>
					</div>
				</CardContent>
			</Card>
			<Card class="overflow-hidden border-none shadow-sm">
				<CardContent class="p-6">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
								API Keys
							</p>
							<p class="text-3xl font-black tracking-tighter">{data.totalApiKeys}</p>
						</div>
						<div class="rounded-2xl bg-background p-3 text-primary shadow-xs">
							<Key class="h-5 w-5" />
						</div>
					</div>
				</CardContent>
			</Card>
			<Card class="overflow-hidden border-none shadow-sm">
				<CardContent class="p-6">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<p class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
								Ext. Modules
							</p>
							<p class="text-3xl font-black tracking-tighter">{externalModules.length}</p>
						</div>
						<div class="rounded-2xl bg-background p-3 text-primary shadow-xs">
							<Package class="h-5 w-5" />
						</div>
					</div>
				</CardContent>
			</Card>
		</div>

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
				<Card class="overflow-hidden border-none p-0 shadow-sm">
					<CardContent class="p-0">
						<Table.Root>
							<Table.Header class="bg-muted/30">
								<Table.Row>
									<Table.Head class="w-75 text-[10px] font-black tracking-widest uppercase">
										User
									</Table.Head>
									<Table.Head class="text-[10px] font-black tracking-widest uppercase">
										Role
									</Table.Head>
									<Table.Head class="text-[10px] font-black tracking-widest uppercase">
										Status
									</Table.Head>
									<Table.Head class="text-[10px] font-black tracking-widest uppercase">
										Joined
									</Table.Head>
									<Table.Head class="text-right text-[10px] font-black tracking-widest uppercase">
										Actions
									</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each filteredUsers as user}
									<Table.Row class="group transition-colors hover:bg-background/50">
										<Table.Cell>
											<div class="flex items-center gap-4">
												<Avatar.Root
													class="h-10 w-10 rounded-xl border-2 border-background shadow-sm"
												>
													<Avatar.Image src={user.image} alt={user.name} />
													<Avatar.Fallback class="bg-primary/10 font-black text-primary">
														{user.name.charAt(0).toUpperCase()}
													</Avatar.Fallback>
												</Avatar.Root>
												<div class="flex min-w-0 flex-col">
													<span class="truncate text-sm font-bold">{user.name}</span>
													<div class="text-muted-foreground flex items-center gap-1 text-[10px]">
														<Mail class="h-3 w-3" />
														<span class="truncate">{user.email}</span>
													</div>
												</div>
											</div>
										</Table.Cell>
										<Table.Cell>
											<div class="flex items-center gap-2">
												{#if user.role === 'admin'}
													<ShieldCheck class="h-3.5 w-3.5 text-primary" />
												{/if}
												<Badge
													variant={user.role === 'admin' ? 'default' : 'secondary'}
													class="rounded-lg px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase"
												>
													{user.role || 'user'}
												</Badge>
											</div>
										</Table.Cell>
										<Table.Cell>
											{#if user.banned}
												<Badge
													variant="destructive"
													class="rounded-lg px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase"
												>
													Banned
												</Badge>
											{:else}
												<Badge
													variant="outline"
													class="rounded-lg border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-primary uppercase"
												>
													Active
												</Badge>
											{/if}
										</Table.Cell>
										<Table.Cell>
											<div
												class="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase"
											>
												<Calendar class="h-3.5 w-3.5" />
												{new Date(user.createdAt).toLocaleDateString(undefined, {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})}
											</div>
										</Table.Cell>
										<Table.Cell class="text-right">
											<DropdownMenu.Root>
												<DropdownMenu.Trigger>
													<Button
														variant="ghost"
														size="icon"
														class="h-8 w-8 rounded-xl hover:bg-background hover:text-foreground"
													>
														<MoreHorizontal class="h-4 w-4" />
													</Button>
												</DropdownMenu.Trigger>
												<DropdownMenu.Content
													align="end"
													class="w-48 rounded-2xl border-none p-2 shadow-xl"
												>
													<DropdownMenu.Label
														class="text-muted-foreground px-2 py-1.5 text-[9px] font-black tracking-widest uppercase"
														>User Actions</DropdownMenu.Label
													>
													<DropdownMenu.Separator class="my-1" />
													<DropdownMenu.Item
														class="cursor-pointer gap-2 rounded-xl text-xs font-bold"
														onclick={() => handleSetRole(user.id, user.role || 'user')}
													>
														<UserCog class="h-4 w-4" />
														{user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
													</DropdownMenu.Item>
													<DropdownMenu.Item
														class={cn(
															'cursor-pointer gap-2 rounded-xl text-xs font-bold',
															user.banned ? 'text-primary' : 'text-destructive'
														)}
														disabled={user.id === data.currentUser.id}
														onclick={() => handleBanUser(user.id, user.banned ?? false)}
													>
														{#if user.banned}
															<Unlock class="h-4 w-4" />
															Unban Account
														{:else}
															<Ban class="h-4 w-4" />
															Ban Account
														{/if}
													</DropdownMenu.Item>
													<DropdownMenu.Separator class="my-1" />
													<DropdownMenu.Item
														class="cursor-pointer gap-2 rounded-xl text-xs font-bold text-destructive"
														disabled={user.id === data.currentUser.id}
														onclick={() => {
															requestConfirmation(
																'Delete User',
																`Are you sure you want to permanently delete the user "${user.name}"? This action cannot be undone.`,
																async () => {
																	try {
																		// TODO: Implement deleteUser in authClient
																		toast.error('Delete user not implemented yet');
																	} catch (err) {
																		toast.error('Failed to delete user');
																	}
																}
															);
														}}
													>
														<UserMinus class="h-4 w-4" />
														Delete User
													</DropdownMenu.Item>
												</DropdownMenu.Content>
											</DropdownMenu.Root>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</CardContent>
				</Card>
			</Tabs.Content>

			<!-- System Settings Tab -->
			<Tabs.Content value="settings">
				<div class="grid gap-6 md:grid-cols-2">
					<Card class="border-none shadow-sm">
						<CardHeader>
							<CardTitle class="font-bold">System Configuration</CardTitle>
							<CardDescription class="font-medium tracking-wider uppercase"
								>Global application parameters and flags</CardDescription
							>
						</CardHeader>
						<CardContent class="space-y-4">
							{#if isAddingSetting}
								<div
									class="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-background/50 p-4"
								>
									<div class="flex items-center justify-between">
										<span class="text-[10px] font-black tracking-widest text-primary uppercase"
											>New Setting</span
										>
										<div class="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 rounded-lg"
												onclick={() => (isAddingSetting = false)}
											>
												<Trash2 class="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 rounded-lg text-primary"
												onclick={handleAddSystemSetting}
											>
												<CheckCircle2 class="h-4 w-4" />
											</Button>
										</div>
									</div>
									<Input
										placeholder="Key (e.g. REGISTRATION_ALLOWED)"
										bind:value={newSettingKey}
										class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
									/>
									<Input
										placeholder="Value"
										bind:value={newSettingValue}
										class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
									/>
									<Input
										placeholder="Description (optional)"
										bind:value={newSettingDescription}
										class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
									/>
								</div>
							{/if}

							{#each systemSettings as setting, i (setting.key)}
								<div
									class="border-muted-foreground/5 flex flex-col gap-2 rounded-2xl border bg-background/50 p-4"
								>
									<div class="flex items-center justify-between">
										<span
											class="text-muted-foreground text-[10px] font-black tracking-widest uppercase"
											>{setting.key}</span
										>
										<div class="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 rounded-lg hover:text-destructive"
												onclick={() => handleDeleteSystemSetting(setting.key)}
											>
												<Trash2 class="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												class="h-8 w-8 rounded-lg hover:text-primary"
												onclick={() =>
													handleUpdateSystemSetting(
														setting.key,
														systemSettings[i].value,
														setting.description || undefined
													)}
											>
												<Save class="h-4 w-4" />
											</Button>
										</div>
									</div>
									<Input
										bind:value={systemSettings[i].value}
										class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
									/>
									{#if setting.description}
										<p class="text-muted-foreground text-[10px] font-medium">
											{setting.description}
										</p>
									{/if}
								</div>
							{:else}
								{#if !isAddingSetting}
									<div
										class="flex flex-col items-center justify-center py-12 space-y-3 text-center"
									>
										<div class="p-4 rounded-full shadow-xs bg-background">
											<Settings class="w-8 h-8 text-muted-foreground/50" />
										</div>
										<div>
											<p class="text-sm font-bold">No system settings found</p>
											<p class="text-xs text-muted-foreground">
												Add global configuration keys to manage system behavior.
											</p>
										</div>
										<Button
											variant="outline"
											size="sm"
											class="text-xs font-bold rounded-xl"
											onclick={() => (isAddingSetting = true)}
										>
											<Plus class="w-4 h-4 mr-2" />
											Add Setting
										</Button>
									</div>
								{/if}
							{/each}

							{#if systemSettings.length > 0 && !isAddingSetting}
								<Button
									variant="outline"
									size="sm"
									class="border-muted-foreground/20 w-full rounded-xl border-dashed text-xs font-bold"
									onclick={() => (isAddingSetting = true)}
								>
									<Plus class="mr-2 h-4 w-4" />
									Add New Setting
								</Button>
							{/if}
						</CardContent>
					</Card>

					<Card class="border-none shadow-sm">
						<CardHeader>
							<CardTitle class="font-bold">Security & Access</CardTitle>
							<CardDescription class="font-medium tracking-wider uppercase"
								>Manage authentication and security policies</CardDescription
							>
						</CardHeader>
						<CardContent class="space-y-6">
							{@const publicReg = systemSettings.find((s) => s.key === 'PUBLIC_REGISTRATION')}
							<div
								class="border-muted-foreground/5 flex items-center justify-between rounded-2xl border bg-background/50 p-4"
							>
								<div class="space-y-0.5">
									<p class="text-sm font-bold">Public Registration</p>
									<p class="text-muted-foreground text-xs">Allow new users to create accounts</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class={cn(
										'rounded-xl text-[10px] font-bold tracking-widest uppercase',
										publicReg?.value === 'true'
											? 'bg-primary/10 text-primary'
											: 'bg-destructive/10 text-destructive'
									)}
									onclick={() =>
										handleUpdateSystemSetting(
											'PUBLIC_REGISTRATION',
											publicReg?.value === 'true' ? 'false' : 'true',
											'Allow new users to create accounts'
										)}
								>
									{publicReg?.value === 'true' ? 'Enabled' : 'Disabled'}
								</Button>
							</div>

							{@const emailVer = systemSettings.find((s) => s.key === 'EMAIL_VERIFICATION')}
							<div
								class="border-muted-foreground/5 flex items-center justify-between rounded-2xl border bg-background/50 p-4"
							>
								<div class="space-y-0.5">
									<p class="text-sm font-bold">Email Verification</p>
									<p class="text-muted-foreground text-xs">
										Require email confirmation for new users
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class={cn(
										'rounded-xl text-[10px] font-bold tracking-widest uppercase',
										emailVer?.value === 'true'
											? 'bg-primary/10 text-primary'
											: 'bg-accent/10 text-accent'
									)}
									onclick={() =>
										handleUpdateSystemSetting(
											'EMAIL_VERIFICATION',
											emailVer?.value === 'true' ? 'false' : 'true',
											'Require email confirmation for new users'
										)}
								>
									{emailVer?.value === 'true' ? 'Required' : 'Optional'}
								</Button>
							</div>

							{@const apiKeyAcc = systemSettings.find((s) => s.key === 'API_KEY_ACCESS')}
							<div
								class="border-muted-foreground/5 flex items-center justify-between rounded-2xl border bg-background/50 p-4"
							>
								<div class="space-y-0.5">
									<p class="text-sm font-bold">API Key Access</p>
									<p class="text-muted-foreground text-xs">
										Allow users to generate and use API keys
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class={cn(
										'rounded-xl text-[10px] font-bold tracking-widest uppercase',
										apiKeyAcc?.value === 'true'
											? 'bg-primary/10 text-primary'
											: 'bg-destructive/10 text-destructive'
									)}
									onclick={() =>
										handleUpdateSystemSetting(
											'API_KEY_ACCESS',
											apiKeyAcc?.value === 'true' ? 'false' : 'true',
											'Allow users to generate and use API keys'
										)}
								>
									{apiKeyAcc?.value === 'true' ? 'Enabled' : 'Disabled'}
								</Button>
							</div>

							{@const allowInstall = systemSettings.find(
								(s) => s.key === 'ALLOW_USER_INSTALL_PLUGINS'
							)}
							<div
								class="border-muted-foreground/5 flex items-center justify-between rounded-2xl border bg-background/50 p-4"
							>
								<div class="space-y-0.5">
									<p class="text-sm font-bold">Allow User Plugin Install</p>
									<p class="text-muted-foreground text-xs">
										Allow regular users to install external modules
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class={cn(
										'rounded-xl text-[10px] font-bold tracking-widest uppercase',
										allowInstall?.value === 'true'
											? 'bg-primary/10 text-primary'
											: 'bg-destructive/10 text-destructive'
									)}
									onclick={() =>
										handleUpdateSystemSetting(
											'ALLOW_USER_INSTALL_PLUGINS',
											allowInstall?.value === 'true' ? 'false' : 'true',
											'Allow regular users to install external modules'
										)}
								>
									{allowInstall?.value === 'true' ? 'Enabled' : 'Disabled'}
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</Tabs.Content>

			<!-- Logs Tab -->
			<Tabs.Content value="logs">
				<Card class="overflow-hidden border-none shadow-sm">
					<CardHeader class="flex flex-row items-center justify-between">
						<div>
							<CardTitle class="font-bold">Server Logs</CardTitle>
							<CardDescription class="font-medium tracking-wider uppercase"
								>Real-time system events and diagnostic information</CardDescription
							>
						</div>
						<div class="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								class="border-muted-foreground/20 rounded-xl text-xs font-bold"
								onclick={refreshLogs}
							>
								<RefreshCw class="mr-2 h-3.5 w-3.5" />
								Refresh
							</Button>
							<Button
								variant="outline"
								size="sm"
								class="border-muted-foreground/20 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10"
								onclick={handleClearLogs}
							>
								<Trash2 class="mr-2 h-3.5 w-3.5" />
								Clear Logs
							</Button>
						</div>
					</CardHeader>
					<CardContent class="p-0">
						<div class="max-h-[600px] overflow-y-auto">
							<Table.Root>
								<Table.Header class="sticky top-0 z-10 bg-muted/90 backdrop-blur-md">
									<Table.Row>
										<Table.Head class="w-[180px] text-[10px] font-black tracking-widest uppercase"
											>Timestamp</Table.Head
										>
										<Table.Head class="w-[100px] text-[10px] font-black tracking-widest uppercase"
											>Level</Table.Head
										>
										<Table.Head class="w-[150px] text-[10px] font-black tracking-widest uppercase"
											>Source</Table.Head
										>
										<Table.Head class="text-[10px] font-black tracking-widest uppercase"
											>Message</Table.Head
										>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each serverLogs as log}
										<Table.Row class="group transition-colors hover:bg-background/50">
											<Table.Cell class="text-muted-foreground font-mono text-[10px]">
												{formatDate(log.createdAt)}
											</Table.Cell>
											<Table.Cell>
												<Badge
													variant="outline"
													class={cn(
														'rounded-lg px-1.5 text-[9px] font-bold tracking-tighter uppercase',
														getLogLevelColor(log.level)
													)}
												>
													{log.level}
												</Badge>
											</Table.Cell>
											<Table.Cell
												class="text-muted-foreground text-[10px] font-black tracking-wider uppercase"
											>
												{log.source}
											</Table.Cell>
											<Table.Cell>
												<div class="flex flex-col gap-1">
													<span class="text-xs font-medium">{log.message}</span>
													{#if log.details}
														<pre
															class="border-muted-foreground/5 mt-1 hidden overflow-x-auto rounded-lg border bg-background/50 p-2 font-mono text-[10px] group-hover:block">{log.details}</pre>
													{/if}
												</div>
											</Table.Cell>
										</Table.Row>
									{:else}
										<Table.Row>
											<Table.Cell colspan={4} class="h-32 text-center">
												<div class="flex flex-col items-center justify-center space-y-2">
													<Terminal class="w-8 h-8 text-muted-foreground/50" />
													<p
														class="text-xs font-bold tracking-widest uppercase text-muted-foreground"
													>
														No logs available
													</p>
												</div>
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					</CardContent>
				</Card>
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

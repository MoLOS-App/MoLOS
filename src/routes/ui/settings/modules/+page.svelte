<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import {
		ArrowLeft,
		LayoutGrid,
		Settings2,
		Save,
		Download,
		FolderGit2,
		Box,
		TriangleAlert,
		RefreshCw,
		CircleCheck,
		CircleX,
		Trash2,
		ChevronUp,
		ChevronDown,
		Search,
		Info,
		GripVertical,
		ExternalLink,
		Undo2,
		ChevronRight
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Accordion from '$lib/components/ui/accordion';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { data } = $props();

	// We use a local state for modules to ensure reactivity without full page reload
	// svelte-ignore state_referenced_locally
	let localModules = $state([...data.modules]);

	// Initialize state from server data
	let moduleStates = $state(
		// svelte-ignore state_referenced_locally
		(localModules || []).reduce(
			(acc, mod) => {
				const savedMod = (data.savedStates || []).find(
					(s) => s.moduleId === mod.id && s.submoduleId === 'main'
				);
				acc[mod.id] = {
					enabled: savedMod ? savedMod.enabled : true,
					menuOrder: savedMod?.menuOrder ?? 0,
					submodules: (mod.navigation || []).reduce(
						(subAcc, sub) => {
							const savedSub = (data.savedStates || []).find(
								(s) => s.moduleId === mod.id && s.submoduleId === sub.name
							);
							subAcc[sub.name] = savedSub ? savedSub.enabled : !sub.disabled;
							return subAcc;
						},
						{} as Record<string, boolean>
					)
				};
				return acc;
			},
			{} as Record<
				string,
				{ enabled: boolean; menuOrder: number; submodules: Record<string, boolean> }
			>
		)
	);

	function toggleModule(moduleId: string) {
		if (moduleStates[moduleId]) {
			moduleStates[moduleId].enabled = !moduleStates[moduleId].enabled;
		}
	}

	function toggleSubmodule(moduleId: string, subName: string) {
		if (moduleStates[moduleId]?.submodules) {
			moduleStates[moduleId].submodules[subName] = !moduleStates[moduleId].submodules[subName];
		}
	}

	let isSaving = $state(false);
	let isInstalling = $state(false);
	let isDeleting = $state<string | null>(null);
	let activeTab = $state('builtin');
	let searchQuery = $state('');
	let isCancelling = $state<string | null>(null);

	let builtInModules = $derived(
		localModules
			.filter((m) => !m.isExternal || m.status === 'active')
			.filter(
				(m) =>
					m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					m.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
			.sort((a, b) => (moduleStates[a.id]?.menuOrder || 0) - (moduleStates[b.id]?.menuOrder || 0))
	);
	let externalModules = $derived(
		localModules
			.filter((m) => m.isExternal)
			.filter(
				(m) =>
					m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					m.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
	);
	let hasPendingModules = $derived(
		externalModules.some((m) => m.status === 'pending' || m.status === 'deleting')
	);

	function moveModule(moduleId: string, direction: 'up' | 'down') {
		const modules = [...builtInModules];
		const index = modules.findIndex((m) => m.id === moduleId);
		if (index === -1) return;

		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= modules.length) return;

		const otherModuleId = modules[newIndex].id;

		// Swap orders
		const tempOrder = moduleStates[moduleId].menuOrder;
		moduleStates[moduleId].menuOrder = moduleStates[otherModuleId].menuOrder;
		moduleStates[otherModuleId].menuOrder = tempOrder;

		// If they were the same, we need to re-index everything
		if (moduleStates[moduleId].menuOrder === moduleStates[otherModuleId].menuOrder) {
			modules.forEach((m, i) => {
				moduleStates[m.id].menuOrder = i;
			});
			// Re-run swap
			moveModule(moduleId, direction);
		}
	}

	// Drag and Drop logic
	let draggedId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function handleDragStart(e: DragEvent, id: string) {
		draggedId = id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', id);
		}
	}

	function handleDragOver(e: DragEvent, id: string) {
		e.preventDefault();
		if (draggedId === id) return;

		// Only update if it's a new target to prevent flickering
		if (dragOverId !== id) {
			dragOverId = id;
		}
	}

	function handleDragLeave(e: DragEvent, id: string) {
		// Only clear if we are actually leaving the target
		if (dragOverId === id) {
			dragOverId = null;
		}
	}

	function handleDrop(e: DragEvent, targetId: string) {
		e.preventDefault();
		const sourceId = draggedId || e.dataTransfer?.getData('text/plain');

		if (!sourceId || sourceId === targetId) {
			draggedId = null;
			dragOverId = null;
			return;
		}

		const modules = [...builtInModules];
		const fromIndex = modules.findIndex((m) => m.id === sourceId);
		const toIndex = modules.findIndex((m) => m.id === targetId);

		if (fromIndex !== -1 && toIndex !== -1) {
			const newModules = [...modules];
			const [movedItem] = newModules.splice(fromIndex, 1);
			newModules.splice(toIndex, 0, movedItem);

			newModules.forEach((m, i) => {
				moduleStates[m.id].menuOrder = i;
			});
			toast.success('Order updated');
		}

		draggedId = null;
		dragOverId = null;
	}

	function handleDragEnd() {
		draggedId = null;
		dragOverId = null;
	}
</script>

<Tooltip.Provider>
	<div class="min-h-screen pb-20 bg-background">
		<div class="max-w-4xl p-6 mx-auto space-y-8">
			<!-- Header -->
			<div class="pt-4 space-y-4">
				<Button
					variant="ghost"
					size="sm"
					onclick={() => goto('/ui/settings')}
					class="text-muted-foreground -ml-2 h-8 rounded-full px-3 text-[10px] font-bold tracking-widest uppercase hover:text-foreground"
				>
					<ArrowLeft class="w-3 h-3 mr-2" />
					Back to Settings
				</Button>
				<div class="space-y-1">
					<h1 class="text-3xl font-black tracking-tighter">Module Manager</h1>
					<p class="text-xs font-bold tracking-widest uppercase text-muted-foreground">
						Configure active functionalities
					</p>
				</div>
			</div>

			<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div class="flex p-1 w-fit rounded-xl bg-muted/20">
					<Button
						variant={activeTab === 'builtin' ? 'secondary' : 'ghost'}
						size="sm"
						class="rounded-lg text-[10px] font-bold tracking-wider uppercase {activeTab ===
						'builtin'
							? 'bg-background shadow-xs'
							: ''}"
						onclick={() => (activeTab = 'builtin')}
					>
						<Box class="mr-2 h-3.5 w-3.5" />
						Manage
						{#if builtInModules.length > 0}
							<Badge variant="secondary" class="ml-2 h-4 px-1.5 text-[9px]"
								>{builtInModules.length}</Badge
							>
						{/if}
					</Button>
					{#if data.user.role === 'admin' || data.allowUserInstallPlugins}
						<Button
							variant={activeTab === 'external' ? 'secondary' : 'ghost'}
							size="sm"
							class="rounded-lg text-[10px] font-bold tracking-wider uppercase {activeTab ===
							'external'
								? 'bg-background shadow-xs'
								: ''}"
							onclick={() => (activeTab = 'external')}
						>
							<FolderGit2 class="mr-2 h-3.5 w-3.5" />
							Install
							{#if externalModules.length > 0}
								<Badge variant="secondary" class="ml-2 h-4 px-1.5 text-[9px]"
									>{externalModules.length}</Badge
								>
							{/if}
						</Button>
					{/if}
				</div>

				<div class="relative w-full md:w-64">
					<Search
						class="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
					/>
					<Input
						placeholder="Search modules..."
						class="text-xs border-none shadow-xs h-9 rounded-xl bg-muted/10 pl-9 focus-visible:ring-1"
						bind:value={searchQuery}
						autocomplete="off"
						spellcheck="false"
					/>
				</div>
			</div>

			{#if hasPendingModules}
				<div
					class="flex items-center justify-between p-4 border rounded-lg border-accent/20 bg-accent/10 text-accent"
				>
					<div class="flex items-center gap-3">
						<RefreshCw class="w-5 h-5 animate-spin" />
						<div>
							<p class="font-medium">Restart Required</p>
							<p class="text-sm opacity-90">
								Changes to external modules detected. Restart the server to apply them.
							</p>
						</div>
					</div>
					<form method="POST" action="?/restart" use:enhance>
						<Button
							variant="outline"
							size="sm"
							type="submit"
							class="border-accent/30 hover:bg-accent/20"
						>
							Restart Server Now
						</Button>
					</form>
				</div>
			{/if}

			<div class="space-y-6">
				{#if activeTab === 'builtin'}
					<section>
						<Accordion.Root type="multiple" class="w-full space-y-4">
							{#each builtInModules as mod, i (mod.id)}
								<div
									draggable="true"
									role="listitem"
									ondragstart={(e) => handleDragStart(e, mod.id)}
									ondragover={(e) => handleDragOver(e, mod.id)}
									ondragleave={(e) => handleDragLeave(e, mod.id)}
									ondragend={handleDragEnd}
									ondrop={(e) => handleDrop(e, mod.id)}
									class="transition-all duration-200 {draggedId === mod.id
										? 'scale-[0.98] opacity-20 grayscale'
										: ''} {dragOverId === mod.id
										? 'rounded-2xl bg-primary/5 ring-2 ring-primary ring-offset-4'
										: ''}"
								>
									<Accordion.Item
										value={mod.id}
										class="px-0 overflow-hidden border-none shadow-sm rounded-2xl bg-muted/20"
									>
										<div class="flex items-center gap-4 px-4">
											<div class="flex items-center gap-1">
												<Tooltip.Root>
													<Tooltip.Trigger>
														<div
															class="text-muted-foreground/50 cursor-grab p-1.5 transition-colors hover:text-primary active:cursor-grabbing"
														>
															<GripVertical class="w-4 h-4" />
														</div>
													</Tooltip.Trigger>
													<Tooltip.Content
														side="left"
														class="text-[10px] font-bold tracking-widest uppercase"
														>Drag to reorder</Tooltip.Content
													>
												</Tooltip.Root>
												<div class="flex flex-col">
													<Button
														variant="ghost"
														size="icon"
														class="w-5 h-5 text-muted-foreground/40 hover:text-primary"
														disabled={i === 0}
														onclick={(e) => {
															e.stopPropagation();
															moveModule(mod.id, 'up');
														}}
													>
														<ChevronUp class="w-3 h-3" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														class="w-5 h-5 text-muted-foreground/40 hover:text-primary"
														disabled={i === builtInModules.length - 1}
														onclick={(e) => {
															e.stopPropagation();
															moveModule(mod.id, 'down');
														}}
													>
														<ChevronDown class="w-3 h-3" />
													</Button>
												</div>
											</div>

											<div class="flex items-center flex-1 gap-4 py-4">
												<div class="rounded-xl bg-background p-2.5 text-primary shadow-xs">
													{#if mod.icon}
														<mod.icon class="w-4 h-4" />
													{:else}
														<LayoutGrid class="w-4 h-4" />
													{/if}
												</div>
												<div class="min-w-0">
													<div class="flex items-center gap-2">
														<span class="text-sm font-bold truncate">{mod.name}</span>
														{#if !moduleStates[mod.id].enabled}
															<Badge
																variant="outline"
																class="h-4 bg-background/50 px-1.5 text-[8px] font-black tracking-widest uppercase"
																>Disabled</Badge
															>
														{/if}
													</div>
													<p
														class="text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase"
													>
														{mod.description || 'No description available.'}
													</p>
												</div>
											</div>

											<div class="flex items-center gap-3">
												<Tooltip.Root>
													<Tooltip.Trigger>
														<div class="flex items-center">
															<Switch
																checked={moduleStates[mod.id].enabled}
																onCheckedChange={() => toggleModule(mod.id)}
																class="scale-90"
															/>
														</div>
													</Tooltip.Trigger>
													<Tooltip.Content
														side="top"
														class="text-[10px] font-bold tracking-widest uppercase"
													>
														{moduleStates[mod.id].enabled ? 'Deactivate' : 'Activate'}
													</Tooltip.Content>
												</Tooltip.Root>
												<Accordion.Trigger
													class="p-2 transition-colors rounded-xl hover:bg-background/50 hover:no-underline"
												></Accordion.Trigger>
											</div>
										</div>

										<Accordion.Content class="px-4 pt-0 pb-4">
											<div class="pl-12 space-y-5">
												<Separator class="bg-muted-foreground/10" />
												{#if mod.navigation && mod.navigation.length > 0}
													<div class="space-y-3">
														<h4
															class="text-muted-foreground flex items-center gap-2 text-[10px] font-black tracking-widest uppercase"
														>
															<Settings2 class="w-3 h-3" />
															Submodules & Features
														</h4>
														<div class="grid gap-2 sm:grid-cols-2">
															{#each mod.navigation as sub}
																<div
																	class="flex items-center justify-between p-3 transition-colors border border-transparent rounded-xl bg-background/40 hover:border-primary/10"
																>
																	<Label
																		class="text-xs font-bold cursor-pointer"
																		for="{mod.id}-{sub.name}"
																	>
																		{sub.name}
																	</Label>
																	<Switch
																		id="{mod.id}-{sub.name}"
																		disabled={!moduleStates[mod.id].enabled}
																		checked={moduleStates[mod.id].submodules[sub.name]}
																		onCheckedChange={() => toggleSubmodule(mod.id, sub.name)}
																		class="scale-75"
																	/>
																</div>
															{/each}
														</div>
													</div>
												{:else}
													<p
														class="text-muted-foreground/50 text-[10px] font-bold tracking-widest uppercase italic"
													>
														No submodules available
													</p>
												{/if}

												<div class="flex items-center justify-between pt-2">
													<div
														class="text-muted-foreground/40 flex items-center gap-2 text-[9px] font-black tracking-tighter uppercase"
													>
														ID: {mod.id} • Order: {moduleStates[mod.id].menuOrder}
													</div>
													<Button
														variant="outline"
														size="sm"
														class="h-7 rounded-lg px-3 text-[10px] font-bold tracking-widest uppercase"
														href={mod.href}
													>
														<ExternalLink class="mr-1.5 h-3 w-3" />
														Open
													</Button>
												</div>
											</div>
										</Accordion.Content>
									</Accordion.Item>
								</div>
							{/each}
						</Accordion.Root>
					</section>
				{:else}
					<section class="space-y-6">
						<Card class="overflow-hidden border-none shadow-sm rounded-2xl">
							<CardHeader class="pb-3">
								<div class="flex items-center gap-3">
									<div class="p-2 shadow-xs rounded-xl bg-background text-primary">
										<Download class="w-4 h-4" />
									</div>
									<div>
										<CardTitle class="font-bold">Install New Module</CardTitle>
										<CardDescription class="font-medium tracking-wider uppercase">
											Clone a module from GitHub, GitLab, or Bitbucket
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<form
									method="POST"
									action="?/install"
									class="flex gap-3"
									use:enhance={() => {
										isInstalling = true;
										return async ({ result, update }) => {
											isInstalling = false;
											if (result.type === 'success') {
												const resData = (result as any).data;
												toast.success(resData?.message || 'Module installed successfully');
												await update({ reset: true });
												// Update local state
												localModules = [...data.modules];
											} else if (result.type === 'redirect') {
												window.location.href = result.location;
											} else {
												const resData = result.type === 'failure' ? (result as any).data : null;
												toast.error(resData?.message || 'Failed to install module');
											}
										};
									}}
								>
									<div class="relative flex-1">
										<FolderGit2
											class="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
										/>
										<Input
											name="repoUrl"
											placeholder="https://github.com/user/repo.git"
											class="text-xs border-none shadow-xs h-9 rounded-xl bg-background/50 pl-9 focus-visible:ring-1"
											required
											autocomplete="off"
											spellcheck="false"
										/>
									</div>
									<Button
										type="submit"
										disabled={isInstalling}
										class="px-6 text-xs font-bold h-9 rounded-xl"
									>
										{isInstalling ? 'Cloning...' : 'Install'}
									</Button>
								</form>
								<p
									class="text-muted-foreground/60 mt-3 flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase"
								>
									<Info class="w-3 h-3" />
									Server restart required after installation
								</p>
							</CardContent>
						</Card>

						{#if externalModules.length > 0}
							<div class="grid gap-4">
								{#each externalModules as mod}
									<Card
										class="overflow-hidden rounded-2xl border-none shadow-sm transition-all duration-200 {mod.status ===
											'pending' || mod.status === 'deleting'
											? 'opacity-50'
											: ''} {!moduleStates[mod.id].enabled
											? 'opacity-60 grayscale'
											: 'hover:scale-[1.01]'}"
									>
										<CardHeader class="flex flex-row items-center justify-between py-4 space-y-0">
											<div class="flex items-center gap-4">
												<div class="rounded-xl bg-background p-2.5 text-primary shadow-xs">
													<LayoutGrid class="w-4 h-4" />
												</div>
												<div class="space-y-0.5">
													<CardTitle class="flex items-center gap-2 font-bold">
														{mod.name}
														{#if mod.status === 'active'}
															<CircleCheck class="h-3.5 w-3.5 text-primary" />
														{:else if mod.status === 'pending'}
															<RefreshCw class="h-3.5 w-3.5 animate-spin text-accent" />
															<Badge
																variant="outline"
																class="h-4 border-accent/20 bg-accent/10 px-1.5 text-[8px] font-black tracking-widest text-accent uppercase"
																>Pending</Badge
															>
														{:else if mod.status === 'deleting'}
															<Trash2 class="h-3.5 w-3.5 text-destructive" />
															<Badge
																variant="destructive"
																class="h-4 border-destructive/20 bg-destructive/10 px-1.5 text-[8px] font-black tracking-widest text-destructive uppercase"
																>Deleting</Badge
															>
														{:else if mod.status === 'error'}
															<CircleX class="h-3.5 w-3.5 text-destructive" />
														{/if}
													</CardTitle>
													<CardDescription class="font-medium tracking-wider uppercase">
														{mod.description || 'External module.'}
														{#if mod.status === 'error' && mod.lastError}
															<div
																class="mt-2 flex items-start gap-2 rounded-lg border border-destructive/10 bg-destructive/5 p-2 text-[9px] text-destructive"
															>
																<TriangleAlert class="mt-0.5 h-3 w-3 shrink-0" />
																<span>{mod.lastError}</span>
															</div>
														{/if}
													</CardDescription>
												</div>
											</div>
											<div class="flex items-center gap-3">
												{#if mod.status !== 'deleting'}
													<form
														method="POST"
														action="?/delete"
														use:enhance={() => {
															isDeleting = mod.id;
															return async ({ result, update }) => {
																isDeleting = null;
																if (result.type === 'success') {
																	toast.success('Module marked for deletion');
																	await update();
																	localModules = [...data.modules];
																} else if (result.type === 'redirect') {
																	window.location.href = result.location;
																} else {
																	toast.error('Failed to delete module');
																}
															};
														}}
													>
														<input type="hidden" name="moduleId" value={mod.id} />
														<Button
															variant="ghost"
															size="icon"
															type="submit"
															class="w-8 h-8 rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
															disabled={isDeleting === mod.id}
														>
															<Trash2
																class="h-4 w-4 {isDeleting === mod.id ? 'animate-pulse' : ''}"
															/>
														</Button>
													</form>
												{:else}
													<form
														method="POST"
														action="?/cancel"
														use:enhance={() => {
															isCancelling = mod.id;
															return async ({ result, update }) => {
																isCancelling = null;
																if (result.type === 'success') {
																	toast.success('Action cancelled');
																	await update();
																	localModules = [...data.modules];
																} else {
																	toast.error('Failed to cancel action');
																}
															};
														}}
													>
														<input type="hidden" name="moduleId" value={mod.id} />
														<Tooltip.Root>
															<Tooltip.Trigger>
																<Button
																	variant="ghost"
																	size="icon"
																	type="submit"
																	class="w-8 h-8 rounded-lg text-muted-foreground/40 hover:bg-primary/10 hover:text-primary"
																	disabled={isCancelling === mod.id}
																>
																	<Undo2
																		class="h-4 w-4 {isCancelling === mod.id ? 'animate-spin' : ''}"
																	/>
																</Button>
															</Tooltip.Trigger>
															<Tooltip.Content
																class="text-[10px] font-bold tracking-widest uppercase"
																>Cancel action</Tooltip.Content
															>
														</Tooltip.Root>
													</form>
												{/if}
												<Switch
													checked={moduleStates[mod.id].enabled}
													onCheckedChange={() => toggleModule(mod.id)}
													class="scale-90"
												/>
											</div>
										</CardHeader>
									</Card>
								{/each}
							</div>
						{:else}
							<div
								class="flex flex-col items-center justify-center p-12 border-2 border-dashed text-muted-foreground rounded-xl border-muted"
							>
								<FolderGit2 class="w-12 h-12 mb-4 opacity-20" />
								<p class="text-lg font-medium">No external modules installed</p>
								<p class="text-sm">Install a module from a git repository to extend MoLOS.</p>
							</div>
						{/if}
					</section>
				{/if}
			</div>
		</div>

		<div
			class="fixed bottom-0 left-0 right-0 z-50 w-full border-t shadow-2xl border-muted-foreground/5 bg-background/80 backdrop-blur-md"
		>
			<div class="flex items-center justify-between max-w-4xl gap-3 px-6 py-4 mx-auto">
				<div class="flex items-center gap-4">
					<div class="hidden h-6 border-l border-muted-foreground/10 md:block"></div>
					<p
						class="text-muted-foreground/60 hidden text-[10px] font-bold tracking-widest uppercase md:block"
					>
						<Info class="mr-1.5 mb-0.5 inline-block h-3.5 w-3.5" />
						If you have made changes -->
					</p>
				</div>
				<form
					method="POST"
					action="?/save"
					use:enhance={() => {
						isSaving = true;
						return async ({ result }) => {
							isSaving = false;
							if (result.type === 'success') {
								toast.success('Configuration saved');
							} else {
								toast.error('Failed to save');
							}
						};
					}}
				>
					<input type="hidden" name="states" value={JSON.stringify(moduleStates)} />
					<Button
						size="sm"
						type="submit"
						disabled={isSaving}
						class="h-9 min-w-[160px] rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg shadow-primary/20"
					>
						{#if isSaving}
							<RefreshCw class="mr-2 h-3.5 w-3.5 animate-spin" />
							Saving...
						{:else}
							<Save class="mr-2 h-3.5 w-3.5" />
							Save Changes
						{/if}
					</Button>
				</form>
			</div>
		</div>
	</div>
</Tooltip.Provider>

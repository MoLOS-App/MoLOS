<script lang="ts">
	import { ArrowLeft } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import * as Accordion from '$lib/components/ui/accordion';
	import {
		ModuleManagerHeader,
		ModuleManagerFooter,
		ExternalModuleCard,
		BuiltinModuleCard,
		InstallModuleForm,
		GitRefDialog,
		type ModuleData,
		type ModuleState
	} from '$lib/components/modules';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	// Local state - use derived to auto-update when data.modules changes
	let localModules = $derived.by(() => [...data.modules]);
	let moduleStates = $state(
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
			{} as Record<string, ModuleState>
		)
	);

	// UI state
	let activeTab = $state<'builtin' | 'external'>('builtin');
	let searchQuery = $state('');
	let isSaving = $state(false);
	let isInstalling = $state(false);

	// Loading states for external modules
	let loadingStates = $state<
		Record<
			string,
			{ forcePull?: boolean; deleting?: boolean; cancelling?: boolean; togglingBlock?: boolean }
		>
	>({});

	// Git ref dialog state
	let showGitRefDialog = $state(false);
	let gitRefDialogModule = $state<{ id: string; name: string; currentRef: string } | null>(null);
	let newGitRefInput = $state('');

	// Derived values
	let builtInModules = $derived(
		localModules
			.filter((m) => !m.isExternal || m.status === 'active')
			.filter(
				(m) =>
					m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					m.description?.toLowerCase().includes(searchQuery.toLowerCase())
			)
			.map((m) => ({
				...m,
				description: m.description ?? '',
				lastError: m.lastError ?? undefined
			}))
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
			.map((m) => ({
				...m,
				description: m.description ?? '',
				lastError: m.lastError ?? undefined
			}))
	);

	let hasPendingModules = $derived(
		externalModules.some((m) => m.status === 'pending' || m.status === 'deleting')
	);

	// Handlers
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

	function openGitRefDialog(moduleId: string, moduleName: string, currentRef: string) {
		gitRefDialogModule = { id: moduleId, name: moduleName, currentRef };
		newGitRefInput = currentRef;
		showGitRefDialog = true;
	}

	function closeGitRefDialog() {
		showGitRefDialog = false;
		gitRefDialogModule = null;
		newGitRefInput = '';
	}

	async function submitGitRefUpdate() {
		if (!gitRefDialogModule || !newGitRefInput.trim()) {
			toast.error('Please enter a valid git ref');
			return;
		}

		const moduleId = gitRefDialogModule.id;
		loadingStates[moduleId] = { ...loadingStates[moduleId], forcePull: true };
		closeGitRefDialog();

		try {
			const formData = new FormData();
			formData.append('moduleId', moduleId);
			formData.append('gitRef', newGitRefInput.trim());

			const response = await fetch('?/updateGitRef', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success(result.data?.message || 'Git ref updated successfully');
				const module = localModules.find((m) => m.id === moduleId);
				if (module) {
					module.gitRef = newGitRefInput.trim();
				}
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Failed to update git ref');
			}
		} catch (error) {
			console.error('Failed to update git ref:', error);
			toast.error('Failed to update git ref');
		} finally {
			loadingStates[moduleId] = { ...loadingStates[moduleId], forcePull: false };
		}
	}

	async function forcePullModule(moduleId: string) {
		loadingStates[moduleId] = { ...loadingStates[moduleId], forcePull: true };

		try {
			const formData = new FormData();
			formData.append('moduleId', moduleId);

			const response = await fetch('?/forcePull', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				toast.success(result.data?.message || 'Module updated successfully');
				const module = localModules.find((m) => m.id === moduleId);
				if (module) {
					module.status = 'pending';
				}
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Failed to pull latest changes');
			}
		} catch (error) {
			console.error('Failed to force pull:', error);
			toast.error('Failed to pull latest changes');
		} finally {
			loadingStates[moduleId] = { ...loadingStates[moduleId], forcePull: false };
		}
	}
</script>

<Tooltip.Provider>
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
				<div class="space-y-1">
					<h1 class="text-3xl font-black tracking-tighter">Module Manager</h1>
					<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
						Configure active functionalities
					</p>
				</div>
			</div>

			<!-- Tabs and Search -->
			<ModuleManagerHeader
				{activeTab}
				builtInCount={builtInModules.length}
				externalCount={externalModules.length}
				allowUserInstallPlugins={data.allowUserInstallPlugins}
				{searchQuery}
				onTabChange={(tab) => (activeTab = tab)}
				onSearchChange={(q) => (searchQuery = q)}
			/>

			{#if hasPendingModules}
				<div class="flex items-center justify-between rounded-lg border bg-accent p-4">
					<div class="flex items-center gap-3">
						<span class="text-muted-foreground">⚠️</span>
						<div>
							<p class="font-medium">Restart Required</p>
							<p class="text-sm opacity-90">
								Changes to external modules detected. Restart the server to apply them.
							</p>
						</div>
					</div>
					<form method="POST" action="?/restart">
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
								{@const isFirst = i === 0}
								{@const isLast = i === builtInModules.length - 1}
								<BuiltinModuleCard
									module={mod}
									moduleState={moduleStates[mod.id]}
									index={i}
									{isFirst}
									{isLast}
									onToggle={toggleModule}
									onToggleSubmodule={toggleSubmodule}
									onMove={moveModule}
								/>
							{/each}
						</Accordion.Root>
					</section>
				{:else}
					<section class="space-y-6">
						<InstallModuleForm {isInstalling} />

						{#if externalModules.length > 0}
							<div class="grid gap-4">
								{#each externalModules as mod}
									<ExternalModuleCard
										module={mod}
										enabled={moduleStates[mod.id].enabled}
										isLoading={loadingStates[mod.id]}
										onToggleEnabled={toggleModule}
										onForcePull={forcePullModule}
										onChangeGitRef={openGitRefDialog}
									/>
								{/each}
							</div>
						{:else}
							<div
								class="text-muted-foreground flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted p-12"
							>
								<span class="mb-4 text-4xl opacity-20">📦</span>
								<p class="text-lg font-medium">No external modules installed</p>
								<p class="text-sm">Install a module from a git repository to extend MoLOS.</p>
							</div>
						{/if}
					</section>
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<ModuleManagerFooter {moduleStates} {isSaving} />
	</div>

	<!-- Git Ref Dialog -->
	<GitRefDialog
		open={showGitRefDialog}
		module={gitRefDialogModule}
		newRef={newGitRefInput}
		onClose={closeGitRefDialog}
		onSubmit={submitGitRefUpdate}
	/>
</Tooltip.Provider>

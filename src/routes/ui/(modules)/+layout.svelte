<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Settings,
		LogOut,
		RefreshCw,
		Bot,
		LayoutGrid,
		Home,
		Compass,
		Sparkles,
		Bell
	} from 'lucide-svelte';
	import { authClient } from '$lib/auth-client';
	import { getAllModules } from '$lib/config';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import ChatSidepanel from '$lib/components/ai/chat-sidepanel.svelte';
	import AppNavDrawer from '$lib/components/navigation/AppNavDrawer.svelte';
	import SubmenuSection from '$lib/components/navigation/SubmenuSection.svelte';
	import { groupSubmenuItems, getActiveSubmenuItem } from '$lib/navigation/submenu';

	let { children, data } = $props();

	let path = $derived($page.url.pathname);
	let session = authClient.useSession();

	const allModules = getAllModules();

	// Filter modules based on activation state
	let modules = $derived(
		allModules
			.filter((m) => {
				const state = data.moduleStates?.find(
					(s) => s.moduleId === m.id && s.submoduleId === 'main'
				);

				// Check if it's an external module based on the registry or the database
				const isExternal = m.isExternal || data.allExternalIds?.includes(m.id);
				const isBuiltin = !isExternal;

				// If it's an external module, we only show it if it's successfully initialized (active)
				const isActiveExternal = isExternal && data.activeExternalIds?.includes(m.id);

				// A module is visible if:
				// 1. It's builtin OR it's an active external module
				// 2. AND it's enabled in the user settings (defaults to true)
				const isEnabled = state ? state.enabled : true;

				return (isBuiltin || isActiveExternal) && isEnabled;
			})
			.sort((a, b) => {
				const stateA = data.moduleStates?.find(
					(s) => s.moduleId === a.id && s.submoduleId === 'main'
				);
				const stateB = data.moduleStates?.find(
					(s) => s.moduleId === b.id && s.submoduleId === 'main'
				);
				return (stateA?.menuOrder || 0) - (stateB?.menuOrder || 0);
			})
	);

	let currentModule = $derived(modules.find((m) => path.startsWith(m.href)));

	// Filter navigation items based on activation state
	let filteredNavigation = $derived(
		currentModule?.navigation.filter((n) => {
			const state = data.moduleStates?.find(
				(s) => s.moduleId === currentModule.id && s.submoduleId === n.name
			);
			return state ? state.enabled : true;
		}) || []
	);
	let submenuSections = $derived(groupSubmenuItems(filteredNavigation));
	let activeSubmenuItem = $derived(getActiveSubmenuItem(filteredNavigation, path));
	let hasSubmenu = $derived(filteredNavigation.length > 0);
	let isRestarting = $state(false);
	let isAiOpen = $state(false);
	let isMobileViewport = $state(false);

	onMount(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)');
		const updateViewport = () => {
			isMobileViewport = mediaQuery.matches;
		};
		updateViewport();
		mediaQuery.addEventListener('change', updateViewport);
		return () => {
			mediaQuery.removeEventListener('change', updateViewport);
		};
	});
</script>

<div class="flex h-screen w-screen bg-background text-foreground">
	<Tooltip.Provider>
		<!-- Left Sidebar: Module Access & User Settings -->
		<aside
			class="fixed top-0 bottom-0 left-0 z-50 hidden w-20 flex-col items-center border-r border-border/60 bg-background/90 py-6 backdrop-blur md:flex"
		>
			<!-- Module Icons -->
			<div class="mb-auto flex flex-col gap-4">
				{#each modules as module}
					<Tooltip.Root>
						<Tooltip.Trigger
							type="button"
							aria-label={module.name}
							aria-current={path.startsWith(module.href) ? 'page' : undefined}
							class={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none ${
								path.startsWith(module.href)
									? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
									: 'text-muted-foreground hover:text-accent-foreground hover:bg-accent/10 hover:ring-1 hover:ring-accent/10'
							}`}
							onclick={() => goto(module.href)}
						>
							{#if module.icon}
								<module.icon
									class="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
								/>
							{:else}
								<LayoutGrid
									class="h-6 w-6 transition-transform duration-200 group-hover:scale-110"
								/>
							{/if}
						</Tooltip.Trigger>
						<Tooltip.Content side="right" class="ml-2">
							{module.name}
						</Tooltip.Content>
					</Tooltip.Root>
				{/each}
			</div>

			<!-- Settings & User at Bottom -->
			<div class="mt-auto flex flex-col gap-3">
				<!-- Settings -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="icon"
							class="text-muted-foreground h-10 w-10 hover:bg-muted"
							onclick={() => goto('/ui/settings')}
						>
							<Settings class="h-5 w-5" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Settings</Tooltip.Content>
				</Tooltip.Root>

				<!-- Logout -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="icon"
							class="text-muted-foreground h-10 w-10 hover:bg-muted"
							onclick={async () => {
								await authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											goto('/ui/login');
										}
									}
								});
							}}
						>
							<LogOut class="h-5 w-5" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Logout</Tooltip.Content>
				</Tooltip.Root>

				<!-- AI Assistant -->
				{#if !isAiOpen}
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button
								variant="ghost"
								size="icon"
								class="text-muted-foreground h-10 w-10 hover:bg-muted"
								aria-label="AI Assistant"
								onclick={() => (isAiOpen = !isAiOpen)}
							>
								<Bot class="h-5 w-5" />
							</Button>
						</Tooltip.Trigger>
						<Tooltip.Content side="right">AI Assistant</Tooltip.Content>
					</Tooltip.Root>
				{/if}
			</div>
		</aside>

		<!-- Main Content Area -->
		<div class="flex min-w-0 flex-1 flex-col md:ml-20">
			<!-- Mobile Bottom Navigation -->
			<div class="fixed inset-x-0 bottom-0 z-40 md:hidden">
				<div class="mx-auto w-[min(100%-1.5rem,28rem)] pb-4">
					<nav
						aria-label="Primary"
						class="flex items-center justify-between gap-1 rounded-full border border-border/60 bg-background/95 px-3 py-2 shadow-xl backdrop-blur"
					>
						<button
							type="button"
							aria-label="Home"
							aria-current={path.startsWith('/ui/dashboard') ? 'page' : undefined}
							onclick={() => goto('/ui/dashboard')}
							class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${path.startsWith('/ui/dashboard') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
						>
							<Home class="h-5 w-5" />
						</button>

						<AppNavDrawer
							{modules}
							{currentModule}
							sections={submenuSections}
							currentPath={path}
							triggerLabel="Open sections"
							triggerClass={`flex min-w-0 w-full h-auto flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors border-transparent bg-transparent shadow-none ${hasSubmenu ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/60'}`}
						>
							<svelte:fragment slot="trigger">
								<Compass class="h-5 w-5" />
							</svelte:fragment>
							<svelte:fragment slot="footer" let:close>
								<div class="mt-6 border-t border-border/60 pt-4">
									<div class="grid grid-cols-2 gap-2">
										<button
											type="button"
											aria-label="Settings"
											onclick={() => {
												close();
												goto('/ui/settings');
											}}
											class="text-muted-foreground flex h-11 items-center justify-center gap-2 rounded-xl border border-border/60 text-sm font-medium transition-colors hover:text-foreground"
										>
											<Settings class="h-4 w-4" />
											<span>Settings</span>
										</button>
										<button
											type="button"
											aria-label="Logout"
											onclick={async () => {
												close();
												await authClient.signOut({
													fetchOptions: {
														onSuccess: () => {
															goto('/ui/login');
														}
													}
												});
											}}
											class="text-muted-foreground flex h-11 items-center justify-center gap-2 rounded-xl border border-border/60 text-sm font-medium transition-colors hover:text-foreground"
										>
											<LogOut class="h-4 w-4" />
											<span>Logout</span>
										</button>
									</div>
									{#if !isAiOpen}
										<button
											type="button"
											aria-label="AI Assistant"
											onclick={() => {
												close();
												isAiOpen = !isAiOpen;
											}}
											class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors"
										>
											<Bot class="h-4 w-4" />
											<span>AI Assistant</span>
										</button>
									{/if}
								</div>
							</svelte:fragment>
						</AppNavDrawer>

						<button
							type="button"
							aria-label="AI"
							aria-current={path.startsWith('/ui/ai') ? 'page' : undefined}
							onclick={() => goto('/ui/ai')}
							class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${path.startsWith('/ui/ai') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
						>
							<Sparkles class="h-5 w-5" />
						</button>

						<button
							type="button"
							aria-label="Notifications"
							onclick={() => goto('/ui/dashboard#notifications')}
							class="text-muted-foreground flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors hover:text-foreground"
						>
							<Bell class="h-5 w-5" />
						</button>

						<button
							type="button"
							aria-label="Settings"
							aria-current={path.startsWith('/ui/settings') ? 'page' : undefined}
							onclick={() => goto('/ui/settings')}
							class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${path.startsWith('/ui/settings') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
						>
							<Settings class="h-5 w-5" />
						</button>
					</nav>
				</div>
			</div>

			<!-- Content -->
			<div class="flex min-w-0 flex-1 overflow-hidden">
				{#if hasSubmenu && !isMobileViewport}
					<div class="flex min-w-0 flex-1">
						<aside class="w-64 shrink-0 border-r border-border/60 px-5 py-6 lg:w-72">
							<nav aria-label="Submenu sections" class="flex flex-col gap-6">
								{#each submenuSections as section}
									<SubmenuSection title={section.label} items={section.items} currentPath={path} />
								{/each}
								{#if submenuSections.length === 0}
									<div
										class="text-muted-foreground rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm"
									>
										No sections yet.
									</div>
								{/if}
							</nav>
						</aside>
						<div class="flex min-w-0 flex-1 justify-center overflow-y-auto">
							<div class="min-h-full w-full max-w-6xl px-4 pt-6 pb-12 sm:px-6 md:pb-10 lg:px-8">
								{@render children()}
							</div>
						</div>
					</div>
				{:else}
					<div class="flex w-full justify-center overflow-y-auto">
						<div
							class="min-h-full w-full max-w-6xl overflow-y-auto bg-transparent px-4 pt-6 pb-16 sm:px-6 md:pb-10 lg:px-8"
						>
							{@render children()}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</Tooltip.Provider>

	<ChatSidepanel bind:isOpen={isAiOpen} />

	{#if data.hasPendingRestart}
		<div class="fixed right-6 bottom-6 z-[200]">
			<form
				method="POST"
				action="/ui/settings/modules?/restart"
				use:enhance={() => {
					isRestarting = true;
					return async ({ result }) => {
						if (result.type === 'success') {
							toast.success('Server restart initiated...');
							setTimeout(() => window.location.reload(), 2000);
						} else {
							isRestarting = false;
							toast.error('Failed to restart server');
						}
					};
				}}
			>
				<Button
					type="submit"
					size="lg"
					class="h-14 animate-bounce rounded-full border-none bg-primary px-6 text-primary-foreground shadow-2xl hover:animate-none hover:bg-accent/90"
					disabled={isRestarting}
				>
					<RefreshCw class="mr-2 h-5 w-5 {isRestarting ? 'animate-spin' : ''}" />
					{isRestarting ? 'Restarting...' : 'Restart Required'}
				</Button>
			</form>
		</div>
	{/if}
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&display=swap');
	:global(body) {
		font-family:
			'Raleway',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
	}
</style>

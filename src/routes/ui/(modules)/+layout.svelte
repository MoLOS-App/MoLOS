<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { animate } from 'animejs';
	import {
		Settings,
		LogOut,
		RefreshCw,
		Pin,
		Bot,
		LayoutGrid,
		Home,
		Compass,
		Sparkles
	} from 'lucide-svelte';
	import { authClient } from '$lib/auth-client';
	import { getAllModules } from '$lib/config';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import ChatSidepanel from '$lib/components/ai/chat-sidepanel.svelte';
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
	let mobileMenuRailOpen = $state(false);
	let mobileSubmenuRailOpen = $state(false);
	let mobileRailVisible = $state(false);
	let mobileRailMode = $state<'menu' | 'submenu' | null>(null);
	let mobileRailEl: HTMLDivElement | null = $state(null);
	let mobileRailContentEl: HTMLDivElement | null = $state(null);
	let mobileRailHeight = $state(0);
	let isRestarting = $state(false);
	let isAiOpen = $state(false);
	let isMobileViewport = $state(false);
	let isSubmenuCompact = $state(false);
	let CurrentModuleIcon = $derived(currentModule?.icon || LayoutGrid);
	let CurrentSubmenuIcon = $derived(activeSubmenuItem?.icon || Compass);

	const submenuCompactStorageKey = 'molos:submenu-compact';

	const persistSubmenuCompact = (value: boolean) => {
		try {
			localStorage.setItem(submenuCompactStorageKey, value ? '1' : '0');
		} catch {
			// Ignore storage failures (private mode, disabled storage).
		}
	};

	onMount(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)');
		const updateViewport = () => {
			isMobileViewport = mediaQuery.matches;
			if (!mediaQuery.matches) {
				mobileMenuRailOpen = false;
				mobileSubmenuRailOpen = false;
				mobileRailVisible = false;
				mobileRailMode = null;
			}
		};
		updateViewport();
		mediaQuery.addEventListener('change', updateViewport);

		try {
			isSubmenuCompact = localStorage.getItem(submenuCompactStorageKey) === '1';
		} catch {
			isSubmenuCompact = false;
		}
		return () => {
			mediaQuery.removeEventListener('change', updateViewport);
		};
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!isMobileViewport) return;
		const shouldOpen = mobileMenuRailOpen || mobileSubmenuRailOpen;
		if (shouldOpen) {
			const nextMode = mobileMenuRailOpen ? 'menu' : 'submenu';
			const modeChanged = mobileRailMode && mobileRailMode !== nextMode;
			mobileRailMode = nextMode;
			const shouldAnimateOpen = !mobileRailVisible || mobileRailHeight === 0;
			if (shouldAnimateOpen) {
				mobileRailVisible = true;
				tick().then(() => {
					if (!mobileRailEl || !mobileRailContentEl) return;
					const targetHeight = mobileRailContentEl.scrollHeight;
					mobileRailHeight = 0;
					mobileRailEl.style.opacity = '0';
					mobileRailEl.style.transform = 'translateY(6px)';
					animate(mobileRailEl, {
						opacity: { to: 1 },
						translateY: { to: 0 },
						duration: 220,
						ease: 'outQuad'
					});
					const heightAnim = { value: 0 };
					animate(heightAnim, {
						value: { to: targetHeight },
						duration: 220,
						ease: 'outQuad',
						onUpdate: () => {
							mobileRailHeight = heightAnim.value;
						}
					});
				});
			} else if (modeChanged) {
				tick().then(() => {
					if (!mobileRailEl || !mobileRailContentEl) return;
					const targetHeight = mobileRailContentEl.scrollHeight;
					animate(mobileRailEl, {
						opacity: { to: 1 },
						duration: 160,
						ease: 'outQuad'
					});
					const heightAnim = { value: mobileRailHeight };
					animate(heightAnim, {
						value: { to: targetHeight },
						duration: 160,
						ease: 'outQuad',
						onUpdate: () => {
							mobileRailHeight = heightAnim.value;
						}
					});
				});
			}
		} else if (mobileRailVisible && mobileRailEl) {
			const el = mobileRailEl;
			animate(el, {
				opacity: { to: 0 },
				translateY: { to: 6 },
				duration: 120,
				ease: 'inQuad',
				onComplete: () => {
					mobileRailVisible = false;
					mobileRailMode = null;
				}
			});
			const heightAnim = { value: mobileRailHeight };
			animate(heightAnim, {
				value: { to: 0 },
				duration: 120,
				ease: 'inQuad',
				onUpdate: () => {
					mobileRailHeight = heightAnim.value;
				}
			});
		} else {
			mobileRailVisible = false;
			mobileRailMode = null;
		}
	});
</script>

<div class="flex h-screen w-screen bg-background text-foreground">
	<Tooltip.Provider>
		<!-- Left Sidebar: Module Access & User Settings -->
		{#if !hasSubmenu || isMobileViewport}
			<aside
				class="fixed top-4 bottom-4 left-4 z-50 hidden w-16 flex-col items-center rounded-3xl border border-border/60 bg-background/95 py-5 shadow-sm backdrop-blur md:flex"
			>
				<!-- Module Icons -->
				<div class="mb-auto flex flex-col gap-3">
					{#each modules as module}
						<Tooltip.Root>
							<Tooltip.Trigger
								type="button"
								aria-label={module.name}
								aria-current={path.startsWith(module.href) ? 'page' : undefined}
								class={`group flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none ${
									path.startsWith(module.href)
										? 'bg-muted/60 text-foreground shadow-sm ring-1 ring-border/60'
										: 'text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:ring-1 hover:ring-border/40'
								}`}
								onclick={() => goto(module.href)}
							>
								{#if module.icon}
									<module.icon
										class="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
									/>
								{:else}
									<LayoutGrid
										class="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
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
				<div class="mt-auto flex flex-col gap-2">
					<!-- Settings -->
					<Tooltip.Root>
						<Tooltip.Trigger>
							<Button
								variant="ghost"
								size="icon"
								class="text-muted-foreground h-10 w-10 rounded-2xl hover:bg-muted/40"
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
								class="text-muted-foreground h-10 w-10 rounded-2xl hover:bg-muted/40"
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
									class="text-muted-foreground h-10 w-10 rounded-2xl hover:bg-muted/40"
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
		{/if}

		<!-- Main Content Area -->
		<div
			class={`flex min-w-0 flex-1 flex-col ${
				hasSubmenu && !isMobileViewport ? 'md:ml-4' : 'md:ml-20'
			}`}
		>
			<!-- Mobile Bottom Navigation -->
			<div class="fixed inset-x-0 bottom-0 z-40 md:hidden">
				<div class="mx-auto w-[min(100%-1.5rem,28rem)] pb-4">
					<div class="rounded-3xl border border-border/60 bg-background/95 shadow-xl backdrop-blur">
						<div
							bind:this={mobileRailEl}
							class={`overflow-hidden transition-colors ${mobileRailVisible ? 'border-b border-border/60' : ''}`}
							style={`height: ${mobileRailHeight}px;`}
						>
							<div bind:this={mobileRailContentEl} class="px-3 py-2">
								{#if mobileRailMode === 'menu'}
									<nav
										aria-label="Modules"
										class="flex items-center gap-2 overflow-x-auto px-1 py-1"
									>
										{#each modules as module}
											{@const isActive = path.startsWith(module.href)}
											<button
												type="button"
												aria-label={module.name}
												aria-current={isActive ? 'page' : undefined}
												class={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition-all ${
													isActive
														? 'bg-muted/70 text-foreground shadow-sm ring-1 ring-border/60'
														: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
												}`}
												onclick={() => {
													goto(module.href);
													mobileMenuRailOpen = false;
												}}
											>
												{#if module.icon}
													<module.icon class="h-4 w-4 text-primary/70" />
												{:else}
													<LayoutGrid class="h-4 w-4 text-primary/70" />
												{/if}
												<span class="whitespace-nowrap">{module.name}</span>
											</button>
										{/each}
									</nav>
								{:else if mobileRailMode === 'submenu'}
									<nav
										aria-label="Submenu"
										class="flex items-center gap-2 overflow-x-auto px-1 py-1"
									>
										{#each filteredNavigation as item}
											{@const isActive = item.href && path === item.href}
											{#if item.href && !item.disabled}
												<a
													href={item.href}
													aria-current={isActive ? 'page' : undefined}
													class={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition-all ${
														isActive
															? 'bg-muted/70 text-foreground shadow-sm ring-1 ring-border/60'
															: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
													}`}
													onclick={() => (mobileSubmenuRailOpen = false)}
												>
													<item.icon class="h-4 w-4 text-primary/70" />
													<span class="whitespace-nowrap">{item.name}</span>
												</a>
											{/if}
										{/each}
										{#if filteredNavigation.length === 0}
											<span class="text-muted-foreground px-2 py-1 text-xs font-semibold">
												No sections available
											</span>
										{/if}
									</nav>
								{/if}
							</div>
						</div>

						<nav
							aria-label="Primary"
							class="flex items-center justify-between gap-1 rounded-b-3xl px-3 py-2"
						>
							<button
								type="button"
								aria-label="Menu"
								aria-current={currentModule?.href && path.startsWith(currentModule.href)
									? 'page'
									: undefined}
								onclick={() => {
									const nextOpen = !mobileMenuRailOpen;
									mobileMenuRailOpen = nextOpen;
									mobileSubmenuRailOpen = false;
									if (nextOpen) {
										mobileRailMode = 'menu';
										mobileRailVisible = true;
									}
								}}
								class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${
									mobileMenuRailOpen
										? 'bg-muted/70 text-foreground'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<CurrentModuleIcon class="h-5 w-5 text-primary/70" />
							</button>

							<button
								type="button"
								aria-label="Submenu"
								aria-current={activeSubmenuItem?.href ? 'page' : undefined}
								onclick={() => {
									const nextOpen = !mobileSubmenuRailOpen;
									mobileSubmenuRailOpen = nextOpen;
									mobileMenuRailOpen = false;
									if (nextOpen) {
										mobileRailMode = 'submenu';
										mobileRailVisible = true;
									}
								}}
								class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${
									mobileSubmenuRailOpen
										? 'bg-muted/70 text-foreground'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<CurrentSubmenuIcon class="h-5 w-5 text-primary/70" />
							</button>

							<button
								type="button"
								aria-label="Dashboard"
								aria-current={path.startsWith('/ui/dashboard') ? 'page' : undefined}
								onclick={() => goto('/ui/dashboard')}
								class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${
									path.startsWith('/ui/dashboard')
										? 'bg-primary/10 text-primary/70'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<Home class="h-5 w-5 text-primary" />
							</button>

							<button
								type="button"
								aria-label="AI"
								aria-current={path.startsWith('/ui/ai') ? 'page' : undefined}
								onclick={() => goto('/ui/ai')}
								class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${
									path.startsWith('/ui/ai')
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<Sparkles class="h-5 w-5 text-primary/70" />
							</button>

							<button
								type="button"
								aria-label="Settings"
								aria-current={path.startsWith('/ui/settings') ? 'page' : undefined}
								onclick={() => goto('/ui/settings')}
								class={`flex min-w-0 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold transition-colors ${
									path.startsWith('/ui/settings')
										? 'bg-primary/10 text-primary'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<Settings class="h-5 w-5 text-primary/70" />
							</button>
						</nav>
					</div>
				</div>
			</div>

			<!-- Content -->
			<div class="flex min-w-0 flex-1 overflow-hidden">
				{#if hasSubmenu && !isMobileViewport}
					<div class="flex min-w-0 flex-1 gap-0">
						<div
							class="hover:shadow-mds my-4 flex shrink-0 rounded-3xl border border-border/60 bg-background/95 shadow-sm transition-shadow duration-300 ease-out"
						>
							<div class="w-14 border-r border-border/60 px-2 py-4">
								<div class="flex h-full flex-col items-center gap-3">
									{#each modules as module}
										{@const isActive = path.startsWith(module.href)}
										<Tooltip.Root>
											<Tooltip.Trigger
												type="button"
												aria-label={module.name}
												aria-current={isActive ? 'page' : undefined}
												class={`group flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none ${
													isActive
														? 'bg-muted/60 text-foreground shadow-sm ring-1 ring-border/60'
														: 'text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:ring-1 hover:ring-border/40'
												}`}
												onclick={() => goto(module.href)}
											>
												{#if module.icon}
													<module.icon
														class="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110"
													/>
												{:else}
													<LayoutGrid
														class="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110"
													/>
												{/if}
											</Tooltip.Trigger>
											<Tooltip.Content side="right" class="ml-2">
												{module.name}
											</Tooltip.Content>
										</Tooltip.Root>
									{/each}

									<div class="mt-auto flex flex-col gap-2">
										<Tooltip.Root>
											<Tooltip.Trigger>
												<Button
													variant="ghost"
													size="icon"
													class="text-muted-foreground h-10 w-10 rounded-2xl hover:bg-muted/40"
													onclick={() => goto('/ui/settings')}
												>
													<Settings class="h-5 w-5" />
												</Button>
											</Tooltip.Trigger>
											<Tooltip.Content side="right">Settings</Tooltip.Content>
										</Tooltip.Root>

										<Tooltip.Root>
											<Tooltip.Trigger>
												<Button
													variant="ghost"
													size="icon"
													class="text-muted-foreground h-10 w-10 rounded-2xl hover:bg-muted/40"
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

										{#if !isAiOpen}
											<Tooltip.Root>
												<Tooltip.Trigger>
													<Button
														variant="ghost"
														size="icon"
														class="text-muted-foreground h-10 w-10 rounded-2xl hover:bg-muted/40"
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
								</div>
							</div>

							<aside
								class={`flex flex-col transition-[width,padding] duration-300 ease-out ${
									isSubmenuCompact ? 'w-16 px-2' : 'w-64 px-4 lg:w-72'
								} py-4`}
							>
								<div
									class={`items-center justify-between gap-3 pb-3 ${
										isSubmenuCompact ? 'hidden' : 'flex'
									}`}
								>
									<div class="flex items-center gap-3">
										<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/60">
											<LayoutGrid class="text-muted-foreground h-5 w-5" />
										</div>
										<div class="min-w-0">
											<p class="text-lg font-semibold text-foreground">
												{currentModule?.name || 'Navigation'}
											</p>
										</div>
									</div>
								</div>
								<nav aria-label="Submenu sections" class="flex flex-1 flex-col gap-6">
									{#each submenuSections as section}
										<SubmenuSection
											title={section.label}
											items={section.items}
											currentPath={path}
											variant="sidebar"
											compact={isSubmenuCompact}
										/>
									{/each}
									{#if submenuSections.length === 0}
										<div
											class={`text-muted-foreground rounded-2xl border border-dashed border-border/70 px-3 py-4 text-sm ${
												isSubmenuCompact ? 'hidden' : ''
											}`}
										>
											No sections yet.
										</div>
									{/if}
								</nav>
								<div class="mt-auto flex justify-center pt-4">
									<button
										type="button"
										aria-label={isSubmenuCompact ? 'Expand submenu' : 'Collapse submenu'}
										class={`text-muted-foreground flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 transition-all duration-300 ease-out hover:text-foreground hover:shadow-sm ${
											isSubmenuCompact ? 'rotate-45' : ''
										}`}
										onclick={() => {
											isSubmenuCompact = !isSubmenuCompact;
											persistSubmenuCompact(isSubmenuCompact);
										}}
									>
										<Pin class="h-4 w-4 transition-transform duration-300 ease-out" />
									</button>
								</div>
							</aside>
						</div>
						<div class="flex min-w-0 flex-1 justify-center overflow-y-auto">
							<div class="min-h-full w-full px-2 pt-4 pb-12 sm:px-4 md:pr-0 md:pb-0">
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

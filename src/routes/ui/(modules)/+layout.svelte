<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import {
		LayoutDashboard,
		List,
		User,
		Settings,
		Bell,
		Search,
		LogOut,
		RefreshCw,
		Bot
	} from 'lucide-svelte';
	import { authClient } from '$lib/auth-client';
	import { getAllModules } from '$lib/config';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import ChatSidepanel from '$lib/components/ai/chat-sidepanel.svelte';

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
				// 2. AND it's enabled in the user settings (defaults to true for builtin, false for external)
				const isEnabled = state ? state.enabled : isBuiltin;

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
	let isRestarting = $state(false);
	let isAiOpen = $state(false);
</script>

<div class="flex w-screen h-screen bg-background text-foreground">
	<Tooltip.Provider>
		<!-- Left Sidebar: Module Access & User Settings -->
		<aside
			class="fixed top-0 bottom-0 left-0 flex flex-col items-center w-20 py-6 border-r z-100 border-border bg-background"
		>
			<!-- Module Icons -->
			<div class="flex flex-col gap-4 mb-auto">
				{#each modules as module}
					<Tooltip.Root>
						<Tooltip.Trigger
							class={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg transition-all duration-200 ${
								path.startsWith(module.href)
									? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20'
									: 'text-muted-foreground hover:text-accent-foreground hover:bg-accent/10 hover:ring-1 hover:ring-accent/10'
							}`}
							onclick={() => goto(module.href)}
						>
							<module.icon
								class="w-6 h-6 transition-transform duration-200 group-hover:scale-110"
							/>
						</Tooltip.Trigger>
						<Tooltip.Content side="right" class="ml-2">
							{module.name}
						</Tooltip.Content>
					</Tooltip.Root>
				{/each}
			</div>

			<!-- Settings & User at Bottom -->
			<div class="flex flex-col gap-3 mt-auto">
				<!-- Settings -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							size="icon"
							class="w-10 h-10 text-muted-foreground hover:bg-muted"
							onclick={() => goto('/ui/settings')}
						>
							<Settings class="w-5 h-5" />
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
							class="w-10 h-10 text-muted-foreground hover:bg-muted"
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
							<LogOut class="w-5 h-5" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="right">Logout</Tooltip.Content>
				</Tooltip.Root>
			</div>
		</aside>

		<!-- Main Content Area -->
		<div class="flex flex-col flex-1 ml-20">
			<!-- Top Navigation Bar -->
			<nav class="flex items-center justify-between px-6 border-b h-14 border-border bg-background">
				<!-- Left spacer -->
				<div></div>

				<!-- Search -->
				<div class="relative w-full max-w-xl">
					<Search class="absolute w-4 h-4 -translate-y-1/2 text-muted-foreground top-1/2 left-3" />
					<Input
						placeholder="Search..."
						class="w-full pl-10 pr-4 text-sm border-0 rounded-lg placeholder:text-muted-foreground h-9 bg-muted"
					/>
				</div>

				<!-- AI Chat Button -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							class="w-10 h-10 transition-all duration-300 rounded-2xl bg-primary text-primary-foreground hover:scale-110 hover:shadow-primary/20 active:scale-95"
							onclick={() => (isAiOpen = !isAiOpen)}
						>
							<Bot class="w-8 h-8" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content side="bottom">AI Assistant</Tooltip.Content>
				</Tooltip.Root>
			</nav>

			<!-- Content with Module Navigation Bubbles -->
			<div class="relative flex flex-1 overflow-hidden">
				<!-- Module Navigation Bubbles (Hidden under Sidebar) -->
				<div class="w-24">
					{#if filteredNavigation.length > 0}
						<div class="fixed bottom-0 z-50 flex flex-col gap-2 mt-2 top-14 left-15">
							{#each filteredNavigation as item, i (`nav-${i}`)}
								{@const isActive = item.href && path === item.href}
								<button
									onclick={() => item.href && goto(item.href)}
									disabled={item.disabled}
									class="group left-0 flex w-12 cursor-pointer items-end justify-end rounded-full px-3 py-2 text-xs font-medium whitespace-nowrap transition-all duration-300 hover:w-32 hover:translate-x-2 hover:bg-accent/90 hover:shadow-sm hover:ring-1 hover:ring-accent/20 active:scale-95 {isActive
										? 'w-32 bg-primary font-semibold text-primary-foreground shadow-md ring-2 ring-primary/30 hover:bg-primary'
										: 'text-muted-foreground bg-muted'}"
									style="top: {i * 48}px"
								>
									<span
										class="transition-opacity duration-300 {isActive
											? 'w-fit opacity-100'
											: 'w-0 opacity-0 group-hover:w-fit group-hover:opacity-100'}"
										>{item.name}</span
									>
									<item.icon class="w-4 h-4 ml-2 opacity-100" />
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Main Content -->
				<div class="flex justify-center w-full overflow-y-auto">
					<div class="w-full min-h-full px-8 pt-6">
						{@render children()}
					</div>
				</div>
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
					class="px-6 border-none rounded-full shadow-2xl h-14 animate-bounce bg-primary text-primary-foreground hover:animate-none hover:bg-accent/90"
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

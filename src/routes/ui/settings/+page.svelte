<script lang="ts">
	import type { PageData } from './$types';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import * as Avatar from '$lib/components/ui/avatar';
	import {
		LayoutGrid,
		User,
		Palette,
		Bell,
		Shield,
		ChevronRight,
		Check,
		Sparkles,
		ArrowLeft,
		Bot
	} from 'lucide-svelte';
	import {
		setTheme,
		getCurrentTheme,
		applyTheme,
		THEMES,
		type Theme,
		type Font,
		FONTS,
		getCurrentFont,
		setFont,
		applyFont
	} from '$lib/theme';
	import { cn } from '$lib/utils';
	import { goto } from '$app/navigation';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';

	let { data } = $props();

	let open = $state(false);
	let currentTheme = $state<Theme>(getCurrentTheme());
	let currentFont = $state<Font>(getCurrentFont());

	let currentThemeMetadata = $derived(THEMES.find((t) => t.id === currentTheme));

	function handleThemeSelect(theme: Theme) {
		setTheme(theme);
		currentTheme = theme;
	}

	function handleFontSelect(font: Font) {
		setFont(font);
		currentFont = font;
	}

	function handleThemeMouseEnter(theme: Theme) {
		applyTheme(theme);
	}

	function handleThemeMouseLeave() {
		applyTheme(currentTheme);
	}

	function handleFontMouseEnter(font: Font) {
		applyFont(font);
	}

	function handleFontMouseLeave() {
		applyFont(currentFont);
	}

	const lightThemes = $derived(THEMES.filter((t) => !t.isDark));
	const darkThemes = $derived(THEMES.filter((t) => t.isDark));
</script>

<svelte:head>
	<title>Settings - MoLOS</title>
	<meta name="description" content="Personalize your MoLOS experience." />
</svelte:head>

<div class="min-h-screen bg-background pb-20">
	<div class="mx-auto max-w-4xl space-y-8 p-6">
		<!-- Header -->
		<div class="space-y-4 pt-4">
			<Button
				variant="ghost"
				size="sm"
				onclick={() => goto('/ui/dashboard')}
				class="text-muted-foreground -ml-2 h-8 rounded-full px-3 text-[10px] font-bold tracking-widest uppercase hover:text-foreground"
			>
				<ArrowLeft class="mr-2 h-3 w-3" />
				Back to Dashboard
			</Button>
			<div class="space-y-1">
				<h1 class="text-3xl font-black tracking-tighter">Settings</h1>
				<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
					Personalize your experience
				</p>
			</div>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Profile Section -->
			<Card class="overflow-hidden border-none shadow-sm">
				<CardHeader class="pb-3">
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
							<User class="h-4 w-4" />
						</div>
						<div>
							<CardTitle class="font-bold">Profile</CardTitle>
						</div>
					</div>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="flex items-center gap-4 rounded-2xl bg-background/50 p-3">
						<Avatar.Root class="h-12 w-12 border-2 border-background shadow-sm">
							<Avatar.Image src="" alt="Avatar" />
							<Avatar.Fallback class="bg-primary text-lg font-black text-primary-foreground">
								{data.user?.name?.[0]?.toUpperCase() || 'U'}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="min-w-0">
							<p class="truncate text-base font-bold">{data.user?.name || 'User'}</p>
							<p class="text-muted-foreground truncate text-xs font-medium">
								{data.user?.email || ''}
							</p>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						class="h-9 w-full rounded-xl text-xs font-bold"
						onclick={() => goto('/ui/settings/profile')}>Edit Profile</Button
					>
				</CardContent>
			</Card>

			<!-- Appearance Section -->
			<Card class="overflow-hidden border-none shadow-sm ">
				<CardHeader class="pb-3">
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
							<Palette class="h-4 w-4" />
						</div>
						<div>
							<CardTitle class="font-bold">Appearance</CardTitle>
						</div>
					</div>
				</CardHeader>
				<CardContent class="space-y-4">
					<button
						class="relative w-full cursor-pointer rounded-2xl bg-linear-to-br p-4 text-left shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
						style="background-image: linear-gradient(to bottom right, var(--primary), var(--primary-foreground));"
						onclick={() => goto('/ui/settings/theme')}
					>
						<div class="flex items-center justify-between">
							<div class="space-y-0.5">
								<p class="text-[8px] font-black tracking-widest uppercase opacity-70">
									Current Style
								</p>
								<h3 class="text-lg font-black capitalize">
									{currentThemeMetadata?.label} • {FONTS.find((f) => f.id === currentFont)?.label}
								</h3>
							</div>
							<Sparkles class="h-6 w-6 opacity-50" />
						</div>
					</button>
					<Button
						size="sm"
						class="h-9 w-full rounded-xl text-xs font-bold"
						onclick={() => goto('/ui/settings/theme')}>Change Theme</Button
					>
				</CardContent>
			</Card>

			<!-- Modules Section -->
			<Card class="overflow-hidden border-none shadow-sm md:col-span-2">
				<CardHeader class="pb-3">
					<div class="flex items-center gap-3">
						<div class="rounded-xl p-2 text-primary shadow-xs">
							<LayoutGrid class="h-4 w-4" />
						</div>
						<div>
							<CardTitle class="font-bold">Modules & Features</CardTitle>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<button
						class="group flex w-full cursor-pointer items-center justify-between rounded-2xl bg-background/50 p-3 transition-colors hover:bg-background/80"
						onclick={() => goto('/ui/settings/modules')}
					>
						<div class="flex items-center gap-4">
							<div class="rounded-xl bg-muted/30 p-2.5 shadow-xs">
								<LayoutGrid class="h-5 w-5 text-primary" />
							</div>
							<div class="text-left">
								<p class="text-sm font-bold">Module Manager</p>
								<p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
									Configure active functionalities
								</p>
							</div>
						</div>
						<ChevronRight
							class="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-1"
						/>
					</button>
				</CardContent>
			</Card>

			<!-- AI Assistant Section -->
			<Card class="overflow-hidden border-none shadow-sm md:col-span-2">
				<CardHeader class="pb-3">
					<div class="flex items-center gap-3">
						<div class="rounded-xl p-2 text-primary shadow-xs">
							<Bot class="h-4 w-4" />
						</div>
						<div>
							<CardTitle class="font-bold">AI Assistant</CardTitle>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<button
						class="group flex w-full cursor-pointer items-center justify-between rounded-2xl bg-background/50 p-3 transition-colors hover:bg-background/80"
						onclick={() => goto('/ui/settings/ai')}
					>
						<div class="flex items-center gap-4">
							<div class="rounded-xl bg-muted/30 p-2.5 shadow-xs">
								<Bot class="h-5 w-5 text-primary" />
							</div>
							<div class="text-left">
								<p class="text-sm font-bold">AI Configuration</p>
								<p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
									Manage LLM providers and agent behavior
								</p>
							</div>
						</div>
						<ChevronRight
							class="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-1"
						/>
					</button>
				</CardContent>
			</Card>

			<!-- Notifications Section -->
			<Card class="overflow-hidden border-none shadow-sm">
				<CardHeader class="pb-3">
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
							<Bell class="h-4 w-4" />
						</div>
						<div>
							<CardTitle class="font-bold">Notifications</CardTitle>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<p
						class="text-muted-foreground rounded-xl border border-dashed bg-background/30 py-4 text-center text-[10px] font-black tracking-widest uppercase"
					>
						Coming soon
					</p>
				</CardContent>
			</Card>

			<!-- Security Section -->
			<Card class="overflow-hidden border-none shadow-sm">
				<CardHeader class="pb-3">
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
							<Shield class="h-4 w-4" />
						</div>
						<div>
							<CardTitle class="font-bold">Privacy</CardTitle>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<p
						class="text-muted-foreground rounded-xl border border-dashed bg-background/30 py-4 text-center text-[10px] font-black tracking-widest uppercase"
					>
						Coming soon
					</p>
				</CardContent>
			</Card>

			{#if data.user?.role === 'admin'}
				<!-- Admin Section -->
				<Card class="overflow-hidden border-none shadow-sm md:col-span-2">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-primary p-2 text-primary-foreground shadow-xs">
								<Shield class="h-4 w-4" />
							</div>
							<div>
								<CardTitle class="font-bold">Administration</CardTitle>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<button
							class="group flex w-full cursor-pointer items-center justify-between rounded-2xl bg-background/50 p-3 transition-colors hover:bg-background/80"
							onclick={() => goto('/ui/settings/admin')}
						>
							<div class="flex items-center gap-4">
								<div class="rounded-xl bg-primary/20 p-2.5 shadow-xs">
									<Shield class="h-5 w-5 text-primary" />
								</div>
								<div class="text-left">
									<p class="text-sm font-bold">Admin Console</p>
									<p class="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
										Manage users, roles, and system settings
									</p>
								</div>
							</div>
							<ChevronRight
								class="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-1"
							/>
						</button>
					</CardContent>
				</Card>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(body) {
		transition:
			background-color 0.3s ease,
			color 0.3s ease;
	}
</style>

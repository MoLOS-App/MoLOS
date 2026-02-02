<svelte:head>
	<title>Theme - MoLOS Settings</title>
	<meta name="description" content="Customize your MoLOS theme and appearance." />
</svelte:head>

<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Progress } from '$lib/components/ui/progress';
	import { toast } from 'svelte-sonner';
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
		applyFont,
		getThemePreviewColors
	} from '$lib/theme';
	import {
		LayoutGrid,
		User,
		Palette,
		Bell,
		Shield,
		ChevronRight,
		ChevronDown,
		Check,
		Sparkles,
		ArrowLeft,
		Loader2,
		CheckCircle2,
		AlertCircle,
		Sun,
		Moon
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let currentTheme = $state<Theme>(getCurrentTheme());
	let currentFont = $state<Font>(getCurrentFont());
	let visibleChevron = $state<boolean>(true);
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

	async function handleToast() {
		toast.success('Logged in successfully');
	}

	async function handleErrorToast() {
		toast.error('Something went wrong');
	}

	async function handleWarningToast() {
		toast.warning('Please check your input');
	}

	async function handleInfoToast() {
		toast.info('Here is some information');
	}

	async function handlePanelScroll(panelId: string) {
		const container = document.querySelector<HTMLDivElement>(`#${panelId}`);
		if (container) {
			const { scrollTop, scrollHeight, clientHeight } = container;
			if (scrollTop + clientHeight >= scrollHeight - 10) {
				visibleChevron = false;
			} else {
				visibleChevron = true;
			}
		}
	}

	const lightThemes = $derived(THEMES.filter((t) => !t.isDark));
	const mediumThemes = $derived(THEMES.filter((t) => t.isDark && t.id.includes('medium')));
	const darkThemes = $derived(
		THEMES.filter(
			(t) => t.isDark && !t.id.includes('medium') && t.id !== 'dark' && !t.id.includes('light')
		)
	);
	const baseThemes = $derived(THEMES.filter((t) => t.id === 'dark' || t.id === 'medium'));
</script>

<div class="flex h-screen flex-col overflow-hidden bg-background">
	<div class="mx-auto w-full max-w-7xl flex-none space-y-8 p-6">
		<!-- Header -->
		<div class="h-30 space-y-4 pt-4">
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
				<h1 class="text-3xl font-black tracking-tighter">Theme Customization</h1>
				<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
					Choose your perfect style
				</p>
			</div>
		</div>

		<div class="relative flex max-h-[calc(100vh-12rem)] min-h-0 flex-1 gap-6">
			<!-- Left Side: Theme Selector -->
			<div id="left-side-panel" class="max-h-full flex-1 space-y-6 overflow-y-auto pb-10">
				<!-- Typography Section -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
								<Sparkles class="h-4 w-4" />
							</div>
							<div>
								<CardTitle class="font-bold">Typography</CardTitle>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-2 gap-3">
							{#each FONTS as font}
								<button
									class={cn(
										'group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
										currentFont === font.id
											? 'border-primary bg-primary/5 shadow-xl shadow-primary/5'
											: 'border-muted/20 bg-muted/5 hover:border-primary/30 hover:bg-muted/10'
									)}
									onclick={() => handleFontSelect(font.id)}
									onmouseenter={() => handleFontMouseEnter(font.id)}
									onmouseleave={() => handleFontMouseLeave()}
								>
									<div
										class={cn(
											'flex h-10 w-10 items-center justify-center rounded-xl bg-background text-lg font-bold transition-transform duration-500 group-hover:scale-110',
											font.class
										)}
									>
										Aa
									</div>
									<span class="text-[10px] font-black tracking-tight uppercase">{font.label}</span>
									{#if currentFont === font.id}
										<div
											class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
										>
											<Check class="h-3 w-3 stroke-[4]" />
										</div>
									{/if}
								</button>
							{/each}
						</div>
					</CardContent>
				</Card>

				<!-- Light Themes -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
								<Sun class="h-4 w-4" />
							</div>
							<div>
								<CardTitle class="font-bold">Light Themes</CardTitle>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-2 gap-3">
							{#each lightThemes as theme}
								<button
									class={cn(
										'group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
										currentTheme === theme.id
											? 'border-primary bg-primary/5 shadow-xl shadow-primary/5'
											: 'border-muted/20 bg-muted/5 hover:border-primary/30 hover:bg-muted/10'
									)}
									onclick={() => handleThemeSelect(theme.id)}
									onmouseenter={() => handleThemeMouseEnter(theme.id)}
									onmouseleave={() => handleThemeMouseLeave()}
								>
									<div class="relative">
										<div
											class={cn(
												'h-12 w-12 rounded-2xl bg-linear-to-br shadow-lg transition-transform duration-500 group-hover:rotate-6',
												theme.colors
											)}
										></div>
										{#if currentTheme === theme.id}
											<div
												class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
											>
												<Check class="h-3 w-3 stroke-[4]" />
											</div>
										{/if}
									</div>
									<span class="text-center text-[10px] font-black tracking-tight uppercase">
										{theme.label}
									</span>
									{#if theme.id !== 'light'}
										{@const colors = getThemePreviewColors(theme.id)}
										<div
											class="mt-1 flex gap-1 opacity-80 transition-opacity group-hover:opacity-100"
										>
											<div
												class={cn('h-5 w-1.5 rounded-full', colors.primary)}
												title="Primary"
											></div>
											<div
												class={cn('h-5 w-1.5 rounded-full', colors.secondary)}
												title="Secondary"
											></div>
											<div class={cn('h-5 w-1.5 rounded-full', colors.accent)} title="Accent"></div>
										</div>
									{/if}
								</button>
							{/each}
						</div>
					</CardContent>
				</Card>

				<!-- Medium Themes -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
								<Moon class="h-4 w-4" />
							</div>
							<div>
								<CardTitle class="font-bold">Medium Themes</CardTitle>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-2 gap-3">
							{#each mediumThemes as theme}
								{@const colors = getThemePreviewColors(theme.id)}
								<button
									class={cn(
										'group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
										currentTheme === theme.id
											? 'border-primary bg-primary/5 shadow-xl shadow-primary/5'
											: 'border-muted/20 bg-muted/5 hover:border-primary/30 hover:bg-muted/10'
									)}
									onclick={() => handleThemeSelect(theme.id)}
									onmouseenter={() => handleThemeMouseEnter(theme.id)}
									onmouseleave={() => handleThemeMouseLeave()}
								>
									<div class="relative">
										<div
											class={cn(
												'h-12 w-12 rounded-2xl bg-linear-to-br shadow-lg transition-transform duration-500 group-hover:rotate-6',
												theme.colors
											)}
										></div>
										{#if currentTheme === theme.id}
											<div
												class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
											>
												<Check class="h-3 w-3 stroke-[4]" />
											</div>
										{/if}
									</div>
									<span class="text-center text-[10px] font-black tracking-tight uppercase">
										{theme.label}
									</span>
									<div
										class="mt-1 flex gap-1 opacity-80 transition-opacity group-hover:opacity-100"
									>
										<div class={cn('h-5 w-1.5 rounded-full', colors.primary)} title="Primary"></div>
										<div
											class={cn('h-5 w-1.5 rounded-full', colors.secondary)}
											title="Secondary"
										></div>
										<div class={cn('h-5 w-1.5 rounded-full', colors.accent)} title="Accent"></div>
									</div>
								</button>
							{/each}
						</div>
					</CardContent>
				</Card>

				<!-- Dark Themes -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
								<Shield class="h-4 w-4" />
							</div>
							<div>
								<CardTitle class="font-bold">Dark Themes</CardTitle>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-2 gap-3">
							{#each darkThemes as theme}
								{@const colors = getThemePreviewColors(theme.id)}
								<button
									class={cn(
										'group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
										currentTheme === theme.id
											? 'border-primary bg-primary/5 shadow-xl shadow-primary/5'
											: 'border-muted/20 bg-muted/5 hover:border-primary/30 hover:bg-muted/10'
									)}
									onclick={() => handleThemeSelect(theme.id)}
									onmouseenter={() => handleThemeMouseEnter(theme.id)}
									onmouseleave={() => handleThemeMouseLeave()}
								>
									<div class="relative">
										<div
											class={cn(
												'h-12 w-12 rounded-2xl bg-linear-to-br shadow-lg transition-transform duration-500 group-hover:rotate-6',
												theme.colors
											)}
										></div>
										{#if currentTheme === theme.id}
											<div
												class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
											>
												<Check class="h-3 w-3 stroke-[4]" />
											</div>
										{/if}
									</div>
									<span class="text-center text-[10px] font-black tracking-tight uppercase">
										{theme.label}
									</span>
									<div
										class="mt-1 flex gap-1 opacity-80 transition-opacity group-hover:opacity-100"
									>
										<div class={cn('h-5 w-1.5 rounded-full', colors.primary)} title="Primary"></div>
										<div
											class={cn('h-5 w-1.5 rounded-full', colors.secondary)}
											title="Secondary"
										></div>
										<div class={cn('h-5 w-1.5 rounded-full', colors.accent)} title="Accent"></div>
									</div>
								</button>
							{/each}
						</div>
					</CardContent>
				</Card>

				<!-- Base Themes -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
								<LayoutGrid class="h-4 w-4" />
							</div>
							<div>
								<CardTitle class="font-bold">Base Themes</CardTitle>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-2 gap-3">
							{#each baseThemes as theme}
								{@const colors = getThemePreviewColors(theme.id)}
								<button
									class={cn(
										'group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
										currentTheme === theme.id
											? 'border-primary bg-primary/5 shadow-xl shadow-primary/5'
											: 'border-muted/20 bg-muted/5 hover:border-primary/30 hover:bg-muted/10'
									)}
									onclick={() => handleThemeSelect(theme.id)}
									onmouseenter={() => handleThemeMouseEnter(theme.id)}
									onmouseleave={() => handleThemeMouseLeave()}
								>
									<div class="relative">
										<div
											class={cn(
												'h-12 w-12 rounded-2xl bg-linear-to-br shadow-lg transition-transform duration-500 group-hover:rotate-6',
												theme.colors
											)}
										></div>
										{#if currentTheme === theme.id}
											<div
												class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
											>
												<Check class="h-3 w-3 stroke-[4]" />
											</div>
										{/if}
									</div>
									<span class="text-center text-[10px] font-black tracking-tight uppercase">
										{theme.label}
									</span>
									<div
										class="mt-1 flex gap-1 opacity-80 transition-opacity group-hover:opacity-100"
									>
										<div class={cn('h-5 w-1.5 rounded-full', colors.primary)} title="Primary"></div>
										<div
											class={cn('h-5 w-1.5 rounded-full', colors.secondary)}
											title="Secondary"
										></div>
										<div class={cn('h-5 w-1.5 rounded-full', colors.accent)} title="Accent"></div>
									</div>
								</button>
							{/each}
						</div>
					</CardContent>
				</Card>
			</div>

			<!-- Right Side: Live Preview Components -->
			<div
				id="right-side-panel"
				class="max-h-full flex-1 space-y-6 overflow-y-auto pb-10"
				onscroll={() => handlePanelScroll('right-side-panel')}
			>
				<!-- Buttons Showcase -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Buttons</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="flex flex-wrap gap-2">
							<Button size="sm" class="h-9">Primary</Button>
							<Button size="sm" variant="secondary" class="h-9">Secondary</Button>
							<Button size="sm" variant="outline" class="h-9">Outline</Button>
							<Button size="sm" variant="ghost" class="h-9">Ghost</Button>
							<Button size="sm" variant="destructive" class="h-9">Destructive</Button>
						</div>
					</CardContent>
				</Card>

				<!-- Badges Showcase -->
				<Card>
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Badges</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="flex flex-wrap gap-2">
							<Badge variant="default">Default</Badge>
							<Badge variant="secondary">Secondary</Badge>
							<Badge variant="outline">Outline</Badge>
							<Badge variant="destructive">Destructive</Badge>
						</div>
					</CardContent>
				</Card>

				<!-- Inputs Showcase -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Inputs</CardTitle>
					</CardHeader>
					<CardContent class="space-y-3">
						<Input placeholder="Type something..." class="h-9" />
						<Input placeholder="Disabled input" class="h-9" disabled />
					</CardContent>
				</Card>

				<!-- Progress & Loading Showcase -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Progress & Loading</CardTitle>
					</CardHeader>
					<CardContent class="space-y-3">
						<Progress value={65} class="h-2" />
						<div class="flex items-center gap-2">
							<Loader2 class="h-4 w-4 animate-spin text-primary" />
							<span class="text-sm font-medium">Loading...</span>
						</div>
					</CardContent>
				</Card>

				<!-- Cards Showcase -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Cards</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="grid grid-cols-2 gap-3">
							<Card class="border-2">
								<CardContent class="p-3">
									<div class="flex items-center gap-2">
										<CheckCircle2 class="h-4 w-4 text-primary" />
										<span class="text-sm font-medium">Success</span>
									</div>
								</CardContent>
							</Card>
							<Card class="border-2">
								<CardContent class="p-3">
									<div class="flex items-center gap-2">
										<AlertCircle class="h-4 w-4 text-accent" />
										<span class="text-sm font-medium">Alert</span>
									</div>
								</CardContent>
							</Card>
						</div>
					</CardContent>
				</Card>

				<!-- Color Swatches Showcase -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Theme Colors</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							<div class="flex gap-2">
								<div
									class="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground"
								>
									Primary
								</div>
								<div
									class="flex h-10 flex-1 items-center justify-center rounded-lg bg-secondary text-[10px] font-bold"
								>
									Secondary
								</div>
								<div
									class="flex h-10 flex-1 items-center justify-center rounded-lg bg-accent text-[10px] font-bold"
								>
									Accent
								</div>
							</div>
							<div class="flex gap-2">
								<div
									class="flex h-10 flex-1 items-center justify-center rounded-lg bg-muted text-[10px] font-bold"
								>
									Muted
								</div>
								<div
									class="flex h-10 flex-1 items-center justify-center rounded-lg bg-border text-[10px] font-bold"
								>
									Border
								</div>
								<div
									class="flex h-10 flex-1 items-center justify-center rounded-lg bg-foreground text-[10px] font-bold text-background"
								>
									Foreground
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<!-- Status Indicators -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Status Indicators</CardTitle>
					</CardHeader>
					<CardContent class="space-y-2">
						<div class="flex items-center gap-2">
							<div class="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
							<span class="text-sm font-medium">Active</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-2 w-2 rounded-full bg-destructive"></div>
							<span class="text-sm font-medium">Inactive</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="h-2 w-2 rounded-full bg-muted"></div>
							<span class="text-sm font-medium">Pending</span>
						</div>
					</CardContent>
				</Card>

				<!-- Toast -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-2">
						<CardTitle class="font-bold tracking-widest uppercase">Toasts</CardTitle>
					</CardHeader>
					<CardContent class="space-y-2">
						<div class="flex flex-wrap gap-2">
							<Button onclick={handleToast} size="sm" class="h-9">Success</Button>
							<Button onclick={handleErrorToast} size="sm" variant="destructive" class="h-9"
								>Error</Button
							>
							<Button onclick={handleWarningToast} size="sm" variant="outline" class="h-9"
								>Warning</Button
							>
							<Button onclick={handleInfoToast} size="sm" variant="secondary" class="h-9"
								>Info</Button
							>
						</div>
					</CardContent>
				</Card>

				<!-- Current Theme Summary -->
				<Card class="overflow-hidden">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
								<Palette class="h-4 w-4" />
							</div>
							<div>
								<CardTitle class="font-bold">Current Theme Summary</CardTitle>
							</div>
						</div>
					</CardHeader>
					<CardContent class="space-y-3">
						<div class="flex items-center gap-3">
							<div
								class={cn(
									'h-10 w-10 rounded-xl bg-linear-to-br shadow-lg',
									THEMES.find((t) => t.id === currentTheme)?.colors
								)}
							></div>
							<div>
								<p class="text-sm font-bold capitalize">{currentThemeMetadata?.label}</p>
								<p class="text-muted-foreground text-xs">
									{currentThemeMetadata?.isDark ? 'Dark Mode' : 'Light Mode'} • {FONTS.find(
										(f) => f.id === currentFont
									)?.label}
								</p>
							</div>
						</div>
						{@const colors = getThemePreviewColors(currentTheme)}
						<div class="flex gap-2">
							<div
								class="flex h-8 flex-1 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground"
							>
								Primary
							</div>
							<div
								class="flex h-8 flex-1 items-center justify-center rounded-lg bg-secondary text-[10px] font-bold"
							>
								Secondary
							</div>
							<div
								class="flex h-8 flex-1 items-center justify-center rounded-lg bg-accent text-[10px] font-bold"
							>
								Accent
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>

		<!-- Scroll Indicators -->
		{#if visibleChevron}
			<div
				class="pointer-events-none sticky bottom-0 flex h-10 w-full justify-center bg-linear-to-b from-transparent to-background pb-0 shadow-lg"
			>
				<ChevronDown class="text-muted-foreground h-5 w-5 animate-bounce" />
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		transition:
			background-color 0.3s ease,
			color 0.3s ease;
	}
</style>

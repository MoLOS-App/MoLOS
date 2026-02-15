<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		ShieldCheck,
		ArrowRight,
		User,
		Mail,
		Lock,
		CheckCircle2,
		ChevronRight
	} from 'lucide-svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let loading = $state(false);
	let error = $state('');
	let step = $state(1);

	async function handleSetup(event: Event) {
		event.preventDefault();
		loading = true;
		error = '';
		try {
			const { data, error: authError } = await authClient.signUp.email({
				email,
				password,
				name,
				callbackURL: '/ui/dashboard'
			});

			if (authError) {
				error = authError.message || 'An error occurred';
				loading = false;
			} else {
				step = 3;
				toast.success('Admin account created successfully!');
				setTimeout(() => {
					goto('/ui/dashboard');
				}, 2000);
			}
		} catch (err) {
			error = 'An error occurred during setup';
			loading = false;
		}
	}

	function nextStep() {
		if (step === 1 && name) step = 2;
	}
</script>

<svelte:head>
	<title>Welcome - MoLOS Setup</title>
	<meta name="description" content="Welcome to MoLOS! Let's get you set up with your account." />
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-background p-6 font-sans text-foreground"
>
	<div class="grid w-full max-w-[1000px] items-center gap-12 lg:grid-cols-2">
		<!-- Left Side: Branding & Value Prop -->
		<div
			class="hidden flex-col space-y-8 lg:flex"
			in:fly={{ x: -20, duration: 1000, easing: cubicOut }}
		>
			<div
				class="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-xl"
			>
				<img src="/favicon.svg" alt="MoLOS Logo" class="h-10 w-10" />
			</div>
			<div class="space-y-4">
				<h1 class="text-6xl leading-[1.1] font-bold tracking-tight">
					Design your <br />
					<span class="text-primary">perfect</span> life.
				</h1>
				<p class="text-muted-foreground max-w-md text-xl font-medium">
					MoLOS is your private, modular operating system for personal growth and productivity.
				</p>
			</div>

			<div class="grid gap-6 pt-8">
				<div class="flex items-start gap-4">
					<div class="mt-1 rounded-full bg-primary/10 p-1 text-primary">
						<CheckCircle2 class="h-5 w-5" />
					</div>
					<div>
						<h3 class="font-bold">Fully Private</h3>
						<p class="text-muted-foreground text-sm">Your data stays on your server. Always.</p>
					</div>
				</div>
				<div class="flex items-start gap-4">
					<div class="mt-1 rounded-full bg-primary/10 p-1 text-primary">
						<CheckCircle2 class="h-5 w-5" />
					</div>
					<div>
						<h3 class="font-bold">Fully Modular</h3>
						<p class="text-muted-foreground text-sm">
							Enable only what you need, when you need it.
						</p>
					</div>
				</div>
				<div class="flex items-start gap-4">
					<div class="mt-1 rounded-full bg-primary/10 p-1 text-primary">
						<CheckCircle2 class="h-5 w-5" />
					</div>
					<div>
						<h3 class="font-bold">Fully Opensource</h3>
						<p class="text-muted-foreground text-sm">Develop and customize as you like.</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Right Side: Setup Form -->
		<div class="relative" in:fly={{ y: 20, duration: 1000, delay: 200, easing: cubicOut }}>
			<div
				class="overflow-hidden rounded-[2.5rem] border border-border bg-card p-8 text-card-foreground shadow-[0_20px_50px_rgba(0,0,0,0.1)] sm:p-12"
			>
				{#if step === 1}
					<div in:fade={{ duration: 400 }}>
						<h2 class="text-3xl font-bold tracking-tight">Let's get started.</h2>
						<p class="text-muted-foreground mt-2 font-medium">First, what should we call you?</p>

						<div class="mt-10 space-y-6">
							<div class="space-y-2">
								<Label
									for="name"
									class="text-muted-foreground ml-1 text-[10px] font-bold tracking-widest uppercase"
									>Your Name</Label
								>
								<div class="relative">
									<User
										class="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
									/>
									<Input
										id="name"
										type="text"
										bind:value={name}
										placeholder="John Doe"
										class="h-14 rounded-2xl border-none bg-muted pl-12 text-lg focus-visible:ring-2 focus-visible:ring-primary"
										onkeydown={(e) => e.key === 'Enter' && nextStep()}
									/>
								</div>
							</div>

							<Button
								onclick={nextStep}
								disabled={!name}
								class="h-14 w-full rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
							>
								Continue
								<ChevronRight class="ml-2 h-5 w-5" />
							</Button>
						</div>
					</div>
				{:else if step === 2}
					<div in:fade={{ duration: 400 }}>
						<button
							onclick={() => (step = 1)}
							class="mb-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
						>
							<ArrowRight class="h-3 w-3 rotate-180" />
							Back
						</button>
						<h2 class="text-3xl font-bold tracking-tight">Create your account.</h2>
						<p class="text-muted-foreground mt-2 font-medium">
							Hi {name}, set up your admin credentials.
						</p>

						{#if error}
							<Alert
								variant="destructive"
								class="mt-6 rounded-2xl border-none bg-destructive/10 text-destructive"
							>
								<AlertDescription class="font-bold">{error}</AlertDescription>
							</Alert>
						{/if}

						<form onsubmit={handleSetup} class="mt-8 space-y-6">
							<div class="space-y-4">
								<div class="space-y-2">
									<Label
										for="email"
										class="text-muted-foreground ml-1 text-[10px] font-bold tracking-widest uppercase"
										>Email Address</Label
									>
									<div class="relative">
										<Mail
											class="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
										/>
										<Input
											id="email"
											type="email"
											bind:value={email}
											placeholder="admin@example.com"
											required
											class="h-14 rounded-2xl border-none bg-muted pl-12 text-lg focus-visible:ring-2 focus-visible:ring-primary"
										/>
									</div>
								</div>

								<div class="space-y-2">
									<Label
										for="password"
										class="text-muted-foreground ml-1 text-[10px] font-bold tracking-widest uppercase"
										>Password</Label
									>
									<div class="relative">
										<Lock
											class="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
										/>
										<Input
											id="password"
											type="password"
											bind:value={password}
											placeholder="••••••••"
											required
											class="h-14 rounded-2xl border-none bg-muted pl-12 text-lg focus-visible:ring-2 focus-visible:ring-primary"
										/>
									</div>
								</div>
							</div>

							<Button
								type="submit"
								disabled={loading}
								class="h-14 w-full rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
							>
								{#if loading}
									<div
										class="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
									></div>
									Setting up...
								{:else}
									Complete Setup
									<ShieldCheck class="ml-2 h-5 w-5" />
								{/if}
							</Button>
						</form>
					</div>
				{:else if step === 3}
					<div
						class="flex flex-col items-center justify-center py-12 text-center"
						in:scale={{ duration: 600, easing: cubicOut }}
					>
						<div class="mb-6 rounded-full bg-primary/10 p-4 text-primary">
							<CheckCircle2 class="h-16 w-16" />
						</div>
						<h2 class="text-4xl font-bold tracking-tight">You're all set.</h2>
						<p class="text-muted-foreground mt-4 text-xl font-medium">
							Welcome to your new digital home, {name}.
						</p>
						<p class="text-muted-foreground mt-2 text-sm">Redirecting you to your dashboard...</p>
					</div>
				{/if}
			</div>

			<!-- Footer Info -->
			<div class="text-muted-foreground mt-8 flex justify-center gap-8">
				<div class="flex items-center gap-2">
					<ShieldCheck class="h-4 w-4" />
					<span class="text-[10px] font-bold tracking-widest uppercase">End-to-End Secure</span>
				</div>
				<div class="flex items-center gap-2">
					<User class="h-4 w-4" />
					<span class="text-[10px] font-bold tracking-widest uppercase">Single User Mode</span>
				</div>
			</div>
		</div>
	</div>
</div>

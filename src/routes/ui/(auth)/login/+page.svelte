<svelte:head>
	<title>Sign In - MoLOS</title>
	<meta name="description" content="Sign in to your MoLOS account to access your personalized dashboard." />
</svelte:head>

<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { LogIn, Mail, Lock, ArrowRight, Sparkles, ChevronRight } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleLogin() {
		loading = true;
		error = '';
		try {
			const { data: authData, error: authError } = await authClient.signIn.email({
				email,
				password,
				callbackURL: '/ui/dashboard'
			});
			if (authError) {
				error = authError.message || 'An error occurred';
			} else {
				toast.success('Logged in successfully');
				await goto('/ui/dashboard');
			}
		} catch (err) {
			error = 'An error occurred during login';
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground"
>
	<div class="w-full max-w-md" in:fly={{ y: 20, duration: 1000, easing: cubicOut }}>
		<div class="mb-8 flex flex-col items-center space-y-4 text-center">
			<div
				class="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-xl"
			>
				<img src="/favicon.svg" alt="MoLOS Logo" class="h-10 w-10" />
			</div>
			<div class="space-y-2">
				<h1 class="text-4xl font-bold tracking-tight">Welcome back.</h1>
				<p class="text-muted-foreground font-medium">Enter your details to access your account.</p>
			</div>
		</div>

		<Card
			class="overflow-hidden rounded-[2.5rem] border border-border p-2 shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
		>
			<CardContent class="space-y-6 p-8 sm:p-10">
				{#if error}
					<div in:fade>
						<Alert
							variant="destructive"
							class="rounded-2xl border-none bg-destructive/10 text-destructive"
						>
							<AlertDescription class="font-bold">{error}</AlertDescription>
						</Alert>
					</div>
				{/if}

				<div class="space-y-6">
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
								placeholder="name@example.com"
								disabled={loading}
								class="h-14 rounded-2xl border-none bg-muted pl-12 text-lg focus-visible:ring-2 focus-visible:ring-primary"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<div class="ml-1 flex items-center justify-between">
							<Label
								for="password"
								class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase"
								>Password</Label
							>
							<a
								href="/ui/forgot-password"
								class="text-[10px] font-bold tracking-widest text-primary uppercase hover:underline"
								>Forgot?</a
							>
						</div>
						<div class="relative">
							<Lock
								class="text-muted-foreground absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2"
							/>
							<Input
								id="password"
								type="password"
								bind:value={password}
								placeholder="••••••••"
								disabled={loading}
								class="h-14 rounded-2xl border-none bg-muted pl-12 text-lg focus-visible:ring-2 focus-visible:ring-primary"
								onkeydown={(e) => e.key === 'Enter' && handleLogin()}
							/>
						</div>
					</div>

					<Button
						onclick={handleLogin}
						disabled={loading}
						class="mt-2 h-14 w-full rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
					>
						{#if loading}
							<div
								class="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
							></div>
							Signing in...
						{:else}
							Sign In
							<ChevronRight class="ml-1 h-5 w-5" />
						{/if}
					</Button>
				</div>

				{#if data.publicRegistration}
					<div class="pt-4 text-center">
						<p class="text-muted-foreground text-sm font-medium">
							Don't have an account?
							<a
								href="/ui/signup"
								class="inline-flex items-center gap-1 font-bold text-primary hover:underline"
							>
								Create one <ArrowRight class="h-3 w-3" />
							</a>
						</p>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Footer Info -->
		<div class="text-muted-foreground mt-8 flex justify-center gap-8">
			<div class="flex items-center gap-2">
				<div class="bg-muted-foreground/30 h-1 w-1 rounded-full"></div>
				<span class="text-[10px] font-bold tracking-widest uppercase">Secure Access</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="bg-muted-foreground/30 h-1 w-1 rounded-full"></div>
				<span class="text-[10px] font-bold tracking-widest uppercase">Privacy First</span>
			</div>
		</div>
	</div>
</div>

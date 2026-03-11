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

<svelte:head>
	<title>Sign In - MoLOS</title>
	<meta
		name="description"
		content="Sign in to your MoLOS account to access your personalized dashboard."
	/>
</svelte:head>

<div
	class="flex flex-col items-center justify-center min-h-screen p-6 bg-background text-foreground"
>
	<div class="w-full max-w-md" in:fly={{ y: 20, duration: 1000, easing: cubicOut }}>
		<div class="flex flex-col items-center mb-8 space-y-4 text-center">
			<div
				class="inline-flex items-center justify-center w-16 h-16 overflow-hidden border shadow-xl rounded-3xl border-border bg-card text-card-foreground"
			>
				<img src="/favicon.ico" alt="MoLOS Logo" class="w-10 h-10" />
			</div>
			<div class="space-y-2">
				<h1 class="text-4xl font-bold tracking-tight">Welcome back.</h1>
				<p class="font-medium text-muted-foreground">Enter your details to access your account.</p>
			</div>
		</div>

		<Card
			class="overflow-hidden rounded-[2.5rem] border border-border p-2 shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
		>
			<CardContent class="p-8 space-y-6 sm:p-10">
				{#if error}
					<div in:fade>
						<Alert
							variant="destructive"
							class="border-none rounded-2xl bg-destructive/10 text-destructive"
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
								class="absolute w-5 h-5 -translate-y-1/2 text-muted-foreground top-1/2 left-4"
							/>
							<Input
								id="email"
								type="email"
								bind:value={email}
								placeholder="name@example.com"
								disabled={loading}
								class="pl-12 text-lg border-none h-14 rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-primary"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<div class="flex items-center justify-between ml-1">
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
								class="absolute w-5 h-5 -translate-y-1/2 text-muted-foreground top-1/2 left-4"
							/>
							<Input
								id="password"
								type="password"
								bind:value={password}
								placeholder="••••••••"
								disabled={loading}
								class="pl-12 text-lg border-none h-14 rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-primary"
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
								class="w-5 h-5 mr-2 border-2 rounded-full animate-spin border-primary-foreground border-t-transparent"
							></div>
							Signing in...
						{:else}
							Sign In
							<ChevronRight class="w-5 h-5 ml-1" />
						{/if}
					</Button>
				</div>

				{#if data.publicRegistration}
					<div class="pt-4 text-center">
						<p class="text-sm font-medium text-muted-foreground">
							Don't have an account?
							<a
								href="/ui/signup"
								class="inline-flex items-center gap-1 font-bold text-primary hover:underline"
							>
								Create one <ArrowRight class="w-3 h-3" />
							</a>
						</p>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Footer Info -->
		<div class="flex justify-center gap-8 mt-8 text-muted-foreground">
			<div class="flex items-center gap-2">
				<div class="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
				<span class="text-[10px] font-bold tracking-widest uppercase">Secure Access</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
				<span class="text-[10px] font-bold tracking-widest uppercase">Privacy First</span>
			</div>
		</div>
	</div>
</div>

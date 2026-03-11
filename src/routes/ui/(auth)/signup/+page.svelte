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
	import { UserPlus, Mail, Lock, User, ArrowRight, Sparkles, ChevronRight } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let name = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSignup(event: Event) {
		event.preventDefault();
		loading = true;
		error = '';
		try {
			const { data: authData, error: authError } = await authClient.signUp.email({
				email,
				password,
				name,
				callbackURL: '/ui/dashboard'
			});
			if (authError) {
				error = authError.message || 'An error occurred';
			} else {
				toast.success('Account created successfully');
				await goto('/ui/dashboard');
			}
		} catch (err) {
			error = 'An error occurred during signup';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Create Account - MoLOS</title>
	<meta name="description" content="Join MoLOS and create your account to start your journey." />
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
				<h1 class="text-4xl font-bold tracking-tight">Join MoLOS.</h1>
				<p class="font-medium text-muted-foreground">Create your account to start your journey.</p>
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

				<form onsubmit={handleSignup} class="space-y-6">
					<div class="space-y-4">
						<div class="space-y-2">
							<Label
								for="name"
								class="text-muted-foreground ml-1 text-[10px] font-bold tracking-widest uppercase"
								>Full Name</Label
							>
							<div class="relative">
								<User
									class="absolute w-5 h-5 -translate-y-1/2 text-muted-foreground top-1/2 left-4"
								/>
								<Input
									id="name"
									type="text"
									bind:value={name}
									placeholder="John Doe"
									required
									disabled={loading}
									class="pl-12 text-lg border-none h-14 rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-primary"
								/>
							</div>
						</div>

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
									required
									disabled={loading}
									class="pl-12 text-lg border-none h-14 rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-primary"
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
									class="absolute w-5 h-5 -translate-y-1/2 text-muted-foreground top-1/2 left-4"
								/>
								<Input
									id="password"
									type="password"
									bind:value={password}
									placeholder="••••••••"
									required
									disabled={loading}
									class="pl-12 text-lg border-none h-14 rounded-2xl bg-muted focus-visible:ring-2 focus-visible:ring-primary"
								/>
							</div>
						</div>
					</div>

					<Button
						type="submit"
						disabled={loading}
						class="mt-2 h-14 w-full rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
					>
						{#if loading}
							<div
								class="w-5 h-5 mr-2 border-2 rounded-full animate-spin border-primary-foreground border-t-transparent"
							></div>
							Creating account...
						{:else}
							Create Account
							<ChevronRight class="w-5 h-5 ml-1" />
						{/if}
					</Button>
				</form>

				<div class="pt-4 text-center">
					<p class="text-sm font-medium text-muted-foreground">
						Already have an account?
						<a
							href="/ui/login"
							class="inline-flex items-center gap-1 font-bold text-primary hover:underline"
						>
							Sign in <ArrowRight class="w-3 h-3" />
						</a>
					</p>
				</div>
			</CardContent>
		</Card>

		<!-- Footer Info -->
		<div class="flex justify-center gap-8 mt-8 text-muted-foreground">
			<div class="flex items-center gap-2">
				<div class="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
				<span class="text-[10px] font-bold tracking-widest uppercase">Private & Secure</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-1 h-1 rounded-full bg-muted-foreground/30"></div>
				<span class="text-[10px] font-bold tracking-widest uppercase">Modular OS</span>
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Loader2, LogOut } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let message = $state('Signing you out safely...');

	onMount(async () => {
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						message = 'You have been logged out. Redirecting...';
						setTimeout(() => {
							goto('/ui/login');
						}, 1500);
					},
					onError: () => {
						message = 'Something went wrong, but we are redirecting you anyway.';
						setTimeout(() => {
							goto('/ui/login');
						}, 2000);
					}
				}
			});
		} catch (e) {
			goto('/ui/login');
		}
	});
</script>

<svelte:head>
	<title>Signing Out - MoLOS</title>
	<meta name="description" content="Signing you out safely..." />
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
				<h1 class="text-4xl font-bold tracking-tight">MoLOS</h1>
			</div>
		</div>

		<Card
			class="overflow-hidden rounded-[2.5rem] border border-border p-2 shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
		>
			<CardContent class="flex flex-col items-center p-8 space-y-6 sm:p-10">
				<div class="relative">
					<div class="absolute inset-0 rounded-full animate-ping bg-primary/20"></div>
					<div
						class="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary"
					>
						<LogOut class="w-10 h-10" />
					</div>
				</div>

				<div class="space-y-2">
					<CardTitle class="font-bold">Logging Out</CardTitle>
					<CardDescription class="font-medium">
						{message}
					</CardDescription>
				</div>

				<div class="flex items-center gap-2 font-bold text-primary">
					<Loader2 class="w-5 h-5 animate-spin" />
					<span>Processing...</span>
				</div>
			</CardContent>
		</Card>
	</div>
</div>

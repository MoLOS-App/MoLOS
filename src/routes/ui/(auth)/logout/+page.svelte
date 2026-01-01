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
				<h1 class="text-4xl font-bold tracking-tight">MoLOS</h1>
			</div>
		</div>

		<Card
			class="overflow-hidden rounded-[2.5rem] border border-border p-2 shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
		>
			<CardContent class="flex flex-col items-center space-y-6 p-8 sm:p-10">
				<div class="relative">
					<div class="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
					<div
						class="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary"
					>
						<LogOut class="h-10 w-10" />
					</div>
				</div>

				<div class="space-y-2">
					<CardTitle class="font-bold">Logging Out</CardTitle>
					<CardDescription class="font-medium">
						{message}
					</CardDescription>
				</div>

				<div class="flex items-center gap-2 font-bold text-primary">
					<Loader2 class="h-5 w-5 animate-spin" />
					<span>Processing...</span>
				</div>
			</CardContent>
		</Card>
	</div>
</div>

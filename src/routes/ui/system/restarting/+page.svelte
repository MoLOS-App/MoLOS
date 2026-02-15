<script lang="ts">
	import { onMount } from 'svelte';
	import { RefreshCw, Loader2, CircleCheck, AlertCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';

	let status = $state('restarting'); // restarting, checking, ready, failed
	let dots = $state('');
	let retryCount = $state(0);
	const MAX_RETRIES = 30;

	onMount(() => {
		const interval = setInterval(() => {
			dots = dots.length >= 3 ? '' : dots + '.';
		}, 500);

		// Wait a bit before starting to check, to allow the server to actually shut down
		setTimeout(checkServer, 3000);

		return () => clearInterval(interval);
	});

	async function checkServer() {
		try {
			// We try to fetch a simple API endpoint or just the root
			// Using a cache-busting query param to ensure we don't get a cached response
			const response = await fetch('/?t=' + Date.now(), { method: 'GET' }).catch(() => null);

			// If we get a response, we need to make sure it's not from the "old" server that is still shutting down
			// In production/preview, the build takes time, so if we get a response immediately, it's likely the old one.
			if (response && response.ok) {
				// If we are in the first few seconds, we might be seeing the old server
				if (retryCount < 2) {
					throw new Error('Possibly old server still responding');
				}

				status = 'ready';
				// Redirect back to modules settings after a short delay
				setTimeout(() => {
					window.location.href = '/ui/settings/modules';
				}, 1500);
			} else {
				throw new Error('Server not ready');
			}
		} catch (e) {
			retryCount++;
			if (retryCount < MAX_RETRIES) {
				status = 'checking';
				setTimeout(checkServer, 5000);
			} else {
				status = 'failed';
			}
		}
	}
</script>

<svelte:head>
	<title>System Restarting - MoLOS</title>
	<meta name="description" content="MoLOS is restarting. Please wait..." />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card class="w-full max-w-md border-primary/20 shadow-xl">
		<CardHeader class="">
			<div class="mb-4 flex justify-center">
				{#if status === 'restarting' || status === 'checking'}
					<div class="relative">
						<RefreshCw class="h-16 w-16 animate-spin text-primary opacity-20" />
						<Loader2
							class="absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin text-primary"
						/>
					</div>
				{:else if status === 'ready'}
					<CircleCheck class="h-16 w-16 animate-bounce text-primary" />
				{:else}
					<AlertCircle class="h-16 w-16 text-destructive" />
				{/if}
			</div>
			<CardTitle class="font-bold">
				{#if status === 'restarting'}
					System Restarting{dots}
				{:else if status === 'checking'}
					Verifying System{dots}
				{:else if status === 'ready'}
					System Ready!
				{:else}
					Restart Taking Longer Than Expected
				{/if}
			</CardTitle>
			<CardDescription class="mt-2">
				{#if status === 'restarting' || status === 'checking'}
					We're applying changes and initializing modules. This usually takes a few seconds.
				{:else if status === 'ready'}
					Everything is back online. Redirecting you now...
				{:else}
					The server is taking a while to come back. You might need to check the terminal or try
					refreshing manually.
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent class="flex flex-col items-center gap-4">
			{#if status === 'failed'}
				<Button variant="default" class="w-full" onclick={() => window.location.reload()}>
					Retry Connection
				</Button>
				<Button variant="outline" class="w-full" href="/ui/settings/modules">
					Back to Settings
				</Button>
			{:else}
				<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
					<div
						class="h-full bg-primary transition-all duration-500 ease-out"
						style="width: {Math.min((retryCount / MAX_RETRIES) * 100 + 10, 100)}%"
					></div>
				</div>
				<p class="text-muted-foreground text-xs">
					Attempt {retryCount} of {MAX_RETRIES}
				</p>
			{/if}
		</CardContent>
	</Card>
</div>

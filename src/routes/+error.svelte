<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Home, RefreshCw, AlertCircle } from 'lucide-svelte';
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card class="w-full max-w-md border-primary/20 shadow-xl">
		<CardHeader class="space-y-2">
			<div
				class="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
			>
				<AlertCircle class="h-10 w-10 text-primary" />
			</div>
			<CardTitle class="font-bold">
				{page.status}
			</CardTitle>
			<CardDescription class="font-medium">
				{#if page.status === 404}
					Page Not Found
				{:else}
					Something went wrong
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-6">
			<p class="text-muted-foreground">
				{#if page.status === 404}
					The page you are looking for doesn't exist or has been moved.
				{:else}
					{page.error?.message || 'An unexpected error occurred.'}
				{/if}
			</p>

			<div class="flex flex-col gap-3">
				<Button href="/ui/dashboard" size="lg" class="w-full">
					<Home class="mr-2 h-4 w-4" />
					Back to Dashboard
				</Button>
				<Button variant="outline" size="lg" class="w-full" onclick={() => window.location.reload()}>
					<RefreshCw class="mr-2 h-4 w-4" />
					Try Again
				</Button>
			</div>
		</CardContent>
	</Card>
</div>

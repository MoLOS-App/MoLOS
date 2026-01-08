<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Switch } from '$lib/components/ui/switch';
	import * as Avatar from '$lib/components/ui/avatar';
	import { ArrowLeft, Camera, Shield, Calendar, Trash2, LayoutGrid } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger
	} from '$lib/components/ui/alert-dialog';

	let { data } = $props();
	let loading = $state(false);
	let isSavingUi = $state(false);
	let deleteConfirmText = $state('');
	let isDeleteDialogOpen = $state(false);
	let requiredSentence = $state('');

	const sentences = [
		'HASTA LA VISTA',
		'USE THE FORCE',
		'MAKE MY DAY',
		'GO AHEAD',
		'YOU SHALL NOT',
		'I AM BACK',
		'RUN, FORREST!',
		'WHY SO SAD?',
		'TO INFINITY',
		'HERE IS JOHNNY',
		'BOND. JAMES',
		'SHAKEN, NOT',
		'THIS IS SPARTA',
		'I AM KING',
		'E.T. PHONE HOME',
		'MAY THE FORCE',
		'LET IT GO',
		'GAME OVER',
		'SHOW ME!',
		'ONE DOES NOT'
	];

	async function handleDeleteAccount() {
		if (deleteConfirmText !== requiredSentence) {
			toast.error(`Please type "${requiredSentence}" to confirm`);
			return;
		}

		try {
			await authClient.deleteUser();
			toast.success('Account deleted successfully');
			goto('/ui/login');
		} catch (err) {
			toast.error('Failed to delete account');
		}
	}
</script>

<div class="min-h-screen bg-background pb-20">
	<div class="mx-auto max-w-4xl space-y-8 p-6">
		<!-- Header -->
		<div class="space-y-4 pt-4">
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
				<h1 class="text-3xl font-black tracking-tighter">Profile</h1>
				<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
					Manage your identity
				</p>
			</div>
		</div>

		<Card class="overflow-hidden border-none shadow-sm">
			<CardContent class="space-y-10 p-8">
				<!-- Avatar Section -->
				<div class="flex flex-col items-center gap-4">
					<div class="group relative">
						<Avatar.Root class="h-24 w-24 border-4 border-background shadow-sm">
							<Avatar.Image src="" alt="Avatar" />
							<Avatar.Fallback class="bg-primary/10 text-3xl font-black text-primary">
								{data.user?.name?.[0]?.toUpperCase() || 'U'}
							</Avatar.Fallback>
						</Avatar.Root>
						<button
							class="absolute right-0 bottom-0 rounded-full border bg-background p-2 shadow-xs transition-colors hover:bg-muted"
						>
							<Camera class="text-muted-foreground h-3.5 w-3.5" />
						</button>
					</div>
				</div>

				<!-- Form Section -->
				<form
					method="POST"
					action="?/update"
					use:enhance={() => {
						loading = true;
						return async ({ result }) => {
							loading = false;
							if (result.type === 'success') {
								toast.success('Profile updated');
							} else {
								toast.error('Update failed');
							}
						};
					}}
					class="space-y-8"
				>
					<div class="space-y-6">
						<div class="space-y-2">
							<Label
								for="name"
								class="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase"
								>Display Name</Label
							>
							<Input
								id="name"
								name="name"
								value={data.user?.name}
								class="h-11 rounded-xl border-none bg-background/50 px-4 text-sm font-medium shadow-xs focus-visible:ring-1"
								required
							/>
						</div>

						<div class="space-y-2">
							<Label
								for="email"
								class="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase"
								>Email Address</Label
							>
							<Input
								id="email"
								name="email"
								type="email"
								value={data.user?.email}
								class="h-11 rounded-xl border-none bg-background/50 px-4 text-sm font-medium shadow-xs focus-visible:ring-1"
								required
							/>
						</div>
					</div>

					<Button
						type="submit"
						class="h-11 w-full rounded-xl font-bold shadow-xs"
						disabled={loading}
					>
						{#if loading}
							Saving...
						{:else}
							Save Changes
						{/if}
					</Button>
				</form>

				<!-- Meta Info -->
				<div class="border-muted-foreground/10 grid grid-cols-2 gap-8 border-t pt-8">
					<div class="space-y-1.5">
						<p class="text-muted-foreground text-[9px] font-black tracking-widest uppercase">
							Account Status
						</p>
						<div class="flex items-center gap-2">
							<Shield class="h-3.5 w-3.5 text-primary" />
							<span class="text-xs font-bold">Verified</span>
						</div>
					</div>
					<div class="space-y-1.5">
						<p class="text-muted-foreground text-[9px] font-black tracking-widest uppercase">
							Member Since
						</p>
						<div class="flex items-center gap-2">
							<Calendar class="h-3.5 w-3.5 text-primary" />
							<span class="text-xs font-bold">Dec 2025</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Danger Zone Section -->
		<Card class="overflow-hidden border-none shadow-sm">
			<CardContent class="p-6">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-xl bg-background p-2 text-destructive shadow-xs">
						<Trash2 class="h-4 w-4" />
					</div>
					<h2 class="text-lg font-bold text-destructive">Danger Zone</h2>
				</div>
				<div
					class="flex items-center justify-between rounded-2xl border border-destructive/10 bg-background/50 p-4"
				>
					<div class="space-y-0.5">
						<p class="text-sm font-bold">Delete Account</p>
						<p class="text-muted-foreground text-xs">
							Permanently remove your account and all data
						</p>
					</div>
					<AlertDialog
						open={isDeleteDialogOpen}
						onOpenChange={(open) => {
							isDeleteDialogOpen = open;
							if (open) {
								requiredSentence = sentences[Math.floor(Math.random() * sentences.length)];
								deleteConfirmText = '';
							}
						}}
					>
						<AlertDialogTrigger>
							<Button variant="destructive" size="sm" class="rounded-xl font-bold">
								Delete Account
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent class="rounded-3xl border-none shadow-2xl">
							<AlertDialogHeader>
								<AlertDialogTitle class="text-2xl font-black tracking-tight"
									>Are you absolutely sure?</AlertDialogTitle
								>
								<AlertDialogDescription class="text-muted-foreground text-sm font-medium">
									This action cannot be undone. This will permanently delete your account and remove
									your data from our servers.
									<div class="mt-4 space-y-2">
										<p class="text-xs font-bold tracking-widest text-foreground uppercase">
											Type <span class="text-destructive">{requiredSentence}</span> to confirm
										</p>
										<Input
											bind:value={deleteConfirmText}
											placeholder={requiredSentence}
											class="h-11 rounded-xl border-none bg-muted/20 px-4 text-sm font-medium shadow-xs focus-visible:ring-1"
										/>
									</div>
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter class="mt-6">
								<AlertDialogCancel class="border-muted-foreground/20 rounded-2xl font-bold"
									>Cancel</AlertDialogCancel
								>
								<AlertDialogAction
									class="rounded-2xl bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
									disabled={deleteConfirmText !== requiredSentence}
									onclick={handleDeleteAccount}
								>
									Confirm Deletion
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</CardContent>
		</Card>
	</div>
</div>

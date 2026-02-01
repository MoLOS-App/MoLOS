<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Download, FolderGit2, GitBranch, Info } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';

	let { isInstalling }: { isInstalling: boolean } = $props();
</script>

<Card class="overflow-hidden rounded-2xl border-none shadow-sm">
	<CardHeader class="pb-3">
		<div class="flex items-center gap-3">
			<div class="rounded-xl bg-background p-2 text-primary shadow-xs">
				<Download class="h-4 w-4" />
			</div>
			<div>
				<CardTitle class="font-bold">Install New Module</CardTitle>
				<CardDescription class="font-medium tracking-wider uppercase">
					Clone a module from GitHub, GitLab, or Bitbucket
				</CardDescription>
			</div>
		</div>
	</CardHeader>
	<CardContent>
		<form
			method="POST"
			action="?/install"
			class="space-y-3"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const resData = (result as any).data;
						toast.success(resData?.message || 'Module installed successfully');
						await update({ reset: true });
					} else if (result.type === 'redirect') {
						window.location.href = result.location;
					} else {
						const resData = result.type === 'failure' ? (result as any).data : null;
						toast.error(resData?.message || 'Failed to install module');
					}
				};
			}}
		>
			<div class="relative">
				<FolderGit2 class="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
				<Input
					name="repoUrl"
					placeholder="https://github.com/user/repo.git"
					class="h-9 w-full rounded-xl border-none bg-background/50 pl-9 pr-3 text-xs shadow-xs focus-visible:ring-1"
					required
					autocomplete="off"
					spellcheck="false"
				/>
			</div>
			<div class="flex gap-3">
				<div class="relative flex-1">
					<GitBranch class="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
					<Input
						name="gitRef"
						placeholder="main"
						class="h-9 w-full rounded-xl border-none bg-background/50 pl-9 text-xs shadow-xs focus-visible:ring-1"
						autocomplete="off"
						spellcheck="false"
					/>
				</div>
				<Button type="submit" disabled={isInstalling} class="h-9 rounded-xl px-6 text-xs font-bold">
					{isInstalling ? 'Cloning...' : 'Install'}
				</Button>
			</div>
		</form>
		<p class="text-muted-foreground/60 mt-3 flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase">
			<Info class="h-3 w-3" />
			Server restart required after installation
		</p>
	</CardContent>
</Card>

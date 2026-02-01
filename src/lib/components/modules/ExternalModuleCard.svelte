<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		LayoutGrid,
		GitBranch,
		CircleCheck,
		CircleX,
		Trash2,
		RefreshCw,
		Lock,
		Undo2
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import type { ModuleData, ExternalModuleActionHandlers, ModuleStatus } from './types';

	let {
		module,
		enabled,
		isLoading,
		onDelete,
		onCancel,
		onForcePull,
		onToggleEnabled,
		onChangeGitRef
	}: {
		module: ModuleData;
		enabled: boolean;
		isLoading?: {
			forcePull?: boolean;
			deleting?: boolean;
			cancelling?: boolean;
			togglingBlock?: boolean;
		};
	} & Omit<ExternalModuleActionHandlers, 'onToggleBlockUpdates'> = $props();

	const isLocalModule = $derived(module.isExternal && module.repoUrl?.startsWith?.('local://'));
	const status = $derived(module.status as ModuleStatus);
	const isDeleting = $derived(status === 'deleting');
	const hasError = $derived(status.startsWith('error_'));
</script>

<Card
	class="overflow-hidden rounded-2xl border-none shadow-sm transition-all duration-200 {status ===
		'pending' || isDeleting
		? 'opacity-50'
		: ''} {!enabled
		? 'opacity-60 grayscale'
		: ''}"
>
	<CardHeader class="flex flex-row items-start justify-between pb-3 space-y-0">
		<div class="flex items-start gap-4">
			<div class="rounded-xl bg-background p-2.5 text-primary shadow-xs">
				<LayoutGrid class="w-4 h-4" />
			</div>
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<CardTitle class="font-bold">{module.name}</CardTitle>
					{#if !isLocalModule}
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Badge
									variant="secondary"
									class="h-5 cursor-pointer gap-1 px-2 text-[8px] font-black tracking-wider uppercase hover:bg-primary/10"
									onclick={() => onChangeGitRef?.(module.id, module.name, module.gitRef || 'main')}
								>
									<GitBranch class="h-2.5 w-2.5" />
									{module.gitRef || 'main'}
								</Badge>
							</Tooltip.Trigger>
							<Tooltip.Content side="top" class="text-[10px] font-bold tracking-widest uppercase">
								Click to change git ref (tag/branch)
							</Tooltip.Content>
						</Tooltip.Root>
					{:else}
						<Badge variant="outline" class="h-5 px-2 text-[8px] font-black tracking-wider uppercase">
							Local
						</Badge>
					{/if}
					{#if status === 'active'}
						<CircleCheck class="h-3.5 w-3.5 text-primary" />
					{:else if status === 'pending'}
						<RefreshCw class="h-3.5 w-3.5 animate-spin text-accent" />
						<Badge variant="outline" class="h-4 border-accent/20 bg-accent/10 px-1.5 text-[8px] font-black tracking-widest text-accent uppercase">Pending</Badge>
					{:else if isDeleting}
						<Trash2 class="h-3.5 w-3.5 text-destructive" />
						<Badge variant="destructive" class="h-4 border-destructive/20 bg-destructive/10 px-1.5 text-[8px] font-black tracking-widest text-destructive uppercase">Deleting</Badge>
					{:else if hasError}
						<CircleX class="h-3.5 w-3.5 text-destructive" />
					{/if}
				</div>
				<CardDescription class="text-[10px] font-medium tracking-wider uppercase">
					{module.description || 'External module.'}
				</CardDescription>
				{#if hasError && module.lastError}
					<div class="mt-2 flex items-start gap-2 rounded-lg border border-destructive/10 bg-destructive/5 p-2 text-[9px] text-destructive">
						<span>{module.lastError}</span>
					</div>
				{/if}
			</div>
		</div>
	</CardHeader>

	<!-- Actions Section -->
	<CardContent class="pt-0 space-y-3">
		<div class="flex flex-wrap items-center gap-2">
			<!-- Module Status Badge -->
			<div class="flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 shadow-xs">
				<div
					class="h-2 w-2 rounded-full {status === 'active'
						? 'bg-primary'
						: status === 'pending'
							? 'bg-accent animate-pulse'
							: hasError
								? 'bg-destructive'
								: 'bg-muted-foreground'}"
				></div>
				<span
					class="text-[10px] font-bold tracking-wider uppercase {status ===
					'active'
						? 'text-primary'
						: hasError
							? 'text-destructive'
							: 'text-muted-foreground'}"
				>
					{status === 'active' ? 'Running' : status}
				</span>
			</div>

			<Separator orientation="vertical" class="h-6" />

			{#if !isLocalModule}
				<!-- Git Operations -->
				<div class="flex items-center gap-2">
					<!-- Force Pull -->
					{#if status === 'active'}
						<Button
							variant="outline"
							size="sm"
							type="button"
							class="h-8 rounded-lg px-3 text-[10px] font-bold tracking-wider uppercase"
							disabled={isLoading?.forcePull}
							onclick={() => onForcePull?.(module.id)}
						>
							<RefreshCw class="mr-1.5 h-3 w-3 {isLoading?.forcePull ? 'animate-spin' : ''}" />
							{isLoading?.forcePull ? 'Pulling...' : 'Pull'}
						</Button>
					{/if}

					<!-- Block Updates Toggle -->
					<form
						method="POST"
						action="?/toggleBlockUpdates"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									const resData = (result as any).data;
									toast.success(resData?.message || 'Block updates updated successfully');
									await update({ reset: true });
								} else if (result.type === 'redirect') {
									window.location.href = result.location;
								} else {
									toast.error('Failed to update block updates');
								}
							};
						}}
					>
						<input type="hidden" name="moduleId" value={module.id} />
						<input type="hidden" name="blockUpdates" value={(!module.blockUpdates).toString()} />
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									variant="outline"
									size="sm"
									type="submit"
									class="h-8 rounded-lg px-3 text-[10px] font-bold tracking-wider uppercase"
									disabled={isLoading?.togglingBlock}
								>
									<Lock class="mr-1.5 h-3 w-3" />
									{isLoading?.togglingBlock ? '...' : module.blockUpdates ? 'Unblock' : 'Block'}
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content side="top" class="text-[10px] font-bold tracking-widest uppercase">
								{module.blockUpdates
									? 'Click to unblock - sync will pull updates'
									: 'Click to block - sync will skip updates'}
							</Tooltip.Content>
						</Tooltip.Root>
					</form>
				</div>

				<Separator orientation="vertical" class="h-6" />
			{/if}

			<!-- Delete/Cancel Action -->
			{#if !isDeleting}
				<form
					method="POST"
					action="?/delete"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								const resData = (result as any).data;
								toast.success(resData?.message || 'Module marked for deletion');
								await update({ reset: true });
							} else if (result.type === 'redirect') {
								window.location.href = result.location;
							} else {
								toast.error('Failed to delete module');
							}
						};
					}}
				>
					<input type="hidden" name="moduleId" value={module.id} />
					<Button
						variant="ghost"
						size="sm"
						type="submit"
						class="h-8 rounded-lg px-3 text-[10px] font-bold tracking-wider uppercase text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={isLoading?.deleting}
					>
						<Trash2 class="mr-1.5 h-3 w-3 {isLoading?.deleting ? 'animate-pulse' : ''}" />
						{isLoading?.deleting ? 'Deleting...' : 'Delete'}
					</Button>
				</form>
			{:else}
				<form
					method="POST"
					action="?/cancel"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === 'success') {
								const resData = (result as any).data;
								toast.success(resData?.message || 'Action cancelled');
								await update({ reset: true });
							} else {
								toast.error('Failed to cancel action');
							}
						};
					}}
				>
					<input type="hidden" name="moduleId" value={module.id} />
					<Button
						variant="outline"
						size="sm"
						type="submit"
						class="h-8 rounded-lg border-accent/50 px-3 text-[10px] font-bold tracking-wider uppercase text-accent hover:bg-accent/10"
						disabled={isLoading?.cancelling}
					>
						<Undo2 class="mr-1.5 h-3 w-3 {isLoading?.cancelling ? 'animate-spin' : ''}" />
						{isLoading?.cancelling ? 'Cancelling...' : 'Cancel'}
					</Button>
				</form>
			{/if}
		</div>
	</CardContent>
</Card>

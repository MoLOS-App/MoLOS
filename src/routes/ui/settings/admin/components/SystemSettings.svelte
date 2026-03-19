<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Settings, Trash2, Save, CheckCircle2, Plus } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils';

	type Props = {
		systemSettings: SystemSetting[];
		onUpdateSetting: (key: string, value: string, description?: string) => void;
		onDeleteSetting: (key: string) => void;
	};

	type SystemSetting = {
		key: string;
		value: string;
		description?: string | null;
		updatedAt?: Date;
	};

	let { systemSettings, onUpdateSetting, onDeleteSetting }: Props = $props();

	let newSettingKey = $state('');
	let newSettingValue = $state('');
	let newSettingDescription = $state('');
	let isAddingSetting = $state(false);

	async function handleAddSystemSetting() {
		if (!newSettingKey || newSettingValue === '') {
			toast.error('Key and value are required');
			return;
		}
		await onUpdateSetting(newSettingKey, newSettingValue, newSettingDescription);
		newSettingKey = '';
		newSettingValue = '';
		newSettingDescription = '';
		isAddingSetting = false;
	}

	function getToggleValue(key: string): boolean {
		const setting = systemSettings.find((s) => s.key === key);
		return setting?.value === 'true';
	}
</script>

<div class="grid gap-6 md:grid-cols-2">
	<Card class="border-none shadow-sm">
		<CardHeader>
			<CardTitle class="font-bold">System Configuration</CardTitle>
			<CardDescription class="font-medium tracking-wider uppercase"
				>Global application parameters and flags</CardDescription
			>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if isAddingSetting}
				<div class="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-background/50 p-4">
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-black tracking-widest text-primary uppercase"
							>New Setting</span
						>
						<div class="flex gap-1">
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 rounded-lg"
								onclick={() => (isAddingSetting = false)}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 rounded-lg text-primary"
								onclick={handleAddSystemSetting}
							>
								<CheckCircle2 class="h-4 w-4" />
							</Button>
						</div>
					</div>
					<Input
						placeholder="Key (e.g. REGISTRATION_ALLOWED)"
						bind:value={newSettingKey}
						class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
					/>
					<Input
						placeholder="Value"
						bind:value={newSettingValue}
						class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
					/>
					<Input
						placeholder="Description (optional)"
						bind:value={newSettingDescription}
						class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
					/>
				</div>
			{/if}

			{#each systemSettings as setting, i (setting.key)}
				<div
					class="border-muted-foreground/5 flex flex-col gap-2 rounded-2xl border bg-background/50 p-4"
				>
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground text-[10px] font-black tracking-widest uppercase"
							>{setting.key}</span
						>
						<div class="flex gap-1">
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 rounded-lg hover:text-destructive"
								onclick={() => onDeleteSetting(setting.key)}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 rounded-lg hover:text-primary"
								onclick={() =>
									onUpdateSetting(
										setting.key,
										systemSettings[i].value,
										setting.description || undefined
									)}
							>
								<Save class="h-4 w-4" />
							</Button>
						</div>
					</div>
					<Input
						bind:value={systemSettings[i].value}
						class="h-9 rounded-xl border-none bg-background/50 text-xs shadow-xs"
					/>
					{#if setting.description}
						<p class="text-muted-foreground text-[10px] font-medium">{setting.description}</p>
					{/if}
				</div>
			{:else}
				{#if !isAddingSetting}
					<div class="flex flex-col items-center justify-center py-12 space-y-3 text-center">
						<div class="p-4 rounded-full shadow-xs bg-background">
							<Settings class="w-8 h-8 text-muted-foreground/50" />
						</div>
						<div>
							<p class="text-sm font-bold">No system settings found</p>
							<p class="text-xs text-muted-foreground">
								Add global configuration keys to manage system behavior.
							</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							class="text-xs font-bold rounded-xl"
							onclick={() => (isAddingSetting = true)}
						>
							<Plus class="w-4 h-4 mr-2" />
							Add Setting
						</Button>
					</div>
				{/if}
			{/each}

			{#if systemSettings.length > 0 && !isAddingSetting}
				<Button
					variant="outline"
					size="sm"
					class="border-muted-foreground/20 w-full rounded-xl border-dashed text-xs font-bold"
					onclick={() => (isAddingSetting = true)}
				>
					<Plus class="mr-2 h-4 w-4" />
					Add New Setting
				</Button>
			{/if}
		</CardContent>
	</Card>

	<Card class="border-none shadow-sm">
		<CardHeader>
			<CardTitle class="font-bold">Security & Access</CardTitle>
			<CardDescription class="font-medium tracking-wider uppercase"
				>Manage authentication and security policies</CardDescription
			>
		</CardHeader>
		<CardContent class="space-y-6">
			{@const publicReg = systemSettings.find((s) => s.key === 'PUBLIC_REGISTRATION')}
			<div
				class="border-muted-foreground/5 flex items-center justify-between rounded-2xl border bg-background/50 p-4"
			>
				<div class="space-y-0.5">
					<p class="text-sm font-bold">Public Registration</p>
					<p class="text-muted-foreground text-xs">Allow new users to create accounts</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class={cn(
						'rounded-xl text-[10px] font-bold tracking-widest uppercase',
						publicReg?.value === 'true'
							? 'bg-primary/10 text-primary'
							: 'bg-destructive/10 text-destructive'
					)}
					onclick={() =>
						onUpdateSetting(
							'PUBLIC_REGISTRATION',
							publicReg?.value === 'true' ? 'false' : 'true',
							'Allow new users to create accounts'
						)}
				>
					{publicReg?.value === 'true' ? 'Enabled' : 'Disabled'}
				</Button>
			</div>

			{@const emailVer = systemSettings.find((s) => s.key === 'EMAIL_VERIFICATION')}
			<div
				class="border-muted-foreground/5 flex items-center justify-between rounded-2xl border bg-background/50 p-4"
			>
				<div class="space-y-0.5">
					<p class="text-sm font-bold">Email Verification</p>
					<p class="text-muted-foreground text-xs">Require email confirmation for new users</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class={cn(
						'rounded-xl text-[10px] font-bold tracking-widest uppercase',
						emailVer?.value === 'true' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
					)}
					onclick={() =>
						onUpdateSetting(
							'EMAIL_VERIFICATION',
							emailVer?.value === 'true' ? 'false' : 'true',
							'Require email confirmation for new users'
						)}
				>
					{emailVer?.value === 'true' ? 'Required' : 'Optional'}
				</Button>
			</div>

			{@const apiKeyAcc = systemSettings.find((s) => s.key === 'API_KEY_ACCESS')}
			<div
				class="border-muted-foreground/5 flex items-center justify-between rounded-2xl border bg-background/50 p-4"
			>
				<div class="space-y-0.5">
					<p class="text-sm font-bold">API Key Access</p>
					<p class="text-muted-foreground text-xs">Allow users to generate and use API keys</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					class={cn(
						'rounded-xl text-[10px] font-bold tracking-widest uppercase',
						apiKeyAcc?.value === 'true'
							? 'bg-primary/10 text-primary'
							: 'bg-destructive/10 text-destructive'
					)}
					onclick={() =>
						onUpdateSetting(
							'API_KEY_ACCESS',
							apiKeyAcc?.value === 'true' ? 'false' : 'true',
							'Allow users to generate and use API keys'
						)}
				>
					{apiKeyAcc?.value === 'true' ? 'Enabled' : 'Disabled'}
				</Button>
			</div>
		</CardContent>
	</Card>
</div>

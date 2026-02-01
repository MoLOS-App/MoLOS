<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Box, FolderGit2, Search } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';

	let { activeTab, builtInCount, externalCount, allowUserInstallPlugins, searchQuery, onTabChange, onSearchChange }: {
		activeTab: 'builtin' | 'external';
		builtInCount: number;
		externalCount: number;
		allowUserInstallPlugins: boolean;
		searchQuery: string;
		onTabChange: (tab: 'builtin' | 'external') => void;
		onSearchChange: (query: string) => void;
	} = $props();
</script>

<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
	<div class="flex w-fit rounded-xl bg-muted/20 p-1">
		<Button
			variant={activeTab === 'builtin' ? 'secondary' : 'ghost'}
			size="sm"
			class="rounded-lg text-[10px] font-bold tracking-wider uppercase {activeTab ===
			'builtin'
				? 'bg-background shadow-xs'
				: ''}"
			onclick={() => onTabChange('builtin')}
		>
			<Box class="mr-2 h-3.5 w-3.5" />
			Manage
			{#if builtInCount > 0}
				<Badge variant="secondary" class="ml-2 h-4 px-1.5 text-[9px]">{builtInCount}</Badge>
			{/if}
		</Button>
		{#if allowUserInstallPlugins}
			<Button
				variant={activeTab === 'external' ? 'secondary' : 'ghost'}
				size="sm"
				class="rounded-lg text-[10px] font-bold tracking-wider uppercase {activeTab ===
				'external'
					? 'bg-background shadow-xs'
					: ''}"
				onclick={() => onTabChange('external')}
			>
				<FolderGit2 class="mr-2 h-3.5 w-3.5" />
				Install
				{#if externalCount > 0}
					<Badge variant="secondary" class="ml-2 h-4 px-1.5 text-[9px]">{externalCount}</Badge>
				{/if}
			</Button>
		{/if}
	</div>

	<div class="relative w-full md:w-64">
		<Search class="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
		<Input
			placeholder="Search modules..."
			class="h-9 rounded-xl border-none bg-muted/10 pl-9 text-xs shadow-xs focus-visible:ring-1"
			value={searchQuery}
			oninput={(e) => onSearchChange(e.currentTarget.value)}
			autocomplete="off"
			spellcheck="false"
		/>
	</div>
</div>

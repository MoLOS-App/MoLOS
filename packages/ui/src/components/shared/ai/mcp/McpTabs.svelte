<script lang="ts">
	import { Server, Key, ScrollText, List, Activity, Shield } from 'lucide-svelte';

	export type TabId = 'dashboard' | 'keys' | 'resources' | 'prompts' | 'logs' | 'oauth';

	interface Tab {
		id: TabId;
		label: string;
		icon: typeof Server;
	}

	let { activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void } =
		$props();

	const tabs: Tab[] = [
		{ id: 'dashboard', label: 'Dashboard', icon: Server },
		{ id: 'keys', label: 'API Keys', icon: Key },
		{ id: 'oauth', label: 'OAuth Apps', icon: Shield },
		{ id: 'resources', label: 'Resources', icon: ScrollText },
		{ id: 'prompts', label: 'Prompts', icon: List },
		{ id: 'logs', label: 'Activity Logs', icon: Activity }
	];
</script>

<div class="overflow-x-auto border-b border-border">
	<nav class="flex min-w-max gap-1">
		{#each tabs as tab (tab.id)}
			{@const Icon = tab.icon}
			{@const isActive = activeTab === tab.id}
			<button
				onclick={() => onTabChange(tab.id)}
				class="focus-visible:ring-ring flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-all duration-200 focus-visible:ring-2 focus-visible:outline-none"
				class:border-primary={isActive}
				class:border-transparent={!isActive}
				class:text-foreground={isActive}
				class:text-muted-foreground={!isActive}
				class:hover:bg-accent={!isActive}
				class:hover:text-foreground={!isActive}
			>
				<Icon class="h-4 w-4" />
				<span class="text-sm font-medium">{tab.label}</span>
			</button>
		{/each}
	</nav>
</div>

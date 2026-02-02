<script lang="ts">
	import { Server, Key, ScrollText, List, Activity } from 'lucide-svelte';

	export type TabId = 'dashboard' | 'keys' | 'resources' | 'prompts' | 'logs';

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
		{ id: 'resources', label: 'Resources', icon: ScrollText },
		{ id: 'prompts', label: 'Prompts', icon: List },
		{ id: 'logs', label: 'Activity Logs', icon: Activity }
	];
</script>

<div class="border-b border-border">
	<nav class="flex gap-1">
		{#each tabs as tab (tab.id)}
			{@const Icon = tab.icon}
			<button
				onclick={() => onTabChange(tab.id)}
				class="flex items-center gap-2 px-4 py-3 border-b-2 transition-colors"
				class:border-primary={activeTab === tab.id}
				class:border-transparent={activeTab !== tab.id}
				class:text-foreground={activeTab === tab.id}
				class:text-muted-foreground={activeTab !== tab.id}
				class:hover:text-foreground={activeTab !== tab.id}
			>
				<Icon class="w-4 h-4" />
				<span class="text-sm font-medium">{tab.label}</span>
			</button>
		{/each}
	</nav>
</div>

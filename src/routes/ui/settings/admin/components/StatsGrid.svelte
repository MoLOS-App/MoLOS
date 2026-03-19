<script lang="ts">
	import StatsCard from './StatsCard.svelte';
	import { Users, Activity, Key, Package } from 'lucide-svelte';

	type Props = {
		totalUsers: number;
		activeSessionsCount: number;
		totalApiKeys: number;
		externalModulesCount: number;
	};

	let { totalUsers, activeSessionsCount, totalApiKeys, externalModulesCount }: Props = $props();
</script>

<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
	<StatsCard title="Total Users" value={totalUsers}>
		{#snippet icon()}
			<Users />
		{/snippet}
	</StatsCard>
	<StatsCard title="Active Sessions" value={activeSessionsCount}>
		{#snippet icon()}
			<Activity />
		{/snippet}
	</StatsCard>
	<StatsCard title="API Keys" value={totalApiKeys}>
		{#snippet icon()}
			<Key />
		{/snippet}
	</StatsCard>
	<StatsCard title="Ext. Modules" value={externalModulesCount}>
		{#snippet icon()}
			<Package />
		{/snippet}
	</StatsCard>
</div>

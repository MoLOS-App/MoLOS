<script lang="ts">
	import { McpResourcesTable } from './index';

	export interface ResourcesManagerData {
		resources: any[];
		availableModules: { id: string; name: string }[];
	}

	let { data, onShowHelp }: { data: ResourcesManagerData; onShowHelp?: () => void } = $props();

	// Dialog states
	let showCreateResourceDialog = $state(false);
	let showEditResourceDialog = $state(false);
	let editingResource = $state<any>(null);

	// Refresh function
	let refreshData = $state(() => {});

	export function setRefresh(fn: () => void) {
		refreshData = fn;
	}

	// Resource handlers
	async function createResource(formData: any) {
		const response = await fetch('/api/ai/mcp/resources', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showCreateResourceDialog = false;
			await refreshData();
		}
	}

	async function updateResource(resourceId: string, formData: any) {
		const response = await fetch(`/api/ai/mcp/resources/${resourceId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditResourceDialog = false;
			editingResource = null;
			await refreshData();
		}
	}

	function openEditResource(resourceId: string) {
		const resource = data.resources.find((r) => r.id === resourceId);
		if (resource) {
			editingResource = resource;
			showEditResourceDialog = true;
		}
	}

	function confirmDeleteResource(resourceId: string) {
		alert('Delete resource: ' + resourceId);
	}

	async function deleteResource(resourceId: string) {
		const response = await fetch(`/api/ai/mcp/resources/${resourceId}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			await refreshData();
		}
	}
</script>

<div class="space-y-6">
	<McpResourcesTable
		resources={data.resources}
		availableModules={data.availableModules}
		onCreateResource={() => (showCreateResourceDialog = true)}
		onEditResource={openEditResource}
		onDeleteResource={confirmDeleteResource}
		{onShowHelp}
	/>
</div>

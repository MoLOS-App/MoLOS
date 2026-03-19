<script lang="ts">
	import {
		McpApiKeyTable,
		McpCreateKeyDialog,
		McpEditKeyDialog,
		McpKeySecretDialog,
		type ApiKey
	} from './index';

	export interface KeysManagerData {
		keys: ApiKey[];
		availableModules: { id: string; name: string }[];
		apiKeyOptions: ApiKey[];
	}

	let { data, onShowHelp }: { data: KeysManagerData; onShowHelp?: () => void } = $props();

	// Dialog states
	let showCreateKeyDialog = $state(false);
	let showEditKeyDialog = $state(false);
	let showKeySecret = $state(false);
	let createdKeySecret = $state('');
	let editingKey = $state<ApiKey | null>(null);

	// Refresh function
	let refreshData = $state(() => {});

	export function setRefresh(fn: () => void) {
		refreshData = fn;
	}

	// Key handlers
	async function createApiKey(formData: {
		name: string;
		allowedScopes: string[] | null;
		expiresAt: string | null;
	}) {
		const response = await fetch('/api/ai/mcp/keys', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			const result = await response.json();
			createdKeySecret = result.fullKey;
			showCreateKeyDialog = false;
			showKeySecret = true;
		}
	}

	function confirmRevokeKey(keyId: string) {
		// Use parent's delete confirmation
		alert('Revoke key: ' + keyId);
	}

	function viewKeyDetails(keyId: string) {
		window.location.href = `/ui/ai/mcp/keys/${keyId}`;
	}

	async function closeKeySecret() {
		showKeySecret = false;
		createdKeySecret = '';
		await refreshData();
	}

	async function updateApiKey(
		keyId: string,
		formData: {
			name: string;
			allowedScopes: string[] | null;
			expiresAt: string | null;
		}
	) {
		const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(formData)
		});

		if (response.ok) {
			showEditKeyDialog = false;
			editingKey = null;
			await refreshData();
		}
	}

	async function toggleKeyStatus(keyId: string, newStatus: 'active' | 'disabled') {
		const response = await fetch(`/api/ai/mcp/keys/${keyId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: newStatus })
		});

		if (response.ok) {
			showEditKeyDialog = false;
			editingKey = null;
			await refreshData();
		}
	}

	function openEditKey(keyId: string) {
		const key = data.keys.find((k) => k.id === keyId);
		if (key) {
			editingKey = key;
			showEditKeyDialog = true;
		}
	}
</script>

<div class="space-y-6">
	<McpApiKeyTable
		keys={data.keys}
		availableModules={data.availableModules}
		onCreateKey={() => (showCreateKeyDialog = true)}
		onEditKey={openEditKey}
		onViewDetails={viewKeyDetails}
		onRevokeKey={confirmRevokeKey}
		{onShowHelp}
	/>

	<!-- Create Auth Key Dialog -->
	<McpCreateKeyDialog
		open={showCreateKeyDialog}
		onOpenChange={(open) => (showCreateKeyDialog = open)}
		availableModules={data.availableModules}
		onCreate={createApiKey}
	/>

	<!-- Edit Auth Key Dialog -->
	<McpEditKeyDialog
		open={showEditKeyDialog}
		onOpenChange={(open) => (showEditKeyDialog = open)}
		availableModules={data.availableModules}
		apiKey={editingKey}
		onUpdate={updateApiKey}
		onToggleStatus={toggleKeyStatus}
	/>

	<!-- Key Secret Display Dialog -->
	<McpKeySecretDialog
		open={showKeySecret}
		onOpenChange={(open) => (showKeySecret = open)}
		keySecret={createdKeySecret}
		onClose={closeKeySecret}
	/>
</div>

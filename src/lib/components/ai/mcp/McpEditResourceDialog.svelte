<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ScrollText } from 'lucide-svelte';

	interface Module {
		id: string;
		name: string;
	}

	interface Resource {
		id: string;
		name: string;
		description: string;
		uri: string;
		moduleId: string | null;
		enabled: boolean;
	}

	let {
		open,
		onOpenChange,
		availableModules = [],
		resource,
		onUpdate
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		availableModules: Module[];
		resource: Resource | null;
		onUpdate: (id: string, data: {
			name: string;
			description: string;
			uri: string;
			moduleId: string | null;
			enabled: boolean;
		}) => void | Promise<void>;
	} = $props();

	let name = $state('');
	let description = $state('');
	let uri = $state('');
	let selectedModule = $state<string>('__global__');
	let enabled = $state(true);

	// Populate form when resource changes
	$effect(() => {
		if (resource) {
			name = resource.name;
			description = resource.description;
			uri = resource.uri;
			selectedModule = resource.moduleId ?? '__global__';
			enabled = resource.enabled;
		}
	});

	async function handleSubmit() {
		if (!resource || !name.trim() || !uri.trim()) return;

		await onUpdate(resource.id, {
			name: name.trim(),
			description: description.trim(),
			uri: uri.trim(),
			moduleId: selectedModule === '__global__' ? null : selectedModule,
			enabled
		});

		onOpenChange(false);
	}

	function getSelectedModuleName(): string {
		if (selectedModule === '__global__') return 'Global (all modules)';
		const module = availableModules.find((m) => m.id === selectedModule);
		return module?.name || 'Select a module';
	}

	const isValid = $derived(name.trim() !== '' && uri.trim() !== '');
</script>

<Dialog {open} onOpenChange={onOpenChange}>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<ScrollText class="w-5 h-5" />
				Edit Resource
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={(e) => e.preventDefault()} class="space-y-4 py-4">
			<!-- Name -->
			<div class="space-y-2">
				<Label for="resource-name">
					Name <span class="text-destructive">*</span>
				</Label>
				<Input
					id="resource-name"
					bind:value={name}
					placeholder="e.g., User Profile"
					autocomplete="off"
				/>
			</div>

			<!-- Description -->
			<div class="space-y-2">
				<Label for="resource-description">Description</Label>
				<Textarea
					id="resource-description"
					bind:value={description}
					placeholder="Describe what this resource provides..."
					rows="2"
				/>
			</div>

			<!-- URI -->
			<div class="space-y-2">
				<Label for="resource-uri">
					URI <span class="text-destructive">*</span>
				</Label>
				<Input
					id="resource-uri"
					bind:value={uri}
					placeholder="e.g., config://user/profile"
					autocomplete="off"
				/>
				<p class="text-xs text-muted-foreground">
					The unique URI identifier for this resource
				</p>
			</div>

			<!-- Module -->
			<div class="space-y-2">
				<Label for="module-select">Module</Label>
				<Select bind:value={selectedModule}>
					<SelectTrigger id="module-select">
						{getSelectedModuleName()}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__global__">Global (all modules)</SelectItem>
						{#each availableModules as module}
							<SelectItem value={module.id}>{module.name}</SelectItem>
						{/each}
					</SelectContent>
				</Select>
				<p class="text-xs text-muted-foreground">
					Leave as "Global" to make this resource available to all modules
				</p>
			</div>

			<!-- Enabled -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label for="resource-enabled">Enabled</Label>
					<p class="text-xs text-muted-foreground">
						Resource will be available when checked
					</p>
				</div>
				<Checkbox id="resource-enabled" bind:checked={enabled} />
			</div>
		</form>

		<DialogFooter>
			<Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
			<Button onclick={handleSubmit} disabled={!isValid}>
				Save Changes
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

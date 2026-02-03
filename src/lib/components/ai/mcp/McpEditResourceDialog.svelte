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
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { ScrollText, Globe, FileCode } from 'lucide-svelte';

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
		resourceType: 'static' | 'url';
		url: string | null;
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
		onUpdate: (
			id: string,
			data: {
				name: string;
				description: string;
				uri: string;
				moduleId: string | null;
				resourceType: 'static' | 'url';
				url: string | null;
				enabled: boolean;
			}
		) => void | Promise<void>;
	} = $props();

	let name = $state('');
	let description = $state('');
	let uri = $state('');
	let resourceType = $state<'static' | 'url'>('static');
	let url = $state('');
	let selectedModule = $state<string>('__global__');
	let enabled = $state(true);
	let rows = 2;

	// Populate form when resource changes
	$effect(() => {
		if (resource) {
			name = resource.name;
			description = resource.description;
			uri = resource.uri;
			resourceType = resource.resourceType ?? 'static';
			url = resource.url ?? '';
			selectedModule = resource.moduleId ?? '__global__';
			enabled = resource.enabled;
		}
	});

	async function handleSubmit() {
		if (!resource || !name.trim()) return;
		if (resourceType === 'static' && !uri.trim()) return;
		if (resourceType === 'url' && !url.trim()) return;

		await onUpdate(resource.id, {
			name: name.trim(),
			description: description.trim(),
			uri: resourceType === 'static' ? uri.trim() : `url://${url.trim()}`,
			moduleId: selectedModule === '__global__' ? null : selectedModule,
			resourceType,
			url: resourceType === 'url' ? url.trim() : null,
			enabled
		});

		onOpenChange(false);
	}

	function getSelectedModuleName(): string {
		if (selectedModule === '__global__') return 'Global (all modules)';
		const module = availableModules.find((m) => m.id === selectedModule);
		return module?.name || 'Select a module';
	}

	const isValid = $derived(
		name.trim() !== '' &&
			(resourceType === 'static' ? uri.trim() !== '' : resourceType === 'url' && url.trim() !== '')
	);
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="sm:max-w-lg">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<ScrollText class="h-5 w-5" />
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
					{rows}
				/>
			</div>

			<!-- Resource Type -->
			<div class="space-y-2">
				<Label>Resource Type</Label>
				<RadioGroup bind:value={resourceType} class="flex gap-4">
					<div class="flex items-center gap-2">
						<RadioGroupItem value="static" id="type-static" />
						<Label for="type-static" class="flex cursor-pointer items-center gap-2">
							<FileCode class="h-4 w-4" />
							<span>Static</span>
						</Label>
					</div>
					<div class="flex items-center gap-2">
						<RadioGroupItem value="url" id="type-url" />
						<Label for="type-url" class="flex cursor-pointer items-center gap-2">
							<Globe class="h-4 w-4" />
							<span>URL</span>
						</Label>
					</div>
				</RadioGroup>
				<p class="text-muted-foreground text-xs">
					{resourceType === 'static'
						? 'Static resources return predefined content. Use for configuration and static data.'
						: 'URL resources fetch content from an HTTP/HTTPS URL on demand.'}
				</p>
			</div>

			<!-- URI (only for Static type) -->
			{#if resourceType === 'static'}
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
					<p class="text-muted-foreground text-xs">
						The unique URI identifier for this resource (e.g., config://app/settings)
					</p>
				</div>
			{/if}

			<!-- URL (only for URL type) -->
			{#if resourceType === 'url'}
				<div class="space-y-2">
					<Label for="resource-url">
						Content URL <span class="text-destructive">*</span>
					</Label>
					<Input
						id="resource-url"
						bind:value={url}
						placeholder="https://example.com/data.json"
						autocomplete="off"
					/>
					<p class="text-muted-foreground text-xs">
						The HTTP/HTTPS URL to fetch content from. The content will be served when the resource
						is read.
					</p>
				</div>
			{/if}

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
				<p class="text-muted-foreground text-xs">
					Leave as "Global" to make this resource available to all modules
				</p>
			</div>

			<!-- Enabled -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label for="resource-enabled">Enabled</Label>
					<p class="text-muted-foreground text-xs">Resource will be available when checked</p>
				</div>
				<Checkbox id="resource-enabled" bind:checked={enabled} />
			</div>
		</form>

		<DialogFooter>
			<Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
			<Button onclick={handleSubmit} disabled={!isValid}>Save Changes</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

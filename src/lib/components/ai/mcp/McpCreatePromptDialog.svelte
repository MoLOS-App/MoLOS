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
	import { List, Plus, Trash2 } from 'lucide-svelte';

	interface Module {
		id: string;
		name: string;
	}

	interface PromptArgument {
		name: string;
		description: string;
		required: boolean;
		type: string;
	}

	let {
		open,
		onOpenChange,
		availableModules = [],
		onCreate
	}: {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		availableModules: Module[];
		onCreate: (data: {
			name: string;
			description: string;
			arguments: PromptArgument[];
			moduleId: string | null;
			enabled: boolean;
		}) => void | Promise<void>;
	} = $props();

	let name = $state('');
	let description = $state('');
	let selectedModule = $state<string>('__global__');
	let enabled = $state(true);
	let promptArguments = $state<PromptArgument[]>([
		{ name: '', description: '', required: false, type: 'string' }
	]);

	const argumentTypes = ['string', 'number', 'boolean', 'object', 'array'];

	async function handleSubmit() {
		if (!name.trim()) return;

		// Filter out empty arguments
		const validArguments = promptArguments.filter((arg) => arg.name.trim() !== '');

		await onCreate({
			name: name.trim(),
			description: description.trim(),
			arguments: validArguments,
			moduleId: selectedModule === '__global__' ? null : selectedModule,
			enabled
		});

		// Reset form
		name = '';
		description = '';
		selectedModule = '__global__';
		enabled = true;
		promptArguments = [{ name: '', description: '', required: false, type: 'string' }];
	}

	function addArgument() {
		promptArguments = [...promptArguments, { name: '', description: '', required: false, type: 'string' }];
	}

	function removeArgument(index: number) {
		if (promptArguments.length > 1) {
			promptArguments = promptArguments.filter((_, i) => i !== index);
		}
	}

	function updateArgument(index: number, field: keyof PromptArgument, value: string | boolean) {
		promptArguments = promptArguments.map((arg, i) => (i === index ? { ...arg, [field]: value } : arg));
	}

	function getSelectedModuleName(): string {
		if (selectedModule === '__global__') return 'Global (all modules)';
		const module = availableModules.find((m) => m.id === selectedModule);
		return module?.name || 'Select a module';
	}

	const isValid = $derived(name.trim() !== '');
</script>

<Dialog {open} onOpenChange={onOpenChange}>
	<DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<List class="w-5 h-5" />
				Create Prompt
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={(e) => e.preventDefault()} class="space-y-4 py-4">
			<!-- Name -->
			<div class="space-y-2">
				<Label for="prompt-name">
					Name <span class="text-destructive">*</span>
				</Label>
				<Input
					id="prompt-name"
					bind:value={name}
					placeholder="e.g., Generate Summary"
					autocomplete="off"
				/>
			</div>

			<!-- Description -->
			<div class="space-y-2">
				<Label for="prompt-description">Description</Label>
				<Textarea
					id="prompt-description"
					bind:value={description}
					placeholder="Describe what this prompt does..."
					rows="2"
				/>
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
					Leave as "Global" to make this prompt available to all modules
				</p>
			</div>

			<!-- Arguments -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<Label>Arguments</Label>
					<Button type="button" variant="outline" size="sm" onclick={addArgument} class="gap-1">
						<Plus class="w-3 h-3" />
						Add Argument
					</Button>
				</div>

				<div class="space-y-3">
					{#each promptArguments as arg, index (index)}
						<div class="p-4 border border-border rounded-lg space-y-3">
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1 space-y-3">
									<div class="grid grid-cols-2 gap-3">
										<div class="space-y-2">
											<Label for="arg-name-{index}">Name</Label>
											<Input
												id="arg-name-{index}"
												bind:value={arg.name}
												placeholder="e.g., content"
												autocomplete="off"
											/>
										</div>
										<div class="space-y-2">
											<Label for="arg-type-{index}">Type</Label>
											<Select
												bind:value={arg.type}
												onChange={(v) => updateArgument(index, 'type', v)}
											>
												<SelectTrigger id="arg-type-{index}">
													{arg.type}
												</SelectTrigger>
												<SelectContent>
													{#each argumentTypes as type}
														<SelectItem value={type}>{type}</SelectItem>
													{/each}
												</SelectContent>
											</Select>
										</div>
									</div>
									<div class="space-y-2">
										<Label for="arg-desc-{index}">Description</Label>
										<Input
											id="arg-desc-{index}"
											bind:value={arg.description}
											placeholder="Describe this argument..."
											autocomplete="off"
										/>
									</div>
								</div>
								{#if promptArguments.length > 1}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={() => removeArgument(index)}
										class="text-destructive hover:text-destructive flex-shrink-0"
									>
										<Trash2 class="w-4 h-4" />
									</Button>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<Checkbox
									bind:checked={arg.required}
									onChange={(v) => updateArgument(index, 'required', v)}
								/>
								<Label for="arg-required-{index}" class="text-sm cursor-pointer">
									Required
								</Label>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Enabled -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label for="prompt-enabled">Enabled</Label>
					<p class="text-xs text-muted-foreground">
						Prompt will be available when checked
					</p>
				</div>
				<Checkbox id="prompt-enabled" bind:checked={enabled} />
			</div>
		</form>

		<DialogFooter>
			<Button variant="outline" onclick={() => onOpenChange(false)}>Cancel</Button>
			<Button onclick={handleSubmit} disabled={!isValid}>
				Create Prompt
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

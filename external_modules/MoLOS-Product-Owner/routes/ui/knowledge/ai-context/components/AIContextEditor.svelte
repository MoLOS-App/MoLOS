<script lang="ts">
	import type { AIContext, Project } from "$lib/models/external_modules/MoLOS-Product-Owner";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { Input } from "$lib/components/ui/input";
	import { Textarea } from "$lib/components/ui/textarea";

	interface Props {
		context?: AIContext | null;
		projects: Project[];
		onSave: (data: {
			title: string;
			content: string;
			type: AIContext["type"];
			projectId?: string;
			metadata?: Record<string, unknown>;
		}) => void;
		onClose: () => void;
	}

	let { context, projects, onSave, onClose }: Props = $props();

	let formData = $state({
		title: context?.title ?? "",
		content: context?.content ?? "",
		type: context?.type ?? "manifest",
		projectId: context?.projectId ?? "",
		metadataJson: context?.metadataJson ?? "{}"
	});

	let errors = $state<Record<string, string>>({});

	const typeOptions = [
		{ value: "manifest", label: "Manifest", description: "Project manifest or llms.txt" },
		{ value: "code_example", label: "Code Example", description: "Code snippet with metadata" },
		{ value: "packed_context", label: "Context Pack", description: "Bundled context for export" }
	] as const;

	function validate() {
		errors = {};
		if (!formData.title.trim()) errors.title = "Title is required";
		if (!formData.content.trim()) errors.content = "Content is required";

		// Validate metadata JSON
		try {
			if (formData.metadataJson.trim()) {
				JSON.parse(formData.metadataJson);
			}
		} catch (e) {
			errors.metadataJson = "Invalid JSON format";
		}

		return Object.keys(errors).length === 0;
	}

	function handleSubmit() {
		if (!validate()) return;

		const metadata = formData.metadataJson.trim()
			? JSON.parse(formData.metadataJson)
			: undefined;

		onSave({
			title: formData.title,
			content: formData.content,
			type: formData.type,
			projectId: formData.projectId || undefined,
			metadata
		});
	}
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={onClose}>
	<div class="bg-background rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4" onclick={(e) => e.stopPropagation()}>
		<div class="px-6 py-4 border-b flex items-center justify-between">
			<h2 class="text-lg font-semibold">
				{context ? "Edit AI Context" : "New AI Context"}
			</h2>
			<button onclick={onClose} class="text-muted-foreground hover:text-foreground text-xl">&times;</button>
		</div>

		<div class="p-6 space-y-4">
			<!-- Title -->
			<div>
				<Label for="title">Title *</Label>
				<Input
					id="title"
					bind:value={formData.title}
					placeholder="e.g., Project Manifest, React Hook Example"
					class={errors.title ? "border-destructive" : ""}
				/>
				{#if errors.title}
					<p class="text-sm text-destructive mt-1">{errors.title}</p>
				{/if}
			</div>

			<!-- Type -->
			<div>
				<Label>Type *</Label>
				<div class="grid grid-cols-3 gap-2 mt-2">
					{#each typeOptions as type}
						<button
							type="button"
							class="p-3 border rounded-lg text-left transition-all {formData.type === type.value ? 'border-primary bg-primary/10' : ''}"
							onclick={() => formData.type = type.value}
						>
							<div class="font-medium text-sm">{type.label}</div>
							<div class="text-xs text-muted-foreground">{type.description}</div>
						</button>
					{/each}
				</div>
			</div>

			<!-- Project -->
			<div>
				<Label for="project">Project (Optional)</Label>
				<select
					id="project"
					bind:value={formData.projectId}
					class="w-full rounded-md border bg-background px-3 py-2 text-sm"
				>
					<option value="">No project</option>
					{#each projects as project}
						<option value={project.id}>{project.name}</option>
					{/each}
				</select>
			</div>

			<!-- Content -->
			<div>
				<Label for="content">Content *</Label>
				<Textarea
					id="content"
					bind:value={formData.content}
					placeholder="Enter your AI context content here..."
					rows="12"
					class={`font-mono text-sm ${errors.content ? "border-destructive" : ""}`}
				/>
				{#if errors.content}
					<p class="text-sm text-destructive mt-1">{errors.content}</p>
				{/if}
				<p class="text-xs text-muted-foreground mt-1">
					For manifests, this would be your llms.txt content. For code examples, include the full code snippet.
				</p>
			</div>

			<!-- Metadata -->
			<div>
				<Label for="metadata">Metadata (JSON, Optional)</Label>
				<Textarea
					id="metadata"
					bind:value={formData.metadataJson}
					placeholder="language, tags, or other metadata as JSON"
					rows="3"
					class={`font-mono text-sm ${errors.metadataJson ? "border-destructive" : ""}`}
				/>
				{#if errors.metadataJson}
					<p class="text-sm text-destructive mt-1">{errors.metadataJson}</p>
				{/if}
				<p class="text-xs text-muted-foreground mt-1">
					Additional metadata as JSON object. Useful for code examples (language, framework, etc.)
				</p>
			</div>
		</div>

		<div class="px-6 py-4 border-t flex justify-end gap-2">
			<Button variant="outline" onclick={onClose}>Cancel</Button>
			<Button onclick={handleSubmit}>
				{context ? "Update" : "Create"}
			</Button>
		</div>
	</div>
</div>

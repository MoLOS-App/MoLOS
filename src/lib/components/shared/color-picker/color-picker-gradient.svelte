<script lang="ts">
	import { cn } from '$lib/utils.js';
	import type { Gradient, GradientStop } from './utils/color-utils.js';
	import { linearGradientCss, createDefaultGradient } from './utils/color-utils.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	interface Props {
		value: Gradient | undefined;
		onChange: (gradient: Gradient) => void;
		showPresets?: boolean;
		class?: string;
	}

	let { value, onChange, showPresets = true, class: className }: Props = $props();

	// Internal gradient state
	let gradient = $state<Gradient>(value ?? createDefaultGradient());

	// Sync with prop
	$effect(() => {
		if (value) {
			gradient = value;
		}
	});

	const PRESET_GRADIENTS: Gradient[] = [
		{
			type: 'linear',
			angle: 90,
			stops: [
				{ color: '#6366f1', position: 0 },
				{ color: '#8b5cf6', position: 100 }
			]
		},
		{
			type: 'linear',
			angle: 45,
			stops: [
				{ color: '#ec4899', position: 0 },
				{ color: '#f43f5e', position: 100 }
			]
		},
		{
			type: 'linear',
			angle: 135,
			stops: [
				{ color: '#06b6d4', position: 0 },
				{ color: '#3b82f6', position: 100 }
			]
		},
		{
			type: 'linear',
			angle: 180,
			stops: [
				{ color: '#84cc16', position: 0 },
				{ color: '#22c55e', position: 100 }
			]
		},
		{
			type: 'linear',
			angle: 270,
			stops: [
				{ color: '#f97316', position: 0 },
				{ color: '#eab308', position: 100 }
			]
		},
		{
			type: 'linear',
			angle: 90,
			stops: [
				{ color: '#ff6b6b', position: 0 },
				{ color: '#ff8e53', position: 100 }
			]
		}
	];

	function updateGradient(newGradient: Gradient) {
		gradient = newGradient;
		onChange(newGradient);
	}

	function handleAngleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const angle = Number.parseInt(target.value, 10);
		updateGradient({ ...gradient, angle });
	}

	function updateStopColor(index: number, color: string) {
		const newStops = [...gradient.stops];
		newStops[index] = { ...newStops[index], color };
		updateGradient({ ...gradient, stops: newStops });
	}

	function updateStopPosition(index: number, e: Event) {
		const target = e.target as HTMLInputElement;
		const position = Number.parseInt(target.value, 10);
		const newStops = [...gradient.stops];
		newStops[index] = { ...newStops[index], position };
		updateGradient({ ...gradient, stops: newStops });
	}

	function addStop() {
		if (gradient.stops.length >= 10) return;

		// Find the largest gap and add a stop in the middle
		let maxGap = 0;
		let insertIndex = 1;

		for (let i = 1; i < gradient.stops.length; i++) {
			const gap = gradient.stops[i].position - gradient.stops[i - 1].position;
			if (gap > maxGap) {
				maxGap = gap;
				insertIndex = i;
			}
		}

		const newPosition = gradient.stops[insertIndex - 1].position + maxGap / 2;
		const newColor = mixColors(
			gradient.stops[insertIndex - 1].color,
			gradient.stops[insertIndex].color,
			0.5
		);

		const newStops = [
			...gradient.stops.slice(0, insertIndex),
			{ color: newColor, position: Math.round(newPosition) },
			...gradient.stops.slice(insertIndex)
		];

		updateGradient({ ...gradient, stops: newStops });
	}

	function removeStop(index: number) {
		if (gradient.stops.length <= 2) return;
		const newStops = gradient.stops.filter((_, i) => i !== index);
		updateGradient({ ...gradient, stops: newStops });
	}

	function selectPreset(preset: Gradient) {
		updateGradient(preset);
	}

	// Simple color mix function
	function mixColors(color1: string, color2: string, weight: number): string {
		const parseHex = (hex: string) => {
			const h = hex.replace('#', '');
			return {
				r: Number.parseInt(h.slice(0, 2), 16),
				g: Number.parseInt(h.slice(2, 4), 16),
				b: Number.parseInt(h.slice(4, 6), 16)
			};
		};

		const c1 = parseHex(color1);
		const c2 = parseHex(color2);

		const r = Math.round(c1.r * (1 - weight) + c2.r * weight);
		const g = Math.round(c1.g * (1 - weight) + c2.g * weight);
		const b = Math.round(c1.b * (1 - weight) + c2.b * weight);

		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	const gradientPreview = $derived(linearGradientCss(gradient));
</script>

<div class={cn('space-y-4', className)}>
	<!-- Gradient Preview -->
	<div
		class="h-16 w-full rounded-lg border border-border shadow-sm"
		style="background: {gradientPreview};"
	/>

	<!-- Angle Control -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<label class="text-muted-foreground text-xs font-medium">Angle</label>
			<span class="text-muted-foreground text-xs">{gradient.angle}°</span>
		</div>
		<input
			type="range"
			min="0"
			max="360"
			step="1"
			value={gradient.angle}
			oninput={handleAngleInput}
			class="[&::-webkit-slider-thumb]:ring-ring/50 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2"
		/>
	</div>

	<!-- Color Stops -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<label class="text-muted-foreground text-xs font-medium">Color Stops</label>
			<button
				type="button"
				disabled={gradient.stops.length >= 10}
				class="text-muted-foreground inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
				onclick={addStop}
				aria-label="Add color stop"
			>
				<Plus class="size-3" />
				Add
			</button>
		</div>

		<div class="space-y-2">
			{#each gradient.stops as stop, index (index)}
				<div class="flex items-center gap-2">
					<!-- Color Picker -->
					<input
						type="color"
						value={stop.color}
						oninput={(e) => updateStopColor(index, (e.target as HTMLInputElement).value)}
						class="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
						aria-label={`Stop {index + 1} color`}
					/>

					<!-- Position Slider -->
					<input
						type="range"
						min="0"
						max="100"
						step="1"
						value={stop.position}
						oninput={(e) => updateStopPosition(index, e)}
						class="[&::-webkit-slider-thumb]:ring-ring/50 flex-1 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2"
					/>

					<!-- Position Display -->
					<span class="text-muted-foreground w-10 text-xs">{stop.position}%</span>

					<!-- Remove Button -->
					<button
						type="button"
						disabled={gradient.stops.length <= 2}
						class="text-muted-foreground inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
						onclick={() => removeStop(index)}
						aria-label={`Remove stop {index + 1}`}
					>
						<Trash2 class="size-4" />
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Presets -->
	{#if showPresets}
		<div class="space-y-2">
			<label class="text-muted-foreground text-xs font-medium">Presets</label>
			<div class="grid grid-cols-6 gap-2">
				{#each PRESET_GRADIENTS as preset, i (i)}
					<button
						type="button"
						class="focus-visible:ring-ring/50 h-10 rounded-md border border-border/50 shadow-xs transition-[color,box-shadow] hover:border-primary focus-visible:ring-2"
						style="background: {linearGradientCss(preset)};"
						onclick={() => selectPreset(preset)}
						aria-label="Select gradient preset"
					/>
				{/each}
			</div>
		</div>
	{/if}
</div>

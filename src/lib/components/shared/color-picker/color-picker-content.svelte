<script lang="ts">
	import { cn } from '$lib/utils.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import ColorPickerPalette from './color-picker-palette.svelte';
	import ColorPickerHistory from './color-picker-history.svelte';
	import ColorPickerGradient from './color-picker-gradient.svelte';
	import {
		PRESET_PALETTES,
		getThemePalette,
		parseColor,
		hslToHex,
		saveColorToHistory,
		type Gradient
	} from './utils/color-utils.js';

	interface Props {
		value: string | Gradient;
		format?: 'hex' | 'rgb' | 'hsl';
		enableGradient?: boolean;
		enableHistory?: boolean;
		enablePresets?: boolean;
		onChange: (value: string | Gradient) => void;
	}

	let {
		value,
		format = 'hex',
		enableGradient = true,
		enableHistory = true,
		enablePresets = true,
		onChange
	}: Props = $props();

	// Color state
	let hexValue = $state(typeof value === 'string' ? value : '#6366f1');
	let hue = $state(0);
	let saturation = $state(100);
	let lightness = $state(50);
	let alpha = $state(1);
	let formatTab = $state<'color' | 'gradient'>('color');
	let inputFormat = $state<'hex' | 'rgb' | 'hsl'>('hex');

	// Initialize color
	$effect(() => {
		if (typeof value === 'string') {
			const parsed = parseColor(value);
			if (parsed) {
				hexValue = parsed.hex;
				hue = parsed.hsl.h;
				saturation = parsed.hsl.s;
				lightness = parsed.hsl.l;
				alpha = parsed.hsl.a ?? 1;
				formatTab = 'color';
			}
		} else {
			formatTab = 'gradient';
		}
	});

	// Update color on slider changes
	function updateFromHsl() {
		const newHex = hslToHex(hue, saturation, lightness, alpha < 1 ? alpha : undefined);
		hexValue = newHex;
		onChange(newHex);
		saveColorToHistory(newHex);
	}

	function handleHexInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = input.value.trim();

		if (val.startsWith('#') && (val.length === 7 || val.length === 4 || val.length === 9)) {
			const parsed = parseColor(val);
			if (parsed) {
				hexValue = val;
				hue = parsed.hsl.h;
				saturation = parsed.hsl.s;
				lightness = parsed.hsl.l;
				alpha = parsed.hsl.a ?? 1;
				onChange(val);
				saveColorToHistory(val);
			}
		}
	}

	function handlePaletteSelect(color: string) {
		const parsed = parseColor(color);
		if (parsed) {
			hexValue = color;
			hue = parsed.hsl.h;
			saturation = parsed.hsl.s;
			lightness = parsed.hsl.l;
			alpha = parsed.hsl.a ?? 1;
			onChange(color);
			saveColorToHistory(color);
		}
	}

	function handleGradientChange(gradient: Gradient) {
		onChange(gradient);
	}

	// Theme palette
	let themePalette = $state<Record<string, string>>({});
	$effect(() => {
		themePalette = getThemePalette();
	});

	// Saturation/Lightness box style
	const slBoxStyle = $derived(
		`linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%)), linear-gradient(to top, #000, transparent)`
	);

	// Hue slider style
	const hueSliderStyle = $derived(
		`linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)`
	);

	// Format display values
	const rgbDisplay = $derived(() => {
		const parsed = parseColor(hexValue);
		if (!parsed) return '';
		const { r, g, b } = parsed.rgb;
		return alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})` : `rgb(${r}, ${g}, ${b})`;
	});

	const hslDisplay = $derived(() => {
		const parsed = parseColor(hexValue);
		if (!parsed) return '';
		const { h, s, l } = parsed.hsl;
		return alpha < 1 ? `hsla(${h}, ${s}%, ${l}%, ${alpha.toFixed(2)})` : `hsl(${h}, ${s}%, ${l}%)`;
	});

	// Handle slider input
	function handleHueInput(e: Event) {
		const target = e.target as HTMLInputElement;
		hue = Number.parseInt(target.value, 10);
		updateFromHsl();
	}

	function handleAlphaInput(e: Event) {
		const target = e.target as HTMLInputElement;
		alpha = Number.parseFloat(target.value);
		updateFromHsl();
	}

	// Handle SL box interaction
	let slBoxRef: HTMLDivElement | undefined = $state();
	let isDragging = $state(false);

	function handleSlMouseDown(e: MouseEvent) {
		isDragging = true;
		updateSlFromEvent(e);
	}

	function handleSlMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		updateSlFromEvent(e);
	}

	function handleSlMouseUp() {
		isDragging = false;
	}

	function updateSlFromEvent(e: MouseEvent) {
		if (!slBoxRef) return;
		const rect = slBoxRef.getBoundingClientRect();
		const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
		const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
		saturation = x;
		lightness = 100 - y;
		updateFromHsl();
	}

	$effect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleSlMouseMove);
			document.addEventListener('mouseup', handleSlMouseUp);
			return () => {
				document.removeEventListener('mousemove', handleSlMouseMove);
				document.removeEventListener('mouseup', handleSlMouseUp);
			};
		}
	});
</script>

<svelte:window on:mouseup={handleSlMouseUp} />

<Tabs.Root value={formatTab} onValueChange={(v) => (formatTab = v as 'color' | 'gradient')}>
	<!-- Tab Triggers -->
	{#if enableGradient}
		<Tabs.List class="mb-4 grid w-full grid-cols-2">
			<Tabs.Trigger value="color">Color</Tabs.Trigger>
			<Tabs.Trigger value="gradient">Gradient</Tabs.Trigger>
		</Tabs.List>
	{/if}

	<!-- Color Tab -->
	<Tabs.Content value="color" class="space-y-4">
		<!-- Color Preview -->
		<div class="flex gap-2">
			<div
				class="relative h-16 flex-1 overflow-hidden rounded-lg border border-border"
				style="background: {hexValue}; opacity: {alpha};"
			>
				<div
					class="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,.05)_25%,rgba(0,0,0,.05)_50%,transparent_50%,transparent_75%,rgba(0,0,0,.05)_75%,rgba(0,0,0,.05)_100%)] bg-[length:8px_8px]"
				/>
			</div>
		</div>

		<!-- Saturation/Lightness Box -->
		<div class="space-y-2">
			<div
				bind:this={slBoxRef}
				class="relative h-32 w-full cursor-crosshair rounded-md"
				style="background: {slBoxStyle};"
				onmousedown={handleSlMouseDown}
				role="slider"
				aria-label="Saturation and lightness"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={saturation}
			>
				<div
					class="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
					style="left: {saturation}%; top: {100 -
						lightness}%; background: hsl({hue}, {saturation}%, {lightness}%);"
				/>
			</div>
		</div>

		<!-- Hue Slider -->
		<div class="space-y-2">
			<div class="h-2 w-full rounded-full" style="background: {hueSliderStyle};" />
			<input
				type="range"
				min="0"
				max="360"
				step="1"
				value={hue}
				oninput={handleHueInput}
				class="[&::-webkit-slider-thumb]:ring-ring/50 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2"
			/>
		</div>

		<!-- Alpha Slider -->
		{#if alpha < 1}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label class="text-muted-foreground text-xs font-medium">Opacity</label>
					<span class="text-muted-foreground text-xs">{Math.round(alpha * 100)}%</span>
				</div>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={alpha}
					oninput={handleAlphaInput}
					class="[&::-webkit-slider-thumb]:ring-ring/50 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2"
				/>
			</div>
		{/if}

		<!-- Format Input -->
		<Tabs.Root
			value={inputFormat}
			onValueChange={(v) => (inputFormat = v as 'hex' | 'rgb' | 'hsl')}
		>
			<Tabs.List class="mb-2">
				<Tabs.Trigger value="hex">HEX</Tabs.Trigger>
				<Tabs.Trigger value="rgb">RGB</Tabs.Trigger>
				<Tabs.Trigger value="hsl">HSL</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="hex">
				<Input value={hexValue} oninput={handleHexInput} placeholder="#6366f1" maxlength={9} />
			</Tabs.Content>

			<Tabs.Content value="rgb">
				<Input value={rgbDisplay()} readonly placeholder="rgb(99, 102, 241)" />
			</Tabs.Content>

			<Tabs.Content value="hsl">
				<Input value={hslDisplay()} readonly placeholder="hsl(239, 84%, 67%)" />
			</Tabs.Content>
		</Tabs.Root>

		<!-- Palettes -->
		{#if enablePresets}
			<div class="space-y-3">
				<label class="text-muted-foreground text-xs font-medium">Theme Colors</label>
				{#if Object.keys(themePalette).length > 0}
					<ColorPickerPalette
						colors={Object.values(themePalette)}
						selected={typeof value === 'string' ? value : undefined}
						columns={6}
						onSelect={handlePaletteSelect}
					/>
				{/if}

				<label class="text-muted-foreground text-xs font-medium">Preset Colors</label>
				<ColorPickerPalette
					colors={PRESET_PALETTES.primary}
					selected={typeof value === 'string' ? value : undefined}
					onSelect={handlePaletteSelect}
				/>

				<ColorPickerPalette
					colors={PRESET_PALETTES.vibrant}
					selected={typeof value === 'string' ? value : undefined}
					onSelect={handlePaletteSelect}
				/>
			</div>
		{/if}

		<!-- History -->
		{#if enableHistory}
			<ColorPickerHistory
				selected={typeof value === 'string' ? value : undefined}
				onSelect={handlePaletteSelect}
			/>
		{/if}
	</Tabs.Content>

	<!-- Gradient Tab -->
	<Tabs.Content value="gradient" class="space-y-4">
		<ColorPickerGradient
			value={typeof value === 'string'
				? {
						type: 'linear',
						angle: 90,
						stops: [
							{ color: hexValue, position: 0 },
							{ color: hexValue, position: 100 }
						]
					}
				: value}
			onChange={handleGradientChange}
			showPresets={enablePresets}
		/>
	</Tabs.Content>
</Tabs.Root>

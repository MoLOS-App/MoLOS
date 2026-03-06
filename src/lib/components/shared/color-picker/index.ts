import ColorPicker from './color-picker.svelte';
import ColorPickerTrigger from './color-picker-trigger.svelte';
import ColorPickerContent from './color-picker-content.svelte';
import ColorPickerPalette from './color-picker-palette.svelte';
import ColorPickerHistory from './color-picker-history.svelte';
import ColorPickerGradient from './color-picker-gradient.svelte';

export {
	ColorPicker,
	ColorPickerTrigger,
	ColorPickerContent,
	ColorPickerPalette,
	ColorPickerHistory,
	ColorPickerGradient
};

// Re-export types
export type {
	Gradient,
	GradientStop,
	Color,
	RGB,
	HSL,
	OKLCH,
	ColorFormat
} from './utils/color-utils.js';

// Re-export utilities
export {
	hexToRgb,
	rgbToHex,
	isValidHex,
	rgbToHsl,
	hslToRgb,
	hexToHsl,
	hslToHex,
	rgbToOklch,
	oklchToRgb,
	hexToOklch,
	oklchToHex,
	parseColor,
	adjustLightness,
	getComplementaryColor,
	getAnalogousColor,
	getTriadicColors,
	mixColors,
	linearGradientCss,
	isValidGradient,
	isValidColor,
	createDefaultGradient,
	loadColorHistory,
	saveColorToHistory,
	clearColorHistory,
	getThemePalette,
	PRESET_PALETTES
} from './utils/color-utils.js';

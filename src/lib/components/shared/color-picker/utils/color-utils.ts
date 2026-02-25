/**
 * Color utility functions for the color picker component
 * Supports conversions between Hex, RGB, HSL, and OKLCH color spaces
 */

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

export interface RGB {
	r: number;
	g: number;
	b: number;
	a?: number;
}

export interface HSL {
	h: number;
	s: number;
	l: number;
	a?: number;
}

export interface OKLCH {
	l: number;
	c: number;
	h: number;
	a?: number;
}

export interface Color {
	hex: string;
	rgb: RGB;
	hsl: HSL;
	oklch: OKLCH;
}

export interface GradientStop {
	color: string;
	position: number; // 0-100
}

export interface Gradient {
	type: 'linear';
	angle: number;
	stops: GradientStop[];
}

// ==================== HEX Conversions ====================

/**
 * Parse hex string to RGB
 * Supports #RGB, #RRGGBB, #RRGGBBAA formats
 */
export function hexToRgb(hex: string): RGB {
	let h = hex.trim();

	// Remove # prefix
	if (h.startsWith('#')) {
		h = h.slice(1);
	}

	// Handle 3-digit hex (#RGB)
	if (h.length === 3) {
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	}

	// Handle 4-digit hex (#RGBA)
	if (h.length === 4) {
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	}

	const r = Number.parseInt(h.slice(0, 2), 16);
	const g = Number.parseInt(h.slice(2, 4), 16);
	const b = Number.parseInt(h.slice(4, 6), 16);
	const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : undefined;

	return { r, g, b, a };
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number, a?: number): string {
	const toHex = (n: number) => {
		const hex = Math.round(n).toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};

	let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

	if (a !== undefined && a < 1) {
		hex += toHex(a * 255);
	}

	return hex;
}

/**
 * Validate hex color string
 */
export function isValidHex(hex: string): boolean {
	const h = hex.trim();
	return /^#([0-9A-Fa-f]{3}){1,2}([0-9A-Fa-f]{2})?$/.test(h);
}

// ==================== RGB/HSL Conversions ====================

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number, a?: number): HSL {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
				break;
			case g:
				h = ((b - r) / d + 2) / 6;
				break;
			case b:
				h = ((r - g) / d + 4) / 6;
				break;
		}
	}

	return { h: h * 360, s: s * 100, l: l * 100, a };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number, a?: number): RGB {
	h /= 360;
	s /= 100;
	l /= 100;

	let r: number, g: number, b: number;

	if (s === 0) {
		r = g = b = l;
	} else {
		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;

		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}

	return { r: r * 255, g: g * 255, b: b * 255, a };
}

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): HSL {
	const rgb = hexToRgb(hex);
	return rgbToHsl(rgb.r, rgb.g, rgb.b, rgb.a);
}

/**
 * Convert HSL to hex
 */
export function hslToHex(h: number, s: number, l: number, a?: number): string {
	const rgb = hslToRgb(h, s, l, a);
	return rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a);
}

// ==================== OKLCH Conversions ====================

/**
 * Convert RGB to OKLCH (perceptually uniform color space)
 */
export function rgbToOklch(r: number, g: number, b: number, a?: number): OKLCH {
	// Convert RGB to linear RGB
	const linearize = (c: number) => {
		c /= 255;
		return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
	};

	const linR = linearize(r);
	const linG = linearize(g);
	const linB = linearize(b);

	// Convert to LMS
	const l = 0.4122214708 * linR + 0.5363325363 * linG + 0.0514459929 * linB;
	const m = 0.2119034982 * linR + 0.6806995451 * linG + 0.1073969566 * linB;
	const s = 0.0883024619 * linR + 0.2817188376 * linG + 0.6299787005 * linB;

	// Convert LMS to OKLab
	const l_ = Math.cbrt(l);
	const m_ = Math.cbrt(m);
	const s_ = Math.cbrt(s);

	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const oklabA = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const oklabB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

	// Convert OKLab to OKLCh
	const C = Math.sqrt(oklabA * oklabA + oklabB * oklabB);
	const H = C === 0 ? 0 : (Math.atan2(oklabB, oklabA) * 180) / Math.PI;

	return { l: L, c: C, h: H < 0 ? H + 360 : H, a };
}

/**
 * Convert OKLCH to RGB
 */
export function oklchToRgb(L: number, C: number, H: number, a?: number): RGB {
	// Convert OKLCh to OKLab
	const hRad = (H * Math.PI) / 180;
	const oklabA = C * Math.cos(hRad);
	const oklabB = C * Math.sin(hRad);

	// Convert OKLab to LMS
	const l_ = L + 0.3963377774 * oklabA + 0.2158037573 * oklabB;
	const m = L - 0.1055613458 * oklabA - 0.0638541728 * oklabB;
	const s_ = L - 0.0894841775 * oklabA - 1.291485548 * oklabB;

	// Convert LMS to linear RGB
	const l = l_ ** 3;
	const m2 = m ** 3;
	const s = s_ ** 3;

	const linR = 4.0767416621 * l - 3.3077115913 * m2 + 0.2309699292 * s;
	const linG = -1.2684380046 * l + 2.6097574011 * m2 - 0.3413193965 * s;
	const linB = -0.0041960863 * l - 0.7034186147 * m2 + 1.707614701 * s;

	// Convert linear RGB to sRGB
	const delinearize = (c: number) => {
		if (c <= 0) return 0;
		if (c >= 1) return 255;
		return c > 0.0031308 ? 255 * (1.055 * c ** (1 / 2.4) - 0.055) : 255 * 12.92 * c;
	};

	return { r: delinearize(linR), g: delinearize(linG), b: delinearize(linB), a };
}

/**
 * Convert hex to OKLCH
 */
export function hexToOklch(hex: string): OKLCH {
	const rgb = hexToRgb(hex);
	return rgbToOklch(rgb.r, rgb.g, rgb.b, rgb.a);
}

/**
 * Convert OKLCH to hex
 */
export function oklchToHex(L: number, C: number, H: number, a?: number): string {
	const rgb = oklchToRgb(L, C, H, a);
	return rgbToHex(rgb.r, rgb.g, rgb.b, rgb.a);
}

// ==================== Color Parsing ====================

/**
 * Parse color from various formats
 */
export function parseColor(input: string): Color | null {
	const trimmed = input.trim();

	// Hex format
	if (isValidHex(trimmed)) {
		return {
			hex: trimmed,
			rgb: hexToRgb(trimmed),
			hsl: hexToHsl(trimmed),
			oklch: hexToOklch(trimmed)
		};
	}

	// RGB format: rgb(r, g, b) or rgba(r, g, b, a)
	const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
	if (rgbMatch) {
		const r = Number.parseInt(rgbMatch[1]);
		const g = Number.parseInt(rgbMatch[2]);
		const b = Number.parseInt(rgbMatch[3]);
		const a = rgbMatch[4] ? Number.parseFloat(rgbMatch[4]) : undefined;
		const hex = rgbToHex(r, g, b, a);

		return {
			hex,
			rgb: { r, g, b, a },
			hsl: rgbToHsl(r, g, b, a),
			oklch: rgbToOklch(r, g, b, a)
		};
	}

	// HSL format: hsl(h, s%, l%) or hsla(h, s%, l%, a%)
	const hslMatch = trimmed.match(/^hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)$/);
	if (hslMatch) {
		const h = Number.parseInt(hslMatch[1]);
		const s = Number.parseInt(hslMatch[2]);
		const l = Number.parseInt(hslMatch[3]);
		const a = hslMatch[4] ? Number.parseFloat(hslMatch[4]) : undefined;
		const hex = hslToHex(h, s, l, a);

		return {
			hex,
			rgb: hexToRgb(hex),
			hsl: { h, s, l, a },
			oklch: hexToOklch(hex)
		};
	}

	return null;
}

// ==================== Color Manipulation ====================

/**
 * Adjust color lightness
 */
export function adjustLightness(hex: string, amount: number): string {
	const hsl = hexToHsl(hex);
	const newL = Math.max(0, Math.min(100, hsl.l + amount));
	return hslToHex(hsl.h, hsl.s, newL, hsl.a);
}

/**
 * Get complementary color
 */
export function getComplementaryColor(hex: string): string {
	const hsl = hexToHsl(hex);
	const newH = (hsl.h + 180) % 360;
	return hslToHex(newH, hsl.s, hsl.l, hsl.a);
}

/**
 * Get analogous color
 */
export function getAnalogousColor(hex: string, offset = 30): string {
	const hsl = hexToHsl(hex);
	const newH = (hsl.h + offset) % 360;
	return hslToHex(newH, hsl.s, hsl.l, hsl.a);
}

/**
 * Get triadic colors
 */
export function getTriadicColors(hex: string): [string, string] {
	const hsl = hexToHsl(hex);
	return [
		hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l, hsl.a),
		hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l, hsl.a)
	];
}

/**
 * Mix two colors
 */
export function mixColors(color1: string, color2: string, weight = 0.5): string {
	const rgb1 = hexToRgb(color1);
	const rgb2 = hexToRgb(color2);

	const r = rgb1.r * (1 - weight) + rgb2.r * weight;
	const g = rgb1.g * (1 - weight) + rgb2.g * weight;
	const b = rgb1.b * (1 - weight) + rgb2.b * weight;
	const a =
		rgb1.a !== undefined && rgb2.a !== undefined
			? rgb1.a * (1 - weight) + rgb2.a * weight
			: undefined;

	return rgbToHex(r, g, b, a);
}

// ==================== Gradient Utilities ====================

/**
 * Generate linear gradient CSS string
 */
export function linearGradientCss(gradient: Gradient): string {
	const stops = gradient.stops.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
	return `linear-gradient(${gradient.angle}deg, ${stops})`;
}

/**
 * Validate gradient
 */
export function isValidGradient(gradient: Gradient): boolean {
	if (!gradient || gradient.type !== 'linear') return false;
	if (gradient.angle < 0 || gradient.angle > 360) return false;
	if (!gradient.stops || gradient.stops.length < 2 || gradient.stops.length > 10) return false;

	// Check each stop
	for (const stop of gradient.stops) {
		if (!stop.color || !isValidColor(stop.color)) return false;
		if (stop.position < 0 || stop.position > 100) return false;
	}

	// Check stops are ordered by position
	for (let i = 1; i < gradient.stops.length; i++) {
		if (gradient.stops[i].position < gradient.stops[i - 1].position) return false;
	}

	return true;
}

/**
 * Check if string is a valid color
 */
export function isValidColor(color: string): boolean {
	return isValidHex(color) || parseColor(color) !== null;
}

/**
 * Create default gradient
 */
export function createDefaultGradient(color1 = '#6366f1', color2 = '#8b5cf6'): Gradient {
	return {
		type: 'linear',
		angle: 90,
		stops: [
			{ color: color1, position: 0 },
			{ color: color2, position: 100 }
		]
	};
}

// ==================== Color History ====================

const STORAGE_KEY = 'molos-color-history';
const MAX_HISTORY = 20;

/**
 * Load color history from localStorage
 */
export function loadColorHistory(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}

/**
 * Save color to history
 */
export function saveColorToHistory(color: string): void {
	if (typeof window === 'undefined') return;

	let history = loadColorHistory();

	// Remove if already exists
	history = history.filter((c) => c !== color);

	// Add to front
	history.unshift(color);

	// Trim to max
	history = history.slice(0, MAX_HISTORY);

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
	} catch {
		// Storage might be disabled
	}
}

/**
 * Clear color history
 */
export function clearColorHistory(): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Storage might be disabled
	}
}

// ==================== Color Palettes ====================

/**
 * Get theme color palette from CSS variables
 */
export function getThemePalette(): Record<string, string> {
	if (typeof window === 'undefined') return {};

	const styles = getComputedStyle(document.documentElement);
	const palette: Record<string, string> = {};

	// Extract theme colors
	const colorVars = [
		'--primary',
		'--primary-foreground',
		'--secondary',
		'--secondary-foreground',
		'--accent',
		'--accent-foreground',
		'--muted',
		'--muted-foreground',
		'--destructive',
		'--destructive-foreground',
		'--success',
		'--warning',
		'--info'
	];

	for (const varName of colorVars) {
		const value = styles.getPropertyValue(varName).trim();
		if (value) {
			palette[varName.replace('--', '')] = value;
		}
	}

	return palette;
}

/**
 * Get preset color palettes
 */
export const PRESET_PALETTES = {
	primary: [
		'#6366f1',
		'#8b5cf6',
		'#ec4899',
		'#f43f5e',
		'#f97316',
		'#eab308',
		'#84cc16',
		'#22c55e',
		'#10b981',
		'#06b6d4'
	],
	neutral: ['#000000', '#4b5563', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff'],
	grayscale: ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'],
	// OKLCH-based vibrant palette (perceptually uniform)
	vibrant: [
		'#ff6b6b', // Red
		'#ff8e53', // Orange
		'#ffd93d', // Yellow
		'#6bcb77', // Green
		'#4d96ff', // Blue
		'#9d4edd', // Purple
		'#ff6b9d', // Pink
		'#00d4ff', // Cyan
		'#7dffc1', // Mint
		'#ffa07a' // Coral
	],
	gradientPresets: [
		{ angle: 90, stops: ['#6366f1', '#8b5cf6'] },
		{ angle: 45, stops: ['#ec4899', '#f43f5e'] },
		{ angle: 135, stops: ['#06b6d4', '#3b82f6'] },
		{ angle: 180, stops: ['#84cc16', '#22c55e'] },
		{ angle: 270, stops: ['#f97316', '#eab308'] },
		{ angle: 90, stops: ['#ff6b6b', '#ff8e53'] }
	]
};

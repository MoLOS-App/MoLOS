export type Theme =
	| 'light'
	| 'dark'
	| 'medium'
	| 'lavender'
	| 'lavender-light'
	| 'lavender-medium'
	| 'mint'
	| 'mint-light'
	| 'mint-medium'
	| 'peach'
	| 'peach-light'
	| 'peach-medium'
	| 'sky'
	| 'sky-light'
	| 'sky-medium'
	| 'blue'
	| 'blue-light'
	| 'blue-medium'
	| 'rose'
	| 'rose-light'
	| 'rose-medium'
	| 'green'
	| 'green-light'
	| 'green-medium'
	| 'orange'
	| 'orange-light'
	| 'orange-medium';

export type Font = 'sans' | 'serif' | 'mono' | 'display';

export interface FontOption {
	id: Font;
	label: string;
	class: string;
}

export const FONTS: FontOption[] = [
	{ id: 'sans', label: 'Inter', class: 'font-sans' },
	{ id: 'serif', label: 'Serif', class: 'font-serif' },
	{ id: 'mono', label: 'Mono', class: 'font-mono' },
	{ id: 'display', label: 'Display', class: 'font-display' }
];

export interface ThemeOption {
	id: Theme;
	label: string;
	colors: string;
	isDark: boolean;
}

export const THEMES: ThemeOption[] = [
	{ id: 'light', label: 'Light', colors: 'from-yellow-100 to-orange-100', isDark: false },
	{ id: 'dark', label: 'Dark', colors: 'from-slate-800 to-slate-900', isDark: true },
	{ id: 'medium', label: 'Medium', colors: 'from-slate-600 to-slate-800', isDark: true },
	{ id: 'lavender', label: 'Lavender', colors: 'from-purple-400 to-purple-600', isDark: true },
	{
		id: 'lavender-light',
		label: 'Lavender Light',
		colors: 'from-purple-100 to-purple-200',
		isDark: false
	},
	{
		id: 'lavender-medium',
		label: 'Lavender Medium',
		colors: 'from-purple-300 to-purple-500',
		isDark: true
	},
	{ id: 'mint', label: 'Mint', colors: 'from-emerald-400 to-emerald-600', isDark: true },
	{
		id: 'mint-light',
		label: 'Mint Light',
		colors: 'from-emerald-100 to-emerald-200',
		isDark: false
	},
	{
		id: 'mint-medium',
		label: 'Mint Medium',
		colors: 'from-emerald-300 to-emerald-500',
		isDark: true
	},
	{ id: 'peach', label: 'Peach', colors: 'from-orange-400 to-orange-600', isDark: true },
	{
		id: 'peach-light',
		label: 'Peach Light',
		colors: 'from-orange-100 to-orange-200',
		isDark: false
	},
	{
		id: 'peach-medium',
		label: 'Peach Medium',
		colors: 'from-orange-300 to-orange-500',
		isDark: true
	},
	{ id: 'sky', label: 'Sky', colors: 'from-sky-400 to-sky-600', isDark: true },
	{ id: 'sky-light', label: 'Sky Light', colors: 'from-sky-100 to-sky-200', isDark: false },
	{
		id: 'sky-medium',
		label: 'Sky Medium',
		colors: 'from-sky-300 to-sky-500',
		isDark: true
	},
	{ id: 'blue', label: 'Blue', colors: 'from-blue-500 to-blue-700', isDark: true },
	{ id: 'blue-light', label: 'Blue Light', colors: 'from-blue-400 to-blue-600', isDark: false },
	{
		id: 'blue-medium',
		label: 'Blue Medium',
		colors: 'from-blue-400 to-blue-600',
		isDark: true
	},
	{ id: 'rose', label: 'Rose', colors: 'from-rose-500 to-rose-700', isDark: true },
	{ id: 'rose-light', label: 'Rose Light', colors: 'from-rose-400 to-rose-600', isDark: false },
	{
		id: 'rose-medium',
		label: 'Rose Medium',
		colors: 'from-rose-400 to-rose-600',
		isDark: true
	},
	{ id: 'green', label: 'Green', colors: 'from-green-500 to-green-700', isDark: true },
	{ id: 'green-light', label: 'Green Light', colors: 'from-green-400 to-green-600', isDark: false },
	{
		id: 'green-medium',
		label: 'Green Medium',
		colors: 'from-green-400 to-green-600',
		isDark: true
	},
	{ id: 'orange', label: 'Orange', colors: 'from-orange-500 to-orange-700', isDark: true },
	{
		id: 'orange-light',
		label: 'Orange Light',
		colors: 'from-orange-400 to-orange-600',
		isDark: false
	},
	{
		id: 'orange-medium',
		label: 'Orange Medium',
		colors: 'from-orange-400 to-orange-600',
		isDark: true
	}
];

// Helper function to get theme preview colors
export function getThemePreviewColors(themeId: Theme): {
	primary: string;
	secondary: string;
	accent: string;
} {
	switch (themeId) {
		case 'light':
			return { primary: 'bg-yellow-500', secondary: 'bg-orange-300', accent: 'bg-orange-400' };
		case 'dark':
			return { primary: 'bg-slate-400', secondary: 'bg-slate-600', accent: 'bg-blue-400' };
		case 'medium':
			return { primary: 'bg-slate-300', secondary: 'bg-slate-500', accent: 'bg-blue-300' };
		case 'lavender':
		case 'lavender-medium':
			return { primary: 'bg-purple-400', secondary: 'bg-purple-600', accent: 'bg-pink-400' };
		case 'mint':
		case 'mint-medium':
			return { primary: 'bg-emerald-400', secondary: 'bg-emerald-600', accent: 'bg-cyan-400' };
		case 'peach':
		case 'peach-medium':
			return { primary: 'bg-orange-400', secondary: 'bg-orange-600', accent: 'bg-yellow-400' };
		case 'sky':
		case 'sky-medium':
			return { primary: 'bg-sky-400', secondary: 'bg-sky-600', accent: 'bg-blue-400' };
		case 'blue':
		case 'blue-medium':
			return { primary: 'bg-blue-500', secondary: 'bg-blue-700', accent: 'bg-indigo-400' };
		case 'rose':
		case 'rose-medium':
			return { primary: 'bg-rose-500', secondary: 'bg-rose-700', accent: 'bg-pink-400' };
		case 'green':
		case 'green-medium':
			return { primary: 'bg-green-500', secondary: 'bg-green-700', accent: 'bg-emerald-400' };
		case 'orange':
		case 'orange-medium':
			return { primary: 'bg-orange-500', secondary: 'bg-orange-700', accent: 'bg-yellow-400' };
		default:
			return { primary: 'bg-primary', secondary: 'bg-secondary', accent: 'bg-accent' };
	}
}

export function getThemeClasses(theme: Theme): string[] {
	const themeOption = THEMES.find((t) => t.id === theme);
	if (!themeOption) return [];

	const classes: string[] = [];

	if (theme === 'light') {
		// Default light
	} else if (theme === 'dark') {
		classes.push('dark');
	} else if (theme === 'medium') {
		classes.push('medium');
	} else {
		const baseTheme = theme.replace('-light', '').replace('-medium', '').replace('-dark', '');
		classes.push(baseTheme);
		if (theme.endsWith('-light')) {
			// Light themes don't need additional classes
		} else if (theme.endsWith('-medium')) {
			classes.push('medium');
		} else {
			classes.push('dark');
		}
	}

	return classes;
}

export function applyTheme(theme: Theme) {
	if (typeof window === 'undefined') return;

	const html = document.documentElement;
	const themeOption = THEMES.find((t) => t.id === theme);

	if (!themeOption) return;

	// Remove all possible theme classes
	const allThemeClasses = THEMES.map((t) =>
		t.id.replace('-light', '').replace('-medium', '').replace('-dark', '')
	);
	html.classList.remove(
		'dark',
		'medium',
		...allThemeClasses,
		'lavender',
		'mint',
		'peach',
		'sky',
		'blue',
		'rose',
		'green',
		'orange'
	);

	const classes = getThemeClasses(theme);
	if (classes.length > 0) {
		html.classList.add(...classes);
	}
}

export function applyFont(font: Font) {
	if (typeof window === 'undefined') return;

	const html = document.documentElement;
	const fontOption = FONTS.find((f) => f.id === font);

	if (!fontOption) return;

	// Remove all possible font classes
	const allFontClasses = FONTS.map((f) => f.class);
	html.classList.remove(...allFontClasses);
	html.classList.add(fontOption.class);
}

export function initTheme() {
	if (typeof window === 'undefined') return;

	// Theme init
	const savedTheme = localStorage.getItem('theme') as Theme | null;
	const validThemes = THEMES.map((t) => t.id);

	if (savedTheme && validThemes.includes(savedTheme)) {
		applyTheme(savedTheme);
	} else {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const defaultTheme: Theme = prefersDark ? 'dark' : 'light';
		applyTheme(defaultTheme);
	}

	// Font init
	const savedFont = localStorage.getItem('font') as Font | null;
	const validFonts = FONTS.map((f) => f.id);

	if (savedFont && validFonts.includes(savedFont)) {
		applyFont(savedFont);
	} else {
		applyFont('sans');
	}
}

export function setTheme(theme: Theme) {
	if (typeof window === 'undefined') return;

	localStorage.setItem('theme', theme);
	// Set cookie for SSR
	document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
	applyTheme(theme);
}

export function setFont(font: Font) {
	if (typeof window === 'undefined') return;

	localStorage.setItem('font', font);
	// Set cookie for SSR
	document.cookie = `font=${font}; path=/; max-age=31536000; SameSite=Lax`;
	applyFont(font);
}

export function getCurrentFont(): Font {
	if (typeof window === 'undefined') return 'sans';

	const saved = localStorage.getItem('font') as Font | null;
	const validFonts = FONTS.map((f) => f.id);

	if (saved && validFonts.includes(saved)) {
		return saved;
	}

	return 'sans';
}

export function getCurrentTheme(): Theme {
	if (typeof window === 'undefined') return 'light';

	const saved = localStorage.getItem('theme') as Theme | null;
	const validThemes = THEMES.map((t) => t.id);

	if (saved && validThemes.includes(saved)) {
		return saved;
	}

	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	return prefersDark ? 'dark' : 'light';
}

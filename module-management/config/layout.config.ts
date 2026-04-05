/**
 * Layout Configuration
 * Customize sidebar behavior, tooltips, and active state indicators
 */

export type TooltipOption = 'always' | 'hover' | 'never';
export type ActiveStateStyle = 'highlight' | 'pill' | 'underline' | 'background' | 'border-left';

export interface LayoutConfig {
	// Tooltip/Label Configuration
	tooltips: {
		/** 'always' = always show labels, 'hover' = show only on hover, 'never' = no tooltips */
		moduleIcons: TooltipOption;
		moduleNavigation: TooltipOption;
		userControls: TooltipOption;
	};

	// Active State Indicator Style
	activeState: {
		/** How to indicate active module icon */
		moduleIconStyle: ActiveStateStyle;
		/** How to indicate active navigation item */
		navItemStyle: ActiveStateStyle;
		/** Color to use for active state (Tailwind class compatible) */
		activeColor: string;
	};

	// Sidebar Customization
	sidebar: {
		/** Width of sidebar (Tailwind class) */
		width: string;
		/** Show separator lines between sections */
		showSeparators: boolean;
		/** Icon size for module icons (h-X w-X) */
		moduleIconSize: string;
		/** Icon size for nav items (h-X w-X) */
		navIconSize: string;
		/** Icon size for user controls (h-X w-X) */
		userIconSize: string;
	};

	// Topbar Configuration
	topbar: {
		/** Show topbar on hover */
		showOnHover: boolean;
		/** Animation duration in ms */
		animationDuration: number;
	};
}

/**
 * Default configuration - CUSTOMIZE THIS FOR YOUR NEEDS
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
	tooltips: {
		moduleIcons: 'hover', // Show module names on hover
		moduleNavigation: 'hover', // Show nav item names on hover
		userControls: 'hover' // Show user control labels on hover
	},

	activeState: {
		moduleIconStyle: 'background', // 'highlight' | 'pill' | 'underline' | 'background' | 'border-left'
		navItemStyle: 'background',
		activeColor: 'bg-primary' // Tailwind class for active state color
	},

	sidebar: {
		width: 'w-1/3 max-w-xs',
		showSeparators: true,
		moduleIconSize: 'h-12 w-12',
		navIconSize: 'h-10 w-10',
		userIconSize: 'h-10 w-10'
	},

	topbar: {
		showOnHover: true,
		animationDuration: 200
	}
};

/**
 * Preset configurations for different use cases
 */
export const LAYOUT_PRESETS = {
	/**
	 * Icon-only interface (minimal labels, clean aesthetic)
	 */
	iconOnly: {
		...DEFAULT_LAYOUT_CONFIG,
		tooltips: {
			moduleIcons: 'hover',
			moduleNavigation: 'hover',
			userControls: 'hover'
		},
		activeState: {
			moduleIconStyle: 'pill',
			navItemStyle: 'pill',
			activeColor: 'bg-blue-500'
		}
	} as LayoutConfig,

	/**
	 * Always-visible labels (accessibility-focused)
	 */
	alwaysLabeled: {
		...DEFAULT_LAYOUT_CONFIG,
		tooltips: {
			moduleIcons: 'always',
			moduleNavigation: 'always',
			userControls: 'always'
		},
		activeState: {
			moduleIconStyle: 'border-left',
			navItemStyle: 'border-left',
			activeColor: 'text-blue-600'
		}
	} as LayoutConfig,

	/**
	 * Subtle indicators (underline style, minimal distraction)
	 */
	subtle: {
		...DEFAULT_LAYOUT_CONFIG,
		tooltips: {
			moduleIcons: 'hover',
			moduleNavigation: 'hover',
			userControls: 'never'
		},
		activeState: {
			moduleIconStyle: 'underline',
			navItemStyle: 'underline',
			activeColor: 'text-blue-600'
		}
	} as LayoutConfig,

	/**
	 * Highlighted style (prominent active states)
	 */
	highlighted: {
		...DEFAULT_LAYOUT_CONFIG,
		tooltips: {
			moduleIcons: 'hover',
			moduleNavigation: 'hover',
			userControls: 'hover'
		},
		activeState: {
			moduleIconStyle: 'highlight',
			navItemStyle: 'highlight',
			activeColor: 'bg-blue-100 text-blue-900'
		}
	} as LayoutConfig
};

/**
 * Get the active state class based on configuration
 */
export function getActiveStateClass(
	style: ActiveStateStyle,
	color: string,
	isActive: boolean
): string {
	if (!isActive) return '';

	switch (style) {
		case 'highlight':
			return `${color} rounded-lg`;
		case 'pill':
			return `${color} text-white rounded-full`;
		case 'underline':
			return `${color} border-b-2 border-current`;
		case 'background':
			return `${color} text-white rounded-lg`;
		case 'border-left':
			return `border-l-4 border-current pl-2 ${color}`;
		default:
			return '';
	}
}

# Layout Configuration Guide

## Overview

The MoLOS layout system is highly configurable, allowing you to customize tooltips, active state indicators, sidebar styling, and module-specific navigation.

## Configuration Files

### 1. Layout Configuration (`layout.config.ts`)

Controls tooltips, active states, sidebar styling, and topbar behavior.

#### Key Configuration Options

```typescript
// Tooltip Display
tooltips: {
  moduleIcons: 'hover' | 'always' | 'never',     // Show module names
  moduleNavigation: 'hover' | 'always' | 'never', // Show nav item names
  userControls: 'hover' | 'always' | 'never',    // Show user control labels
}

// Active State Indicators
activeState: {
  moduleIconStyle: 'highlight' | 'pill' | 'underline' | 'background' | 'border-left',
  navItemStyle: 'highlight' | 'pill' | 'underline' | 'background' | 'border-left',
  activeColor: string, // Tailwind class (e.g., 'bg-primary', 'bg-blue-500')
}

// Sidebar Styling
sidebar: {
  width: string,           // Tailwind width class (e.g., 'w-1/3 max-w-xs')
  showSeparators: boolean, // Show lines between sections
  moduleIconSize: string,  // h-X w-X (e.g., 'h-12 w-12')
  navIconSize: string,     // h-X w-X (e.g., 'h-10 w-10')
  userIconSize: string,    // h-X w-X (e.g., 'h-10 w-10')
}

// Topbar Behavior
topbar: {
  showOnHover: boolean,      // Show topbar when hovering over content area
  animationDuration: number, // Animation duration in milliseconds
}
```

#### Active State Styles

| Style         | Description                | Example                            |
| ------------- | -------------------------- | ---------------------------------- |
| `highlight`   | Light background highlight | Subtle colored background          |
| `pill`        | Colored pill/badge style   | Rounded background with text color |
| `underline`   | Bottom border underline    | Text underline style               |
| `background`  | Solid background color     | Prominent colored background       |
| `border-left` | Left border indicator      | Thick left border with color       |

#### Available Presets

```typescript
LAYOUT_PRESETS.iconOnly; // Icon-only, minimal labels, pill style
LAYOUT_PRESETS.alwaysLabeled; // Always show labels, accessibility-focused
LAYOUT_PRESETS.subtle; // Minimal distraction, underline style
LAYOUT_PRESETS.highlighted; // Prominent active states, highlight style
```

### 2. Module Navigation Configuration (`modules/`)

Each module can define its own unique navigation structure.

#### Defining a New Module

```typescript
export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
	'/ui/yourmodule': {
		name: 'Your Module',
		href: '/ui/yourmodule',
		icon: YourIcon, // lucide-svelte icon
		description: 'Module description',
		navigation: [
			{ name: 'Nav Item 1', icon: Icon1 },
			{ name: 'Nav Item 2', icon: Icon2, badge: 5 },
			{ name: 'Nav Item 3', icon: Icon3, disabled: true }
		]
	}
};
```

#### NavItem Properties

```typescript
interface NavItem {
	name: string; // Display name for tooltip
	icon: any; // lucide-svelte icon component
	href?: string; // Optional route for future navigation
	badge?: number; // Optional badge count (displayed on icon)
	disabled?: boolean; // Optional disabled state
}
```

## Usage Examples

### Example 1: Using a Preset

```typescript
import { LAYOUT_PRESETS } from '$lib/config/layout.config';

// In your layout component
const config = LAYOUT_PRESETS.iconOnly; // or alwaysLabeled, subtle, highlighted
```

### Example 2: Customizing the Default Config

Edit `layout.config.ts`:

```typescript
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
	tooltips: {
		moduleIcons: 'always', // Always show module names
		moduleNavigation: 'hover', // Show on hover
		userControls: 'never' // Never show labels
	},

	activeState: {
		moduleIconStyle: 'border-left', // Use left border for modules
		navItemStyle: 'underline', // Use underline for nav items
		activeColor: 'text-blue-600'
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
		animationDuration: 300
	}
};
```

### Example 3: Adding a New Module

See [Module Configuration Guide](./modules/README.md) for detailed instructions.

### Example 4: Adding Badges to Navigation Items

```typescript
'/ui/tasks': {
  name: 'Tasks',
  href: '/ui/tasks',
  icon: List,
  navigation: [
    { name: 'All Tasks', icon: List, badge: 12 },
    { name: 'My Tasks', icon: CheckSquare, badge: 5 },
    { name: 'Completed', icon: CheckCircle },
    { name: 'Scheduled', icon: Calendar, badge: 3 },
  ],
}
```

## Helper Functions

### `getActiveStateClass(style, color, isActive)`

Returns the appropriate Tailwind classes for the active state style.

```typescript
import { getActiveStateClass } from './layout.config';

const activeClass = getActiveStateClass('pill', 'bg-blue-500', true);
// Returns: 'bg-blue-500 text-white rounded-full'
```

### `getModuleNavigation(modulePath)`

Get navigation items for a specific module.

```typescript
import { getModuleNavigation } from './modules';

const navItems = getModuleNavigation('/ui/dashboard');
```

### `getAvailableModules()`

Get all available modules.

```typescript
import { getAllModules } from './modules';

const modules = getAllModules();
```

### `getModuleConfig(path)`

Get complete configuration for a specific module.

```typescript
import { getModuleById } from './modules';

const config = getModuleById('dashboard');
```

## Quick Reference

### Change Active State Style

```typescript
// In layout.config.ts
activeState: {
  moduleIconStyle: 'border-left',  // Changed from 'background'
  navItemStyle: 'underline',       // Changed from 'background'
  activeColor: 'text-blue-600',
}
```

### Show All Tooltips

```typescript
tooltips: {
  moduleIcons: 'always',
  moduleNavigation: 'always',
  userControls: 'always',
}
```

### Hide All Tooltips

```typescript
tooltips: {
  moduleIcons: 'never',
  moduleNavigation: 'never',
  userControls: 'never',
}
```

### Disable Topbar

```typescript
topbar: {
  showOnHover: false,  // Topbar won't appear
  animationDuration: 200,
}
```

### Reduce Sidebar Width

```typescript
sidebar: {
  width: 'w-1/4 max-w-sm',  // Changed from 'w-1/3 max-w-xs'
  // ... rest of config
}
```

## Related Documentation

- [Module Configuration](./modules/README.md) - How to add new modules
- [Layout Implementation Summary](./LAYOUT_IMPLEMENTATION_SUMMARY.md) - System overview

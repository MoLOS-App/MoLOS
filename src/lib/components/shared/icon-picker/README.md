# Icon Picker Component

A reusable component for selecting icons from icon packs or emojis.

## Features

- **Icon Packs**: Extensible plugin system for adding new icon packs
- **Emojis**: Predefined categories with curated emoji sets
- **Search**: Filter icons and emojis by name or keywords
- **String Return**: Returns string identifiers (e.g., `'lucide-SquareCheck'` or `'😀'`)
- **Curated Subsets**: Includes ~100+ commonly used Lucide icons and 500+ curated emojis

## Installation

The component is located at:

```
src/lib/components/shared/icon-picker/
```

## Usage

```svelte
<script>
	import { IconPicker } from '$lib/components/shared/icon-picker';

	let selectedIcon = 'lucide-SquareCheck';
</script>

<IconPicker selected={selectedIcon} onSelect={(icon) => (selectedIcon = icon)} size="md" />
```

## Props

| Prop           | Type                     | Default      | Description                                                      |
| -------------- | ------------------------ | ------------ | ---------------------------------------------------------------- |
| `selected`     | `string`                 | `undefined`  | Currently selected icon (e.g., `'lucide-SquareCheck'` or `'😀'`) |
| `onSelect`     | `(icon: string) => void` | **required** | Callback when icon is selected                                   |
| `size`         | `'sm' \| 'md' \| 'lg'`   | `'md'`       | Size of the trigger button                                       |
| `enableEmojis` | `boolean`                | `true`       | Whether to show emojis tab                                       |
| `class`        | `string`                 | `undefined`  | Additional CSS classes                                           |

## Return Values

### Lucide Icons

Returns strings in the format: `'lucide-{IconName}'`

Examples:

- `'lucide-SquareCheck'`
- `'lucide-Search'`
- `'lucide-Star'`
- `'lucide-Home'`

### Emojis

Returns the emoji string directly:

Examples:

- `'😀'`
- `'⭐'`
- `'🔥'`
- `'✅'`

## Emoji Categories

The component includes 6 predefined emoji categories:

1. **People** - Faces, gestures, people
2. **Nature** - Animals, plants, weather
3. **Food** - Fruits, vegetables, meals, drinks
4. **Activities** - Sports, hobbies, events
5. **Objects** - Tools, tech, household items, symbols
6. **Symbols** - Arrows, math symbols, shapes, checks

## Extending with New Icon Packs

You can add new icon packs using the plugin system:

```typescript
import { registerIconPack } from '$lib/components/shared/icon-picker';
import type { IconPack, IconEntry } from '$lib/components/shared/icon-picker';

// Create your icon pack
const myCustomPack: IconPack = {
	id: 'my-custom',
	name: 'My Custom Icons',
	getIcons(): IconEntry[] {
		return [
			{
				id: 'MyIcon1',
				component: MyIconComponent1,
				keywords: ['custom', 'icon1', 'example']
			},
			{
				id: 'MyIcon2',
				component: MyIconComponent2,
				keywords: ['custom', 'icon2']
			}
		];
	}
};

// Register the pack
registerIconPack(myCustomPack);
```

After registering, icons will be available in the picker and return as:
`'my-custom-MyIcon1'`, `'my-custom-MyIcon2'`, etc.

## Icon Pack Interface

```typescript
interface IconPack {
	id: string; // Unique pack identifier
	name: string; // Display name
	getIcons(): IconEntry[]; // Returns array of icons
}

interface IconEntry {
	id: string; // Unique icon name
	component: Component; // Svelte component
	keywords: string[]; // Search keywords
}
```

## Available Lucide Icons

The curated Lucide pack includes ~100+ commonly used icons:

**Actions**: Check, X, Plus, Minus, Edit, Trash, Search, Menu, Settings, etc.
**User**: User, Users, etc.
**Notifications**: Bell, BellRing, etc.
**Favorites**: Star, Heart, Bookmark, Share, etc.
**Files**: File, Folder, Download, Upload, etc.
**Navigation**: Home, MapPin, Chevron, Arrow, etc.
**Time**: Calendar, Clock, etc.
**Help**: Info, HelpCircle, Alert, etc.
**Visibility**: Eye, Lock, Shield, etc.
**Media**: Image, Video, Music, Message, etc.
**UI Tools**: Filter, Sort, Grid, List, etc.
**Security**: Lock, Shield, etc.
**And many more...**

## Utilities

The component exports several utility functions:

```typescript
import {
	getIconType, // Determine if string is emoji or icon
	parseIconIdentifier, // Parse 'lucide-SquareCheck' -> {packId, iconName}
	searchIcons, // Search all registered icons
	searchEmojis, // Search emojis by category name
	getAllEmojis, // Get all emojis
	EMOJI_CATEGORIES // Array of emoji categories
} from '$lib/components/shared/icon-picker';
```

## Accessibility

- Full keyboard navigation support
- ARIA labels on all interactive elements
- Focus indicators
- Screen reader announcements

## Examples

### Basic Icon Picker

```svelte
<script>
	import { IconPicker } from '$lib/components/shared/icon-picker';
	let icon = '';
</script>

<IconPicker {icon} onSelect={(i) => (icon = i)} />
```

### With Default Icon

```svelte
<script>
	import { IconPicker } from '$lib/components/shared/icon-picker';
	let icon = 'lucide-Home';
</script>

<IconPicker selected={icon} onSelect={(i) => (icon = i)} size="lg" />
```

### Icons Only (No Emojis)

```svelte
<IconPicker selected={icon} onSelect={(i) => (icon = i)} enableEmojis={false} />
```

### Different Sizes

```svelte
<div class="flex gap-2">
	<IconPicker size="sm" />
	<IconPicker size="md" />
	<IconPicker size="lg" />
</div>
```

## License

This component follows the same license as the MoLOS project.

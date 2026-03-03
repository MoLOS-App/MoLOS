/**
 * Icon Picker Component
 * A reusable component for selecting icons from icon packs or emojis
 */

import IconPicker from './icon-picker.svelte';
import IconPickerTrigger from './icon-picker-trigger.svelte';
import IconPickerContent from './icon-picker-content.svelte';
import IconPickerIcons from './icon-picker-icons.svelte';
import IconPickerEmojis from './icon-picker-emojis.svelte';

export { IconPicker, IconPickerTrigger, IconPickerContent, IconPickerIcons, IconPickerEmojis };

// Re-export types from icon pack utilities
export type { IconEntry, IconPack } from './utils/icon-packs.js';

// Re-export types from emoji data
export type { EmojiCategory } from './utils/emoji-data.js';

// Re-export icon pack utilities
export {
	registerIconPack,
	getIconPack,
	getAllIconPacks,
	getAllIcons,
	searchIcons,
	getIconType,
	parseIconIdentifier
} from './utils/icon-packs.js';

// Re-export emoji utilities
export { EMOJI_CATEGORIES, getAllEmojis, searchEmojis } from './utils/emoji-data.js';

// Re-export lucide pack for registration if needed
export { lucideIconPack } from './utils/lucide-pack.js';

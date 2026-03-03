/**
 * Icon Picker Component
 * A reusable component for selecting icons from icon packs or emojis
 */

import IconPicker from './icon-picker.svelte';
export { IconPicker, IconPicker as default };
export { default as IconPickerTrigger } from './icon-picker-trigger.svelte';
export { default as IconPickerContent } from './icon-picker-content.svelte';
export { default as IconPickerIcons } from './icon-picker-icons.svelte';
export { default as IconPickerEmojis } from './icon-picker-emojis.svelte';

export type { IconEntry, IconPack } from './utils/icon-packs.js';

export type { EmojiCategory } from './utils/emoji-data.js';

export {
	registerIconPack,
	getIconPack,
	getAllIconPacks,
	getAllIcons,
	searchIcons,
	getIconType,
	parseIconIdentifier
} from './utils/icon-packs.js';

export { EMOJI_CATEGORIES, getAllEmojis, searchEmojis } from './utils/emoji-data.js';

export { lucideIconPack } from './utils/lucide-pack.js';

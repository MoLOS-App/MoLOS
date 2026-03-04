/**
 * Icon recognition challenge generator
 * Generates challenges using Lucide icons
 */

import type {
	Challenge,
	ChallengeDifficulty,
	ChallengeGenerator,
	IconChallengeEntry
} from '../types.js';
import { getRandomItem, generateChallengeId, shuffleArray } from '../utils/randomizer.js';
import { normalizeText } from '../utils/validator.js';
import * as LucideIcons from 'lucide-svelte';

/**
 * Curated icons for recognition challenges
 * These are easily recognizable icons with clear names
 */
const RECOGNITION_ICONS: IconChallengeEntry[] = [
	{
		id: 'Mail',
		name: 'Email',
		component: LucideIcons.Mail,
		keywords: ['email', 'mail', 'message', 'inbox']
	},
	{
		id: 'Phone',
		name: 'Phone',
		component: LucideIcons.Phone,
		keywords: ['phone', 'call', 'telephone', 'mobile']
	},
	{
		id: 'Home',
		name: 'Home',
		component: LucideIcons.Home,
		keywords: ['home', 'house', 'main', 'dashboard']
	},
	{
		id: 'Star',
		name: 'Star',
		component: LucideIcons.Star,
		keywords: ['star', 'favorite', 'rating', 'bookmark']
	},
	{
		id: 'Heart',
		name: 'Heart',
		component: LucideIcons.Heart,
		keywords: ['heart', 'love', 'like', 'favorite']
	},
	{
		id: 'Search',
		name: 'Search',
		component: LucideIcons.Search,
		keywords: ['search', 'find', 'lookup', 'magnifier']
	},
	{
		id: 'Settings',
		name: 'Settings',
		component: LucideIcons.Settings,
		keywords: ['settings', 'gear', 'config', 'preferences']
	},
	{
		id: 'User',
		name: 'User',
		component: LucideIcons.User,
		keywords: ['user', 'person', 'profile', 'account']
	},
	{
		id: 'Camera',
		name: 'Camera',
		component: LucideIcons.Camera,
		keywords: ['camera', 'photo', 'picture', 'capture']
	},
	{
		id: 'Music',
		name: 'Music',
		component: LucideIcons.Music,
		keywords: ['music', 'audio', 'song', 'melody']
	},
	{
		id: 'Video',
		name: 'Video',
		component: LucideIcons.Video,
		keywords: ['video', 'movie', 'film', 'play']
	},
	{
		id: 'Image',
		name: 'Image',
		component: LucideIcons.Image,
		keywords: ['image', 'picture', 'photo', 'gallery']
	},
	{
		id: 'Calendar',
		name: 'Calendar',
		component: LucideIcons.Calendar,
		keywords: ['calendar', 'date', 'schedule', 'event']
	},
	{
		id: 'Clock',
		name: 'Clock',
		component: LucideIcons.Clock,
		keywords: ['clock', 'time', 'watch', 'hour']
	},
	{
		id: 'MapPin',
		name: 'Location',
		component: LucideIcons.MapPin,
		keywords: ['location', 'map', 'pin', 'place']
	},
	{
		id: 'Lock',
		name: 'Lock',
		component: LucideIcons.Lock,
		keywords: ['lock', 'secure', 'password', 'privacy']
	},
	{
		id: 'Bell',
		name: 'Bell',
		component: LucideIcons.Bell,
		keywords: ['bell', 'notification', 'alert', 'ring']
	},
	{
		id: 'Cloud',
		name: 'Cloud',
		component: LucideIcons.Cloud,
		keywords: ['cloud', 'weather', 'storage', 'sky']
	},
	{
		id: 'Sun',
		name: 'Sun',
		component: LucideIcons.Sun,
		keywords: ['sun', 'day', 'light', 'bright']
	},
	{
		id: 'Moon',
		name: 'Moon',
		component: LucideIcons.Moon,
		keywords: ['moon', 'night', 'dark', 'sleep']
	},
	{
		id: 'ShoppingCart',
		name: 'Shopping Cart',
		component: LucideIcons.ShoppingCart,
		keywords: ['cart', 'shopping', 'buy', 'store']
	},
	{
		id: 'Trash',
		name: 'Trash',
		component: LucideIcons.Trash,
		keywords: ['trash', 'delete', 'bin', 'remove']
	},
	{
		id: 'Edit',
		name: 'Edit',
		component: LucideIcons.Edit,
		keywords: ['edit', 'modify', 'change', 'pencil']
	},
	{
		id: 'Download',
		name: 'Download',
		component: LucideIcons.Download,
		keywords: ['download', 'save', 'get', 'retrieve']
	}
];

/**
 * Get icons for a specific difficulty
 */
function getIconsForDifficulty(difficulty: ChallengeDifficulty): IconChallengeEntry[] {
	// All difficulties use the same pool for consistency
	// But we could filter by complexity if needed
	return RECOGNITION_ICONS;
}

/**
 * Generate an icon recognition challenge
 */
export const generateIconRecognitionChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	const iconPool = getIconsForDifficulty(difficulty);

	// Select a random correct icon
	const correctIcon = getRandomItem(iconPool);

	// Get other icons for distractors
	const otherIcons = iconPool.filter((icon) => icon.id !== correctIcon.id);
	const shuffledOthers = shuffleArray(otherIcons);

	// Number of options based on difficulty
	const optionCount = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 4 : 6;

	// Select distractors
	const distractors = shuffledOthers.slice(0, optionCount - 1);

	// Combine and shuffle options
	const allOptions = shuffleArray([correctIcon, ...distractors]);

	return {
		id: generateChallengeId(),
		type: 'icon-recognition',
		difficulty,
		question: `Which icon represents "${correctIcon.name}"?`,
		options: allOptions.map((icon) => icon.name),
		correctAnswer: correctIcon.name,
		iconOptions: allOptions,
		correctIconId: correctIcon.id,
		validator: (userAnswer) => {
			const normalizedUser = typeof userAnswer === 'string' ? normalizeText(userAnswer) : '';
			const normalizedCorrect = normalizeText(correctIcon.name);
			return normalizedUser === normalizedCorrect;
		},
		metadata: {
			category: 'icon-recognition',
			answerType: 'selection',
			correctIconId: correctIcon.id
		}
	};
};

/**
 * Generate a custom icon recognition challenge
 */
export function generateCustomIconChallenge(
	targetIcon: IconChallengeEntry,
	distractors: IconChallengeEntry[],
	difficulty: ChallengeDifficulty = 'medium'
): Challenge {
	const allOptions = shuffleArray([targetIcon, ...distractors]);

	return {
		id: generateChallengeId(),
		type: 'icon-recognition',
		difficulty,
		question: `Which icon represents "${targetIcon.name}"?`,
		options: allOptions.map((icon) => icon.name),
		correctAnswer: targetIcon.name,
		iconOptions: allOptions,
		correctIconId: targetIcon.id,
		validator: (userAnswer) => {
			const normalizedUser = typeof userAnswer === 'string' ? normalizeText(userAnswer) : '';
			const normalizedCorrect = normalizeText(targetIcon.name);
			return normalizedUser === normalizedCorrect;
		},
		metadata: {
			category: 'icon-recognition',
			answerType: 'selection',
			correctIconId: targetIcon.id
		}
	};
}

/**
 * Export icons for use in components
 */
export { RECOGNITION_ICONS };

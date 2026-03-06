/**
 * Challenge randomization utilities
 * Handles selection and randomization of challenges
 */

import type {
	Challenge,
	ChallengeType,
	ChallengeDifficulty,
	VerificationConfig,
	ChallengeGenerator,
	ChallengeRegistry
} from '../types.js';
import { getEnabledChallengeTypes, selectRandomDifficulty } from '../config.js';

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Get a random item from an array
 */
export function getRandomItem<T>(array: T[]): T {
	return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get multiple random unique items from an array
 */
export function getRandomItems<T>(array: T[], count: number): T[] {
	const shuffled = shuffleArray(array);
	return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random number with decimals between min and max
 */
export function randomFloat(min: number, max: number, decimals: number = 0): number {
	const value = Math.random() * (max - min) + min;
	return Number(value.toFixed(decimals));
}

/**
 * Generate a unique challenge ID
 */
export function generateChallengeId(): string {
	return `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Select random challenge types for a session
 */
export function selectChallengeTypes(
	count: number,
	allowedTypes: ChallengeType[],
	ensureVariety: boolean = true
): ChallengeType[] {
	if (!ensureVariety || count <= allowedTypes.length) {
		// Get random types, possibly with duplicates if count > allowedTypes
		const selected: ChallengeType[] = [];
		for (let i = 0; i < count; i++) {
			selected.push(getRandomItem(allowedTypes));
		}
		return selected;
	}

	// Ensure variety: first pick unique types, then fill with random
	const shuffled = shuffleArray(allowedTypes);
	const selected = shuffled.slice(0, allowedTypes.length);

	// Fill remaining slots with random types
	while (selected.length < count) {
		selected.push(getRandomItem(allowedTypes));
	}

	return shuffleArray(selected);
}

/**
 * Generate a session of challenges using the registry
 */
export function generateChallengeSession(
	registry: ChallengeRegistry,
	config: VerificationConfig
): Challenge[] {
	const allowedTypes = getEnabledChallengeTypes(config.challengeTypes);
	const selectedTypes = selectChallengeTypes(config.challengeCount, allowedTypes);

	const challenges: Challenge[] = [];

	for (const type of selectedTypes) {
		const generator = registry.get(type);
		if (!generator) {
			console.warn(`No generator found for challenge type: ${type}`);
			continue;
		}

		const difficulty = selectRandomDifficulty(
			config.difficultyWeighting ?? { easy: 50, medium: 35, hard: 15 }
		);

		const challenge = generator(difficulty);
		challenges.push(challenge);
	}

	return challenges;
}

/**
 * Scramble a string (for word puzzles)
 */
export function scrambleString(str: string): string {
	const chars = str.split('');
	return shuffleArray(chars).join('');
}

/**
 * Generate random arithmetic operators
 */
export function getRandomOperator(difficulty: ChallengeDifficulty): string {
	const easyOps = ['+', '-'];
	const mediumOps = ['+', '-', '×'];
	const hardOps = ['+', '-', '×', '÷'];

	switch (difficulty) {
		case 'easy':
			return getRandomItem(easyOps);
		case 'medium':
			return getRandomItem(mediumOps);
		case 'hard':
			return getRandomItem(hardOps);
	}
}

/**
 * Generate a number range based on difficulty
 */
export function getNumberRange(difficulty: ChallengeDifficulty): { min: number; max: number } {
	switch (difficulty) {
		case 'easy':
			return { min: 1, max: 10 };
		case 'medium':
			return { min: 10, max: 50 };
		case 'hard':
			return { min: 50, max: 100 };
	}
}

/**
 * Pick N random items ensuring one is correct
 */
export function pickOptionsWithCorrect<T>(allItems: T[], correctItem: T, count: number): T[] {
	const otherItems = allItems.filter((item) => item !== correctItem);
	const randomOthers = getRandomItems(otherItems, count - 1);
	const options = [...randomOthers, correctItem];
	return shuffleArray(options);
}

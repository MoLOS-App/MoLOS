/**
 * Sorting challenge generator
 * Generates item ordering/sorting challenges
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { SORTING_CHALLENGES } from '../config.js';
import { getRandomItem, generateChallengeId, shuffleArray } from '../utils/randomizer.js';
import { validateArrayAnswer } from '../utils/validator.js';

/**
 * Parse user's sorted answer
 */
function parseSortedAnswer(answer: string | string[]): string[] {
	if (Array.isArray(answer)) {
		return answer.map((s) => s.trim());
	}

	// Split by commas, numbered lists, or newlines
	const items = answer
		.split(/[,\n]+|\d+\.\s*/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	return items;
}

/**
 * Generate a sorting challenge
 */
export const generateSortingChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	// Filter challenges by difficulty
	const eligibleChallenges = SORTING_CHALLENGES.filter((c) => c.difficulty === difficulty);

	// If no challenges match, use all
	const challengePool = eligibleChallenges.length > 0 ? eligibleChallenges : SORTING_CHALLENGES;

	// Select a random challenge
	const selectedChallenge = getRandomItem(challengePool);

	// Shuffle items for display
	const shuffledItems = shuffleArray([...selectedChallenge.items]);

	// Format question
	const question = `${selectedChallenge.instruction}\n\nItems: ${shuffledItems.map((i) => `"${i}"`).join(', ')}\n\nEnter the items in the correct order (separated by commas):`;

	return {
		id: generateChallengeId(),
		type: 'sorting',
		difficulty,
		question,
		options: shuffledItems,
		correctAnswer: selectedChallenge.correctOrder,
		validator: (userAnswer) => {
			const userItems = parseSortedAnswer(userAnswer);
			return validateArrayAnswer(userItems, selectedChallenge.correctOrder, true);
		},
		metadata: {
			category: 'sorting',
			answerType: 'array',
			instruction: selectedChallenge.instruction,
			shuffledItems,
			originalItems: selectedChallenge.items
		}
	};
};

/**
 * Generate a custom sorting challenge
 */
export function generateCustomSortingChallenge(
	instruction: string,
	items: string[],
	correctOrder: string[],
	difficulty: ChallengeDifficulty = 'medium'
): Challenge {
	const shuffledItems = shuffleArray([...items]);

	const question = `${instruction}\n\nItems: ${shuffledItems.map((i) => `"${i}"`).join(', ')}\n\nEnter the items in the correct order (separated by commas):`;

	return {
		id: generateChallengeId(),
		type: 'sorting',
		difficulty,
		question,
		options: shuffledItems,
		correctAnswer: correctOrder,
		validator: (userAnswer) => {
			const userItems = parseSortedAnswer(userAnswer);
			return validateArrayAnswer(userItems, correctOrder, true);
		},
		metadata: {
			category: 'sorting',
			answerType: 'array',
			instruction,
			shuffledItems,
			originalItems: items
		}
	};
}

/**
 * Generate a numeric sorting challenge
 */
export function generateNumericSortingChallenge(
	difficulty: ChallengeDifficulty = 'easy'
): Challenge {
	const count = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;
	const numbers: number[] = [];

	// Generate random numbers
	while (numbers.length < count) {
		const num = Math.floor(Math.random() * 100) + 1;
		if (!numbers.includes(num)) {
			numbers.push(num);
		}
	}

	const correctOrder = [...numbers].sort((a, b) => a - b).map(String);
	const shuffledNumbers = shuffleArray([...numbers].map(String));

	return {
		id: generateChallengeId(),
		type: 'sorting',
		difficulty,
		question: `Sort these numbers from smallest to largest:\n\n${shuffledNumbers.join(', ')}\n\nEnter the numbers in the correct order (separated by commas):`,
		options: shuffledNumbers,
		correctAnswer: correctOrder,
		validator: (userAnswer) => {
			const userItems = parseSortedAnswer(userAnswer);
			return validateArrayAnswer(userItems, correctOrder, true);
		},
		metadata: {
			category: 'sorting',
			answerType: 'array',
			instruction: 'Sort from smallest to largest',
			shuffledItems: shuffledNumbers,
			originalItems: numbers.map(String)
		}
	};
}

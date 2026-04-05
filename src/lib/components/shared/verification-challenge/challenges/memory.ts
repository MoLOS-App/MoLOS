/**
 * Memory challenge generator
 * Generates memory recall challenges
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { MEMORY_ITEMS } from '../config.js';
import {
	getRandomItem,
	generateChallengeId,
	shuffleArray,
	randomInt
} from '../utils/randomizer.js';
import { validateArrayAnswer } from '../utils/validator.js';

/**
 * Generate a memory challenge
 */
export const generateMemoryChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	// Filter items by difficulty
	const eligibleItems = MEMORY_ITEMS.filter((m) => m.difficulty === difficulty);

	// If no items match, use all
	const itemPool = eligibleItems.length > 0 ? eligibleItems : MEMORY_ITEMS;

	// Select a random memory set
	const selectedMemory = getRandomItem(itemPool);

	// Shuffle items for display
	const shuffledItems = shuffleArray([...selectedMemory.items]);

	// Generate question types based on difficulty
	const questionType = randomInt(0, 2);
	let question: string;
	let correctAnswer: string | string[];

	switch (questionType) {
		case 0:
			// Ask for specific position - simple and clear
			const position = randomInt(1, shuffledItems.length);
			question = `If you saw this sequence: "${shuffledItems.join(', ')}"\n\nWhat was the item at position ${position}?`;
			correctAnswer = shuffledItems[position - 1];
			break;
		case 1:
			// Ask to identify which item was NOT in the list (easier than recall)
			const wrongItem = 'Xylophone'; // Obviously wrong item
			const options = shuffleArray([...shuffledItems.slice(0, 3), wrongItem]);
			question = `You saw: "${shuffledItems.join(', ')}"\n\nWhich item was NOT in the list?`;
			correctAnswer = wrongItem;
			break;
		case 2:
			// Ask for first/last item - simple
			const askFirst = Math.random() > 0.5;
			question = `Given this list: "${shuffledItems.join(', ')}"\n\nWhat was the ${askFirst ? 'first' : 'last'} item?`;
			correctAnswer = askFirst ? shuffledItems[0] : shuffledItems[shuffledItems.length - 1];
			break;
		default:
			question = `Given this list: "${shuffledItems.join(', ')}"\n\nWhat was the first item?`;
			correctAnswer = shuffledItems[0];
	}

	return {
		id: generateChallengeId(),
		type: 'memory',
		difficulty,
		question,
		correctAnswer,
		validator: (userAnswer) => {
			if (Array.isArray(correctAnswer)) {
				// For list questions, order doesn't matter
				const userItems =
					typeof userAnswer === 'string' ? userAnswer.split(',').map((s) => s.trim()) : userAnswer;
				return validateArrayAnswer(userItems, correctAnswer, false);
			} else {
				// For single item questions
				const normalizedUser = typeof userAnswer === 'string' ? userAnswer.trim() : '';
				const normalizedCorrect = correctAnswer.trim();
				return normalizedUser.toLowerCase() === normalizedCorrect.toLowerCase();
			}
		},
		metadata: {
			category: 'memory',
			answerType: 'text',
			items: shuffledItems,
			category_name: selectedMemory.category,
			questionType
		}
	};
};

/**
 * Generate a custom memory challenge
 */
export function generateCustomMemoryChallenge(
	items: string[],
	difficulty: ChallengeDifficulty = 'medium',
	questionType: 'position' | 'list' | 'first-last' = 'position'
): Challenge {
	const shuffledItems = shuffleArray([...items]);
	let question: string;
	let correctAnswer: string | string[];

	switch (questionType) {
		case 'position':
			const position = randomInt(1, shuffledItems.length);
			question = `If you saw: "${shuffledItems.join(', ')}"\n\nWhat was the item at position ${position}?`;
			correctAnswer = shuffledItems[position - 1];
			break;
		case 'list':
			question = `Given: "${shuffledItems.join(', ')}"\n\nWhat was the first item?`;
			correctAnswer = shuffledItems[0];
			break;
		case 'first-last':
			const askFirst = Math.random() > 0.5;
			question = `Given: "${shuffledItems.join(', ')}"\n\nWhat was the ${askFirst ? 'first' : 'last'} item?`;
			correctAnswer = askFirst ? shuffledItems[0] : shuffledItems[shuffledItems.length - 1];
			break;
	}

	return {
		id: generateChallengeId(),
		type: 'memory',
		difficulty,
		question,
		correctAnswer,
		validator: (userAnswer) => {
			if (Array.isArray(correctAnswer)) {
				const userItems =
					typeof userAnswer === 'string' ? userAnswer.split(',').map((s) => s.trim()) : userAnswer;
				return validateArrayAnswer(userItems, correctAnswer, false);
			} else {
				const normalizedUser = typeof userAnswer === 'string' ? userAnswer.trim() : '';
				const normalizedCorrect = correctAnswer.trim();
				return normalizedUser.toLowerCase() === normalizedCorrect.toLowerCase();
			}
		},
		metadata: {
			category: 'memory',
			answerType: 'text',
			items: shuffledItems,
			questionType
		}
	};
}

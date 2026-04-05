/**
 * Default configuration for Verification Challenge Component
 */

import { DEFAULT_CONFIG, ALL_CHALLENGE_TYPES } from './types.js';
import type { ChallengeType, ChallengeDifficulty, VerificationConfig } from './types.js';

/**
 * Default difficulty weighting
 */
const DEFAULT_DIFFICULTY_WEIGHTING: Record<ChallengeDifficulty, number> = {
	easy: 50,
	medium: 35,
	hard: 15
};

/**
 * Create a configuration with defaults overridden by user options
 */
export function createConfig(userConfig?: Partial<VerificationConfig>): VerificationConfig {
	const userWeighting = userConfig?.difficultyWeighting;

	return {
		...DEFAULT_CONFIG,
		...userConfig,
		difficultyWeighting: {
			easy: userWeighting?.easy ?? DEFAULT_DIFFICULTY_WEIGHTING.easy,
			medium: userWeighting?.medium ?? DEFAULT_DIFFICULTY_WEIGHTING.medium,
			hard: userWeighting?.hard ?? DEFAULT_DIFFICULTY_WEIGHTING.hard
		}
	};
}

/**
 * Get the list of challenge types to use based on config
 */
export function getEnabledChallengeTypes(types?: ChallengeType[]): ChallengeType[] {
	if (!types || types.length === 0) {
		return [...ALL_CHALLENGE_TYPES];
	}
	return types;
}

/**
 * Select a random difficulty based on weighting
 */
export function selectRandomDifficulty(
	weighting: Record<ChallengeDifficulty, number>
): ChallengeDifficulty {
	const total = weighting.easy + weighting.medium + weighting.hard;
	const random = Math.random() * total;

	if (random < weighting.easy) {
		return 'easy';
	} else if (random < weighting.easy + weighting.medium) {
		return 'medium';
	}
	return 'hard';
}

/**
 * Phrase bank for text-input challenges
 */
export const TEXT_INPUT_PHRASES = [
	{ phrase: 'confirm', hint: 'Type "confirm"' },
	{ phrase: 'delete', hint: 'Type "delete"' },
	{ phrase: 'proceed', hint: 'Type "proceed"' },
	{ phrase: 'continue', hint: 'Type "continue"' },
	{ phrase: 'accept', hint: 'Type "accept"' },
	{ phrase: 'approve', hint: 'Type "approve"' },
	{ phrase: 'yes', hint: 'Type "yes"' },
	{ phrase: 'okay', hint: 'Type "okay"' },
	{ phrase: 'remove', hint: 'Type "remove"' },
	{ phrase: 'submit', hint: 'Type "submit"' }
];

/**
 * Word bank for word-puzzle challenges
 */
export const WORD_PUZZLE_WORDS = [
	'apple',
	'beach',
	'chair',
	'dance',
	'earth',
	'flame',
	'grape',
	'house',
	'image',
	'juice',
	'knife',
	'lemon',
	'mouse',
	'nurse',
	'ocean',
	'piano',
	'queen',
	'river',
	'stone',
	'tiger',
	'uncle',
	'voice',
	'water',
	'youth',
	'zebra',
	'cloud',
	'dream',
	'frost',
	'globe',
	'happy'
];

/**
 * Question bank for multiple-choice challenges
 */
export const MULTIPLE_CHOICE_QUESTIONS: Array<{
	question: string;
	options: string[];
	correct: number;
	difficulty: ChallengeDifficulty;
}> = [
	{
		question: 'What color is the sky on a clear day?',
		options: ['Blue', 'Green', 'Red', 'Yellow'],
		correct: 0,
		difficulty: 'easy'
	},
	{
		question: 'How many days are in a week?',
		options: ['5', '6', '7', '8'],
		correct: 2,
		difficulty: 'easy'
	},
	{
		question: 'What is the capital of France?',
		options: ['London', 'Berlin', 'Paris', 'Madrid'],
		correct: 2,
		difficulty: 'easy'
	},
	{
		question: 'Which planet is closest to the Sun?',
		options: ['Venus', 'Mercury', 'Earth', 'Mars'],
		correct: 1,
		difficulty: 'medium'
	},
	{
		question: 'What is the largest ocean on Earth?',
		options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
		correct: 3,
		difficulty: 'medium'
	},
	{
		question: 'How many continents are there?',
		options: ['5', '6', '7', '8'],
		correct: 2,
		difficulty: 'easy'
	},
	{
		question: 'What is the chemical symbol for water?',
		options: ['H2O', 'CO2', 'O2', 'NaCl'],
		correct: 0,
		difficulty: 'medium'
	},
	{
		question: 'Which year did World War II end?',
		options: ['1943', '1944', '1945', '1946'],
		correct: 2,
		difficulty: 'hard'
	},
	{
		question: 'What is the speed of light in km/s (approximately)?',
		options: ['100,000', '200,000', '300,000', '400,000'],
		correct: 2,
		difficulty: 'hard'
	},
	{
		question: 'Which element has the atomic number 1?',
		options: ['Helium', 'Hydrogen', 'Oxygen', 'Carbon'],
		correct: 1,
		difficulty: 'medium'
	}
];

/**
 * Statement bank for true-false challenges
 */
export const TRUE_FALSE_STATEMENTS: Array<{
	statement: string;
	isTrue: boolean;
	difficulty: ChallengeDifficulty;
}> = [
	{
		statement: 'The sun rises in the east.',
		isTrue: true,
		difficulty: 'easy'
	},
	{
		statement: 'Water freezes at 0 degrees Celsius.',
		isTrue: true,
		difficulty: 'easy'
	},
	{
		statement: 'The moon is made of cheese.',
		isTrue: false,
		difficulty: 'easy'
	},
	{
		statement: 'There are 24 hours in a day.',
		isTrue: true,
		difficulty: 'easy'
	},
	{
		statement: 'Penguins can fly.',
		isTrue: false,
		difficulty: 'easy'
	},
	{
		statement: 'The Great Wall of China is visible from space with the naked eye.',
		isTrue: false,
		difficulty: 'medium'
	},
	{
		statement: 'Humans share about 50% of their DNA with bananas.',
		isTrue: true,
		difficulty: 'hard'
	},
	{
		statement: 'Lightning never strikes the same place twice.',
		isTrue: false,
		difficulty: 'medium'
	},
	{
		statement: 'Venus is the hottest planet in our solar system.',
		isTrue: true,
		difficulty: 'medium'
	},
	{
		statement: 'Goldfish have a memory span of 3 seconds.',
		isTrue: false,
		difficulty: 'medium'
	}
];

/**
 * Logic puzzle templates
 */
export const LOGIC_PUZZLES: Array<{
	scenario: string;
	question: string;
	answer: boolean;
	difficulty: ChallengeDifficulty;
}> = [
	{
		scenario: 'If it rains, the ground gets wet.',
		question: 'It is raining. Is the ground wet?',
		answer: true,
		difficulty: 'easy'
	},
	{
		scenario: 'All dogs have tails.',
		question: 'Max is a dog. Does Max have a tail?',
		answer: true,
		difficulty: 'easy'
	},
	{
		scenario: 'If the light is red, cars must stop.',
		question: 'The light is green. Must cars stop?',
		answer: false,
		difficulty: 'easy'
	},
	{
		scenario: 'All birds can fly. Penguins are birds.',
		question: 'Can penguins fly? (Assume the first statement is true)',
		answer: true,
		difficulty: 'medium'
	},
	{
		scenario: 'If A is greater than B, and B is greater than C.',
		question: 'Is A greater than C?',
		answer: true,
		difficulty: 'medium'
	},
	{
		scenario: 'If you study hard, you will pass. John passed.',
		question: 'Did John study hard? (Note: This is a logical fallacy)',
		answer: false,
		difficulty: 'hard'
	},
	{
		scenario: 'If it is daytime, the sun is visible. It is not daytime.',
		question: 'Is the sun visible? (Note: Cannot determine from the given information)',
		answer: false,
		difficulty: 'hard'
	}
];

/**
 * Memory challenge items
 */
export const MEMORY_ITEMS: Array<{
	category: string;
	items: string[];
	difficulty: ChallengeDifficulty;
}> = [
	{
		category: 'Fruits',
		items: ['Apple', 'Banana', 'Cherry'],
		difficulty: 'easy'
	},
	{
		category: 'Colors',
		items: ['Red', 'Blue', 'Green'],
		difficulty: 'easy'
	},
	{
		category: 'Animals',
		items: ['Dog', 'Cat', 'Bird'],
		difficulty: 'easy'
	},
	{
		category: 'Planets',
		items: ['Mars', 'Venus', 'Jupiter', 'Saturn'],
		difficulty: 'medium'
	},
	{
		category: 'Countries',
		items: ['France', 'Japan', 'Brazil', 'Egypt'],
		difficulty: 'medium'
	},
	{
		category: 'Elements',
		items: ['Hydrogen', 'Oxygen', 'Carbon', 'Nitrogen', 'Helium'],
		difficulty: 'hard'
	}
];

/**
 * Sorting challenge templates
 */
export const SORTING_CHALLENGES: Array<{
	instruction: string;
	items: string[];
	correctOrder: string[];
	difficulty: ChallengeDifficulty;
}> = [
	{
		instruction: 'Sort by size (smallest to largest):',
		items: ['Mouse', 'Elephant', 'Dog'],
		correctOrder: ['Mouse', 'Dog', 'Elephant'],
		difficulty: 'easy'
	},
	{
		instruction: 'Sort by number of legs (fewest to most):',
		items: ['Snake', 'Dog', 'Spider'],
		correctOrder: ['Snake', 'Dog', 'Spider'],
		difficulty: 'easy'
	},
	{
		instruction: 'Sort alphabetically:',
		items: ['Banana', 'Apple', 'Cherry'],
		correctOrder: ['Apple', 'Banana', 'Cherry'],
		difficulty: 'easy'
	},
	{
		instruction: 'Sort by population (smallest to largest):',
		items: ['City', 'Village', 'Country'],
		correctOrder: ['Village', 'City', 'Country'],
		difficulty: 'medium'
	},
	{
		instruction: 'Sort by distance from Sun (closest to farthest):',
		items: ['Earth', 'Mars', 'Mercury', 'Venus'],
		correctOrder: ['Mercury', 'Venus', 'Earth', 'Mars'],
		difficulty: 'hard'
	},
	{
		instruction: 'Sort by atomic number (lowest to highest):',
		items: ['Oxygen', 'Hydrogen', 'Carbon', 'Helium'],
		correctOrder: ['Hydrogen', 'Helium', 'Carbon', 'Oxygen'],
		difficulty: 'hard'
	}
];

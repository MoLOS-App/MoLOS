/**
 * Challenge generation helper utilities
 * Common patterns used across challenge generators
 */

import { generateChallengeId, randomInt, getNumberRange, shuffleArray } from './randomizer.js';
import type { Challenge, ChallengeDifficulty, IconChallengeEntry } from '../types.js';

/**
 * Create a base challenge object with common fields
 */
export function createBaseChallenge(
	type: Challenge['type'],
	difficulty: ChallengeDifficulty,
	question: string,
	correctAnswer: string | string[]
): Omit<Challenge, 'validator'> {
	return {
		id: generateChallengeId(),
		type,
		difficulty,
		question,
		correctAnswer
	};
}

/**
 * Generate a math problem and its answer
 */
export function generateMathProblem(difficulty: ChallengeDifficulty): {
	num1: number;
	num2: number;
	operator: string;
	answer: number;
	question: string;
} {
	const range = getNumberRange(difficulty);
	const operators =
		difficulty === 'easy'
			? ['+', '-']
			: difficulty === 'medium'
				? ['+', '-', '×']
				: ['+', '-', '×', '÷'];

	const operator = operators[randomInt(0, operators.length - 1)];
	let num1: number;
	let num2: number;
	let answer: number;

	// Ensure clean division and subtraction
	switch (operator) {
		case '+':
			num1 = randomInt(range.min, range.max);
			num2 = randomInt(range.min, range.max);
			answer = num1 + num2;
			break;
		case '-':
			num1 = randomInt(range.min, range.max);
			num2 = randomInt(range.min, Math.min(num1, range.max));
			answer = num1 - num2;
			break;
		case '×':
			// Smaller numbers for multiplication
			num1 = randomInt(2, difficulty === 'hard' ? 15 : 10);
			num2 = randomInt(2, difficulty === 'hard' ? 15 : 10);
			answer = num1 * num2;
			break;
		case '÷':
			// Ensure clean division
			num2 = randomInt(2, 10);
			answer = randomInt(2, difficulty === 'hard' ? 15 : 10);
			num1 = num2 * answer;
			break;
		default:
			num1 = randomInt(range.min, range.max);
			num2 = randomInt(range.min, range.max);
			answer = num1 + num2;
	}

	const question = `What is ${num1} ${operator} ${num2}?`;

	return { num1, num2, operator, answer, question };
}

/**
 * Generate a number sequence pattern
 */
export function generateNumberPattern(difficulty: ChallengeDifficulty): {
	sequence: number[];
	nextNumber: number;
	pattern: string;
} {
	const patterns: Array<{
		generate: () => { sequence: number[]; next: number };
		difficulties: ChallengeDifficulty[];
	}> = [
		// Arithmetic progression (+2, +3, etc.)
		{
			generate: () => {
				const step = randomInt(2, 5);
				const start = randomInt(1, 10);
				const sequence = [start, start + step, start + step * 2, start + step * 3];
				return { sequence, next: start + step * 4 };
			},
			difficulties: ['easy', 'medium']
		},
		// Arithmetic progression (+10, +5, etc.)
		{
			generate: () => {
				const step = randomInt(5, 15);
				const start = randomInt(0, 20);
				const sequence = [start, start + step, start + step * 2, start + step * 3];
				return { sequence, next: start + step * 4 };
			},
			difficulties: ['medium']
		},
		// Square numbers
		{
			generate: () => {
				const start = randomInt(1, 4);
				const sequence = [
					start * start,
					(start + 1) * (start + 1),
					(start + 2) * (start + 2),
					(start + 3) * (start + 3)
				];
				return { sequence, next: (start + 4) * (start + 4) };
			},
			difficulties: ['medium', 'hard']
		},
		// Fibonacci-like
		{
			generate: () => {
				const a = randomInt(1, 3);
				const b = randomInt(1, 3);
				const sequence = [a, b, a + b, a + 2 * b];
				return { sequence, next: 2 * a + 3 * b };
			},
			difficulties: ['hard']
		},
		// Doubling
		{
			generate: () => {
				const start = randomInt(1, 5);
				const sequence = [start, start * 2, start * 4, start * 8];
				return { sequence, next: start * 16 };
			},
			difficulties: ['medium']
		},
		// Prime numbers (starting positions)
		{
			generate: () => {
				const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
				const start = randomInt(0, 4);
				const sequence = primes.slice(start, start + 4);
				return { sequence, next: primes[start + 4] };
			},
			difficulties: ['hard']
		}
	];

	const validPatterns = patterns.filter((p) => p.difficulties.includes(difficulty));
	const selectedPattern = validPatterns[randomInt(0, validPatterns.length - 1)];
	const result = selectedPattern.generate();

	return {
		sequence: result.sequence,
		nextNumber: result.next,
		pattern: result.sequence.join(', ') + ', ?'
	};
}

/**
 * Generate a letter sequence pattern
 */
export function generateLetterPattern(): {
	sequence: string[];
	nextLetter: string;
	pattern: string;
} {
	const patterns: Array<{
		sequence: string[];
		next: string;
	}> = [
		{ sequence: ['A', 'C', 'E'], next: 'G' },
		{ sequence: ['B', 'D', 'F'], next: 'H' },
		{ sequence: ['A', 'E', 'I'], next: 'M' },
		{ sequence: ['Z', 'X', 'V'], next: 'T' },
		{ sequence: ['A', 'B', 'D', 'G'], next: 'K' },
		{ sequence: ['M', 'N', 'O', 'P'], next: 'Q' }
	];

	const selected = patterns[randomInt(0, patterns.length - 1)];
	return {
		sequence: selected.sequence,
		nextLetter: selected.next,
		pattern: selected.sequence.join(', ') + ', ?'
	};
}

/**
 * Scramble a word for word puzzles
 */
export function scrambleWord(word: string): string {
	const chars = word.split('');
	let scrambled: string;

	// Keep scrambling until it's different from original
	do {
		for (let i = chars.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[chars[i], chars[j]] = [chars[j], chars[i]];
		}
		scrambled = chars.join('');
	} while (scrambled === word);

	return scrambled;
}

/**
 * Get wrong options for multiple choice (distractors)
 */
export function getDistractors(
	correctAnswer: number | string,
	count: number,
	difficulty: ChallengeDifficulty
): string[] {
	if (typeof correctAnswer === 'number') {
		// Generate numeric distractors
		const range = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 20;
		const distractors = new Set<string>();

		while (distractors.size < count) {
			const offset = randomInt(-range, range);
			if (offset !== 0) {
				distractors.add(String(correctAnswer + offset));
			}
		}

		return Array.from(distractors);
	}

	// For non-numeric, return placeholders (should be overridden by specific generator)
	return Array(count).fill('Option');
}

/**
 * Format items for display in sorting challenges
 */
export function formatSortingItems(items: string[]): string {
	return items.map((item) => `"${item}"`).join(', ');
}

/**
 * Select icons for icon recognition challenge
 */
export function selectChallengeIcons(
	allIcons: IconChallengeEntry[],
	correctIcon: IconChallengeEntry,
	count: number
): IconChallengeEntry[] {
	const otherIcons = allIcons.filter((icon) => icon.id !== correctIcon.id);
	const shuffled = shuffleArray(otherIcons);
	const selected = shuffled.slice(0, count - 1);
	return shuffleArray([...selected, correctIcon]);
}

/**
 * Create memory challenge display items
 */
export function createMemoryDisplay(
	items: string[],
	showTime: number = 3000
): { items: string[]; showTime: number } {
	return {
		items,
		showTime
	};
}

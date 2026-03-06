/**
 * Answer validation utilities
 * Handles validation of user answers for different challenge types
 */

import type { Challenge } from '../types.js';

/**
 * Validate a user answer against a challenge
 */
export function validateAnswer(challenge: Challenge, userAnswer: string | string[]): boolean {
	const { type, correctAnswer, validator } = challenge;

	// Use custom validator if provided
	if (validator) {
		return validator(userAnswer);
	}

	// Default validation based on challenge type
	switch (type) {
		case 'math':
		case 'pattern':
		case 'text-input':
		case 'word-puzzle':
		case 'logic':
		case 'true-false':
			return validateTextAnswer(userAnswer, correctAnswer);

		case 'multiple-choice':
		case 'icon-recognition':
			return validateSelectionAnswer(userAnswer, correctAnswer);

		case 'sorting':
		case 'memory':
			return validateArrayAnswer(userAnswer, correctAnswer);

		default:
			return false;
	}
}

/**
 * Validate text-based answers (case-insensitive, trimmed)
 */
export function validateTextAnswer(
	userAnswer: string | string[],
	correctAnswer: string | string[]
): boolean {
	if (Array.isArray(userAnswer)) {
		return false;
	}

	const normalizedUser = normalizeText(userAnswer);
	const normalizedCorrect = normalizeText(correctAnswer as string);

	return normalizedUser === normalizedCorrect;
}

/**
 * Validate selection answers (single choice)
 */
export function validateSelectionAnswer(
	userAnswer: string | string[],
	correctAnswer: string | string[]
): boolean {
	if (Array.isArray(userAnswer)) {
		return false;
	}

	const normalizedUser = normalizeText(userAnswer);
	const normalizedCorrect = normalizeText(correctAnswer as string);

	return normalizedUser === normalizedCorrect;
}

/**
 * Validate array answers (order matters for sorting, doesn't matter for memory)
 */
export function validateArrayAnswer(
	userAnswer: string | string[],
	correctAnswer: string | string[],
	orderMatters: boolean = true
): boolean {
	if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) {
		return false;
	}

	if (userAnswer.length !== correctAnswer.length) {
		return false;
	}

	if (orderMatters) {
		return userAnswer.every(
			(answer, index) => normalizeText(answer) === normalizeText(correctAnswer[index])
		);
	}

	// Order doesn't matter - just check all items are present
	const sortedUser = [...userAnswer].map(normalizeText).sort();
	const sortedCorrect = [...correctAnswer].map(normalizeText).sort();

	return sortedUser.every((answer, index) => answer === sortedCorrect[index]);
}

/**
 * Normalize text for comparison (trim, lowercase, remove extra spaces)
 */
export function normalizeText(text: string): string {
	return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if answer is empty or just whitespace
 */
export function isEmptyAnswer(answer: string | string[]): boolean {
	if (!answer) return true;

	if (Array.isArray(answer)) {
		return answer.length === 0 || answer.every((item) => !item || !item.trim());
	}

	return !answer.trim();
}

/**
 * Get a hint for an answer (first character)
 */
export function getAnswerHint(answer: string | string[]): string {
	if (Array.isArray(answer)) {
		return answer.map((item) => (item ? item[0].toUpperCase() : '?')).join(', ');
	}

	return answer ? answer[0].toUpperCase() + '...' : '';
}

/**
 * Calculate similarity between two strings (for fuzzy matching)
 */
export function calculateSimilarity(str1: string, str2: string): number {
	const s1 = normalizeText(str1);
	const s2 = normalizeText(str2);

	if (s1 === s2) return 1;
	if (s1.length === 0 || s2.length === 0) return 0;

	// Levenshtein distance
	const matrix: number[][] = [];

	for (let i = 0; i <= s1.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= s2.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= s1.length; i++) {
		for (let j = 1; j <= s2.length; j++) {
			const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost
			);
		}
	}

	const distance = matrix[s1.length][s2.length];
	const maxLength = Math.max(s1.length, s2.length);

	return (maxLength - distance) / maxLength;
}

/**
 * Check if answer is close enough (for typos)
 */
export function isCloseEnough(
	userAnswer: string,
	correctAnswer: string,
	threshold: number = 0.8
): boolean {
	const similarity = calculateSimilarity(userAnswer, correctAnswer);
	return similarity >= threshold;
}

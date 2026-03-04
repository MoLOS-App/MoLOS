/**
 * Multiple choice challenge generator
 * Generates general knowledge questions with 4 options
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { MULTIPLE_CHOICE_QUESTIONS } from '../config.js';
import {
	getRandomItem,
	getRandomItems,
	generateChallengeId,
	shuffleArray
} from '../utils/randomizer.js';
import { validateSelectionAnswer } from '../utils/validator.js';

/**
 * Generate a multiple choice challenge
 */
export const generateMultipleChoiceChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	// Filter questions by difficulty
	const eligibleQuestions = MULTIPLE_CHOICE_QUESTIONS.filter((q) => q.difficulty === difficulty);

	// If no questions match difficulty, use all questions
	const questionPool = eligibleQuestions.length > 0 ? eligibleQuestions : MULTIPLE_CHOICE_QUESTIONS;

	// Select a random question
	const selectedQuestion = getRandomItem(questionPool);

	// Create shuffled options with labels
	const optionsWithLabels = selectedQuestion.options.map((option, index) => ({
		label: String.fromCharCode(65 + index), // A, B, C, D
		value: option
	}));

	// Shuffle the options
	const shuffledOptions = shuffleArray(optionsWithLabels);

	// Find the correct answer after shuffle
	const correctOption = shuffledOptions.find(
		(opt) => opt.value === selectedQuestion.options[selectedQuestion.correct]
	);

	return {
		id: generateChallengeId(),
		type: 'multiple-choice',
		difficulty,
		question: selectedQuestion.question,
		options: shuffledOptions.map((opt) => `${opt.label}. ${opt.value}`),
		correctAnswer: correctOption?.value ?? selectedQuestion.options[selectedQuestion.correct],
		validator: (userAnswer) => {
			// Accept either the full option text or just the value
			const normalizedUser = typeof userAnswer === 'string' ? userAnswer.trim() : '';
			const correctValue =
				correctOption?.value ?? selectedQuestion.options[selectedQuestion.correct];

			// Check if answer matches the value directly
			if (normalizedUser === correctValue) return true;

			// Check if answer is the label (A, B, C, D)
			if (normalizedUser.toUpperCase() === correctOption?.label) return true;

			// Check if answer is the full option string
			return validateSelectionAnswer(userAnswer, correctValue);
		},
		metadata: {
			category: 'multiple-choice',
			answerType: 'selection',
			originalIndex: selectedQuestion.correct
		}
	};
};

/**
 * Generate a custom multiple choice challenge
 */
export function generateCustomMultipleChoice(
	question: string,
	options: string[],
	correctIndex: number,
	difficulty: ChallengeDifficulty = 'medium'
): Challenge {
	// Create shuffled options with labels
	const optionsWithLabels = options.map((option, index) => ({
		label: String.fromCharCode(65 + index),
		value: option,
		isCorrect: index === correctIndex
	}));

	const shuffledOptions = shuffleArray(optionsWithLabels);
	const correctOption = shuffledOptions.find((opt) => opt.isCorrect);

	return {
		id: generateChallengeId(),
		type: 'multiple-choice',
		difficulty,
		question,
		options: shuffledOptions.map((opt) => `${opt.label}. ${opt.value}`),
		correctAnswer: correctOption?.value ?? options[correctIndex],
		validator: (userAnswer) => {
			const normalizedUser = typeof userAnswer === 'string' ? userAnswer.trim() : '';
			if (normalizedUser === correctOption?.value) return true;
			if (normalizedUser.toUpperCase() === correctOption?.label) return true;
			return validateSelectionAnswer(userAnswer, correctOption?.value ?? options[correctIndex]);
		},
		metadata: {
			category: 'multiple-choice',
			answerType: 'selection',
			originalIndex: correctIndex
		}
	};
}

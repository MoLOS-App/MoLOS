/**
 * Logic puzzle challenge generator
 * Generates if-then logic puzzles
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { LOGIC_PUZZLES } from '../config.js';
import { getRandomItem, generateChallengeId } from '../utils/randomizer.js';
import { validateTextAnswer } from '../utils/validator.js';

/**
 * Normalize logic answers (yes/no, true/false)
 */
function normalizeLogicAnswer(answer: string): 'yes' | 'no' | 'unknown' {
	const normalized = answer.toLowerCase().trim();

	if (['yes', 'true', 'correct', 'right', 'y', 't', '1'].includes(normalized)) {
		return 'yes';
	}
	if (['no', 'false', 'incorrect', 'wrong', 'n', 'f', '0'].includes(normalized)) {
		return 'no';
	}

	return 'unknown';
}

/**
 * Generate a logic puzzle challenge
 */
export const generateLogicChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	// Filter puzzles by difficulty
	const eligiblePuzzles = LOGIC_PUZZLES.filter((p) => p.difficulty === difficulty);

	// If no puzzles match, use all
	const puzzlePool = eligiblePuzzles.length > 0 ? eligiblePuzzles : LOGIC_PUZZLES;

	// Select a random puzzle
	const selectedPuzzle = getRandomItem(puzzlePool);

	const correctAnswer = selectedPuzzle.answer ? 'Yes' : 'No';

	// Format question
	const question = `${selectedPuzzle.scenario}\n\n${selectedPuzzle.question}`;

	return {
		id: generateChallengeId(),
		type: 'logic',
		difficulty,
		question,
		options: ['Yes', 'No'],
		correctAnswer,
		validator: (userAnswer) => {
			const normalizedUser = normalizeLogicAnswer(String(userAnswer));
			const normalizedCorrect = normalizeLogicAnswer(correctAnswer);
			return normalizedUser === normalizedCorrect;
		},
		metadata: {
			category: 'logic',
			answerType: 'boolean',
			scenario: selectedPuzzle.scenario,
			puzzleQuestion: selectedPuzzle.question,
			expectedAnswer: selectedPuzzle.answer
		}
	};
};

/**
 * Generate a custom logic puzzle challenge
 */
export function generateCustomLogicChallenge(
	scenario: string,
	question: string,
	answer: boolean,
	difficulty: ChallengeDifficulty = 'medium'
): Challenge {
	const correctAnswer = answer ? 'Yes' : 'No';

	return {
		id: generateChallengeId(),
		type: 'logic',
		difficulty,
		question: `${scenario}\n\n${question}`,
		options: ['Yes', 'No'],
		correctAnswer,
		validator: (userAnswer) => {
			const normalizedUser = normalizeLogicAnswer(String(userAnswer));
			const normalizedCorrect = normalizeLogicAnswer(correctAnswer);
			return normalizedUser === normalizedCorrect;
		},
		metadata: {
			category: 'logic',
			answerType: 'boolean',
			scenario,
			puzzleQuestion: question,
			expectedAnswer: answer
		}
	};
}

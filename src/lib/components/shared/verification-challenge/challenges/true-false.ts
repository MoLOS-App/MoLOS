/**
 * True/False challenge generator
 * Generates true/false statement challenges
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { TRUE_FALSE_STATEMENTS } from '../config.js';
import { getRandomItem, generateChallengeId } from '../utils/randomizer.js';
import { validateTextAnswer } from '../utils/validator.js';

/**
 * Normalize true/false answers
 */
function normalizeBooleanAnswer(answer: string): string {
	const normalized = answer.toLowerCase().trim();

	// Accept various forms
	if (['true', 't', 'yes', 'y', '1'].includes(normalized)) {
		return 'true';
	}
	if (['false', 'f', 'no', 'n', '0'].includes(normalized)) {
		return 'false';
	}

	return normalized;
}

/**
 * Generate a true/false challenge
 */
export const generateTrueFalseChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	// Filter statements by difficulty
	const eligibleStatements = TRUE_FALSE_STATEMENTS.filter((s) => s.difficulty === difficulty);

	// If no statements match, use all
	const statementPool = eligibleStatements.length > 0 ? eligibleStatements : TRUE_FALSE_STATEMENTS;

	// Select a random statement
	const selectedStatement = getRandomItem(statementPool);

	const correctAnswer = selectedStatement.isTrue ? 'True' : 'False';

	return {
		id: generateChallengeId(),
		type: 'true-false',
		difficulty,
		question: `True or False: ${selectedStatement.statement}`,
		options: ['True', 'False'],
		correctAnswer,
		validator: (userAnswer) => {
			const normalizedUser = normalizeBooleanAnswer(String(userAnswer));
			const normalizedCorrect = normalizeBooleanAnswer(correctAnswer);
			return normalizedUser === normalizedCorrect;
		},
		metadata: {
			category: 'true-false',
			answerType: 'boolean',
			statement: selectedStatement.statement,
			isTrue: selectedStatement.isTrue
		}
	};
};

/**
 * Generate a custom true/false challenge
 */
export function generateCustomTrueFalse(
	statement: string,
	isTrue: boolean,
	difficulty: ChallengeDifficulty = 'medium'
): Challenge {
	const correctAnswer = isTrue ? 'True' : 'False';

	return {
		id: generateChallengeId(),
		type: 'true-false',
		difficulty,
		question: `True or False: ${statement}`,
		options: ['True', 'False'],
		correctAnswer,
		validator: (userAnswer) => {
			const normalizedUser = normalizeBooleanAnswer(String(userAnswer));
			const normalizedCorrect = normalizeBooleanAnswer(correctAnswer);
			return normalizedUser === normalizedCorrect;
		},
		metadata: {
			category: 'true-false',
			answerType: 'boolean',
			statement,
			isTrue
		}
	};
}

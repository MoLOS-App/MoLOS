/**
 * Math challenge generator
 * Generates arithmetic problems with +, -, ×, ÷ operators
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { generateMathProblem } from '../utils/generators.js';
import { validateTextAnswer } from '../utils/validator.js';

/**
 * Generate a math challenge
 */
export const generateMathChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'medium'
): Challenge => {
	const { question, answer } = generateMathProblem(difficulty);

	return {
		id: `math-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		type: 'math',
		difficulty,
		question,
		correctAnswer: String(answer),
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, String(answer));
		},
		metadata: {
			category: 'arithmetic',
			answerType: 'number'
		}
	};
};

/**
 * Get difficulty label for display
 */
export function getMathDifficultyLabel(difficulty: ChallengeDifficulty): string {
	switch (difficulty) {
		case 'easy':
			return 'Simple arithmetic (1-10)';
		case 'medium':
			return 'Medium arithmetic (10-50)';
		case 'hard':
			return 'Complex arithmetic (50-100)';
	}
}

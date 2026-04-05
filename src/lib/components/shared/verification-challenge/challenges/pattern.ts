/**
 * Pattern challenge generator
 * Generates number and letter sequence completion challenges
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { generateNumberPattern, generateLetterPattern } from '../utils/generators.js';
import { generateChallengeId, randomInt } from '../utils/randomizer.js';
import { validateTextAnswer } from '../utils/validator.js';

/**
 * Generate a pattern challenge
 */
export const generatePatternChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'medium'
): Challenge => {
	// Decide between number or letter pattern (letters only for easy/medium)
	const useLetterPattern = difficulty === 'easy' && Math.random() > 0.5;

	if (useLetterPattern) {
		return generateLetterPatternChallenge(difficulty);
	}

	return generateNumberPatternChallenge(difficulty);
};

/**
 * Generate a number pattern challenge
 */
function generateNumberPatternChallenge(difficulty: ChallengeDifficulty): Challenge {
	const { pattern, nextNumber, sequence } = generateNumberPattern(difficulty);

	return {
		id: generateChallengeId(),
		type: 'pattern',
		difficulty,
		question: `Complete the sequence: ${pattern}`,
		correctAnswer: String(nextNumber),
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, String(nextNumber));
		},
		metadata: {
			category: 'pattern',
			answerType: 'number',
			sequence,
			patternType: 'arithmetic'
		}
	};
}

/**
 * Generate a letter pattern challenge
 */
function generateLetterPatternChallenge(difficulty: ChallengeDifficulty): Challenge {
	const { pattern, nextLetter, sequence } = generateLetterPattern();

	return {
		id: generateChallengeId(),
		type: 'pattern',
		difficulty,
		question: `Complete the sequence: ${pattern}`,
		correctAnswer: nextLetter,
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, nextLetter);
		},
		metadata: {
			category: 'pattern',
			answerType: 'letter',
			sequence,
			patternType: 'alphabetical'
		}
	};
}

/**
 * Generate a custom pattern challenge
 */
export function generateCustomPatternChallenge(
	sequence: (number | string)[],
	nextItem: number | string,
	difficulty: ChallengeDifficulty = 'medium'
): Challenge {
	const pattern = sequence.join(', ') + ', ?';

	return {
		id: generateChallengeId(),
		type: 'pattern',
		difficulty,
		question: `Complete the sequence: ${pattern}`,
		correctAnswer: String(nextItem),
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, String(nextItem));
		},
		metadata: {
			category: 'pattern',
			answerType: typeof nextItem === 'number' ? 'number' : 'letter',
			sequence
		}
	};
}

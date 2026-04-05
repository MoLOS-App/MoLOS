/**
 * Text input challenge generator
 * Generates phrase typing challenges
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { TEXT_INPUT_PHRASES } from '../config.js';
import { getRandomItem, generateChallengeId } from '../utils/randomizer.js';
import { validateTextAnswer } from '../utils/validator.js';

/**
 * Generate a text input challenge
 */
export const generateTextInputChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	// Select a random phrase
	const phraseData = getRandomItem(TEXT_INPUT_PHRASES);

	// Adjust hint based on difficulty
	let question: string;
	switch (difficulty) {
		case 'easy':
			question = `${phraseData.hint} (case-insensitive)`;
			break;
		case 'medium':
			question = `Type the word: "${phraseData.phrase}"`;
			break;
		case 'hard':
			question = `Type the confirmation word (hint: it's a common action)`;
			break;
	}

	return {
		id: generateChallengeId(),
		type: 'text-input',
		difficulty,
		question,
		correctAnswer: phraseData.phrase,
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, phraseData.phrase);
		},
		metadata: {
			category: 'text-input',
			answerType: 'text',
			phrase: phraseData.phrase
		}
	};
};

/**
 * Generate a context-specific text input challenge
 */
export function generateContextualTextChallenge(
	action: 'delete' | 'confirm' | 'proceed' | 'accept',
	difficulty: ChallengeDifficulty = 'easy'
): Challenge {
	const phrase = action;
	const question =
		difficulty === 'hard'
			? `Type "${phrase}" to confirm this action`
			: `Type '${phrase}' to continue`;

	return {
		id: generateChallengeId(),
		type: 'text-input',
		difficulty,
		question,
		correctAnswer: phrase,
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, phrase);
		},
		metadata: {
			category: 'text-input',
			answerType: 'text',
			action,
			phrase
		}
	};
}

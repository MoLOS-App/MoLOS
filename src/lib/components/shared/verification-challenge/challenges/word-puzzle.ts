/**
 * Word puzzle challenge generator
 * Generates word unscrambling challenges
 */

import type { Challenge, ChallengeDifficulty, ChallengeGenerator } from '../types.js';
import { WORD_PUZZLE_WORDS } from '../config.js';
import { scrambleWord } from '../utils/generators.js';
import { getRandomItem, generateChallengeId } from '../utils/randomizer.js';
import { validateTextAnswer } from '../utils/validator.js';

/**
 * Filter words by length based on difficulty
 */
function getWordsByDifficulty(difficulty: ChallengeDifficulty): { word: string; hint?: string }[] {
	switch (difficulty) {
		case 'easy':
			// 3-4 letter words
			return WORD_PUZZLE_WORDS.filter((w) => w.length <= 4).map((w) => ({ word: w }));
		case 'medium':
			// 4-5 letter words
			return WORD_PUZZLE_WORDS.filter((w) => w.length >= 4 && w.length <= 5).map((w) => ({
				word: w
			}));
		case 'hard':
			// 5-6 letter words
			return WORD_PUZZLE_WORDS.filter((w) => w.length >= 5).map((w) => ({ word: w }));
	}
}

/**
 * Generate a word puzzle challenge
 */
export const generateWordPuzzleChallenge: ChallengeGenerator = (
	difficulty: ChallengeDifficulty = 'easy'
): Challenge => {
	const wordPool = getWordsByDifficulty(difficulty);
	const selectedWord = getRandomItem(wordPool);

	const scrambledWord = scrambleWord(selectedWord.word);

	let question: string;
	switch (difficulty) {
		case 'easy':
			question = `Unscramble this word: "${scrambledWord}" (hint: ${selectedWord.word.length} letters)`;
			break;
		case 'medium':
			question = `Unscramble this word: "${scrambledWord}"`;
			break;
		case 'hard':
			question = `Unscramble: "${scrambledWord.toUpperCase()}"`;
			break;
	}

	return {
		id: generateChallengeId(),
		type: 'word-puzzle',
		difficulty,
		question,
		correctAnswer: selectedWord.word,
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, selectedWord.word);
		},
		metadata: {
			category: 'word-puzzle',
			answerType: 'text',
			scrambledWord,
			wordLength: selectedWord.word.length
		}
	};
};

/**
 * Generate a custom word puzzle challenge
 */
export function generateCustomWordPuzzle(
	word: string,
	difficulty: ChallengeDifficulty = 'medium'
): Challenge {
	const scrambledWord = scrambleWord(word);

	return {
		id: generateChallengeId(),
		type: 'word-puzzle',
		difficulty,
		question: `Unscramble this word: "${scrambledWord}"`,
		correctAnswer: word.toLowerCase(),
		validator: (userAnswer) => {
			return validateTextAnswer(userAnswer, word);
		},
		metadata: {
			category: 'word-puzzle',
			answerType: 'text',
			scrambledWord,
			wordLength: word.length
		}
	};
}

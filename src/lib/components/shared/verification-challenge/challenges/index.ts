/**
 * Challenge registry - maps challenge types to their generators
 */

import type { ChallengeRegistry } from '../types.js';
import { generateMathChallenge } from './math.js';
import { generateTextInputChallenge } from './text-input.js';
import { generateMultipleChoiceChallenge } from './multiple-choice.js';
import { generatePatternChallenge } from './pattern.js';
import { generateWordPuzzleChallenge } from './word-puzzle.js';
import { generateTrueFalseChallenge } from './true-false.js';
import { generateIconRecognitionChallenge } from './icon-recognition.js';
import { generateLogicChallenge } from './logic.js';
import { generateMemoryChallenge } from './memory.js';
import { generateSortingChallenge } from './sorting.js';

/**
 * Registry of all available challenge generators
 */
export const challengeRegistry: ChallengeRegistry = new Map([
	['math', generateMathChallenge],
	['text-input', generateTextInputChallenge],
	['multiple-choice', generateMultipleChoiceChallenge],
	['pattern', generatePatternChallenge],
	['word-puzzle', generateWordPuzzleChallenge],
	['true-false', generateTrueFalseChallenge],
	['icon-recognition', generateIconRecognitionChallenge],
	['logic', generateLogicChallenge],
	['memory', generateMemoryChallenge],
	['sorting', generateSortingChallenge]
]);

/**
 * Get a challenge generator by type
 */
export function getChallengeGenerator(type: string) {
	return challengeRegistry.get(type as any);
}

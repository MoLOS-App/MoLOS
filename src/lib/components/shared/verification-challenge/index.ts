/**
 * Verification Challenge Component
 * Public API exports
 */

// Main component
import VerificationChallenge from './verification-challenge.svelte';

// Types
export type {
	Challenge,
	ChallengeType,
	ChallengeDifficulty,
	VerificationStatus,
	ChallengeResult,
	VerificationSession,
	VerificationConfig,
	VerificationChallengeProps,
	ChallengeDisplayProps,
	ProgressIndicatorProps,
	ChallengeInputProps,
	ResultFeedbackProps,
	ChallengeGenerator,
	ChallengeRegistry,
	IconChallengeEntry
} from './types.js';

// Config
export { DEFAULT_CONFIG, ALL_CHALLENGE_TYPES } from './types.js';
export { createConfig, getEnabledChallengeTypes, selectRandomDifficulty } from './config.js';

// Challenge registry
export { challengeRegistry, getChallengeGenerator } from './challenges/index.js';

// Utilities
export {
	generateChallengeSession,
	shuffleArray,
	getRandomItem,
	getRandomItems,
	randomInt,
	generateChallengeId
} from './utils/randomizer.js';

export { validateTextAnswer, validateArrayAnswer } from './utils/validator.js';

// Component export
export default VerificationChallenge;

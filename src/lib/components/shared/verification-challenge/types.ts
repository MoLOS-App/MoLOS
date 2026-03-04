/**
 * Type definitions for Verification Challenge Component
 * Modal-based verification system requiring users to complete randomized challenges
 */

import type { Component } from 'svelte';

/**
 * All supported challenge types
 */
export type ChallengeType =
	| 'math'
	| 'text-input'
	| 'multiple-choice'
	| 'pattern'
	| 'word-puzzle'
	| 'true-false'
	| 'icon-recognition'
	| 'logic'
	| 'memory'
	| 'sorting';

/**
 * Challenge difficulty levels
 */
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Session status states
 */
export type VerificationStatus = 'pending' | 'invalid' | 'verified' | 'cancelled';

/**
 * Result of a single challenge attempt
 */
export interface ChallengeResult {
	challengeId: string;
	passed: boolean;
	userAnswer?: string | string[];
	timestamp: Date;
}

/**
 * Icon entry for icon recognition challenges
 * Using `any` for component type to accommodate Lucide icon class types
 */
export interface IconChallengeEntry {
	id: string;
	name: string;
	component: any;
	keywords: string[];
}

/**
 * Base challenge interface
 */
export interface Challenge {
	id: string;
	type: ChallengeType;
	difficulty: ChallengeDifficulty;
	question: string;
	options?: string[];
	correctAnswer: string | string[];
	validator: (userAnswer: string | string[]) => boolean;
	metadata?: Record<string, unknown>;
	/** For icon-recognition challenges */
	iconOptions?: IconChallengeEntry[];
	correctIconId?: string;
}

/**
 * Verification session state
 */
export interface VerificationSession {
	challenges: Challenge[];
	currentIndex: number;
	results: ChallengeResult[];
	status: VerificationStatus;
}

/**
 * Configuration for verification challenges
 */
export interface VerificationConfig {
	/** Number of challenges per session (default: 2) */
	challengeCount: number;
	/** Specific challenge types to use (default: all) */
	challengeTypes?: ChallengeType[];
	/** Difficulty weighting for random selection */
	difficultyWeighting?: Record<ChallengeDifficulty, number>;
	/** Maximum retries per challenge (default: 'unlimited') */
	maxRetries: number | 'unlimited';
	/** Allow skipping challenges (default: false) */
	allowSkip: boolean;
	/** Title displayed in modal */
	title?: string;
	/** Description displayed in modal */
	description?: string;
	/** Confirm button text */
	confirmText?: string;
	/** Cancel button text */
	cancelText?: string;
}

/**
 * Props for the main VerificationChallenge component
 */
export interface VerificationChallengeProps {
	/** Whether the modal is open */
	open?: boolean;
	/** Callback when all challenges are completed successfully */
	onVerified?: () => void;
	/** Callback when user cancels */
	onCancelled?: () => void;
	/** Callback when a challenge is completed (pass or fail) */
	onChallengeComplete?: (result: ChallengeResult) => void;
	/** Configuration options */
	config?: Partial<VerificationConfig>;
	/** Additional CSS classes */
	class?: string;
}

/**
 * Props for challenge display component
 */
export interface ChallengeDisplayProps {
	challenge: Challenge;
	userAnswer?: string | string[];
	onAnswerChange: (answer: string | string[]) => void;
	onSubmit: () => void;
	disabled?: boolean;
}

/**
 * Props for progress indicator component
 */
export interface ProgressIndicatorProps {
	current: number;
	total: number;
	results: ChallengeResult[];
}

/**
 * Props for challenge input component
 */
export interface ChallengeInputProps {
	challenge: Challenge;
	value?: string | string[];
	onValueChange: (value: string | string[]) => void;
	onSubmit: () => void;
	disabled?: boolean;
}

/**
 * Props for result feedback component
 */
export interface ResultFeedbackProps {
	result: ChallengeResult | null;
	showRetry?: boolean;
	onRetry?: () => void;
	onNext?: () => void;
}

/**
 * Generator function type for challenges
 */
export type ChallengeGenerator = (difficulty?: ChallengeDifficulty) => Challenge;

/**
 * Registry of challenge generators
 */
export type ChallengeRegistry = Map<ChallengeType, ChallengeGenerator>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: VerificationConfig = {
	challengeCount: 2,
	maxRetries: 'unlimited',
	allowSkip: false,
	title: 'Verification Required',
	description: 'Please complete the following challenges to proceed.',
	confirmText: 'Proceed',
	cancelText: 'Cancel',
	difficultyWeighting: {
		easy: 50,
		medium: 35,
		hard: 15
	}
};

/**
 * All available challenge types
 */
export const ALL_CHALLENGE_TYPES: ChallengeType[] = [
	'math',
	'text-input',
	'multiple-choice',
	'pattern',
	'word-puzzle',
	'true-false',
	'icon-recognition',
	'logic',
	'sorting'
	// Note: 'memory' removed from default pool as it requires multiple stages
	// Can be explicitly enabled via config.challengeTypes if needed
];

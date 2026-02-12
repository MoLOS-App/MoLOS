/**
 * Completion Promise - Genuine task termination verification
 *
 * Provides a mechanism for verifying genuine task completion.
 * Prevents premature termination and ensures thoroughness.
 */

import type { AgentState, ExecutionPlan, Observation, Thought } from '../core/types';

// ============================================================================
// Completion Types
// ============================================================================

/**
 * Completion status
 */
export type CompletionStatus =
	| 'in_progress'
	| 'verifying'
	| 'complete'
	| 'incomplete'
	| 'blocked'
	| 'failed';

/**
 * Completion check result
 */
export interface CompletionCheck {
	/** Status */
	status: CompletionStatus;
	/** Confidence (0-1) */
	confidence: number;
	/** Reason */
	reason: string;
	/** Evidence */
	evidence: string[];
	/** Missing actions */
	missingActions: string[];
	/** Suggestions for completion */
	suggestions: string[];
}

/**
 * Completion promise configuration
 */
export interface CompletionPromiseConfig {
	/** Minimum iterations before allowing completion */
	minIterations: number;
	/** Confidence threshold for completion */
	confidenceThreshold: number;
	/** Enable verification */
	enableVerification: boolean;
	/** Check for common premature termination patterns */
	checkPrematurePatterns: boolean;
	/** Debug mode */
	debug: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_COMPLETION_CONFIG: CompletionPromiseConfig = {
	minIterations: 1,
	confidenceThreshold: 0.8,
	enableVerification: true,
	checkPrematurePatterns: true,
	debug: false
};

/**
 * Premature termination patterns
 */
const PREMATURE_PATTERNS = [
	/i (can't|cannot|won't be able to)/i,
	/i don't (have|know|see)/i,
	/no (such|file|data|record)/i,
	/unable to/i,
	/not (found|available|possible)/i
];

/**
 * Completion indicators in responses
 */
const COMPLETION_INDICATORS = [
	/i have (completed|finished|done)/i,
	/task (is )?complete/i,
	/successfully (completed|created|updated|deleted)/i,
	/all (steps|tasks|actions) (are )?done/i,
	/here('s| is) (the|your|a)/i  // Often indicates presenting results
];

// ============================================================================
// Completion Promise
// ============================================================================

/**
 * Completion Promise - Verifies genuine task completion
 */
export class CompletionPromise {
	private config: CompletionPromiseConfig;
	private completionHistory: CompletionCheck[] = [];

	constructor(config: Partial<CompletionPromiseConfig> = {}) {
		this.config = { ...DEFAULT_COMPLETION_CONFIG, ...config };
	}

	/**
	 * Check if task is complete
	 */
	check(state: AgentState): CompletionCheck {
		const evidence: string[] = [];
		const missingActions: string[] = [];
		const suggestions: string[] = [];

		// 1. Check minimum iterations
		if (state.currentIteration < this.config.minIterations) {
			return this.createResult(
				'in_progress',
				0.3,
				`Need at least ${this.config.minIterations} iterations`,
				['Minimum iterations not reached'],
				[],
				['Continue with task execution']
			);
		}

		// 2. Check for plan completion
		if (state.plan) {
			const planCheck = this.checkPlanCompletion(state.plan);
			evidence.push(...planCheck.evidence);
			missingActions.push(...planCheck.missingActions);
		}

		// 3. Check observations for success
		const successRate = this.calculateSuccessRate(state.observations);
		if (successRate > 0.7) {
			evidence.push(`Success rate: ${(successRate * 100).toFixed(0)}%`);
		}

		// 4. Check for premature termination patterns
		if (this.config.checkPrematurePatterns) {
			const lastThought = state.thoughts[state.thoughts.length - 1];
			if (lastThought) {
				const prematureCheck = this.checkPrematureTermination(lastThought);
				if (prematureCheck.isPremature) {
					return this.createResult(
						'incomplete',
						0.4,
						'Possible premature termination detected',
						[prematureCheck.reason],
						[],
						['Verify task completion', 'Check for alternative approaches']
					);
				}
			}
		}

		// 5. Check for completion indicators
		const completionIndicators = this.findCompletionIndicators(state);
		evidence.push(...completionIndicators);

		// 6. Calculate confidence
		let confidence = this.calculateConfidence(state, evidence, missingActions);

		// 7. Determine status
		let status: CompletionStatus;
		let reason: string;

		if (confidence >= this.config.confidenceThreshold) {
			status = 'complete';
			reason = 'Task appears complete with high confidence';
		} else if (confidence >= 0.5) {
			status = 'verifying';
			reason = 'Task may be complete, verification recommended';
			suggestions.push('Verify all requirements are met');
		} else if (missingActions.length > 0) {
			status = 'incomplete';
			reason = 'Missing required actions';
			suggestions.push(...missingActions.map(a => `Complete: ${a}`));
		} else {
			status = 'in_progress';
			reason = 'Task is still in progress';
			suggestions.push('Continue with remaining work');
		}

		// Store in history
		const result = this.createResult(status, confidence, reason, evidence, missingActions, suggestions);
		this.completionHistory.push(result);

		return result;
	}

	/**
	 * Verify completion with additional checks
	 */
	async verify(
		state: AgentState,
		verificationFn?: (state: AgentState) => Promise<boolean>
	): Promise<CompletionCheck> {
		const baseCheck = this.check(state);

		if (!this.config.enableVerification || baseCheck.status === 'complete') {
			return baseCheck;
		}

		// Run custom verification if provided
		if (verificationFn) {
			try {
				const verified = await verificationFn(state);

				if (verified) {
					return this.createResult(
						'complete',
						Math.min(baseCheck.confidence + 0.2, 1.0),
						'Verification passed',
						[...baseCheck.evidence, 'Custom verification passed'],
						baseCheck.missingActions,
						[]
					);
				} else {
					return this.createResult(
						'incomplete',
						Math.max(baseCheck.confidence - 0.2, 0),
						'Verification failed',
						baseCheck.evidence,
						baseCheck.missingActions,
						['Verification failed - task not complete']
					);
				}
			} catch (error) {
				if (this.config.debug) {
					console.error('[CompletionPromise] Verification error:', error);
				}
			}
		}

		return baseCheck;
	}

	/**
	 * Get completion history
	 */
	getHistory(): CompletionCheck[] {
		return [...this.completionHistory];
	}

	/**
	 * Reset history
	 */
	reset(): void {
		this.completionHistory = [];
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private createResult(
		status: CompletionStatus,
		confidence: number,
		reason: string,
		evidence: string[],
		missingActions: string[],
		suggestions: string[]
	): CompletionCheck {
		return {
			status,
			confidence,
			reason,
			evidence,
			missingActions,
			suggestions
		};
	}

	private checkPlanCompletion(plan: ExecutionPlan): {
		evidence: string[];
		missingActions: string[];
	} {
		const evidence: string[] = [];
		const missingActions: string[] = [];

		const completed = plan.steps.filter(s => s.status === 'completed').length;
		const total = plan.steps.length;

		evidence.push(`Plan progress: ${completed}/${total} steps`);

		for (const step of plan.steps) {
			if (step.status === 'pending' || step.status === 'in_progress') {
				missingActions.push(step.description);
			}
		}

		return { evidence, missingActions };
	}

	private calculateSuccessRate(observations: Observation[]): number {
		if (observations.length === 0) return 0;

		const successful = observations.filter(o => o.isSuccess).length;
		return successful / observations.length;
	}

	private checkPrematureTermination(thought: Thought): {
		isPremature: boolean;
		reason: string;
	} {
		const reasoning = thought.reasoning.toLowerCase();

		for (const pattern of PREMATURE_PATTERNS) {
			if (pattern.test(reasoning)) {
				return {
					isPremature: true,
					reason: `Premature termination pattern: ${pattern}`
				};
			}
		}

		return { isPremature: false, reason: '' };
	}

	private findCompletionIndicators(state: AgentState): string[] {
		const indicators: string[] = [];

		// Check last thought
		const lastThought = state.thoughts[state.thoughts.length - 1];
		if (lastThought) {
			for (const pattern of COMPLETION_INDICATORS) {
				if (pattern.test(lastThought.reasoning)) {
					indicators.push(`Completion indicator found: ${pattern}`);
				}
			}
		}

		// Check observations for completion signals
		const lastObservation = state.observations[state.observations.length - 1];
		if (lastObservation?.isSuccess && lastObservation.result) {
			const resultStr = JSON.stringify(lastObservation.result);
			for (const pattern of COMPLETION_INDICATORS) {
				if (pattern.test(resultStr)) {
					indicators.push(`Result contains completion indicator`);
					break;
				}
			}
		}

		return indicators;
	}

	private calculateConfidence(
		state: AgentState,
		evidence: string[],
		missingActions: string[]
	): number {
		let confidence = 0.5;

		// Positive factors
		if (state.plan) {
			const completedSteps = state.plan.steps.filter(s => s.status === 'completed').length;
			const totalSteps = state.plan.steps.length;
			confidence += (completedSteps / totalSteps) * 0.2;
		}

		if (state.observations.length > 0) {
			const successRate = this.calculateSuccessRate(state.observations);
			confidence += successRate * 0.2;
		}

		confidence += Math.min(evidence.length * 0.05, 0.15);

		// Negative factors
		confidence -= Math.min(missingActions.length * 0.1, 0.3);

		// Check if user asked for something specific
		const userMessages = state.messages.filter(m => m.role === 'user');
		if (userMessages.length > 0 && state.observations.length === 0) {
			confidence -= 0.2; // No actions taken for user request
		}

		return Math.max(0, Math.min(1, confidence));
	}
}

/**
 * Create a completion promise
 */
export function createCompletionPromise(config?: Partial<CompletionPromiseConfig>): CompletionPromise {
	return new CompletionPromise(config);
}

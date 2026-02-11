/**
 * Completion verification for agent execution
 * Ensures the agent actually completed what it set out to do
 */

import type { ExecutionPlan, AgentMessage } from '../core/agent-types';

/**
 * Verifies that the agent has properly completed its task
 */
export class CompletionVerifier {
	/**
	 * Verify that the plan is complete
	 */
	verifyPlanComplete(plan: ExecutionPlan | null): VerificationResult {
		if (!plan) {
			return {
				isComplete: true,
				reason: 'No plan was created, responding directly to user request'
			};
		}

		// Check all steps
		const totalSteps = plan.steps.length;
		const completedSteps = plan.steps.filter((s) => s.status === 'completed').length;
		const failedSteps = plan.steps.filter((s) => s.status === 'failed').length;
		const skippedSteps = plan.steps.filter((s) => s.status === 'skipped').length;
		const pendingSteps = plan.steps.filter(
			(s) => s.status === 'pending' || s.status === 'in_progress'
		).length;

		// Plan is complete if no pending steps
		const isComplete = pendingSteps === 0;

		if (isComplete) {
			return {
				isComplete: true,
				reason: this.buildCompletionMessage(plan, completedSteps, failedSteps, skippedSteps)
			};
		}

		return {
			isComplete: false,
			reason: `Plan incomplete: ${completedSteps}/${totalSteps} steps completed, ${failedSteps} failed, ${pendingSteps} remaining`,
			remainingSteps: pendingSteps,
			suggestions: this.generateSuggestions(plan)
		};
	}

	/**
	 * Verify that we have meaningful content to return
	 */
	verifyHasContent(message: string, actions: unknown[]): VerificationResult {
		const hasMessage = message && message.trim().length > 0;
		const hasActions = actions && actions.length > 0;

		if (hasMessage) {
			return {
				isComplete: true,
				reason: 'Has meaningful response message'
			};
		}

		if (hasActions) {
			return {
				isComplete: true,
				reason: 'Has actions to report to user'
			};
		}

		return {
			isComplete: false,
			reason: 'No message or actions to return - should generate summary',
			suggestions: [
				'Generate a summary of what was accomplished',
				'Report on the status of the plan'
			]
		};
	}

	/**
	 * Verify that the agent made progress
	 */
	verifyMadeProgress(
		plan: ExecutionPlan | null,
		actionsTaken: number,
		iterations: number
	): VerificationResult {
		if (!plan) {
			// No plan means we responded directly
			return { isComplete: true, reason: 'Direct response mode' };
		}

		const completedSteps = plan.steps.filter((s) => s.status === 'completed').length;

		// Must have completed at least one step or taken some action
		const madeProgress = completedSteps > 0 || actionsTaken > 0;

		if (!madeProgress && iterations > 1) {
			return {
				isComplete: false,
				reason: 'No progress made after multiple iterations',
				suggestions: [
					'Check if tools are working',
					'Try a different approach',
					'Ask user for clarification'
				]
			};
		}

		return {
			isComplete: true,
			reason: `Progress: ${completedSteps} steps, ${actionsTaken} actions`
		};
	}

	/**
	 * Build a completion message
	 */
	private buildCompletionMessage(
		plan: ExecutionPlan,
		completed: number,
		failed: number,
		skipped: number
	): string {
		const parts = [];

		if (completed > 0) {
			parts.push(`${completed} step${completed > 1 ? 's' : ''} completed`);
		}

		if (failed > 0) {
			parts.push(`${failed} failed`);
		}

		if (skipped > 0) {
			parts.push(`${skipped} skipped`);
		}

		return `Plan ${plan.goal} finished: ${parts.join(', ')}`;
	}

	/**
	 * Generate suggestions for incomplete plans
	 */
	private generateSuggestions(plan: ExecutionPlan): string[] {
		const suggestions: string[] = [];

		const pendingSteps = plan.steps.filter(
			(s) => s.status === 'pending' || s.status === 'in_progress'
		);
		const failedSteps = plan.steps.filter((s) => s.status === 'failed');

		if (failedSteps.length > 0) {
			suggestions.push(`Retry failed steps: ${failedSteps.map((s) => s.description).join(', ')}`);
		}

		if (pendingSteps.length > 0) {
			suggestions.push(
				`Continue with pending steps: ${pendingSteps.map((s) => s.description).join(', ')}`
			);
		}

		// Check for stuck patterns
		const stuckOnSingleStep = pendingSteps.length === 1 && plan.steps.length > 1;
		if (stuckOnSingleStep) {
			suggestions.push('Consider skipping the stuck step or asking for help');
		}

		return suggestions;
	}

	/**
	 * Generate a summary message for the user
	 */
	generateSummary(plan: ExecutionPlan | null, message: string): string {
		if (!plan) {
			return message || "I've processed your request.";
		}

		const completed = plan.steps.filter((s) => s.status === 'completed').length;
		const total = plan.steps.length;
		const failed = plan.steps.filter((s) => s.status === 'failed').length;

		if (completed === total && failed === 0) {
			return message || `I've completed all ${total} steps: ${plan.goal}`;
		}

		if (completed > 0) {
			return message || `I've completed ${completed} of ${total} steps for: ${plan.goal}`;
		}

		return message || `Working on: ${plan.goal}`;
	}
}

/**
 * Result of a verification check
 */
export interface VerificationResult {
	isComplete: boolean;
	reason: string;
	remainingSteps?: number;
	suggestions?: string[];
}

/**
 * Response builder and validator
 * Ensures agents never return empty responses
 */

import type {
	InternalAgentAction,
	ExecutionResult,
	AgentTelemetry,
	AgentEvent,
	ExecutionPlan
} from './agent-types';
import type { AiAction } from '$lib/models/ai';

/**
 * Builds and validates agent responses
 */
export class ResponseBuilder {
	/**
	 * Build an execution result with guaranteed non-empty message
	 */
	buildExecutionResult(options: ExecutionResultOptions): ExecutionResult {
		const { success, baseMessage, actions, plan, telemetry, events } = options;

		console.log('[ResponseBuilder] baseMessage:', baseMessage?.substring(0, 100));
		console.log('[ResponseBuilder] actions:', actions.length);
		console.log('[ResponseBuilder] plan:', plan?.goal);

		// Ensure we NEVER return an empty message
		const message = this.ensureNonEmptyMessage(baseMessage, actions, plan, success);

		console.log('[ResponseBuilder] final message:', message?.substring(0, 100));

		// Convert internal actions to AiAction format
		const outputActions: AiAction[] = actions
			.filter((a) => a.type === 'read' || a.type === 'write')
			.map((a) => ({
				type: a.type as 'read' | 'write',
				entity: a.entity,
				description: a.description,
				status: (a.status === 'executed' ? 'executed' : a.status === 'pending' ? 'pending' : 'failed') as 'pending' | 'confirmed' | 'executed' | 'failed',
				data: a.data
			}));

		return {
			success,
			message,
			actions: outputActions,
			plan,
			telemetry,
			events
		};
	}

	/**
	 * Ensure the message is never empty by generating context-aware fallbacks
	 */
	private ensureNonEmptyMessage(
		baseMessage: string,
		actions: InternalAgentAction[],
		plan: ExecutionResultOptions['plan'],
		success: boolean
	): string {
		// If we have a message, use it (but trim whitespace)
		if (baseMessage && baseMessage.trim()) {
			return baseMessage.trim();
		}

		// Generate context-aware fallback based on what happened
		const completedActions = actions.filter((a) => a.status === 'executed');
		const pendingActions = actions.filter((a) => a.status === 'pending');
		const failedActions = actions.filter((a) => a.status === 'failed');

		// Case 1: We have actions to report
		if (completedActions.length > 0) {
			return this.summarizeActions(completedActions, pendingActions);
		}

		// Case 2: We have a plan
		if (plan && plan.steps.length > 0) {
			const completedSteps = plan.steps.filter((s) => s.status === 'completed');
			if (completedSteps.length > 0) {
				return `I've completed ${completedSteps.length} step${completedSteps.length > 1 ? 's' : ''} ${
					completedSteps.length === plan.steps.length
						? 'and finished the plan.'
						: `out of ${plan.steps.length} in my plan.`
				}`;
			}
			return `I'm working on your request: "${plan.goal}".`;
		}

		// Case 3: Failure with failed actions
		if (!success && failedActions.length > 0) {
			return `I encountered some issues while trying to help you. ${failedActions.length > 1 ? `${failedActions.length} actions failed.` : `The action "${failedActions[0].description}" failed.`}`;
		}

		// Case 4: Generic success fallback
		if (success) {
			return "I've processed your request. Is there anything specific you'd like me to help with?";
		}

		// Case 5: Generic failure fallback
		return "I wasn't able to complete your request. Could you provide more details or try rephrasing?";
	}

	/**
	 * Summarize completed actions
	 */
	private summarizeActions(completedActions: InternalAgentAction[], pendingActions: InternalAgentAction[]): string {
		if (pendingActions.length === 0) {
			// All actions completed
			if (completedActions.length === 1) {
				return `I ${this.actionToPastTense(completedActions[0].description)}.`;
			}
			return `I've completed the following actions:\n${completedActions.map((a) => `• ${this.actionToPastTense(a.description)}`).join('\n')}`;
		}

		// Some actions pending
		const completedText =
			completedActions.length === 1
				? `I ${this.actionToPastTense(completedActions[0].description)}`
				: `I've completed ${completedActions.length} actions`;

		const pendingText =
			pendingActions.length === 1
				? `need your confirmation to ${pendingActions[0].description}`
				: `need your confirmation for ${pendingActions.length} more actions`;

		return `${completedText} and ${pendingText}.`;
	}

	/**
	 * Convert action description to past tense (simple heuristic)
	 */
	private actionToPastTense(description: string): string {
		const lower = description.toLowerCase();

		// Already past tense
		if (lower.startsWith('completed ') || lower.startsWith('finished ') || lower.startsWith('done ')) {
			return description;
		}

		// Convert present tense to past tense
		const tenseMap: Record<string, string> = {
			'create ': 'created ',
			'add ': 'added ',
			'update ': 'updated ',
			'delete ': 'deleted ',
			'remove ': 'removed ',
			'set ': 'set ',
			'get ': 'retrieved ',
			'fetch ': 'fetched ',
			'load ': 'loaded ',
			'save ': 'saved '
		};

		for (const [present, past] of Object.entries(tenseMap)) {
			if (lower.startsWith(present)) {
				return past + description.slice(present.length);
			}
		}

		return description;
	}

	/**
	 * Create a thinking action for UI
	 */
	createThinkingAction(thought: string): InternalAgentAction {
		return {
			type: 'think',
			entity: 'agent',
			description: thought,
			status: 'executed',
			data: { thought }
		};
	}

	/**
	 * Create an error action for UI
	 */
	createErrorAction(error: string, context?: Record<string, unknown>): InternalAgentAction {
		return {
			type: 'error',
			entity: 'agent',
			description: error,
			status: 'failed',
			data: { error, ...context }
		};
	}

	/**
	 * Create a plan action for UI
	 */
	createPlanAction(plan: ExecutionResultOptions['plan']): InternalAgentAction {
		if (!plan) {
			return {
				type: 'plan',
				entity: 'agent',
				description: 'No active plan',
				status: 'executed',
				data: { plan: null }
			};
		}

		const completedCount = plan.steps.filter((s) => s.status === 'completed').length;
		const totalCount = plan.steps.length;

		return {
			type: 'plan',
			entity: 'agent',
			description: `Plan: ${plan.goal} (${completedCount}/${totalCount} steps complete)`,
			status: 'executed',
			data: {
				planId: plan.id,
				goal: plan.goal,
				totalSteps: totalCount,
				completedSteps: completedCount,
				steps: plan.steps.map((s) => ({
					id: s.id,
					description: s.description,
					status: s.status
				}))
			} as Record<string, unknown>
		};
	}
}

/**
 * Options for building an execution result
 */
export interface ExecutionResultOptions {
	success: boolean;
	baseMessage: string;
	actions: InternalAgentAction[];
	plan: ExecutionPlan | null;
	telemetry: AgentTelemetry;
	events: AgentEvent[];
}

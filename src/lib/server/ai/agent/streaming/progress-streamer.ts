/**
 * Progress streaming to UI
 * Sends real-time updates about agent progress
 */

import type { ProgressEvent, ExecutionPlan, PlanStep } from '../core/agent-types';

/**
 * Streams progress events to the UI
 */
export class ProgressStreamer {
	private callbacks: Array<(event: ProgressEvent) => void | Promise<void>> = [];

	/**
	 * Register a callback for progress events
	 */
	onProgress(callback: (event: ProgressEvent) => void | Promise<void>): () => void {
		this.callbacks.push(callback);

		// Return unsubscribe function
		return () => {
			const index = this.callbacks.indexOf(callback);
			if (index !== -1) {
				this.callbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Emit a progress event
	 */
	async emit(event: ProgressEvent): Promise<void> {
		for (const callback of this.callbacks) {
			try {
				await callback(event);
			} catch (error) {
				console.error('Progress callback error:', error);
			}
		}
	}

	/**
	 * Stream that a plan was created
	 */
	async streamPlanCreated(plan: ExecutionPlan): Promise<void> {
		await this.emit({
			type: 'plan',
			timestamp: Date.now(),
			data: {
				planId: plan.id,
				goal: plan.goal,
				totalSteps: plan.steps.length,
				steps: plan.steps.map((s) => ({
					id: s.id,
					description: s.description
				}))
			}
		});
	}

	/**
	 * Stream that a step is starting
	 */
	async streamStepStarting(step: PlanStep, stepNumber: number, totalSteps: number): Promise<void> {
		await this.emit({
			type: 'step_start',
			timestamp: Date.now(),
			data: {
				stepId: step.id,
				stepNumber,
				totalSteps,
				description: step.description,
				toolName: step.toolName
			}
		});
	}

	/**
	 * Stream that a step completed
	 */
	async streamStepCompleted(
		step: PlanStep,
		stepNumber: number,
		totalSteps: number,
		result: unknown
	): Promise<void> {
		await this.emit({
			type: 'step_complete',
			timestamp: Date.now(),
			data: {
				stepId: step.id,
				stepNumber,
				totalSteps,
				description: step.description,
				result: this.sanitizeResult(result)
			}
		});
	}

	/**
	 * Stream that a step failed
	 */
	async streamStepFailed(
		step: PlanStep,
		stepNumber: number,
		totalSteps: number,
		error: string
	): Promise<void> {
		await this.emit({
			type: 'step_failed',
			timestamp: Date.now(),
			data: {
				stepId: step.id,
				stepNumber,
				totalSteps,
				description: step.description,
				error
			}
		});
	}

	/**
	 * Stream a thinking message
	 */
	async streamThinking(thought: string): Promise<void> {
		await this.emit({
			type: 'thinking',
			timestamp: Date.now(),
			data: { thought }
		});
	}

	/**
	 * Stream that execution is complete
	 */
	async streamComplete(summary: CompletionSummary): Promise<void> {
		await this.emit({
			type: 'complete',
			timestamp: Date.now(),
			data: {
				success: summary.success,
				message: summary.message,
				stepsCompleted: summary.stepsCompleted,
				stepsTotal: summary.stepsTotal,
				durationMs: summary.durationMs
			}
		});
	}

	/**
	 * Stream an error
	 */
	async streamError(error: string, context?: Record<string, unknown>): Promise<void> {
		await this.emit({
			type: 'error',
			timestamp: Date.now(),
			data: { error, ...context }
		});
	}

	/**
	 * Sanitize result for streaming (remove sensitive data)
	 */
	private sanitizeResult(result: unknown): unknown {
		if (result === null || result === undefined) {
			return null;
		}

		if (typeof result === 'string') {
			// Truncate long strings
			return result.length > 500 ? result.slice(0, 500) + '...' : result;
		}

		if (Array.isArray(result)) {
			// Limit array size
			return result.slice(0, 10);
		}

		if (typeof result === 'object') {
			// Sanitize object
			const sanitized: Record<string, unknown> = {};
			const keys = Object.keys(result).slice(0, 20); // Limit keys
			for (const key of keys) {
				const value = (result as Record<string, unknown>)[key];
				sanitized[key] = this.sanitizeResult(value);
			}
			return sanitized;
		}

		return result;
	}

	/**
	 * Clear all callbacks
	 */
	clear(): void {
		this.callbacks = [];
	}
}

/**
 * Summary of completion
 */
export interface CompletionSummary {
	success: boolean;
	message: string;
	stepsCompleted: number;
	stepsTotal: number;
	durationMs: number;
}

/**
 * Plan tracking and execution state management
 */

import type { ExecutionPlan, PlanStep } from '../core/agent-types';

/**
 * Tracks execution progress of a plan
 */
export class PlanTracker {
	private plan: ExecutionPlan;

	constructor(plan: ExecutionPlan) {
		this.plan = plan;
	}

	/**
	 * Get the current plan
	 */
	getPlan(): ExecutionPlan {
		return this.plan;
	}

	/**
	 * Start executing the plan
	 */
	start(): void {
		this.plan.status = 'active';
		this.plan.startedAt = Date.now();
	}

	/**
	 * Mark the plan as complete
	 */
	complete(): void {
		this.plan.status = 'completed';
		this.plan.completedAt = Date.now();
		this.plan.currentStepId = undefined;
	}

	/**
	 * Mark the plan as failed
	 */
	fail(): void {
		this.plan.status = 'failed';
		this.plan.completedAt = Date.now();
	}

	/**
	 * Get the next pending step that has no unmet dependencies
	 */
	getNextStep(): PlanStep | null {
		const pendingSteps = this.plan.steps.filter((s) => s.status === 'pending');

		for (const step of pendingSteps) {
			if (this.areDependenciesMet(step)) {
				return step;
			}
		}

		return null;
	}

	/**
	 * Check if all dependencies for a step are met
	 */
	private areDependenciesMet(step: PlanStep): boolean {
		if (step.dependencies.length === 0) return true;

		return step.dependencies.every((depId) => {
			const depStep = this.plan.steps.find((s) => s.id === depId);
			return depStep?.status === 'completed';
		});
	}

	/**
	 * Start executing a step
	 */
	startStep(stepId: string): void {
		const step = this.plan.steps.find((s) => s.id === stepId);
		if (step) {
			step.status = 'in_progress';
			step.startedAt = Date.now();
			this.plan.currentStepId = stepId;
		}
	}

	/**
	 * Complete a step with a result
	 */
	completeStep(stepId: string, result: unknown): void {
		const step = this.plan.steps.find((s) => s.id === stepId);
		if (step) {
			step.status = 'completed';
			step.completedAt = Date.now();
			step.result = result;
		}
	}

	/**
	 * Mark a step as failed
	 */
	failStep(stepId: string, error: string): void {
		const step = this.plan.steps.find((s) => s.id === stepId);
		if (step) {
			step.status = 'failed';
			step.completedAt = Date.now();
			step.error = error;
		}
	}

	/**
	 * Skip a step (optional execution)
	 */
	skipStep(stepId: string, reason?: string): void {
		const step = this.plan.steps.find((s) => s.id === stepId);
		if (step) {
			step.status = 'skipped';
			step.completedAt = Date.now();
			if (reason) {
				step.error = `Skipped: ${reason}`;
			}
		}
	}

	/**
	 * Check if the plan is complete (all steps done or skipped)
	 */
	isComplete(): boolean {
		return this.plan.steps.every(
			(s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'failed'
		);
	}

	/**
	 * Check if the plan has any failed steps
	 */
	hasFailures(): boolean {
		return this.plan.steps.some((s) => s.status === 'failed');
	}

	/**
	 * Get the number of completed steps
	 */
	getCompletedCount(): number {
		return this.plan.steps.filter((s) => s.status === 'completed').length;
	}

	/**
	 * Get the number of total steps
	 */
	getTotalCount(): number {
		return this.plan.steps.length;
	}

	/**
	 * Get the percentage complete
	 */
	getProgress(): number {
		if (this.plan.steps.length === 0) return 100;
		return Math.round((this.getCompletedCount() / this.plan.steps.length) * 100);
	}

	/**
	 * Get a summary of the plan status
	 */
	getSummary(): PlanSummary {
		const completed = this.plan.steps.filter((s) => s.status === 'completed').length;
		const failed = this.plan.steps.filter((s) => s.status === 'failed').length;
		const skipped = this.plan.steps.filter((s) => s.status === 'skipped').length;
		const inProgress = this.plan.steps.filter((s) => s.status === 'in_progress').length;
		const pending = this.plan.steps.filter((s) => s.status === 'pending').length;

		return {
			goal: this.plan.goal,
			status: this.plan.status,
			total: this.plan.steps.length,
			completed,
			failed,
			skipped,
			inProgress,
			pending,
			progress: this.getProgress(),
			currentStep: this.plan.currentStepId
				? this.plan.steps.find((s) => s.id === this.plan.currentStepId)?.description
				: undefined
		};
	}
}

/**
 * Summary of plan status
 */
export interface PlanSummary {
	goal: string;
	status: 'draft' | 'active' | 'completed' | 'failed';
	total: number;
	completed: number;
	failed: number;
	skipped: number;
	inProgress: number;
	pending: number;
	progress: number;
	currentStep?: string;
}

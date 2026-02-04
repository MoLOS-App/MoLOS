/**
 * Agent state management
 */

import type { AgentState, ExecutionPlan, AgentMessage, InternalAgentAction } from './agent-types';
import { uuid } from '$lib/utils/uuid';

/**
 * Manages the state of an agent execution
 */
export class AgentStateManager {
	private state: AgentState;

	constructor(
		userId: string,
		sessionId: string,
		initialMessages: AgentMessage[] = []
	) {
		this.state = {
			runId: uuid(),
			sessionId,
			userId,
			plan: null,
			currentIteration: 0,
			totalStepsCompleted: 0,
			lastToolSignature: null,
			messages: initialMessages,
			actions: [],
			isComplete: false
		};
	}

	/**
	 * Get the current state
	 */
	getState(): Readonly<AgentState> {
		return this.state;
	}

	/**
	 * Get the run ID
	 */
	getRunId(): string {
		return this.state.runId;
	}

	/**
	 * Set the current execution plan
	 */
	setPlan(plan: ExecutionPlan): void {
		this.state.plan = plan;
	}

	/**
	 * Get the current plan
	 */
	getPlan(): ExecutionPlan | null {
		return this.state.plan;
	}

	/**
	 * Increment the iteration counter
	 */
	incrementIteration(): void {
		this.state.currentIteration++;
	}

	/**
	 * Get the current iteration number
	 */
	getIteration(): number {
		return this.state.currentIteration;
	}

	/**
	 * Add a message to the history
	 */
	addMessage(message: AgentMessage): void {
		this.state.messages.push(message);
	}

	/**
	 * Get all messages
	 */
	getMessages(): AgentMessage[] {
		return this.state.messages;
	}

	/**
	 * Add an action to the history
	 */
	addAction(action: InternalAgentAction): void {
		this.state.actions.push(action);
	}

	/**
	 * Get all actions
	 */
	getActions(): InternalAgentAction[] {
		return this.state.actions;
	}

	/**
	 * Set the last tool signature (for detecting loops)
	 */
	setLastToolSignature(signature: string | null): void {
		this.state.lastToolSignature = signature;
	}

	/**
	 * Get the last tool signature
	 */
	getLastToolSignature(): string | null {
		return this.state.lastToolSignature;
	}

	/**
	 * Mark the execution as complete
	 */
	markComplete(): void {
		this.state.isComplete = true;
		if (this.state.plan) {
			this.state.plan.status = 'completed';
			this.state.plan.completedAt = Date.now();
		}
	}

	/**
	 * Check if execution is complete
	 */
	isComplete(): boolean {
		return this.state.isComplete;
	}

	/**
	 * Increment the completed steps counter
	 */
	incrementStepsCompleted(): void {
		this.state.totalStepsCompleted++;
	}

	/**
	 * Get the number of completed steps
	 */
	getStepsCompleted(): number {
		return this.state.totalStepsCompleted;
	}

	/**
	 * Update the current step in the plan
	 */
	updatePlanStep(stepId: string, updates: Partial<PlanStepUpdate>): void {
		if (!this.state.plan) return;

		const step = this.state.plan.steps.find((s) => s.id === stepId);
		if (step) {
			Object.assign(step, updates);
		}
	}

	/**
	 * Set the current step ID in the plan
	 */
	setCurrentStep(stepId: string): void {
		if (this.state.plan) {
			this.state.plan.currentStepId = stepId;
		}
	}

	/**
	 * Create a snapshot of the current state for persistence
	 */
	toSnapshot(): AgentSnapshot {
		return {
			runId: this.state.runId,
			sessionId: this.state.sessionId,
			userId: this.state.userId,
			plan: this.state.plan,
			currentIteration: this.state.currentIteration,
			totalStepsCompleted: this.state.totalStepsCompleted,
			isComplete: this.state.isComplete,
			timestamp: Date.now()
		};
	}
}

/**
 * Partial update for a plan step
 */
interface PlanStepUpdate {
	status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
	result?: unknown;
	error?: string;
	startedAt?: number;
	completedAt?: number;
}

/**
 * Snapshot of agent state for persistence
 */
export interface AgentSnapshot {
	runId: string;
	sessionId: string;
	userId: string;
	plan: ExecutionPlan | null;
	currentIteration: number;
	totalStepsCompleted: number;
	isComplete: boolean;
	timestamp: number;
}

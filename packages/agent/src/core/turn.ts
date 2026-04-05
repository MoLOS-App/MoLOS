/**
 * Turn Management - Handles turn lifecycle and sub-turns
 *
 * ## Purpose
 * Manages the lifecycle of turns and sub-turns in agent execution:
 * - **Turn**: One user message with all its LLM calls and tool executions
 * - **Sub-turn**: A single LLM call within a turn (enables recursive tool calling)
 * - Tracks turn status (pending, running, completed, failed, cancelled)
 * - Maintains turn history for debugging and analytics
 *
 * ## Key Concepts
 *
 * ### Turn vs Sub-turn Hierarchy
 * ```
 * Turn (user message)
 * ├── SubTurn 1 (LLM call)
 * │   ├── Tool call 1
 * │   ├── Tool call 2
 * │   └── Tool result 1
 * ├── SubTurn 2 (LLM call)
 * │   ├── Tool call 3
 * │   └── Tool result 2
 * └── ... (up to maxSubTurnDepth)
 * ```
 *
 * ### Turn Status State Machine
 * ```
 * pending → running → completed
 *                   → failed
 *                   → cancelled
 * ```
 *
 * ### Sub-turn Depth Limit
 * - Prevents infinite recursion in tool-calling loops
 * - Configurable via `maxSubTurnDepth` (default: 3)
 * - Check via `canSpawnSubTurn(parentTurnId)`
 *
 * ## Usage Pattern
 * ```typescript
 * const turnManager = createTurnManager({
 *   maxTurns: 50,
 *   maxSubTurnDepth: 3
 * });
 *
 * // Create a turn for user input
 * const turn = turnManager.createTurn('Hello, agent!');
 *
 * // Check if sub-turns can be spawned
 * if (turnManager.canSpawnSubTurn(turn.id)) {
 *   const subTurn = turnManager.createSubTurn(turn.id, request, toolCalls);
 *   // Execute sub-turn...
 *   turnManager.completeSubTurn(turn.id, subTurn.id, { response });
 * }
 *
 * // Complete the turn
 * turnManager.completeTurn(turn.id, {
 *   messages: allMessages,
 *   output: finalOutput,
 *   toolCalls,
 *   toolResults,
 *   endedAt: Date.now(),
 *   durationMs
 * });
 * ```
 *
 * ## AI Context Optimization
 * - Turn history is maintained for analytics (not for LLM context)
 * - Completed turns are moved from active map to history array
 * - Active turn count is tracked for resource management
 * - Sub-turn depth prevents runaway tool-calling loops
 */

import type { AgentMessage, ToolCall, ToolResult } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Status of a turn
 */
export type TurnStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * A turn represents one user message and all its associated sub-turns
 */
export interface Turn {
	id: string;
	parentTurnId?: string;
	sessionId: string;
	userMessage: AgentMessage;
	subTurns: SubTurn[];
	status: TurnStatus;
	startedAt: number;
	completedAt?: number;
	finalResponse?: AgentMessage;
	error?: string;
	metadata?: Record<string, unknown>;
	spawnConfig?: SpawnConfig;
}

/**
 * A sub-turn represents a single LLM call within a turn
 */
export interface SubTurn {
	id: string;
	turnId: string;
	request: unknown;
	response?: unknown;
	toolCalls: ToolCall[];
	toolResults: ToolResult[];
	status: TurnStatus;
	startedAt: number;
	completedAt?: number;
	error?: string;
}

/**
 * Result of a completed turn
 */
export interface TurnResult {
	turnId: string;
	messages: AgentMessage[];
	output: string;
	toolCalls: ToolCall[];
	toolResults: ToolResult[];
	endedAt: number;
	durationMs: number;
	usage?: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

/**
 * Result of a sub-turn
 */
export interface SubTurnResult extends TurnResult {
	parentTurnId: string;
	spawnMode: 'run' | 'session';
}

/**
 * Configuration for spawning a sub-turn
 */
export interface SpawnConfig {
	model?: string;
	systemPrompt?: string;
	tools?: unknown[];
	timeout?: number;
	maxContextRunes?: number;
}

// =============================================================================
// Turn Manager
// =============================================================================

/**
 * Configuration for TurnManager
 */
export interface TurnManagerConfig {
	maxTurns: number;
	maxSubTurnDepth: number;
}

/**
 * TurnManager handles turn lifecycle and sub-turn tracking
 *
 * ## Core Responsibilities
 * 1. **Turn Creation**: Creates new turns with unique IDs
 * 2. **Turn Completion**: Marks turns as completed/failed/cancelled
 * 3. **Sub-turn Management**: Creates and completes sub-turns under parent turns
 * 4. **State Tracking**: Tracks active vs completed turns
 * 5. **Depth Management**: Enforces maxSubTurnDepth limit
 *
 * ## Data Structures
 * - `turns: Map<string, Turn>` - Active turns (keyed by turn ID)
 * - `turnHistory: Turn[]` - Completed turns (for debugging/analytics)
 * - `activeTurnCount: number` - Count of active turns
 * - `subTurnCounter: number` - Counter for unique sub-turn IDs
 *
 * ## State Transitions
 * ```
 * createTurn() → 'running'
 * completeTurn() → 'completed'
 * failTurn() → 'failed'
 * cancelTurn() → 'cancelled'
 * ```
 *
 * ## Thread Safety Note
 * This class is not thread-safe. For concurrent access,
 * wrap with appropriate synchronization mechanisms.
 */
export class TurnManager {
	private readonly maxTurns: number;
	private readonly maxSubTurnDepth: number;
	private turns: Map<string, Turn> = new Map();
	private turnHistory: Turn[] = [];
	private activeTurnCount = 0;
	private subTurnCounter = 0;

	constructor(config: TurnManagerConfig) {
		this.maxTurns = config.maxTurns;
		this.maxSubTurnDepth = config.maxSubTurnDepth;
	}

	/**
	 * Get the current active turn
	 */
	get currentTurn(): Turn | undefined {
		if (this.turns.size === 0) {
			return undefined;
		}
		// Return the most recently created active turn
		let mostRecent: Turn | undefined;
		let mostRecentTime = 0;
		for (const turn of this.turns.values()) {
			if (turn.startedAt > mostRecentTime) {
				mostRecentTime = turn.startedAt;
				mostRecent = turn;
			}
		}
		return mostRecent;
	}

	/**
	 * Get the total number of turns (active + completed)
	 */
	get turnCount(): number {
		return this.activeTurnCount + this.turnHistory.length;
	}

	/**
	 * Create a new turn
	 */
	createTurn(input: string, parentTurnId?: string): Turn {
		const id = this.generateTurnId();
		const now = Date.now();

		const turn: Turn = {
			id,
			parentTurnId,
			sessionId: 'default',
			userMessage: {
				role: 'user',
				content: input
			},
			subTurns: [],
			status: 'running',
			startedAt: now
		};

		this.turns.set(id, turn);
		this.activeTurnCount++;

		return turn;
	}

	/**
	 * Create a new sub-turn under a parent turn
	 */
	createSubTurn(
		parentTurnId: string,
		request: unknown,
		tools: ToolCall[] = []
	): SubTurn | undefined {
		const parentTurn = this.turns.get(parentTurnId);
		if (!parentTurn) {
			return undefined;
		}

		if (!this.canSpawnSubTurn(parentTurnId)) {
			return undefined;
		}

		const subTurnId = this.generateSubTurnId();
		const now = Date.now();

		const subTurn: SubTurn = {
			id: subTurnId,
			turnId: parentTurnId,
			request,
			toolCalls: tools,
			toolResults: [],
			status: 'running',
			startedAt: now
		};

		parentTurn.subTurns.push(subTurn);
		return subTurn;
	}

	/**
	 * Complete a turn with result
	 */
	completeTurn(turnId: string, result: TurnResult): void {
		const turn = this.turns.get(turnId);
		if (!turn) {
			return;
		}

		turn.status = 'completed';
		turn.completedAt = result.endedAt;
		turn.finalResponse = {
			role: 'assistant',
			content: result.output
		};

		this.turns.delete(turnId);
		this.turnHistory.push(turn);
		this.activeTurnCount--;
	}

	/**
	 * Fail a turn with error
	 */
	failTurn(turnId: string, error: { type: string; message: string }): void {
		const turn = this.turns.get(turnId);
		if (!turn) {
			return;
		}

		turn.status = 'failed';
		turn.completedAt = Date.now();
		turn.error = error.message;

		this.turns.delete(turnId);
		this.turnHistory.push(turn);
		this.activeTurnCount--;
	}

	/**
	 * Cancel a turn
	 */
	cancelTurn(turnId: string): void {
		const turn = this.turns.get(turnId);
		if (!turn) {
			return;
		}

		turn.status = 'cancelled';
		turn.completedAt = Date.now();

		// Cancel all sub-turns
		for (const subTurn of turn.subTurns) {
			if (subTurn.status === 'running') {
				subTurn.status = 'cancelled';
				subTurn.completedAt = Date.now();
			}
		}

		this.turns.delete(turnId);
		this.turnHistory.push(turn);
		this.activeTurnCount--;
	}

	/**
	 * Complete a sub-turn
	 */
	completeSubTurn(
		turnId: string,
		subTurnId: string,
		result: {
			response?: unknown;
			toolResults?: ToolResult[];
			error?: string;
		}
	): void {
		const turn = this.turns.get(turnId);
		if (!turn) {
			return;
		}

		const subTurn = turn.subTurns.find((st) => st.id === subTurnId);
		if (!subTurn) {
			return;
		}

		subTurn.status = result.error ? 'failed' : 'completed';
		subTurn.completedAt = Date.now();
		subTurn.response = result.response;

		if (result.toolResults) {
			subTurn.toolResults = result.toolResults;
		}

		if (result.error) {
			subTurn.error = result.error;
		}
	}

	/**
	 * Get a turn by ID
	 */
	getTurn(turnId: string): Turn | undefined {
		return this.turns.get(turnId);
	}

	/**
	 * Get a sub-turn by ID
	 */
	getSubTurn(turnId: string, subTurnId: string): SubTurn | undefined {
		const turn = this.turns.get(turnId);
		if (!turn) {
			return undefined;
		}
		return turn.subTurns.find((st) => st.id === subTurnId);
	}

	/**
	 * Get all active turns
	 */
	getActiveTurns(): Turn[] {
		return Array.from(this.turns.values());
	}

	/**
	 * Get completed turns from history
	 */
	getCompletedTurns(): Turn[] {
		return [...this.turnHistory];
	}

	/**
	 * Get turn history (all completed turns)
	 */
	getTurnHistory(): Turn[] {
		return [...this.turnHistory];
	}

	/**
	 * Check if a sub-turn can be spawned under the given parent
	 */
	canSpawnSubTurn(parentTurnId: string): boolean {
		const parentTurn = this.turns.get(parentTurnId);
		if (!parentTurn) {
			return false;
		}

		const depth = this.getSubTurnDepth(parentTurnId);
		return depth < this.maxSubTurnDepth;
	}

	/**
	 * Get the sub-turn depth for a turn
	 */
	getSubTurnDepth(turnId: string): number {
		const turn = this.turns.get(turnId);
		if (!turn) {
			return 0;
		}

		let depth = 0;
		let currentTurn: Turn | undefined = turn;

		while (currentTurn?.parentTurnId) {
			depth++;
			currentTurn = this.turns.get(currentTurn.parentTurnId);
		}

		return depth;
	}

	/**
	 * Generate a new sub-turn ID
	 */
	generateSubTurnId(): string {
		return `subturn_${Date.now()}_${++this.subTurnCounter}`;
	}

	/**
	 * Check if max turns limit is reached
	 */
	isAtMaxTurns(): boolean {
		return this.turnHistory.length >= this.maxTurns;
	}

	/**
	 * Get the current number of active turns
	 */
	getActiveTurnCount(): number {
		return this.activeTurnCount;
	}

	/**
	 * Get total turns processed (including completed)
	 */
	getTotalTurns(): number {
		return this.turnHistory.length;
	}

	/**
	 * Reset the turn manager
	 */
	reset(): void {
		this.turns.clear();
		this.turnHistory = [];
		this.activeTurnCount = 0;
		this.subTurnCounter = 0;
	}

	/**
	 * Generate a unique turn ID
	 */
	private generateTurnId(): string {
		return `turn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new TurnManager instance
 */
export function createTurnManager(config: TurnManagerConfig): TurnManager {
	return new TurnManager(config);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if turn has exceeded max tool calls
 */
export function hasExceededMaxToolCalls(turn: Turn, maxToolCalls: number): boolean {
	const totalToolCalls = turn.subTurns.reduce((count, st) => count + st.toolCalls.length, 0);
	return totalToolCalls >= maxToolCalls;
}

/**
 * Get total tool call count for a turn
 */
export function getTotalToolCalls(turn: Turn): number {
	return turn.subTurns.reduce((count, st) => count + st.toolCalls.length, 0);
}

/**
 * Get total tool result count for a turn
 */
export function getTotalToolResults(turn: Turn): number {
	return turn.subTurns.reduce((count, st) => count + st.toolResults.length, 0);
}

/**
 * Check if all sub-turns in a turn are complete
 */
export function areAllSubTurnsComplete(turn: Turn): boolean {
	if (turn.subTurns.length === 0) {
		return false;
	}
	return turn.subTurns.every((st) => st.status !== 'running');
}

/**
 * Get running sub-turns for a turn
 */
export function getRunningSubTurns(turn: Turn): SubTurn[] {
	return turn.subTurns.filter((st) => st.status === 'running');
}

/**
 * Calculate turn duration in milliseconds
 */
export function getTurnDurationMs(turn: Turn): number {
	if (!turn.completedAt) {
		return Date.now() - turn.startedAt;
	}
	return turn.completedAt - turn.startedAt;
}

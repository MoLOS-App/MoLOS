/**
 * Unified ReAct Loop - Reasoning + Acting execution pattern
 *
 * Implements the Thought-Action-Observation-Reflection cycle.
 * This is the core execution engine for the agent.
 */

import type {
	AgentMessage,
	ToolDefinition,
	Thought,
	Observation,
	Reflection,
	AgentState,
	ExecutionPlan,
	ProgressEvent,
	ThinkingLevel,
	ToolExecutionResult
} from '../core/types';
import type { IAgentContext } from '../core/context';
import type { EventBus } from '../events/event-bus';
import type { HookManager } from '../hooks/hook-manager';
import type { ToolExecutor } from '../tools/tool-executor';
import type { ILlmProvider } from '../llm/provider-interface';
import type { LlmResponse } from '../core/types';
import { ThinkingEngine, createThinkingEngine } from './thinking-engine';
import { CompletionPromise, createCompletionPromise, type CompletionCheck } from './completion-promise';

// ============================================================================
// ReAct Loop Types
// ============================================================================

/**
 * ReAct loop configuration
 */
export interface ReActLoopConfig {
	/** Maximum iterations */
	maxIterations: number;
	/** Maximum duration in ms */
	maxDurationMs: number;
	/** Thinking level */
	thinkingLevel: ThinkingLevel;
	/** Require tool use */
	requireToolUse: boolean;
	/** Allow self-correction */
	allowSelfCorrection: boolean;
	/** Enable verbose reasoning */
	verboseReasoning: boolean;
	/** Enable completion verification */
	enableCompletionVerification: boolean;
	/** Debug mode */
	debug: boolean;
}

/**
 * Default ReAct loop configuration
 */
export const DEFAULT_REACT_CONFIG: ReActLoopConfig = {
	maxIterations: 20,
	maxDurationMs: 300000, // 5 minutes
	thinkingLevel: 'low',
	requireToolUse: false,
	allowSelfCorrection: true,
	verboseReasoning: false,
	enableCompletionVerification: true,
	debug: false
};

/**
 * ReAct loop state
 */
export interface ReActLoopState {
	/** Current iteration */
	iteration: number;
	/** Start time */
	startTime: number;
	/** Thought history */
	thoughts: Thought[];
	/** Observation history */
	observations: Observation[];
	/** Reflection history */
	reflections: Reflection[];
	/** Is complete */
	isComplete: boolean;
	/** Completion reason */
	completionReason?: string;
	/** Current plan */
	plan?: ExecutionPlan;
	/** Conversation prefix */
	conversationalPrefix?: string;
}

/**
 * ReAct loop result
 */
export interface ReActLoopResult {
	/** Success */
	success: boolean;
	/** Final message */
	finalMessage: string;
	/** Reasoning summary */
	reasoning: string;
	/** Total iterations */
	totalIterations: number;
	/** Duration in ms */
	durationMs: number;
	/** Thoughts */
	thoughts: Thought[];
	/** Observations */
	observations: Observation[];
	/** Reflections */
	reflections: Reflection[];
	/** Completion reason */
	completionReason: string;
	/** Completion check */
	completionCheck?: CompletionCheck;
}

/**
 * Iteration result
 */
export interface IterationResult {
	thought: Thought;
	observation: Observation | null;
	reflection: Reflection | null;
	shouldContinue: boolean;
	events: ProgressEvent[];
}

// ============================================================================
// Unified ReAct Loop
// ============================================================================

/**
 * Unified ReAct Loop - Core execution engine
 */
export class UnifiedReActLoop {
	private config: ReActLoopConfig;
	private state: ReActLoopState;
	private thinkingEngine: ThinkingEngine;
	private completionPromise: CompletionPromise;
	private context: IAgentContext;
	private llmProvider: ILlmProvider;
	private toolExecutor: ToolExecutor;
	private eventBus?: EventBus;
	private hookManager?: HookManager;
	private tools: ToolDefinition[];
	private systemPrompt: string;

	constructor(
		context: IAgentContext,
		llmProvider: ILlmProvider,
		toolExecutor: ToolExecutor,
		tools: ToolDefinition[],
		systemPrompt: string,
		config: Partial<ReActLoopConfig> = {}
	) {
		this.context = context;
		this.llmProvider = llmProvider;
		this.toolExecutor = toolExecutor;
		this.tools = tools;
		this.systemPrompt = systemPrompt;
		this.config = { ...DEFAULT_REACT_CONFIG, ...config };

		this.thinkingEngine = createThinkingEngine(this.config.thinkingLevel, this.config.debug);
		this.completionPromise = createCompletionPromise({
			enableVerification: this.config.enableCompletionVerification,
			debug: this.config.debug
		});

		this.state = {
			iteration: 0,
			startTime: Date.now(),
			thoughts: [],
			observations: [],
			reflections: [],
			isComplete: false
		};
	}

	/**
	 * Run the ReAct loop
	 */
	async run(userRequest: string, initialMessages: AgentMessage[]): Promise<ReActLoopResult> {
		// Initialize
		const messages = this.buildInitialMessages(userRequest, initialMessages);

		// Main loop
		while (!this.state.isComplete && this.state.iteration < this.config.maxIterations) {
			// Check duration
			const elapsed = Date.now() - this.state.startTime;
			if (elapsed > this.config.maxDurationMs) {
				this.state.isComplete = true;
				this.state.completionReason = 'max_duration';
				break;
			}

			// Run iteration
			const iterationResult = await this.runIteration(messages);

			// Store results
			this.state.thoughts.push(iterationResult.thought);
			if (iterationResult.observation) {
				this.state.observations.push(iterationResult.observation);
			}
			if (iterationResult.reflection) {
				this.state.reflections.push(iterationResult.reflection);
			}

			// Add observation to messages (critical feedback loop)
			if (iterationResult.observation) {
				messages.push(this.createObservationMessage(iterationResult.observation));
			}

			// Check if should continue
			if (!iterationResult.shouldContinue) {
				this.state.isComplete = true;
				this.state.completionReason = 'agent_completed';
				break;
			}

			this.state.iteration++;
		}

		// Finalize
		const durationMs = Date.now() - this.state.startTime;
		const completionCheck = this.checkCompletion();

		// Generate final message
		const finalMessage = await this.generateFinalMessage(userRequest, messages);

		return {
			success: completionCheck.status === 'complete',
			finalMessage,
			reasoning: this.buildReasoningSummary(),
			totalIterations: this.state.iteration,
			durationMs,
			thoughts: this.state.thoughts,
			observations: this.state.observations,
			reflections: this.state.reflections,
			completionReason: this.state.completionReason || 'unknown',
			completionCheck
		};
	}

	/**
	 * Get current state
	 */
	getState(): Readonly<ReActLoopState> {
		return { ...this.state };
	}

	/**
	 * Mark as complete
	 */
	markComplete(reason: string): void {
		this.state.isComplete = true;
		this.state.completionReason = reason;
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private buildInitialMessages(userRequest: string, initialMessages: AgentMessage[]): AgentMessage[] {
		const enhancedPrompt = this.thinkingEngine.enhanceSystemPrompt(this.systemPrompt);

		const messages: AgentMessage[] = [
			{ role: 'system', content: enhancedPrompt },
			...initialMessages,
			{ role: 'user', content: userRequest }
		];

		return messages;
	}

	private async runIteration(messages: AgentMessage[]): Promise<IterationResult> {
		const events: ProgressEvent[] = [];
		this.state.iteration++;

		// Phase 1: Generate thought
		const thought = await this.generateThought(messages);
		this.context.getState().thoughts.push(thought);

		// Check for conversational response
		const isConversational = this.isConversationalResponse(thought.reasoning);
		if (isConversational && !this.state.conversationalPrefix) {
			this.state.conversationalPrefix = thought.reasoning;
		}

		// Emit thought event
		if (!isConversational) {
			events.push({
				type: 'thought',
				timestamp: Date.now(),
				data: {
					thoughtId: thought.id,
					reasoning: thought.reasoning,
					nextAction: thought.nextAction,
					toolName: thought.toolName,
					iteration: this.state.iteration,
					confidence: thought.confidence
				}
			});
		}

		// Check if agent wants to complete
		if (thought.nextAction === 'complete' || thought.nextAction === 'ask_user') {
			return {
				thought,
				observation: null,
				reflection: null,
				shouldContinue: false,
				events
			};
		}

		// Phase 2: Execute action
		let observation: Observation | null = null;

		if (thought.nextAction === 'use_tool' && thought.toolName) {
			observation = await this.executeTool(thought);
			this.context.getState().observations.push(observation);
		}

		// Phase 3: Reflect
		const reflection = await this.reflect(observation, thought);
		this.state.reflections.push(reflection);

		// Determine if should continue
		const shouldContinue =
			!reflection.satisfied &&
			reflection.shouldContinue &&
			this.state.iteration < this.config.maxIterations;

		return {
			thought,
			observation,
			reflection,
			shouldContinue,
			events
		};
	}

	private async generateThought(messages: AgentMessage[]): Promise<Thought> {
		try {
			const response = await this.llmProvider.complete(messages, this.tools);
			return this.parseThoughtFromResponse(response);
		} catch (error) {
			// Handle error
			return {
				id: `thought-error-${Date.now()}`,
				iteration: this.state.iteration,
				reasoning: `Error generating thought: ${error}`,
				nextAction: 'retry',
				confidence: 0.3
			};
		}
	}

	private parseThoughtFromResponse(response: LlmResponse): Thought {
		const id = `thought-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

		// Check for tool calls
		if (response.toolCalls && response.toolCalls.length > 0) {
			const toolCall = response.toolCalls[0];
			return {
				id,
				iteration: this.state.iteration,
				reasoning: response.content || `Using tool: ${toolCall.name}`,
				nextAction: 'use_tool',
				toolName: toolCall.name,
				toolParameters: toolCall.parameters,
				confidence: 0.8
			};
		}

		// No tool call - check for completion
		const content = response.content?.toLowerCase() || '';
		const isComplete = /\b(complete|done|finished)\b/i.test(content);

		return {
			id,
			iteration: this.state.iteration,
			reasoning: response.content || 'No reasoning provided',
			nextAction: isComplete ? 'complete' : 'retry',
			confidence: isComplete ? 0.9 : 0.5
		};
	}

	private async executeTool(thought: Thought): Promise<Observation> {
		const startTime = Date.now();

		const result = await this.toolExecutor.execute(
			{
				id: thought.id,
				name: thought.toolName!,
				parameters: thought.toolParameters || {}
			},
			{
				context: this.context,
				iteration: this.state.iteration,
				useCache: true
			}
		);

		return {
			id: `obs-${Date.now()}`,
			thoughtId: thought.id,
			toolName: thought.toolName,
			result: result.result,
			error: result.error,
			durationMs: result.durationMs,
			timestamp: Date.now(),
			isSuccess: result.success
		};
	}

	private async reflect(observation: Observation | null, thought: Thought): Promise<Reflection> {
		if (!observation) {
			return {
				id: `ref-${Date.now()}`,
				observationId: '',
				thoughts: 'No observation to reflect on.',
				planChanged: false,
				satisfied: thought.nextAction === 'complete',
				shouldContinue: thought.nextAction !== 'complete',
				nextStep: thought.nextAction === 'complete' ? 'complete' : 'continue'
			};
		}

		// Simple reflection based on observation result
		if (observation.isSuccess) {
			return {
				id: `ref-${Date.now()}`,
				observationId: observation.id,
				thoughts: 'Tool executed successfully.',
				planChanged: false,
				satisfied: false,
				shouldContinue: true,
				nextStep: 'continue'
			};
		}

		return {
			id: `ref-${Date.now()}`,
			observationId: observation.id,
			thoughts: `Tool failed: ${observation.error}`,
			planChanged: this.config.allowSelfCorrection,
			satisfied: false,
			shouldContinue: this.config.allowSelfCorrection,
			nextStep: 'continue'
		};
	}

	private createObservationMessage(observation: Observation): AgentMessage {
		let content: string;

		if (observation.isSuccess) {
			content = `Observation: Tool '${observation.toolName}' executed successfully.\n`;
			if (observation.result !== null && observation.result !== undefined) {
				const resultStr = typeof observation.result === 'string'
					? observation.result
					: JSON.stringify(observation.result);
				content += `Result: ${resultStr.slice(0, 5000)}${resultStr.length > 5000 ? '...' : ''}\n`;
			}
		} else {
			content = `Observation: Tool execution failed.\nError: ${observation.error || 'Unknown error'}\n`;
		}

		content += `Duration: ${observation.durationMs}ms`;

		return {
			role: 'user',
			content,
			metadata: { observationId: observation.id, toolName: observation.toolName }
		};
	}

	private checkCompletion(): CompletionCheck {
		const agentState: AgentState = {
			...this.context.getState(),
			thoughts: this.state.thoughts,
			observations: this.state.observations,
			currentIteration: this.state.iteration,
			isComplete: this.state.isComplete,
			completionReason: this.state.completionReason
		};

		return this.completionPromise.check(agentState);
	}

	private async generateFinalMessage(userRequest: string, messages: AgentMessage[]): Promise<string> {
		// Build summary prompt
		let summaryPrompt = `User request: "${userRequest.slice(0, 200)}"

Task execution completed. Provide a clear, natural summary of what was accomplished.

Key points:
- Be conversational and direct
- Explain what you did
- Keep it concise but complete`;

		if (this.state.conversationalPrefix) {
			summaryPrompt = `${this.state.conversationalPrefix}\n\n${summaryPrompt}`;
		}

		try {
			const response = await this.llmProvider.complete([
				{ role: 'system', content: 'You are a helpful AI assistant summarizing completed work.' },
				{ role: 'user', content: summaryPrompt }
			]);

			return response.content || 'Task completed.';
		} catch {
			// Build a simple summary
			const successCount = this.state.observations.filter(o => o.isSuccess).length;
			const failCount = this.state.observations.length - successCount;

			return `Task completed. ${successCount} actions succeeded, ${failCount} failed.`;
		}
	}

	private buildReasoningSummary(): string {
		const parts: string[] = [];

		parts.push('## Execution Summary');
		parts.push(`- Total iterations: ${this.state.iteration}`);
		parts.push(`- Duration: ${Date.now() - this.state.startTime}ms`);
		parts.push(`- Tools used: ${this.state.observations.filter(o => o.isSuccess).length}`);
		parts.push(`- Completion reason: ${this.state.completionReason || 'unknown'}`);

		if (this.state.observations.length > 0) {
			parts.push('\n## Key Actions');
			this.state.observations.slice(-5).forEach((obs, i) => {
				parts.push(`${i + 1}. ${obs.toolName || 'Action'} - ${obs.isSuccess ? '✓' : '✗'}`);
			});
		}

		return parts.join('\n');
	}

	private isConversationalResponse(reasoning: string): boolean {
		if (!reasoning) return false;

		const patterns = [
			/^(sure|of course|certainly|absolutely|gladly)/i,
			/^(claro|por supuesto|seguro)/i,
			/will (show|list|display|get|fetch)/i,
			/i('ll|will) (help|assist|do this)/i
		];

		return patterns.some(p => p.test(reasoning));
	}
}

/**
 * Create a unified ReAct loop
 */
export function createReActLoop(
	context: IAgentContext,
	llmProvider: ILlmProvider,
	toolExecutor: ToolExecutor,
	tools: ToolDefinition[],
	systemPrompt: string,
	config?: Partial<ReActLoopConfig>
): UnifiedReActLoop {
	return new UnifiedReActLoop(context, llmProvider, toolExecutor, tools, systemPrompt, config);
}

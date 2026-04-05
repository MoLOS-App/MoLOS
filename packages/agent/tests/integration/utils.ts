/**
 * Test utilities for agent integration tests
 *
 * Provides mock factories and helper functions for testing agent integrations
 */

import type { ToolParameterSchema } from '../../src/types/index.js';
import type {
	AgentMessage,
	ToolDefinition,
	LlmRequest,
	LlmResponse
} from '../../src/types/index.js';
import type { Tool } from '../../src/tools/registry.js';
import type { LanguageModelV2 } from '@ai-sdk/provider';

// =============================================================================
// Mock Provider
// =============================================================================

export interface MockProviderOptions {
	respond?: string;
	toolCalls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
	shouldFail?: boolean;
	errorType?: 'auth' | 'rate_limit' | 'timeout' | 'context_overflow' | 'format' | 'unknown';
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
	finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
	thinking?: string;
}

/**
 * Creates a mock LLM provider for testing
 */
export function createMockProvider(options: MockProviderOptions): LanguageModelV2 {
	const defaultId = 'mock-provider';
	const defaultModel = 'mock-model';

	return {
		provider: defaultId,
		modelId: defaultModel,
		specificationVersion: 'v1' as const,
		supportedUrls: {},
		doGenerate: async (): Promise<unknown> => {
			if (options.shouldFail) {
				const error = createErrorFromType(options.errorType || 'unknown');
				throw error;
			}

			// If toolCalls are specified, return them
			if (options.toolCalls && options.toolCalls.length > 0) {
				const message: AgentMessage = {
					role: 'assistant',
					content: options.toolCalls.map((tc) => ({
						type: 'tool_call' as const,
						id: tc.id || `call_${Date.now()}`,
						name: tc.name,
						input: tc.args
					}))
				};

				return {
					message,
					model: defaultModel,
					finishReason: options.finishReason || 'tool_calls',
					usage: {
						inputTokens: options.usage?.inputTokens || 100,
						outputTokens: options.usage?.outputTokens || 50,
						totalTokens: (options.usage?.inputTokens || 100) + (options.usage?.outputTokens || 50)
					}
				};
			}

			// Return simple text response
			const message: AgentMessage = {
				role: 'assistant',
				content: options.respond || 'Mock response'
			};

			return {
				message,
				model: defaultModel,
				finishReason: options.finishReason || 'stop',
				usage: {
					inputTokens: options.usage?.inputTokens || 100,
					outputTokens: options.usage?.outputTokens || 50,
					totalTokens: (options.usage?.inputTokens || 100) + (options.usage?.outputTokens || 50)
				},
				thinking: options.thinking
			};
		},
		doStream: async function* (): AsyncGenerator<unknown> {
			if (options.shouldFail) {
				throw createErrorFromType(options.errorType || 'unknown');
			}

			const response = options.respond || 'Mock streaming response';

			// Yield text deltas
			const words = response.split(' ');
			for (let i = 0; i < words.length; i++) {
				yield {
					type: 'text-delta',
					textDelta: words[i] + (i < words.length - 1 ? ' ' : '')
				};
			}

			// Yield finish
			yield {
				type: 'finish',
				finishReason: options.finishReason || 'stop',
				usage: {
					inputTokens: options.usage?.inputTokens || 100,
					outputTokens: options.usage?.outputTokens || 50,
					totalTokens: (options.usage?.inputTokens || 100) + (options.usage?.outputTokens || 50)
				}
			};
		}
	} as unknown as LanguageModelV2;
}

/**
 * Creates an error based on type for simulating provider failures
 */
function createErrorFromType(errorType: string): Error {
	switch (errorType) {
		case 'auth':
			return new Error('invalid api key');
		case 'rate_limit':
			return new Error('rate limit exceeded');
		case 'timeout':
			return new Error('timeout');
		case 'context_overflow':
			return new Error('context length exceeded');
		case 'format':
			return new Error('string should match pattern');
		default:
			return new Error('unknown error');
	}
}

// =============================================================================
// Mock Tool Factory
// =============================================================================

/**
 * Creates a mock tool for testing
 */
export function createMockTool(
	name: string,
	execute: (args: Record<string, unknown>) => Promise<string> | string
): Tool {
	return {
		name,
		description: `Tool: ${name}`,
		parameters: {
			type: 'object' as const,
			properties: {},
			required: []
		},
		execute: async (args: Record<string, unknown>) => {
			const result = execute(args);
			return result instanceof Promise ? await result : result;
		}
	};
}

/**
 * Creates a mock tool with arguments
 */
export function createMockToolWithArgs(
	name: string,
	argSchema: Record<string, ToolParameterSchema>,
	execute: (args: Record<string, unknown>) => Promise<string> | string
): Tool {
	return {
		name,
		description: `Tool: ${name}`,
		parameters: {
			type: 'object' as const,
			properties: argSchema,
			required: Object.keys(argSchema)
		},
		execute: async (args: Record<string, unknown>) => {
			const result = execute(args);
			return result instanceof Promise ? await result : result;
		}
	};
}

// =============================================================================
// Mock Tool Definition Factory
// =============================================================================

/**
 * Creates a mock tool definition for testing
 */
export function createMockToolDefinition(
	name: string,
	description: string = `Tool: ${name}`,
	parameters: Record<string, ToolParameterSchema> = {}
): ToolDefinition {
	return {
		name,
		description,
		parameters: {
			type: 'object',
			properties: parameters,
			required: []
		}
	};
}

// =============================================================================
// Message Factories
// =============================================================================

/**
 * Creates a mock user message
 */
export function createUserMessage(content: string): AgentMessage {
	return {
		role: 'user',
		content
	};
}

/**
 * Creates a mock assistant message
 */
export function createAssistantMessage(content: string | Array<unknown>): AgentMessage {
	return {
		role: 'assistant',
		content: content as AgentMessage['content']
	};
}

/**
 * Creates a mock tool message
 */
export function createToolMessage(
	toolCallId: string,
	content: string,
	toolName?: string
): AgentMessage {
	return {
		role: 'tool',
		content,
		toolCallId,
		name: toolName
	};
}

// =============================================================================
// Event Factories
// =============================================================================

import type { AgentEvent } from '../../src/events/event-bus.js';

/**
 * Creates a mock event for testing
 */
export function createMockEvent(
	type: string,
	data: Record<string, unknown> = {},
	stream: string = 'lifecycle'
): AgentEvent {
	return {
		runId: `test_run_${Date.now()}`,
		seq: 1,
		stream,
		ts: Date.now(),
		data,
		type
	};
}

// =============================================================================
// Async Test Helpers
// =============================================================================

/**
 * Waits for a condition to be true with timeout
 */
export async function waitFor(
	condition: () => boolean | Promise<boolean>,
	timeoutMs: number = 5000,
	pollIntervalMs: number = 50
): Promise<void> {
	const startTime = Date.now();

	while (true) {
		const result = await Promise.resolve(condition());
		if (result) {
			return;
		}

		if (Date.now() - startTime > timeoutMs) {
			throw new Error(`waitFor timed out after ${timeoutMs}ms`);
		}

		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
}

/**
 * Measures the execution time of an async function
 */
export async function measureTime<T>(
	fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
	const startTime = Date.now();
	const result = await fn();
	const durationMs = Date.now() - startTime;
	return { result, durationMs };
}

/**
 * Asserts that a function completes within a time limit
 */
export async function assertCompletesWithin<T>(
	fn: () => Promise<T>,
	maxDurationMs: number
): Promise<T> {
	const { result, durationMs } = await measureTime(fn);

	if (durationMs > maxDurationMs) {
		throw new Error(`Operation took ${durationMs}ms, expected max ${maxDurationMs}ms`);
	}

	return result;
}

// =============================================================================
// Collection Helpers
// =============================================================================

/**
 * Creates an array of mock tools
 */
export function createMockTools(count: number): Tool[] {
	return Array.from({ length: count }, (_, i) =>
		createMockTool(`tool_${i}`, async () => `result from tool ${i}`)
	);
}

/**
 * Creates mock messages for conversation history
 */
export function createConversationHistory(
	messageCount: number,
	alternatingRoles: boolean = true
): AgentMessage[] {
	const messages: AgentMessage[] = [];

	for (let i = 0; i < messageCount; i++) {
		const role = alternatingRoles ? (i % 2 === 0 ? 'user' : 'assistant') : 'user';

		messages.push({
			role,
			content: `Message ${i + 1}`
		});
	}

	return messages;
}

// =============================================================================
// LLM Request/Response Helpers
// =============================================================================

/**
 * Creates a mock LLM request
 */
export function createMockLlmRequest(overrides: Partial<LlmRequest> = {}): LlmRequest {
	return {
		model: 'mock-model',
		messages: [],
		temperature: 1.0,
		maxTokens: 2048,
		...overrides
	};
}

/**
 * Creates a mock LLM response
 */
export function createMockLlmResponse(overrides: Partial<LlmResponse> = {}): LlmResponse {
	return {
		model: 'mock-model',
		message: {
			role: 'assistant',
			content: 'Mock response'
		},
		usage: {
			inputTokens: 100,
			outputTokens: 50,
			totalTokens: 150
		},
		finishReason: 'stop',
		...overrides
	};
}

// =============================================================================
// Error Assertion Helpers
// =============================================================================

/**
 * Asserts that an async function throws an error
 */
export async function assertThrowsAsync(
	fn: () => Promise<unknown>,
	expectedMessageOrError?: string | RegExp | Error
): Promise<Error> {
	try {
		await fn();
		throw new Error('Expected function to throw but it did not');
	} catch (error) {
		if (
			expectedMessageOrError &&
			typeof expectedMessageOrError === 'string' &&
			!error?.toString().includes(expectedMessageOrError)
		) {
			throw new Error(
				`Expected error message to include "${expectedMessageOrError}" but got: ${error}`
			);
		}

		if (
			expectedMessageOrError instanceof RegExp &&
			!expectedMessageOrError.test(error?.toString() || '')
		) {
			throw new Error(
				`Expected error message to match ${expectedMessageOrError} but got: ${error}`
			);
		}

		if (expectedMessageOrError instanceof Error) {
			// Just check that an error was thrown
		}

		return error as Error;
	}
}

// =============================================================================
// Object Comparison Helpers
// =============================================================================

/**
 * Asserts that an object has all the specified properties
 */
export function assertHasProperties(obj: Record<string, unknown>, properties: string[]): void {
	for (const prop of properties) {
		if (!(prop in obj)) {
			throw new Error(`Object missing expected property: ${prop}`);
		}
	}
}

/**
 * Asserts that two arrays contain the same items (order-independent)
 */
export function assertSameItems<T>(a: T[], b: T[]): void {
	if (a.length !== b.length) {
		throw new Error(`Array length mismatch: ${a.length} vs ${b.length}`);
	}

	const sortedA = [...a].sort();
	const sortedB = [...b].sort();

	for (let i = 0; i < sortedA.length; i++) {
		if (sortedA[i] !== sortedB[i]) {
			throw new Error(`Array mismatch at index ${i}: ${sortedA[i]} vs ${sortedB[i]}`);
		}
	}
}

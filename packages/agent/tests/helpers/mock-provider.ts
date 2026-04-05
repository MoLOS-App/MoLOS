/**
 * Mock Provider Helpers
 *
 * Utilities for creating mock LLM providers and responses for testing.
 *
 * @module test-helpers/mock-provider
 */

import type {
	LlmRequest,
	LlmResponse,
	AgentMessage,
	ToolCall,
	ToolResult,
	ProviderConfig
} from '../../src/types/index.js';

// =============================================================================
// Mock LLM Response Builder
// =============================================================================

/**
 * Builder for creating mock LLM responses
 */
export class MockLlmResponseBuilder {
	private response: Partial<LlmResponse> = {};

	constructor() {
		this.response = {
			model: 'gpt-4',
			finishReason: 'stop',
			usage: {
				inputTokens: 100,
				outputTokens: 50,
				totalTokens: 150
			}
		};
	}

	withModel(model: string): this {
		this.response.model = model;
		return this;
	}

	withMessage(message: Partial<AgentMessage>): this {
		this.response.message = {
			role: 'assistant',
			content: '',
			...message
		};
		return this;
	}

	withTextContent(text: string): this {
		if (!this.response.message) {
			this.response.message = { role: 'assistant', content: '' };
		}
		this.response.message.content = text;
		return this;
	}

	withToolCalls(toolCalls: ToolCall[]): this {
		if (!this.response.message) {
			this.response.message = { role: 'assistant', content: '' };
		}
		this.response.message.content = toolCalls.map((tc) => ({
			type: 'tool_call' as const,
			id: tc.id,
			name: tc.tool.name,
			input: tc.arguments
		}));
		return this;
	}

	withFinishReason(reason: LlmResponse['finishReason']): this {
		this.response.finishReason = reason;
		return this;
	}

	withUsage(usage: Partial<LlmResponse['usage']>): this {
		this.response.usage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			...this.response.usage,
			...usage
		};
		return this;
	}

	withThinking(thinking: string): this {
		this.response.thinking = thinking;
		return this;
	}

	build(): LlmResponse {
		return {
			model: this.response.model ?? 'gpt-4',
			message: this.response.message ?? { role: 'assistant', content: '' },
			finishReason: this.response.finishReason ?? 'stop',
			usage: this.response.usage ?? {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0
			},
			thinking: this.response.thinking
		};
	}
}

// =============================================================================
// Mock Tool Call Builder
// =============================================================================

/**
 * Builder for creating mock tool calls
 */
export class MockToolCallBuilder {
	private toolCall: ToolCall = {
		id: `tool_call_${Date.now()}`,
		tool: {
			name: 'test_tool',
			description: 'Test tool',
			parameters: { type: 'object', properties: {}, required: [] }
		},
		arguments: {}
	};

	withId(id: string): this {
		this.toolCall.id = id;
		return this;
	}

	withToolName(name: string): this {
		this.toolCall.tool.name = name;
		return this;
	}

	withArguments(args: Record<string, unknown>): this {
		this.toolCall.arguments = args;
		return this;
	}

	build(): ToolCall {
		return { ...this.toolCall };
	}
}

// =============================================================================
// Mock Tool Result Builder
// =============================================================================

/**
 * Builder for creating mock tool results
 */
export class MockToolResultBuilder {
	private result: ToolResult = {
		toolName: 'test_tool',
		arguments: {},
		success: true,
		output: '',
		executionMs: 10
	};

	withToolName(name: string): this {
		this.result.toolName = name;
		return this;
	}

	withArguments(args: Record<string, unknown>): this {
		this.result.arguments = args;
		return this;
	}

	withOutput(output: string): this {
		this.result.success = true;
		this.result.output = output;
		return this;
	}

	withError(error: string): this {
		this.result.success = false;
		this.result.error = error;
		return this;
	}

	withExecutionTime(ms: number): this {
		this.result.executionMs = ms;
		return this;
	}

	withMetadata(metadata: Record<string, unknown>): this {
		this.result.metadata = metadata;
		return this;
	}

	build(): ToolResult {
		return { ...this.result };
	}
}

// =============================================================================
// Mock Provider
// =============================================================================

/**
 * Mock LLM provider for testing
 */
export class MockLlmProvider {
	private config: ProviderConfig;
	private responses: LlmResponse[] = [];
	private responseIndex = 0;
	private callHistory: LlmRequest[] = [];

	constructor(config?: Partial<ProviderConfig>) {
		this.config = {
			provider: config?.provider ?? 'openai',
			apiKey: config?.apiKey ?? 'test-api-key',
			baseUrl: config?.baseUrl ?? 'https://api.test.com',
			timeout: config?.timeout ?? 30000,
			maxRetries: config?.maxRetries ?? 3
		};
	}

	/**
	 * Queue a response to be returned on the next chat() call
	 */
	addResponse(response: LlmResponse): this {
		this.responses.push(response);
		return this;
	}

	/**
	 * Set responses to be returned in sequence
	 */
	setResponses(responses: LlmResponse[]): this {
		this.responses = [...responses];
		this.responseIndex = 0;
		return this;
	}

	/**
	 * Mock chat implementation
	 */
	async chat(request: LlmRequest): Promise<LlmResponse> {
		this.callHistory.push(request);

		if (this.responses.length === 0) {
			// Default response
			return new MockLlmResponseBuilder()
				.withModel(this.config.provider)
				.withTextContent('Mock response')
				.build();
		}

		if (this.responseIndex >= this.responses.length) {
			this.responseIndex = 0;
		}

		return this.responses[this.responseIndex++];
	}

	/**
	 * Get all calls made to this provider
	 */
	getCallHistory(): LlmRequest[] {
		return [...this.callHistory];
	}

	/**
	 * Get the last call made
	 */
	getLastCall(): LlmRequest | undefined {
		return this.callHistory[this.callHistory.length - 1];
	}

	/**
	 * Clear call history
	 */
	clearHistory(): void {
		this.callHistory = [];
	}

	/**
	 * Get provider config
	 */
	getConfig(): ProviderConfig {
		return { ...this.config };
	}

	/**
	 * Dispose of the provider
	 */
	dispose(): void {
		this.responses = [];
		this.callHistory = [];
	}
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a mock LLM response
 */
export function createMockLlmResponse(overrides?: Partial<LlmResponse>): LlmResponse {
	return new MockLlmResponseBuilder().build();
}

/**
 * Creates a mock tool call
 */
export function createMockToolCall(overrides?: Partial<ToolCall>): ToolCall {
	return new MockToolCallBuilder().build();
}

/**
 * Creates a mock tool result
 */
export function createMockToolResult(overrides?: Partial<ToolResult>): ToolResult {
	return new MockToolResultBuilder().build();
}

/**
 * Creates a mock provider
 */
export function createMockProvider(config?: Partial<ProviderConfig>): MockLlmProvider {
	return new MockLlmProvider(config);
}

/**
 * Creates a simple mock response with text content
 */
export function mockTextResponse(text: string, model?: string): LlmResponse {
	return new MockLlmResponseBuilder()
		.withModel(model ?? 'gpt-4')
		.withTextContent(text)
		.build();
}

/**
 * Creates a mock response with tool calls
 */
export function mockToolCallResponse(toolCalls: ToolCall[], model?: string): LlmResponse {
	return new MockLlmResponseBuilder()
		.withModel(model ?? 'gpt-4')
		.withToolCalls(toolCalls)
		.withFinishReason('tool_calls')
		.build();
}

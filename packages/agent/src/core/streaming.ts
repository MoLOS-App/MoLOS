/**
 * Streaming Infrastructure
 *
 * Provides streaming middleware pipeline for processing LLM response streams.
 *
 * ## Stream Chunk Types
 * - `text-delta`: Incremental text output from the LLM
 * - `tool-call-start`: Marks beginning of a tool call with its name and ID
 * - `tool-call-delta`: Incremental arguments for a tool call
 * - `tool-call-end`: Marks completion of a tool call with optional result
 * - `finish`: Final message with reason and token usage
 * - `error`: Error during streaming
 *
 * ## Middleware Chain
 * Middlewares are applied in order (first added = first applied to stream):
 * - Sanitize malformed tool calls
 * - Trim tool call names
 * - Repair malformed JSON arguments
 *
 * ## AI Context Note
 * Stream chunks are processed sequentially; each chunk type triggers
 * different handling in the consumer. Tool calls are assembled from
 * start/delta/end chunks before execution.
 */

// =============================================================================
// Streaming Types
// =============================================================================

/**
 * Represents a chunk of data in the streaming pipeline.
 * Can be text deltas, tool call start/updates/end, or control messages.
 *
 * ## Stream Chunk Types
 * - `text-delta`: Incremental text output from the LLM
 * - `tool-call-start`: Marks beginning of a tool call with its name and ID
 * - `tool-call-delta`: Incremental arguments for a tool call
 * - `tool-call-end`: Marks completion of a tool call with optional result
 * - `finish`: Final message with reason and token usage
 * - `error`: Error during streaming
 *
 * ## AI Context Note
 * Stream chunks are processed sequentially; each chunk type triggers
 * different handling in the consumer. Tool calls are assembled from
 * start/delta/end chunks before execution.
 */
export type StreamChunk =
	| { type: 'text-delta'; delta: string }
	| { type: 'tool-call-start'; toolName: string; toolCallId: string }
	| { type: 'tool-call-delta'; toolCallId: string; delta: string }
	| { type: 'tool-call-end'; toolCallId: string; result?: string }
	| { type: 'finish'; reason: string; usage?: { inputTokens: number; outputTokens: number } }
	| { type: 'error'; error: string };

/**
 * Context passed to streaming middleware functions.
 * Provides access to agent state and configuration during streaming.
 */
export interface StreamContext {
	turnId: string;
	iteration: number;
	toolCallCount: number;
	metadata: Record<string, unknown>;
	abortSignal?: AbortSignal;
}

/**
 * A middleware function in the streaming pipeline.
 * Takes an async iterable of stream chunks and returns a transformed async iterable.
 */
export type StreamMiddleware = (
	stream: AsyncIterable<StreamChunk>,
	context: StreamContext
) => AsyncIterable<StreamChunk>;

/**
 * Streaming result containing the async iterable and metadata.
 */
export interface StreamResult {
	stream: AsyncIterable<StreamChunk>;
	context: StreamContext;
}

// =============================================================================
// Stream Chain - Middleware Composition
// =============================================================================

/**
 * Chain for composing streaming middleware.
 * Middlewares are applied in order (first added = first applied).
 *
 * ## Middleware Composition Pattern
 * Each middleware wraps the previous one, creating a nested processing pipeline:
 * ```
 * Initial Stream → Middleware1 → Middleware2 → Middleware3 → Final Output
 * ```
 *
 * ## Usage
 * ```typescript
 * const chain = new StreamChain();
 * chain.use(sanitizeMiddleware);
 * chain.use(trimMiddleware);
 * const processedStream = chain.execute(rawStream, context);
 * ```
 *
 * ## AI Context Note
 * The chain is immutable after creation. Adding middlewares after
 * execute() has no effect on already-executing streams.
 */
export class StreamChain {
	private middlewares: StreamMiddleware[] = [];

	use(middleware: StreamMiddleware): this {
		this.middlewares.push(middleware);
		return this;
	}

	execute(initial: AsyncIterable<StreamChunk>, context: StreamContext): AsyncIterable<StreamChunk> {
		let result: AsyncIterable<StreamChunk> = initial;
		for (const mw of this.middlewares) {
			result = mw(result, context);
		}
		return result;
	}

	get size(): number {
		return this.middlewares.length;
	}

	get isEmpty(): boolean {
		return this.middlewares.length === 0;
	}
}

// =============================================================================
// Built-in Streaming Middlewares
// =============================================================================

/**
 * Sanitizes malformed tool calls in the streaming pipeline.
 *
 * ## Sanitization Steps
 * 1. **Tool name sanitization**: Removes control chars (0x00-0x1F, 0x7F) and
 *    dangerous characters (<>"'&) from tool names
 * 2. **Buffer validation**: Ensures JSON strings in deltas have balanced quotes
 *    - If quote count is odd, cuts at last quote position
 * 3. **Text delta cleaning**: Removes null bytes and normalizes line endings
 *
 * ## Why This Matters for AI Context
 * LLM providers can occasionally output malformed tool calls, especially:
 * - Partial JSON in streaming mode
 * - Special characters in tool names
 * - Unbalanced strings from token-level generation
 *
 * This middleware prevents these issues from propagating to tool execution.
 */
function wrapStreamFnSanitizeMalformedToolCalls(
	stream: AsyncIterable<StreamChunk>,
	context: StreamContext
): AsyncIterable<StreamChunk> {
	return {
		async *[Symbol.asyncIterator]() {
			let buffer = '';
			let inToolCall = false;

			for await (const chunk of stream) {
				if (context.abortSignal?.aborted) {
					break;
				}

				if (chunk.type === 'tool-call-start') {
					inToolCall = true;
					const sanitizedName = sanitizeToolName(chunk.toolName);
					if (sanitizedName !== chunk.toolName) {
						yield {
							type: 'tool-call-start',
							toolName: sanitizedName,
							toolCallId: chunk.toolCallId
						};
					} else {
						yield chunk;
					}
				} else if (chunk.type === 'tool-call-delta' && inToolCall) {
					buffer += chunk.delta;
					const sanitized = sanitizeBuffer(buffer);
					if (sanitized !== buffer) {
						const diff = sanitized.slice(buffer.length - chunk.delta.length);
						if (diff) {
							yield { type: 'tool-call-delta', toolCallId: chunk.toolCallId, delta: diff };
						}
						buffer = sanitized;
					} else {
						yield chunk;
					}
				} else if (chunk.type === 'tool-call-end') {
					inToolCall = false;
					buffer = '';
					yield chunk;
				} else if (chunk.type === 'text-delta') {
					const sanitizedDelta = sanitizeTextDelta(chunk.delta);
					if (sanitizedDelta) {
						yield { type: 'text-delta', delta: sanitizedDelta };
					}
				} else {
					yield chunk;
				}
			}
		}
	};
}

function wrapStreamFnTrimToolCallNames(
	stream: AsyncIterable<StreamChunk>,
	_context: StreamContext
): AsyncIterable<StreamChunk> {
	return {
		async *[Symbol.asyncIterator]() {
			for await (const chunk of stream) {
				if (chunk.type === 'tool-call-start') {
					const trimmedName = chunk.toolName.trim();
					if (trimmedName !== chunk.toolName) {
						yield {
							type: 'tool-call-start',
							toolName: trimmedName,
							toolCallId: chunk.toolCallId
						};
					} else {
						yield chunk;
					}
				} else {
					yield chunk;
				}
			}
		}
	};
}

function wrapStreamFnRepairMalformedToolCallArguments(
	stream: AsyncIterable<StreamChunk>,
	_context: StreamContext
): AsyncIterable<StreamChunk> {
	return {
		async *[Symbol.asyncIterator]() {
			let buffer = '';

			for await (const chunk of stream) {
				if (chunk.type === 'tool-call-start') {
					buffer = '';
					yield chunk;
				} else if (chunk.type === 'tool-call-delta') {
					buffer += chunk.delta;
					yield chunk;
				} else if (chunk.type === 'tool-call-end') {
					if (buffer.length > 0) {
						repairMalformedJson(buffer);
					}
					buffer = '';
					yield chunk;
				} else {
					yield chunk;
				}
			}
		}
	};
}

// =============================================================================
// Helper Functions
// =============================================================================

function sanitizeToolName(name: string): string {
	return name
		.replace(/[\x00-\x1F\x7F]/g, '')
		.replace(/[<>"'&]/g, '')
		.trim();
}

function sanitizeTextDelta(delta: string): string {
	if (!delta) return delta;
	return delta.replace(/\x00/g, '').replace(/\r\n/g, '\n');
}

function sanitizeBuffer(buffer: string): string {
	if (!buffer) return buffer;

	const stringCount = (buffer.match(/(?:[^"\\]|\\.)*"/g) || []).length;
	const unclosedString = stringCount % 2 !== 0;

	if (unclosedString) {
		const lastQuoteIndex = buffer.lastIndexOf('"');
		if (lastQuoteIndex > 0) {
			return buffer.slice(0, lastQuoteIndex + 1);
		}
	}

	return buffer;
}

function repairMalformedJson(jsonStr: string): string {
	if (!jsonStr || jsonStr.trim().length === 0) return jsonStr;

	try {
		JSON.parse(jsonStr);
		return jsonStr;
	} catch {
		let repaired = jsonStr;
		repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
		try {
			JSON.parse(repaired);
			return repaired;
		} catch {
			return jsonStr;
		}
	}
}

// =============================================================================
// Export Middlewares
// =============================================================================

/**
 * Built-in streaming middlewares for external use.
 */
export const streamingMiddlewares = {
	sanitizeMalformedToolCalls: wrapStreamFnSanitizeMalformedToolCalls,
	trimToolCallNames: wrapStreamFnTrimToolCallNames,
	repairMalformedToolCallArguments: wrapStreamFnRepairMalformedToolCallArguments
};

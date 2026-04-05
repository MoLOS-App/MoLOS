/**
 * Token Estimator - Accurate Context Window Budget Calculation
 *
 * ## Purpose
 * Estimates token usage for messages, tools, and media to enable
 * proactive context budget management before LLM API calls.
 *
 * ## Why Token Estimation Matters
 *
 * **Prevents 400 Errors**:
 * - LLM APIs return "context window exceeded" on too-large input
 * - These errors are expensive (wasted tokens, latency)
 * - Estimation allows proactive trimming instead of reactive errors
 *
 * **Context Budget Management**:
 * - Different models have different context windows (4K, 32K, 128K, etc.)
 * - Must account for ALL inputs: messages + tools + media + response
 * - Estimation enables intelligent compression decisions
 *
 * **Hidden Token Costs**:
 * - Tool definitions can be 500+ tokens each (often overlooked!)
 * - Media items (images, files) have fixed per-item cost
 * - Message overhead (roles, structure) adds up
 *
 * ## Key Concepts
 *
 * **chars/2.5 Heuristic**:
 * ```
 * tokens ≈ characters / 2.5
 * ```
 * - Based on OpenAI's GPT tokenization (not exact, but close)
 * - English text averages ~4 characters per token
 * - Code/special chars can be ~2 characters per token
 * - 2.5 provides conservative (slightly over-estimate) buffer
 *
 * **Per-Message Overhead (12 chars)**:
 * - Role marker ("user:", "assistant:", "system:")
 * - Content structure (newlines, separators)
 * - Accounts for ~3-5 tokens per message
 *
 * **Media Estimation (256 tokens/item)**:
 * - Fixed per-item cost regardless of size
 * - Covers: images, audio, video, file attachments
 * - Actual cost varies by model (this is conservative)
 *
 * **Tool Definition Overhead (20 chars)**:
 * - Per-tool overhead for JSON structure
 * - Parameter names, types, descriptions
 * - Tool calls themselves (in conversation)
 *
 * ## Context Optimization Tips
 *
 * **Proactive Checking**:
 * ```typescript
 * if (isOverContextBudget(contextWindow, messages, tools, maxTokens)) {
 *   // Compress oldest messages BEFORE API call
 *   messages = compressMessages(messages, targetCount);
 * }
 * ```
 *
 * **Tool Definition Cost**:
 * - 10 tool definitions ≈ 1,500-2,000 tokens
 * - Only include tools that might be used
 * - Consider batching tools vs. many individual tools
 *
 * **Media Items are Expensive**:
 * - Each image: ~256 tokens (fixed)
 * - 5 images in message: ~1,280 tokens
 * - Same as ~5,000 characters of text!
 *
 * **Compression Strategy**:
 * - Use turn-boundaries to find safe compression points
 * - Preserve recent messages (higher value)
 * - Remove oldest messages first
 *
 * ## Estimation Accuracy
 *
 * **Limitations**:
 * - chars/2.5 is approximate (varies by content type)
 * - Doesn't account for tokenization edge cases
 * - Media estimate is conservative
 *
 * **Improving Accuracy**:
 * - For critical cases, use model-specific tokenizers
 * - Add 10-15% buffer to estimates
 * - Monitor actual vs. estimated for calibration
 *
 * ## Usage Pattern
 *
 * ```typescript
 * import { tokenEstimator, isOverContextBudget } from './token-estimator';
 *
 * // Check before API call
 * const wouldExceed = isOverContextBudget(
 *   128000,           // context window
 *   messages,         // conversation history
 *   toolDefs,         // available tools
 *   2000              // max response tokens
 * );
 *
 * // Estimate individual components
 * const msgTokens = tokenEstimator.estimateMessageTokens(message);
 * const toolTokens = tokenEstimator.estimateToolDefsTokens(tools);
 * const mediaTokens = tokenEstimator.estimateMediaTokens(3); // 3 images
 * ```
 */

import type { AgentMessage, ToolDefinition } from '../types/index.js';
import { TOKEN } from '../constants.js';

/**
 * Token estimation constants now imported from '../constants.js':
 * - TOKEN.CHARS_PER_TOKEN: ~2.5 chars per token
 * - TOKEN.MESSAGE_OVERHEAD_CHARS: 12 chars per message
 * - TOKEN.MEDIA_TOKENS_PER_ITEM: 256 tokens per media item
 * - TOKEN.TOOL_DEFS_OVERHEAD_CHARS: 20 chars per tool

/**
 * Interface for token estimation operations
 */
export interface TokenEstimator {
	/**
	 * Estimate tokens for a single message
	 *
	 * Handles different content types:
	 * - string: Plain text content
	 * - array: Content blocks (text, tool_call, tool_result)
	 *
	 * @param msg - Agent message to estimate
	 * @returns Estimated token count (rounded up)
	 */
	estimateMessageTokens(msg: AgentMessage): number;

	/**
	 * Estimate tokens for tool definitions
	 *
	 * Counts: name + description + parameters JSON + overhead
	 *
	 * @param defs - Array of tool definitions
	 * @returns Estimated token count (rounded up)
	 */
	estimateToolDefsTokens(defs: ToolDefinition[]): number;

	/**
	 * Estimate tokens for media items
	 *
	 * Fixed per-item cost regardless of media size
	 *
	 * @param mediaCount - Number of media items
	 * @returns Estimated token count
	 */
	estimateMediaTokens(mediaCount: number): number;

	/**
	 * Check if a set of inputs would exceed the context budget
	 *
	 * Convenience method that sums all token costs
	 *
	 * @param contextWindow - Model's context window size
	 * @param messages - Conversation history
	 * @param toolDefs - Available tool definitions
	 * @param maxTokens - Max tokens expected for response
	 * @returns True if total exceeds context window
	 */
	isOverContextBudget(
		contextWindow: number,
		messages: AgentMessage[],
		toolDefs: ToolDefinition[],
		maxTokens: number
	): boolean;
}

/**
 * Default token estimator implementation
 *
 * Uses character-based estimation with overhead adjustments
 */
export const tokenEstimator: TokenEstimator = {
	/**
	 * Estimate tokens for a single message
	 *
	 * ## Content Type Handling
	 *
	 * **string content**:
	 * - Direct length calculation
	 * - Simplest case
	 *
	 * **array content blocks**:
	 * - text blocks: Use text.length
	 * - tool_call blocks: id + name + JSON(input)
	 * - tool_result blocks: toolCallId + content
	 *
	 * ## Formula
	 * ```
	 * tokens = ceil((contentLength + MESSAGE_OVERHEAD) / CHARS_PER_TOKEN)
	 * ```
	 */
	estimateMessageTokens(msg: AgentMessage): number {
		let contentLength = 0;

		if (typeof msg.content === 'string') {
			// Plain text content - direct length
			contentLength = msg.content.length;
		} else if (Array.isArray(msg.content)) {
			// Array of content blocks (multi-modal, tool calls)
			for (const block of msg.content) {
				if (typeof block === 'string') {
					contentLength += block.length;
				} else if (block.type === 'text') {
					contentLength += block.text.length;
				} else if (block.type === 'tool_call' || block.type === 'tool-call') {
					// Tool call: id + name + JSON.stringify(input)
					// These are expensive (JSON strings add up)
					// Support both 'tool_call' (legacy) and 'tool-call' (AI SDK) formats
					const id = (block as any).id || (block as any).toolCallId || '';
					const name = (block as any).name || (block as any).toolName || '';
					const input = (block as any).input || {};
					contentLength += id.length;
					contentLength += name.length;
					contentLength += JSON.stringify(input).length;
				} else if (block.type === 'tool_result') {
					// Tool result: toolCallId + content
					contentLength += block.toolCallId.length;
					contentLength += block.content.length;
				}
			}
		}

		// Add per-message overhead and divide by chars per token
		return Math.ceil((contentLength + TOKEN.MESSAGE_OVERHEAD_CHARS) / TOKEN.CHARS_PER_TOKEN);
	},

	/**
	 * Estimate tokens for tool definitions
	 *
	 * ## What's Counted
	 * - Tool name length
	 * - Tool description length
	 * - JSON.stringify(parameters) length
	 * - Per-tool overhead (20 chars)
	 *
	 * ## Why Tool Definitions Are Expensive
	 * - Each tool can be 200-500+ tokens
	 * - 10 tools ≈ 2,000-5,000 tokens
	 * - Often overlooked in context budgeting
	 *
	 * ## Formula
	 * ```
	 * totalChars = sum(tool.name + tool.description + JSON(tool.parameters))
	 * tokens = ceil((totalChars + defs.length * OVERHEAD) / CHARS_PER_TOKEN)
	 * ```
	 */
	estimateToolDefsTokens(defs: ToolDefinition[]): number {
		if (defs.length === 0) {
			return 0;
		}

		let totalChars = 0;

		for (const def of defs) {
			// Sum: name + description + JSON.stringify(parameters)
			totalChars += def.name.length;
			totalChars += def.description.length;
			totalChars += JSON.stringify(def.parameters).length;
			// Add per-tool overhead for JSON structure
			totalChars += TOKEN.TOOL_DEFS_OVERHEAD_CHARS;
		}

		return Math.ceil(totalChars / TOKEN.CHARS_PER_TOKEN);
	},

	/**
	 * Estimate tokens for media items
	 *
	 * ## Fixed Per-Item Cost
	 * - 256 tokens per media item (conservative)
	 * - Size doesn't matter (model-dependent)
	 * - Covers: images, audio, video, file attachments
	 *
	 * ## Why Fixed Cost?
	 * - Vision models process images into tokens
	 * - Token count depends on dimensions, not file size
	 * - 256 is conservative for most models
	 */
	estimateMediaTokens(mediaCount: number): number {
		return mediaCount * TOKEN.MEDIA_TOKENS_PER_ITEM;
	},

	/**
	 * Check if inputs would exceed context budget
	 *
	 * ## Total Token Budget Breakdown
	 * ```
	 * total = messageTokens + toolDefsTokens + maxResponseTokens
	 * ```
	 *
	 * ## Example Budget (128K context)
	 * - Messages: ~100,000 tokens
	 * - Tools: ~10,000 tokens
	 * - Response: ~18,000 tokens
	 * - Buffer: Keep under 128,000
	 *
	 * @param contextWindow - Model's context window (e.g., 128000)
	 * @param messages - Conversation history
	 * @param toolDefs - Tool definitions
	 * @param maxTokens - Expected response tokens
	 * @returns True if would exceed budget
	 */
	isOverContextBudget(
		contextWindow: number,
		messages: AgentMessage[],
		toolDefs: ToolDefinition[],
		maxTokens: number
	): boolean {
		// Sum all token estimates
		const messageTokens = messages.reduce((sum, msg) => sum + this.estimateMessageTokens(msg), 0);
		const toolDefsTokens = this.estimateToolDefsTokens(toolDefs);

		const total = messageTokens + toolDefsTokens + maxTokens;

		return total > contextWindow;
	}
};

/**
 * Standalone utility functions for token estimation
 *
 * These are convenience wrappers around tokenEstimator methods
 * for simpler import patterns.
 */
export const estimateMessageTokens = (msg: AgentMessage): number =>
	tokenEstimator.estimateMessageTokens(msg);

export const estimateToolDefsTokens = (defs: ToolDefinition[]): number =>
	tokenEstimator.estimateToolDefsTokens(defs);

export const estimateMediaTokens = (mediaCount: number): number =>
	tokenEstimator.estimateMediaTokens(mediaCount);

/**
 * Check if inputs would exceed context budget
 *
 * Convenience wrapper for quick budget checks
 *
 * @param contextWindow - Model's context window size
 * @param messages - Conversation history
 * @param toolDefs - Available tool definitions
 * @param maxTokens - Max tokens expected for response
 * @returns True if total exceeds context window
 */
export const isOverContextBudget = (
	contextWindow: number,
	messages: AgentMessage[],
	toolDefs: ToolDefinition[],
	maxTokens: number
): boolean => tokenEstimator.isOverContextBudget(contextWindow, messages, toolDefs, maxTokens);

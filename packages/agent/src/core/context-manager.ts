/**
 * Context Manager - Context overflow handling and compaction logic
 *
 * This module contains all context management functionality extracted from the
 * agent loop to improve code organization and reusability.
 *
 * ## Key Responsibilities
 *
 * ### 1. Tool Result Truncation
 * - `calculateMaxToolResultChars`: Computes max chars based on context window
 * - `getToolResultTextLength`: Extracts text length from tool result message
 * - `hasImportantTail`: Detects errors/results in tail of text
 * - `truncateToolResultText`: Head+tail truncation with suffix
 * - `truncateToolResultsIfNeeded`: Maps over messages, truncates oversized results
 * - `toolResultsLikelyOversized`: Heuristic check if tool results caused overflow
 *
 * ### 2. Context Estimation
 * - `estimateContextWindow`: Estimates context window from config or usage
 *
 * ### 3. Context Compaction
 * - `shouldCompact`: Checks if compaction should be attempted
 * - `compactContext`: Summarizes middle messages, keeps system + recent
 * - `createCompactionSummary`: Creates summary text from messages
 * - `forceCompression`: Uses turn boundaries to split messages
 *
 * ## Context Overflow Handling Strategy
 *
 * When context limit is reached, the system tries these strategies in order:
 * 1. **Compact** (up to 3 attempts): Summarizes older messages into a single summary
 * 2. **Truncate**: Last resort - shortens individual tool results
 *
 * ## Tool Result Truncation (head+tail strategy)
 *
 * - Preserves beginning and end of tool results
 * - Prioritizes keeping errors, exceptions, final results
 * - Uses clean newline cut points when possible
 * - Truncation suffix: `[Content truncated — original was too large for context window]`
 *
 * ## Compaction Strategy (Preserves Critical Context)
 *
 * ```
 * Before: [system, msg1, msg2, ..., msgN-10, msgN-9, ..., msgN]
 * After:  [system, [compaction summary], msgN-9, ..., msgN]
 * ```
 *
 * - **Always keeps**: First message (system prompt with identity/bootstrap)
 * - **Always keeps**: Last 10 messages (recent conversation context)
 * - **Summarizes**: Everything in between into one `[context_compaction]` message
 */

import type { AgentMessage } from '../types/index.js';
import { TOOL_RESULT, COMPACTION, AGENT } from '../constants.js';
import { findMiddleBoundary } from './turn-boundaries.js';

// ============================================================================
// Tool Result Truncation
// ============================================================================

/**
 * Calculate max characters allowed for a single tool result based on context window.
 * Inspired by Inspo's tool result truncation logic.
 *
 * @param contextWindowTokens - Estimated context window size in tokens
 * @returns Maximum characters allowed for a single tool result
 */
export function calculateMaxToolResultChars(contextWindowTokens: number): number {
	const maxTokens = Math.floor(contextWindowTokens * TOOL_RESULT.MAX_CONTEXT_SHARE);
	// Rough conversion: ~4 chars per token on average
	const maxChars = maxTokens * 4;
	return Math.min(maxChars, TOOL_RESULT.HARD_MAX_CHARS);
}

/**
 * Get the total character count of text content in a tool result message.
 *
 * @param msg - Agent message with role 'tool'
 * @returns Total text length of the tool result
 */
export function getToolResultTextLength(msg: AgentMessage): number {
	if (msg.role !== 'tool') {
		return 0;
	}
	if (typeof msg.content === 'string') {
		return msg.content.length;
	}
	if (Array.isArray(msg.content)) {
		let total = 0;
		for (const block of msg.content) {
			if (block && typeof block === 'object' && block.type === 'text') {
				total += (block as { text?: string }).text?.length ?? 0;
			}
		}
		return total;
	}
	return 0;
}

/**
 * Detect if text contains important content near the end (errors, results).
 * These should be preserved during truncation.
 *
 * @param text - Text to check for important tail content
 * @returns True if text has important tail content
 */
export function hasImportantTail(text: string): boolean {
	const tail = text.slice(-COMPACTION.TAIL_SLICE_CHARS).toLowerCase();
	return (
		/\b(error|exception|failed|fatal|traceback|panic|stack trace|errno|exit code)\b/.test(tail) ||
		/\}\s*$/.test(tail.trim()) ||
		/\b(total|summary|result|complete|finished|done)\b/.test(tail)
	);
}

/**
 * Truncate tool result text to fit within maxChars.
 * Uses head+tail strategy when tail contains important content.
 *
 * @param text - Text to truncate
 * @param maxChars - Maximum characters allowed
 * @returns Truncated text with suffix if truncated, otherwise original
 */
export function truncateToolResultText(text: string, maxChars: number): string {
	const suffix = '\n\n[Content truncated — original was too large for context window]';
	if (text.length <= maxChars) {
		return text;
	}

	const budget = Math.max(TOOL_RESULT.MIN_KEEP_CHARS, maxChars - suffix.length);

	// If tail looks important, split budget between head and tail
	if (hasImportantTail(text) && budget > TOOL_RESULT.MIN_KEEP_CHARS * 2) {
		const tailBudget = Math.min(
			Math.floor(budget * COMPACTION.TAIL_BUDGET_RATIO),
			COMPACTION.TAIL_MAX_CHARS
		);
		const headBudget = budget - tailBudget - 50; // Middle marker length

		if (headBudget > TOOL_RESULT.MIN_KEEP_CHARS) {
			// Find clean cut points at newline boundaries
			let headCut = headBudget;
			const headNewline = text.lastIndexOf('\n', headBudget);
			if (headNewline > headBudget * 0.8) {
				headCut = headNewline;
			}

			let tailStart = text.length - tailBudget;
			const tailNewline = text.indexOf('\n', tailStart);
			if (tailNewline !== -1 && tailNewline < tailStart + tailBudget * 0.2) {
				tailStart = tailNewline + 1;
			}

			return (
				text.slice(0, headCut) +
				'\n\n[... middle content omitted ...]\n\n' +
				text.slice(tailStart) +
				suffix
			);
		}
	}

	// Default: keep the beginning with clean newline cut
	let cutPoint = budget;
	const lastNewline = text.lastIndexOf('\n', budget);
	if (lastNewline > budget * 0.8) {
		cutPoint = lastNewline;
	}
	return text.slice(0, cutPoint) + suffix;
}

/**
 * Truncate tool results in messages if they exceed size limits.
 *
 * ## When This Is Called
 * This is a **fallback strategy** when:
 * 1. Context overflow occurred
 * 2. Compaction was already attempted (3 times)
 * 3. Tool results are suspected to be the cause
 *
 * ## Size Limits
 * - **Max tool result share**: 30% of context window (MAX_TOOL_RESULT_CONTEXT_SHARE)
 * - **Hard max chars**: 400,000 (for large context windows)
 * - **Min keep chars**: 2,000 (must always keep at least this much)
 * - **Tail budget**: 30% of keep budget, max 4,000 chars
 *
 * ## Truncation Strategy (head+tail preservation)
 * ```
 * Original: [HEAD content... important tail with errors/results]
 * Truncated: [HEAD...]\n\n[... middle content omitted ...]\n\n[important tail]
 * ```
 *
 * ## What "Important Tail" Looks For
 * - Error indicators: error, exception, failed, fatal, traceback, panic
 * - JSON end markers: `}\s*$` (complete JSON objects)
 * - Result indicators: total, summary, result, complete, finished, done
 *
 * ## AI Context Optimization
 * - Only truncates `role: 'tool'` messages
 * - Uses clean newline cut points when possible
 * - Always preserves the suffix: `[Content truncated — original was too large for context window]`
 *
 * @param messages - Messages to process
 * @param contextWindowTokens - Estimated context window size in tokens
 * @returns Object with truncated messages and count of truncated tool results
 */
export function truncateToolResultsIfNeeded(
	messages: AgentMessage[],
	contextWindowTokens: number
): { messages: AgentMessage[]; truncatedCount: number } {
	const maxChars = calculateMaxToolResultChars(contextWindowTokens);
	let truncatedCount = 0;

	const result = messages.map((msg) => {
		if (msg.role !== 'tool') {
			return msg;
		}

		const textLength = getToolResultTextLength(msg);
		if (textLength <= maxChars) {
			return msg;
		}

		truncatedCount++;
		const truncatedContent = truncateToolResultText(
			typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
			maxChars
		);

		// Return new message with truncated content
		return {
			...msg,
			content: truncatedContent
		} as AgentMessage;
	});

	return { messages: result, truncatedCount };
}

/**
 * Check if tool results likely caused a context overflow.
 * Used as a heuristic to decide whether to attempt truncation before giving up.
 *
 * @param messages - Messages to check
 * @param contextWindowTokens - Estimated context window size in tokens
 * @returns True if tool results are likely the cause of overflow
 */
export function toolResultsLikelyOversized(
	messages: AgentMessage[],
	contextWindowTokens: number
): boolean {
	const maxChars = calculateMaxToolResultChars(contextWindowTokens);

	for (const msg of messages) {
		if (msg.role !== 'tool') {
			continue;
		}
		if (getToolResultTextLength(msg) > maxChars) {
			return true;
		}
	}

	return false;
}

// ============================================================================
// Context Estimation
// ============================================================================

/**
 * Estimate the context window size based on accumulated usage or config.
 * Used for tool result truncation decisions.
 *
 * @param config - Agent loop configuration containing maxTokens
 * @param accumulatedUsage - Total tokens used so far
 * @returns Estimated context window size in tokens
 */
export function estimateContextWindow(
	config: { maxTokens?: number },
	accumulatedUsage: { totalTokens: number }
): number {
	// Use config's maxTokens as a hint if available
	const configuredMax = config.maxTokens;
	if (configuredMax && configuredMax > 0) {
		// Assume context window is typically 4-10x the max output tokens
		return configuredMax * AGENT.CONTEXT_WINDOW_MULTIPLIER;
	}

	// Use accumulated usage to estimate
	const totalTokens = accumulatedUsage.totalTokens;
	if (totalTokens > 0) {
		// Add 50% headroom to estimate actual context window
		return Math.floor(totalTokens * 1.5);
	}

	// Default context window estimate (128K tokens)
	return AGENT.DEFAULT_CONTEXT_WINDOW;
}

// ============================================================================
// Context Compaction
// ============================================================================

/**
 * Check if context overflow compaction should be attempted.
 *
 * @param error - The error that was thrown
 * @param overflowCompactionAttempts - Current number of compaction attempts
 * @returns True if compaction should be attempted
 */
export function shouldCompact(
	error: { type?: string },
	overflowCompactionAttempts: number
): boolean {
	return (
		error.type === 'context_overflow' &&
		overflowCompactionAttempts < AGENT.MAX_OVERFLOW_COMPACTION_ATTEMPTS
	);
}

/**
 * Compact context by summarizing older messages into a single summary message.
 *
 * ## Compaction Strategy (Preserves Critical Context)
 * ```
 * Before: [system, msg1, msg2, ..., msgN-10, msgN-9, ..., msgN]
 * After:  [system, [compaction summary], msgN-9, ..., msgN]
 * ```
 *
 * - **Always keeps**: First message (system prompt with identity/bootstrap)
 * - **Always keeps**: Last 10 messages (recent conversation context)
 * - **Summarizes**: Everything in between into one `[context_compaction]` message
 *
 * ## Summary Content Format
 * ```
 * [Context Compaction] Summarized N previous messages:
 * [Tool: tool_name] truncated_result...
 * [Assistant] truncated_content...
 * [User] truncated_content...
 * ```
 *
 * ## AI Context Optimization
 * - Tool results are truncated to 200 chars (preserves tool name + sample)
 * - Text content is truncated to 300 chars
 * - Groups consecutive same-role messages together
 * - This reduces token count while preserving the "shape" of conversation
 *
 * @param messages - Full message history
 * @returns Compacted message array with summary
 */
export async function compactContext(messages: AgentMessage[]): Promise<AgentMessage[]> {
	const keepRecentCount = COMPACTION.KEEP_RECENT_MESSAGES;

	// Not enough messages to compact
	if (messages.length <= keepRecentCount + 1) {
		return messages;
	}

	// Keep first message (system) and last N messages
	const systemMessage = messages[0]!;
	const recentMessages = messages.slice(-keepRecentCount);
	const middleMessages = messages.slice(1, -keepRecentCount);

	// Create a summary of the middle messages
	const summaryContent = createCompactionSummary(middleMessages);

	// Build compacted message list
	const compacted: AgentMessage[] = [systemMessage];

	// Add summary message
	compacted.push({
		role: 'system',
		content: summaryContent,
		name: 'context_compaction'
	});

	// Add recent messages
	compacted.push(...recentMessages);

	return compacted;
}

/**
 * Create a summary message for compacted context.
 *
 * @param messages - Messages to summarize
 * @returns Formatted summary string
 */
export function createCompactionSummary(messages: AgentMessage[]): string {
	if (messages.length === 0) {
		return '[Previous context summarized - no messages to summarize]';
	}

	const summaries: string[] = [];
	let currentRole = '';
	let currentContent: string[] = [];

	for (const msg of messages) {
		// Handle tool messages by including their result summary
		if (msg.role === 'tool') {
			const toolName = msg.name ?? 'unknown_tool';
			const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
			// Truncate long tool results
			const truncated =
				content.length > COMPACTION.TOOL_RESULT_TRUNCATE_CHARS
					? content.slice(0, COMPACTION.TOOL_RESULT_TRUNCATE_CHARS) + '...'
					: content;
			summaries.push(`[Tool: ${toolName}] ${truncated}`);
			continue;
		}

		// Group consecutive messages by role
		if (msg.role !== currentRole) {
			if (currentContent.length > 0) {
				const roleLabel =
					currentRole === 'assistant' ? 'Assistant' : currentRole === 'user' ? 'User' : currentRole;
				const combined = currentContent.join('\n');
				// Truncate if too long
				const truncated =
					combined.length > COMPACTION.TEXT_TRUNCATE_CHARS
						? combined.slice(0, COMPACTION.TEXT_TRUNCATE_CHARS) + '...'
						: combined;
				summaries.push(`[${roleLabel}] ${truncated}`);
			}
			currentRole = msg.role;
			currentContent = [];
		}

		const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
		currentContent.push(content);
	}

	// Don't forget the last group
	if (currentContent.length > 0) {
		const roleLabel =
			currentRole === 'assistant' ? 'Assistant' : currentRole === 'user' ? 'User' : currentRole;
		const combined = currentContent.join('\n');
		const truncated =
			combined.length > COMPACTION.TEXT_TRUNCATE_CHARS
				? combined.slice(0, COMPACTION.TEXT_TRUNCATE_CHARS) + '...'
				: combined;
		summaries.push(`[${roleLabel}] ${truncated}`);
	}

	const messageCount = messages.length;
	return (
		`[Context Compaction] Summarized ${messageCount} previous message${messageCount !== 1 ? 's' : ''}:\n` +
		summaries.join('\n')
	);
}

/**
 * Force compression of messages at turn boundaries.
 * Uses findMiddleBoundary to safely split at user message positions,
 * preserving complete tool call sequences.
 *
 * @param messages - Messages to compress
 * @returns Object with compressed messages, dropped count, and success flag
 */
export async function forceCompression(
	messages: AgentMessage[]
): Promise<{ messages: AgentMessage[]; droppedCount: number; success: boolean }> {
	if (messages.length <= 2) {
		return { messages, droppedCount: 0, success: false };
	}

	// Find middle turn boundary
	const mid = findMiddleBoundary(messages);

	if (mid <= 0) {
		// Single turn with massive content - keep only most recent user message
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i]!.role === 'user') {
				const keptHistory = [messages[i]!];
				return {
					messages: keptHistory,
					droppedCount: messages.length - 1,
					success: true
				};
			}
		}
		return { messages, droppedCount: 0, success: false };
	}

	const keptHistory = messages.slice(mid);
	return {
		messages: keptHistory,
		droppedCount: messages.length - keptHistory.length,
		success: true
	};
}

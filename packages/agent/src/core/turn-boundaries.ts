/**
 * Turn Boundaries - Safe Compression Boundary Detection
 *
 * ## Purpose
 * Identifies safe boundaries in message history where compression can occur
 * without splitting mid-turn tool-call sequences. This ensures coherent
 * conversation compression that preserves tool execution integrity.
 *
 * ## Why Turn Boundaries Matter
 *
 * **Don't Split Tool-Call Sequences**:
 * A "turn" in agent conversation consists of:
 * ```
 * user message → assistant planning → tool calls → tool results → assistant response
 * ```
 * If you compress in the middle of this sequence, you get:
 * ```
 * user message → assistant planning → [COMPRESSED]
 * ```
 * The assistant loses context of what tools it was executing!
 *
 * **User Messages are Safe Boundaries**:
 * - User messages start new turns
 * - Assistant has finished previous tool execution
 * - Safe to cut history here
 *
 * **Turn Boundary Example**:
 * ```
 * [0] user: "Do the thing"
 * [1] assistant: "I'll do it"
 * [2] tool: search("thing")
 * [3] tool_result: "result"
 * [4] assistant: "Done!"
 * [5] user: "Now do another"
 * ```
 * Safe boundaries: [0, 5] (user message positions)
 * If compressing to ~50%: cut at boundary [5], keep [5] onwards
 *
 * ## Key Concepts
 *
 * **Backward Preference Algorithm**:
 * When finding boundary near target index:
 * 1. Prefer boundary BEFORE target (more recent context preserved)
 * 2. If no boundary before, use first boundary after
 * 3. Fallback to index 0 if no boundaries found
 *
 * **Middle Boundary for Compression**:
 * - FindMiddleBoundary returns ~50th percentile
 * - Drops oldest ~50% of turns
 * - Preserves recent turns for better context
 *
 * **Zero-indexed Boundaries**:
 * - Boundaries are indices into message array
 * - Index 0 is always a safe boundary (start of conversation)
 * - Index messages.length is always safe (end marker)
 *
 * ## Context Optimization
 *
 * **Compression Strategy**:
 * ```typescript
 * // Find safe point to cut history
 * const boundary = findMiddleBoundary(messages);
 * const compressedMessages = messages.slice(boundary);
 * ```
 *
 * **Don't Cut Tool Sequences**:
 * ```typescript
 * // WRONG: Could split tool execution
 * const idx = Math.floor(messages.length / 2);
 *
 * // CORRECT: Find turn boundary
 * const idx = findSafeBoundary(messages, Math.floor(messages.length / 2));
 * ```
 *
 * **Repeated Compression**:
 * - Multiple compressions are safe (stateless)
 * - Each compression drops oldest ~50% of turns
 * - Eventually may lose important early context
 *
 * ## Safety Guarantees
 *
 * **Always Returns Valid Index**:
 * - Empty array → returns 0
 * - No user messages → returns 0
 * - Any array → returns index in [0, messages.length]
 *
 * **No Message Modification**:
 * - All functions are pure (read-only)
 * - Safe to call multiple times
 * - No side effects
 *
 * ## Algorithm Details
 *
 * **parseTurnBoundaries**:
 * ```
 * 1. Initialize empty boundaries array
 * 2. For each message at index i:
 *    - If message.role === 'user', push i to boundaries
 * 3. Return boundaries
 * ```
 *
 * **findSafeBoundary (backward preference)**:
 * ```
 * 1. Parse all boundaries
 * 2. For boundaries from end to start:
 *    - If boundary <= targetIndex, return it
 * 3. For boundaries from start to end:
 *    - If boundary > targetIndex, return it
 * 4. Return 0 (fallback)
 * ```
 *
 * **findMiddleBoundary**:
 * ```
 * 1. Parse all boundaries
 * 2. If >= 2 boundaries:
 *    - Return boundary at floor(length/2)
 * 3. Otherwise:
 *    - Return findSafeBoundary(messages, floor(length/2))
 * ```
 */

import type { AgentMessage } from '../types/index.js';

/**
 * Parse turn boundaries in a message history.
 *
 * A "turn boundary" is a position in the message array where it's safe
 * to split the conversation without breaking tool-call sequences.
 *
 * ## Definition of Turn Boundary
 * - Position 0 (start of conversation) is always a boundary
 * - Any user message position is a boundary
 * - User messages start new turns, ending previous assistant tool execution
 *
 * ## Why User Messages?
 * ```
 * [user] message → [assistant] response with tools
 *                                         ↓
 *                         [user] next message (BOUNDARY)
 * ```
 * User messages indicate the previous assistant turn is complete.
 *
 * @param messages - Array of agent messages
 * @returns Array of indices where turn boundaries occur (user message positions)
 */
export function parseTurnBoundaries(messages: AgentMessage[]): number[] {
	const boundaries: number[] = [];

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]!;
		if (message.role === 'user') {
			boundaries.push(i);
		}
	}

	return boundaries;
}

/**
 * Check if index is a valid turn boundary.
 *
 * Useful for validating proposed compression points.
 *
 * @param messages - Array of agent messages
 * @param index - Index to check
 * @returns True if index is a safe boundary
 */
export function isSafeBoundary(messages: AgentMessage[], index: number): boolean {
	// Index 0 or at end is always safe
	if (index === 0 || index === messages.length) {
		return true;
	}

	// Out of bounds
	if (index < 0 || index >= messages.length) {
		return false;
	}

	// Check if at user message position
	const message = messages[index]!;
	return message.role === 'user';
}

/**
 * Find nearest safe turn boundary to targetIndex.
 *
 * ## Backward Preference Algorithm
 * 1. Search from END of boundaries array (most recent first)
 * 2. Find last boundary that is <= targetIndex
 *    - This preserves more recent context
 * 3. If none found before target, find first boundary after
 * 4. If still none, fallback to 0
 *
 * ## Why Backward Preference?
 * ```
 * messages: [0:user, 1:asst, 2:user, 3:asst, 4:asst, 5:user, 6:asst]
 * boundaries: [0, 2, 5]
 *
 * targetIndex: 4
 * backward search: 5 > 4 (skip), 2 <= 4 ✓ → returns 2
 *
 * Result: Cut at index 2, preserving [2:] (more recent)
 * ```
 *
 * @param messages - Array of agent messages
 * @param targetIndex - Target index to find boundary near
 * @returns Index of nearest safe boundary, or 0 if none found
 */
export function findSafeBoundary(messages: AgentMessage[], targetIndex: number): number {
	if (messages.length === 0) {
		return 0;
	}

	const boundaries = parseTurnBoundaries(messages);

	if (boundaries.length === 0) {
		return 0;
	}

	// Backward search: find last boundary <= targetIndex
	// This preserves more recent context
	for (let i = boundaries.length - 1; i >= 0; i--) {
		const boundary = boundaries[i]!;
		if (boundary <= targetIndex) {
			// Don't return 0 as "nearest" if there's a better option
			// (0 is always safe, but there's something closer)
			if (boundary > 0) {
				return boundary;
			}
			break;
		}
	}

	// Forward search: find first boundary > targetIndex
	// (no boundary before target, use next one)
	for (const boundary of boundaries) {
		if (boundary > targetIndex) {
			return boundary;
		}
	}

	// No boundary found - extremely rare
	// Means no user messages and targetIndex > 0
	return 0;
}

/**
 * Find middle turn boundary for compression.
 *
 * Drops oldest ~50% of turns, keeping more recent context.
 *
 * ## Use Case
 * When context budget is tight and aggressive compression needed:
 * ```typescript
 * // Keep only most recent ~50% of turns
 * const boundary = findMiddleBoundary(messages);
 * const compressed = messages.slice(boundary);
 * ```
 *
 * ## Example
 * ```
 * boundaries: [0, 5, 10, 15, 20, 25]
 * middleIndex: floor(6/2) = 3
 * boundary[3]: 15
 *
 * Result: Drop [0-15), keep [15-25]
 * ```
 *
 * @param messages - Array of agent messages
 * @returns Index of middle turn boundary
 */
export function findMiddleBoundary(messages: AgentMessage[]): number {
	const boundaries = parseTurnBoundaries(messages);

	if (boundaries.length >= 2) {
		// Return boundary at ~middle of boundaries array
		// This represents ~50th percentile turn
		const middleIndex = Math.floor(boundaries.length / 2);
		return boundaries[middleIndex]!;
	}

	// Not enough boundaries for middle - use findSafeBoundary
	// This handles edge cases like single user message
	return findSafeBoundary(messages, Math.floor(messages.length / 2));
}

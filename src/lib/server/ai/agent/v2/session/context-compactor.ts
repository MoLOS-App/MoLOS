/**
 * Context Compactor - Auto-compaction on context overflow
 *
 * Summarizes and compacts conversation history when approaching token limits.
 */

import type { AgentMessage, Thought, Observation } from '../core/types';

// ============================================================================
// Compaction Types
// ============================================================================

/**
 * Compaction configuration
 */
export interface CompactionConfig {
	/** Maximum tokens before compaction */
	maxTokensBeforeCompaction: number;
	/** Target tokens after compaction */
	targetTokensAfterCompaction: number;
	/** Always preserve recent messages */
	preserveRecentMessages: number;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default compaction configuration
 */
export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
	maxTokensBeforeCompaction: 100000,
	targetTokensAfterCompaction: 50000,
	preserveRecentMessages: 10,
	debug: false
};

/**
 * Compaction result
 */
export interface CompactionResult {
	/** Whether compaction occurred */
	compacted: boolean;
	/** Original message count */
	originalCount: number;
	/** New message count */
	newCount: number;
	/** Tokens before compaction */
	tokensBefore: number;
	/** Tokens after compaction */
	tokensAfter: number;
	/** Summary generated */
	summary?: string;
	/** Compacted message ranges */
	compactedRanges: Array<{ start: number; end: number }>;
}

/**
 * Message summary for compaction
 */
export interface MessageSummary {
	/** Time range */
	timeRange: { start: number; end: number };
	/** Key topics */
	topics: string[];
	/** Actions taken */
	actions: string[];
	/** Decisions made */
	decisions: string[];
	/** Files modified */
	filesModified: string[];
}

// ============================================================================
// Context Compactor
// ============================================================================

/**
 * Context Compactor - Handles conversation compaction
 */
export class ContextCompactor {
	private config: CompactionConfig;

	constructor(config: Partial<CompactionConfig> = {}) {
		this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config };
	}

	/**
	 * Check if compaction is needed
	 */
	needsCompaction(messages: AgentMessage[]): boolean {
		const tokens = this.estimateTokens(messages);
		return tokens >= this.config.maxTokensBeforeCompaction;
	}

	/**
	 * Estimate tokens in messages
	 */
	estimateTokens(messages: AgentMessage[]): number {
		let tokens = 0;

		for (const msg of messages) {
			// Base cost per message
			tokens += 4;

			// Content tokens
			if (typeof msg.content === 'string') {
				tokens += Math.ceil(msg.content.length / 4);
			} else if (msg.content) {
				tokens += Math.ceil(JSON.stringify(msg.content).length / 4);
			}

			// Tool calls
			if (msg.toolCalls) {
				for (const tc of msg.toolCalls) {
					tokens += Math.ceil(tc.name.length / 4);
					tokens += Math.ceil(JSON.stringify(tc.parameters).length / 4);
				}
			}
		}

		return tokens;
	}

	/**
	 * Compact messages
	 */
	compact(messages: AgentMessage[], summaryGenerator?: (messages: AgentMessage[]) => Promise<string>): CompactionResult {
		const tokensBefore = this.estimateTokens(messages);
		const originalCount = messages.length;

		// Check if compaction needed
		if (tokensBefore < this.config.maxTokensBeforeCompaction) {
			return {
				compacted: false,
				originalCount,
				newCount: originalCount,
				tokensBefore,
				tokensAfter: tokensBefore,
				compactedRanges: []
			};
		}

		// Find messages to compact
		const preserveCount = Math.min(this.config.preserveRecentMessages, messages.length);
		const toCompact = messages.slice(0, -preserveCount);
		const toPreserve = messages.slice(-preserveCount);

		// Generate summary for compacted portion
		const summary = this.generateSummary(toCompact);

		// Create summary message
		const summaryMessage: AgentMessage = {
			role: 'system',
			content: `[Context Summary]\n${summary}`,
			metadata: {
				type: 'compaction_summary',
				compactedCount: toCompact.length,
				timestamp: Date.now()
			}
		};

		// Build compacted messages
		const compacted: AgentMessage[] = [
			// Keep first system message if present
			...(messages[0]?.role === 'system' ? [messages[0]] : []),
			summaryMessage,
			...toPreserve
		];

		const tokensAfter = this.estimateTokens(compacted);
		const compactedRanges = [{ start: 0, end: toCompact.length }];

		if (this.config.debug) {
			console.log(
				`[ContextCompactor] Compacted ${toCompact.length} messages, ` +
				`${tokensBefore} -> ${tokensAfter} tokens`
			);
		}

		return {
			compacted: true,
			originalCount,
			newCount: compacted.length,
			tokensBefore,
			tokensAfter,
			summary,
			compactedRanges
		};
	}

	/**
	 * Compact with external summary generation (async)
	 */
	async compactAsync(
		messages: AgentMessage[],
		summaryGenerator: (messages: AgentMessage[]) => Promise<string>
	): Promise<CompactionResult> {
		const tokensBefore = this.estimateTokens(messages);
		const originalCount = messages.length;

		// Check if compaction needed
		if (tokensBefore < this.config.maxTokensBeforeCompaction) {
			return {
				compacted: false,
				originalCount,
				newCount: originalCount,
				tokensBefore,
				tokensAfter: tokensBefore,
				compactedRanges: []
			};
		}

		// Find messages to compact
		const preserveCount = Math.min(this.config.preserveRecentMessages, messages.length);
		const toCompact = messages.slice(0, -preserveCount);
		const toPreserve = messages.slice(-preserveCount);

		// Generate summary using provided function
		const summary = await summaryGenerator(toCompact);

		// Create summary message
		const summaryMessage: AgentMessage = {
			role: 'system',
			content: `[Context Summary]\n${summary}`,
			metadata: {
				type: 'compaction_summary',
				compactedCount: toCompact.length,
				timestamp: Date.now()
			}
		};

		// Build compacted messages
		const compacted: AgentMessage[] = [
			// Keep first system message if present
			...(messages[0]?.role === 'system' ? [messages[0]] : []),
			summaryMessage,
			...toPreserve
		];

		const tokensAfter = this.estimateTokens(compacted);

		return {
			compacted: true,
			originalCount,
			newCount: compacted.length,
			tokensBefore,
			tokensAfter,
			summary,
			compactedRanges: [{ start: 0, end: toCompact.length }]
		};
	}

	/**
	 * Compact thoughts and observations
	 */
	compactReActHistory(
		thoughts: Thought[],
		observations: Observation[]
	): { thoughts: Thought[]; observations: Observation[]; summary: string } {
		// Keep recent iterations
		const maxIterations = 10;
		const recentThoughts = thoughts.slice(-maxIterations);
		const recentObservationIds = new Set(recentThoughts.map(t => t.id));

		const recentObservations = observations.filter(
			o => recentObservationIds.has(o.thoughtId)
		);

		// Generate summary of older iterations
		const oldThoughts = thoughts.slice(0, -maxIterations);
		const summary = this.generateReActSummary(oldThoughts, observations);

		return {
			thoughts: recentThoughts,
			observations: recentObservations,
			summary
		};
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private generateSummary(messages: AgentMessage[]): string {
		const topics: string[] = [];
		const actions: string[] = [];
		const files: Set<string> = new Set();

		for (const msg of messages) {
			// Extract topics from user messages
			if (msg.role === 'user' && typeof msg.content === 'string') {
				const words = msg.content.split(/\s+/).filter(w => w.length > 4);
				topics.push(...words.slice(0, 3));
			}

			// Extract actions from tool calls
			if (msg.toolCalls) {
				for (const tc of msg.toolCalls) {
					actions.push(tc.name);

					// Extract file paths
					const params = JSON.stringify(tc.parameters);
					const fileMatches = params.match(/["']([^"']+\.[a-z]+)["']/gi);
					if (fileMatches) {
						fileMatches.forEach(m => files.add(m.replace(/["']/g, '')));
					}
				}
			}
		}

		const parts: string[] = [];

		if (topics.length > 0) {
			parts.push(`Topics discussed: ${[...new Set(topics)].slice(0, 5).join(', ')}`);
		}

		if (actions.length > 0) {
			const uniqueActions = [...new Set(actions)];
			parts.push(`Actions taken: ${uniqueActions.length} tool calls (${uniqueActions.slice(0, 5).join(', ')})`);
		}

		if (files.size > 0) {
			parts.push(`Files involved: ${[...files].slice(0, 5).join(', ')}`);
		}

		return parts.length > 0 ? parts.join('\n') : 'Previous conversation context compacted.';
	}

	private generateReActSummary(thoughts: Thought[], observations: Observation[]): string {
		if (thoughts.length === 0) return '';

		const successfulActions = observations.filter(o => o.isSuccess).length;
		const failedActions = observations.length - successfulActions;

		const toolUsage = new Map<string, number>();
		for (const t of thoughts) {
			if (t.toolName) {
				toolUsage.set(t.toolName, (toolUsage.get(t.toolName) ?? 0) + 1);
			}
		}

		const parts: string[] = [
			`Previous iterations: ${thoughts.length}`,
			`Actions: ${successfulActions} successful, ${failedActions} failed`
		];

		if (toolUsage.size > 0) {
			const topTools = [...toolUsage.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([name, count]) => `${name}(${count})`);
			parts.push(`Tools used: ${topTools.join(', ')}`);
		}

		return parts.join('. ');
	}
}

/**
 * Create a context compactor
 */
export function createContextCompactor(config?: Partial<CompactionConfig>): ContextCompactor {
	return new ContextCompactor(config);
}

/**
 * Thinking Engine - Configurable reasoning depth
 *
 * Manages thinking levels and reasoning content generation.
 * Supports off/minimal/low/medium/high thinking levels.
 */

import type { ThinkingLevel, Thought, AgentMessage } from '../core/types';

// ============================================================================
// Thinking Types
// ============================================================================

/**
 * Thinking prompt configuration
 */
export interface ThinkingPrompt {
	/** Prompt prefix */
	prefix: string;
	/** Prompt suffix */
	suffix: string;
	/** Include in response */
	includeInResponse: boolean;
	/** Maximum thinking tokens */
	maxTokens: number;
}

/**
 * Thinking configuration by level
 */
export const THINKING_PROMPTS: Record<ThinkingLevel, ThinkingPrompt> = {
	off: {
		prefix: '',
		suffix: '',
		includeInResponse: false,
		maxTokens: 0
	},
	minimal: {
		prefix: 'Think briefly before responding.',
		suffix: '',
		includeInResponse: false,
		maxTokens: 200
	},
	low: {
		prefix: 'Consider the context and plan your approach before acting.',
		suffix: 'Now proceed with your action.',
		includeInResponse: true,
		maxTokens: 500
	},
	medium: {
		prefix: `Think through your approach step by step:
1. Analyze the current situation
2. Identify the goal
3. Consider available options
4. Choose the best action
5. Plan the execution`,
		suffix: 'Now execute your plan.',
		includeInResponse: true,
		maxTokens: 1000
	},
	high: {
		prefix: `<thinking_protocol>
Before taking any action, thoroughly analyze:
1. The user's true intent and any implicit requirements
2. The current state and available resources
3. Potential risks and edge cases
4. The optimal sequence of actions
5. How to verify success

Document your reasoning process and explain your decisions.
Consider alternative approaches and their trade-offs.
</thinking_protocol>`,
		suffix: 'Now proceed with your well-reasoned action.',
		includeInResponse: true,
		maxTokens: 2000
	}
};

/**
 * Thinking result
 */
export interface ThinkingResult {
	/** Thinking content */
	content: string;
	/** Thinking level used */
	level: ThinkingLevel;
	/** Token count */
	tokenCount: number;
	/** Whether thinking was truncated */
	truncated: boolean;
}

// ============================================================================
// Thinking Engine
// ============================================================================

/**
 * Thinking Engine - Manages reasoning depth
 */
export class ThinkingEngine {
	private level: ThinkingLevel;
	private debug: boolean;

	constructor(level: ThinkingLevel = 'low', debug: boolean = false) {
		this.level = level;
		this.debug = debug;
	}

	/**
	 * Get current thinking level
	 */
	getLevel(): ThinkingLevel {
		return this.level;
	}

	/**
	 * Set thinking level
	 */
	setLevel(level: ThinkingLevel): void {
		this.level = level;

		if (this.debug) {
			console.log(`[ThinkingEngine] Level set to: ${level}`);
		}
	}

	/**
	 * Get thinking prompt for current level
	 */
	getPrompt(): ThinkingPrompt {
		return THINKING_PROMPTS[this.level];
	}

	/**
	 * Check if thinking is enabled
	 */
	isEnabled(): boolean {
		return this.level !== 'off';
	}

	/**
	 * Get max thinking tokens
	 */
	getMaxTokens(): number {
		return THINKING_PROMPTS[this.level].maxTokens;
	}

	/**
	 * Enhance system prompt with thinking instructions
	 */
	enhanceSystemPrompt(basePrompt: string): string {
		if (this.level === 'off') {
			return basePrompt;
		}

		const thinkingPrompt = THINKING_PROMPTS[this.level];
		const parts: string[] = [basePrompt];

		if (thinkingPrompt.prefix) {
			parts.push(`\n\n## Thinking Instructions\n${thinkingPrompt.prefix}`);
		}

		return parts.join('\n');
	}

	/**
	 * Extract thinking content from response
	 */
	extractThinking(content: string): ThinkingResult {
		if (this.level === 'off') {
			return {
				content: '',
				level: 'off',
				tokenCount: 0,
				truncated: false
			};
		}

		// Look for thinking tags
		const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);

		if (thinkingMatch) {
			const thinkingContent = thinkingMatch[1].trim();
			const tokenCount = Math.ceil(thinkingContent.length / 4);
			const maxTokens = THINKING_PROMPTS[this.level].maxTokens;
			const truncated = tokenCount > maxTokens;

			return {
				content: thinkingContent,
				level: this.level,
				tokenCount,
				truncated
			};
		}

		// No explicit thinking tags found
		return {
			content: '',
			level: this.level,
			tokenCount: 0,
			truncated: false
		};
	}

	/**
	 * Process thinking content
	 */
	processThinking(content: string): { thinking: string; response: string } {
		if (this.level === 'off') {
			return { thinking: '', response: content };
		}

		const thinkingResult = this.extractThinking(content);

		if (!thinkingResult.content) {
			return { thinking: '', response: content };
		}

		// Remove thinking tags from response
		const response = content
			.replace(/<thinking>[\s\S]*?<\/thinking>/i, '')
			.trim();

		return {
			thinking: thinkingResult.content,
			response
		};
	}

	/**
	 * Wrap content in thinking tags
	 */
	wrapThinking(content: string): string {
		if (this.level === 'off' || !THINKING_PROMPTS[this.level].includeInResponse) {
			return content;
		}

		return `<thinking>\n${content}\n</thinking>`;
	}

	/**
	 * Estimate thinking tokens for messages
	 */
	estimateThinkingTokens(messages: AgentMessage[]): number {
		if (this.level === 'off') return 0;

		let tokens = 0;

		for (const msg of messages) {
			if (typeof msg.content === 'string') {
				const thinking = this.extractThinking(msg.content);
				tokens += thinking.tokenCount;
			}
		}

		return tokens;
	}

	/**
	 * Create thinking summary for compaction
	 */
	summarizeThinking(thoughts: Thought[]): string {
		if (thoughts.length === 0) return '';

		const recentThoughts = thoughts.slice(-5);
		const summaries = recentThoughts.map(t => {
			const action = t.toolName ? `using ${t.toolName}` : t.nextAction;
			return `- ${t.reasoning.slice(0, 100)}... (${action})`;
		});

		return `Recent thinking:\n${summaries.join('\n')}`;
	}
}

/**
 * Create a thinking engine
 */
export function createThinkingEngine(level?: ThinkingLevel, debug?: boolean): ThinkingEngine {
	return new ThinkingEngine(level, debug);
}

/**
 * Get thinking level from string
 */
export function parseThinkingLevel(value: string | undefined): ThinkingLevel {
	const validLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high'];

	if (!value) return 'low';

	const normalized = value.toLowerCase() as ThinkingLevel;

	return validLevels.includes(normalized) ? normalized : 'low';
}

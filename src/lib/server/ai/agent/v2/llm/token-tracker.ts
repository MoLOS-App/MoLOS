/**
 * Token Tracker - Token usage tracking
 *
 * Tracks token usage across the agent execution.
 * Supports budget limits and usage alerts.
 */

// ============================================================================
// Token Types
// ============================================================================

/**
 * Token usage record
 */
export interface TokenUsage {
	/** Input tokens */
	inputTokens: number;
	/** Output tokens */
	outputTokens: number;
	/** Total tokens */
	totalTokens: number;
	/** Provider */
	provider: string;
	/** Model */
	model: string;
	/** Timestamp */
	timestamp: number;
	/** Operation type */
	operation: 'completion' | 'streaming' | 'embedding';
	/** Estimated cost */
	cost?: number;
}

/**
 * Token budget
 */
export interface TokenBudget {
	/** Maximum input tokens */
	maxInputTokens?: number;
	/** Maximum output tokens */
	maxOutputTokens?: number;
	/** Maximum total tokens */
	maxTotalTokens?: number;
	/** Maximum cost (USD) */
	maxCost?: number;
}

/**
 * Token tracker configuration
 */
export interface TokenTrackerConfig {
	/** Token budget */
	budget?: TokenBudget;
	/** Reserve tokens for responses */
	reserveTokens: number;
	/** Enable debug logging */
	debug: boolean;
	/** Cost per 1K tokens by provider */
	costPerKTokens?: Record<string, { input: number; output: number }>;
}

/**
 * Default configuration
 */
export const DEFAULT_TOKEN_TRACKER_CONFIG: TokenTrackerConfig = {
	reserveTokens: 1000,
	debug: false,
	costPerKTokens: {
		anthropic: { input: 0.003, output: 0.015 }, // Claude 3.5 Sonnet
		openai: { input: 0.005, output: 0.015 }, // GPT-4o
		openrouter: { input: 0.003, output: 0.015 },
		ollama: { input: 0, output: 0 }, // Local = free
		zai: { input: 0.003, output: 0.015 }
	}
};

/**
 * Token alert
 */
export interface TokenAlert {
	/** Alert type */
	type: 'budget_warning' | 'budget_exceeded' | 'reserve_depleted';
	/** Current usage */
	usage: TokenUsage;
	/** Budget limit */
	limit: number;
	/** Percentage used */
	percentage: number;
	/** Timestamp */
	timestamp: number;
	/** Message */
	message: string;
}

// ============================================================================
// Token Tracker
// ============================================================================

/**
 * Token Tracker - Tracks token usage across execution
 */
export class TokenTracker {
	private config: TokenTrackerConfig;
	private usageHistory: TokenUsage[] = [];
	private alertCallbacks: Array<(alert: TokenAlert) => void> = [];
	private currentUsage = {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		cost: 0
	};

	constructor(config: Partial<TokenTrackerConfig> = {}) {
		this.config = { ...DEFAULT_TOKEN_TRACKER_CONFIG, ...config };
	}

	/**
	 * Record token usage
	 */
	record(usage: Omit<TokenUsage, 'timestamp' | 'cost'>): TokenUsage {
		const cost = this.calculateCost(usage.inputTokens, usage.outputTokens, usage.provider);

		const record: TokenUsage = {
			...usage,
			timestamp: Date.now(),
			cost
		};

		this.usageHistory.push(record);

		// Update current totals
		this.currentUsage.inputTokens += usage.inputTokens;
		this.currentUsage.outputTokens += usage.outputTokens;
		this.currentUsage.totalTokens += usage.totalTokens;
		this.currentUsage.cost += cost;

		// Check budget
		this.checkBudget(record);

		if (this.config.debug) {
			console.log(
				`[TokenTracker] Recorded: ${usage.inputTokens} in, ${usage.outputTokens} out, $${cost.toFixed(4)}`
			);
		}

		return record;
	}

	/**
	 * Estimate tokens for messages
	 */
	estimateInputTokens(messages: Array<{ role: string; content: string | unknown }>): number {
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
		}

		return tokens;
	}

	/**
	 * Estimate output tokens for content
	 */
	estimateOutputTokens(content: string): number {
		return Math.ceil(content.length / 4);
	}

	/**
	 * Check if we have enough tokens remaining
	 */
	hasBudgetAvailable(requiredTokens: number): boolean {
		const budget = this.config.budget;

		if (!budget) return true;

		const remainingInput = budget.maxInputTokens
			? budget.maxInputTokens - this.currentUsage.inputTokens
			: Infinity;

		const remainingTotal = budget.maxTotalTokens
			? budget.maxTotalTokens - this.currentUsage.totalTokens
			: Infinity;

		// Must have enough for input + reserve
		const available = Math.min(remainingInput, remainingTotal) - this.config.reserveTokens;

		return available >= requiredTokens;
	}

	/**
	 * Get available tokens for input
	 */
	getAvailableInputTokens(): number {
		const budget = this.config.budget;

		if (!budget) return Infinity;

		const remainingInput = budget.maxInputTokens
			? budget.maxInputTokens - this.currentUsage.inputTokens
			: Infinity;

		const remainingTotal = budget.maxTotalTokens
			? budget.maxTotalTokens - this.currentUsage.totalTokens
			: Infinity;

		return Math.max(0, Math.min(remainingInput, remainingTotal) - this.config.reserveTokens);
	}

	/**
	 * Get current usage summary
	 */
	getCurrentUsage(): {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
		cost: number;
		records: number;
	} {
		return {
			...this.currentUsage,
			records: this.usageHistory.length
		};
	}

	/**
	 * Get usage history
	 */
	getHistory(): TokenUsage[] {
		return [...this.usageHistory];
	}

	/**
	 * Get usage by provider
	 */
	getUsageByProvider(): Map<string, TokenUsage[]> {
		const byProvider = new Map<string, TokenUsage[]>();

		for (const usage of this.usageHistory) {
			const existing = byProvider.get(usage.provider) || [];
			existing.push(usage);
			byProvider.set(usage.provider, existing);
		}

		return byProvider;
	}

	/**
	 * Reset the tracker
	 */
	reset(): void {
		this.usageHistory = [];
		this.currentUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			cost: 0
		};
	}

	/**
	 * Subscribe to alerts
	 */
	onAlert(callback: (alert: TokenAlert) => void): () => void {
		this.alertCallbacks.push(callback);
		return () => {
			const index = this.alertCallbacks.indexOf(callback);
			if (index !== -1) {
				this.alertCallbacks.splice(index, 1);
			}
		};
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private calculateCost(inputTokens: number, outputTokens: number, provider: string): number {
		const costs = this.config.costPerKTokens?.[provider] || { input: 0, output: 0 };

		const inputCost = (inputTokens / 1000) * costs.input;
		const outputCost = (outputTokens / 1000) * costs.output;

		return inputCost + outputCost;
	}

	private checkBudget(usage: TokenUsage): void {
		const budget = this.config.budget;

		if (!budget) return;

		// Check input budget
		if (budget.maxInputTokens) {
			const percentage = (this.currentUsage.inputTokens / budget.maxInputTokens) * 100;

			if (percentage >= 100) {
				this.emitAlert({
					type: 'budget_exceeded',
					usage,
					limit: budget.maxInputTokens,
					percentage,
					timestamp: Date.now(),
					message: `Input token budget exceeded: ${this.currentUsage.inputTokens}/${budget.maxInputTokens}`
				});
			} else if (percentage >= 80) {
				this.emitAlert({
					type: 'budget_warning',
					usage,
					limit: budget.maxInputTokens,
					percentage,
					timestamp: Date.now(),
					message: `Input token budget at ${percentage.toFixed(1)}%`
				});
			}
		}

		// Check total budget
		if (budget.maxTotalTokens) {
			const percentage = (this.currentUsage.totalTokens / budget.maxTotalTokens) * 100;

			if (percentage >= 100) {
				this.emitAlert({
					type: 'budget_exceeded',
					usage,
					limit: budget.maxTotalTokens,
					percentage,
					timestamp: Date.now(),
					message: `Total token budget exceeded: ${this.currentUsage.totalTokens}/${budget.maxTotalTokens}`
				});
			} else if (percentage >= 80) {
				this.emitAlert({
					type: 'budget_warning',
					usage,
					limit: budget.maxTotalTokens,
					percentage,
					timestamp: Date.now(),
					message: `Total token budget at ${percentage.toFixed(1)}%`
				});
			}
		}

		// Check cost budget
		if (budget.maxCost) {
			const percentage = (this.currentUsage.cost / budget.maxCost) * 100;

			if (percentage >= 100) {
				this.emitAlert({
					type: 'budget_exceeded',
					usage,
					limit: budget.maxCost,
					percentage,
					timestamp: Date.now(),
					message: `Cost budget exceeded: $${this.currentUsage.cost.toFixed(4)}/$${budget.maxCost}`
				});
			} else if (percentage >= 80) {
				this.emitAlert({
					type: 'budget_warning',
					usage,
					limit: budget.maxCost,
					percentage,
					timestamp: Date.now(),
					message: `Cost budget at ${percentage.toFixed(1)}%`
				});
			}
		}
	}

	private emitAlert(alert: TokenAlert): void {
		for (const callback of this.alertCallbacks) {
			try {
				callback(alert);
			} catch (error) {
				console.error('[TokenTracker] Error in alert callback:', error);
			}
		}
	}
}

/**
 * Create a token tracker
 */
export function createTokenTracker(config?: Partial<TokenTrackerConfig>): TokenTracker {
	return new TokenTracker(config);
}

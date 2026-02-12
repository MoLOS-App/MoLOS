/**
 * Error Recovery - Auto-recovery strategies
 *
 * Provides automatic recovery strategies for common error types.
 */

import type { IAgentContext } from '../core/context';
import {
	AgentError,
	LlmError,
	ToolError,
	ExecutionError,
	ErrorCode,
	isRecoverable,
	isRateLimitError,
	isTimeoutError,
	isAuthError
} from './error-types';

// ============================================================================
// Recovery Types
// ============================================================================

/**
 * Recovery strategy type
 */
export type RecoveryStrategy =
	| 'retry'
	| 'fallback'
	| 'compact'
	| 'skip'
	| 'abort'
	| 'ask_user';

/**
 * Recovery action
 */
export interface RecoveryAction {
	/** Strategy to use */
	strategy: RecoveryStrategy;
	/** Delay before action in ms */
	delayMs: number;
	/** Maximum attempts */
	maxAttempts: number;
	/** Message for user */
	message?: string;
	/** Additional context */
	context?: Record<string, unknown>;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
	/** Whether recovery was successful */
	success: boolean;
	/** Strategy used */
	strategy: RecoveryStrategy;
	/** Attempts made */
	attempts: number;
	/** Message */
	message: string;
	/** Original error */
	originalError: Error;
	/** Recovery actions taken */
	actionsTaken: string[];
}

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
	/** Maximum retry attempts */
	maxRetryAttempts: number;
	/** Base delay for retries */
	baseRetryDelayMs: number;
	/** Maximum delay for retries */
	maxRetryDelayMs: number;
	/** Enable fallback */
	enableFallback: boolean;
	/** Enable auto-compaction */
	enableCompaction: boolean;
	/** Debug mode */
	debug: boolean;
}

/**
 * Default recovery configuration
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
	maxRetryAttempts: 3,
	baseRetryDelayMs: 1000,
	maxRetryDelayMs: 10000,
	enableFallback: true,
	enableCompaction: true,
	debug: false
};

/**
 * Recovery handler function
 */
export type RecoveryHandler = (
	error: Error,
	action: RecoveryAction,
	context: IAgentContext
) => Promise<boolean>;

// ============================================================================
// Error Recovery
// ============================================================================

/**
 * Error Recovery - Manages automatic recovery strategies
 */
export class ErrorRecovery {
	private config: RecoveryConfig;
	private handlers: Map<ErrorCode, RecoveryHandler> = new Map();
	private recoveryHistory: RecoveryResult[] = [];

	constructor(config: Partial<RecoveryConfig> = {}) {
		this.config = { ...DEFAULT_RECOVERY_CONFIG, ...config };
		this.registerDefaultHandlers();
	}

	/**
	 * Register a recovery handler for an error code
	 */
	registerHandler(code: ErrorCode, handler: RecoveryHandler): void {
		this.handlers.set(code, handler);
	}

	/**
	 * Get recovery action for an error
	 */
	getRecoveryAction(error: Error): RecoveryAction {
		const code = this.getErrorCode(error);

		switch (code) {
			case ErrorCode.LLM_RATE_LIMITED:
				return {
					strategy: 'retry',
					delayMs: 5000,
					maxAttempts: 3,
					message: 'Rate limit hit, waiting before retry...'
				};

			case ErrorCode.LLM_TIMEOUT:
			case ErrorCode.TOOL_TIMEOUT:
				return {
					strategy: 'retry',
					delayMs: 2000,
					maxAttempts: 2,
					message: 'Request timed out, retrying...'
				};

			case ErrorCode.LLM_PROVIDER_UNAVAILABLE:
				return {
					strategy: 'fallback',
					delayMs: 1000,
					maxAttempts: 2,
					message: 'Provider unavailable, trying fallback...'
				};

			case ErrorCode.LLM_CONTEXT_TOO_LONG:
				return {
					strategy: 'compact',
					delayMs: 0,
					maxAttempts: 1,
					message: 'Context too long, compacting...'
				};

			case ErrorCode.TOOL_NOT_FOUND:
				return {
					strategy: 'skip',
					delayMs: 0,
					maxAttempts: 1,
					message: 'Tool not found, skipping...'
				};

			case ErrorCode.LLM_AUTH_FAILED:
			case ErrorCode.CONFIG_MISSING_API_KEY:
				return {
					strategy: 'ask_user',
					delayMs: 0,
					maxAttempts: 0,
					message: 'Authentication failed. Please check your API key.'
				};

			case ErrorCode.EXECUTION_MAX_ITERATIONS:
				return {
					strategy: 'abort',
					delayMs: 0,
					maxAttempts: 0,
					message: 'Maximum iterations reached.'
				};

			default:
				if (isRecoverable(error)) {
					return {
						strategy: 'retry',
						delayMs: this.config.baseRetryDelayMs,
						maxAttempts: this.config.maxRetryAttempts,
						message: 'Recoverable error, retrying...'
					};
				}

				return {
					strategy: 'abort',
					delayMs: 0,
					maxAttempts: 0,
					message: 'Unrecoverable error occurred.'
				};
		}
	}

	/**
	 * Attempt recovery
	 */
	async attemptRecovery(
		error: Error,
		context: IAgentContext,
		action?: RecoveryAction
	): Promise<RecoveryResult> {
		const recoveryAction = action ?? this.getRecoveryAction(error);
		const actionsTaken: string[] = [];
		let attempts = 0;
		let success = false;

		// Get custom handler if registered
		const code = this.getErrorCode(error);
		const handler = this.handlers.get(code);

		if (handler) {
			attempts++;
			try {
				success = await handler(error, recoveryAction, context);
				if (success) {
					actionsTaken.push('Custom handler succeeded');
				}
			} catch (handlerError) {
				actionsTaken.push(`Custom handler failed: ${handlerError}`);
			}
		}

		// Execute default strategy if handler didn't succeed
		if (!success) {
			const result = await this.executeStrategy(error, recoveryAction, context);
			success = result.success;
			actionsTaken.push(...result.actions);
			attempts += result.attempts;
		}

		const result: RecoveryResult = {
			success,
			strategy: recoveryAction.strategy,
			attempts,
			message: success
				? 'Recovery successful'
				: recoveryAction.message || 'Recovery failed',
			originalError: error,
			actionsTaken
		};

		this.recoveryHistory.push(result);

		if (this.config.debug) {
			console.log(`[ErrorRecovery] ${success ? 'Success' : 'Failed'}: ${recoveryAction.strategy}`);
		}

		return result;
	}

	/**
	 * Get recovery history
	 */
	getHistory(): RecoveryResult[] {
		return [...this.recoveryHistory];
	}

	/**
	 * Clear history
	 */
	clearHistory(): void {
		this.recoveryHistory = [];
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private getErrorCode(error: Error): ErrorCode {
		if (error instanceof AgentError) {
			return error.code;
		}
		return ErrorCode.UNKNOWN;
	}

	private async executeStrategy(
		error: Error,
		action: RecoveryAction,
		context: IAgentContext
	): Promise<{ success: boolean; actions: string[]; attempts: number }> {
		const actions: string[] = [];
		let attempts = 0;

		switch (action.strategy) {
			case 'retry':
				// Retry is handled by the caller
				actions.push(`Retry strategy: ${action.maxAttempts} attempts, ${action.delayMs}ms delay`);
				attempts = 1;
				return { success: true, actions, attempts };

			case 'fallback':
				if (this.config.enableFallback) {
					actions.push('Fallback strategy: switching provider');
					attempts = 1;
					return { success: true, actions, attempts };
				}
				return { success: false, actions: ['Fallback disabled'], attempts: 0 };

			case 'compact':
				if (this.config.enableCompaction) {
					actions.push('Compact strategy: triggering context compaction');
					attempts = 1;
					return { success: true, actions, attempts };
				}
				return { success: false, actions: ['Compaction disabled'], attempts: 0 };

			case 'skip':
				actions.push('Skip strategy: marking action as skipped');
				return { success: true, actions, attempts: 1 };

			case 'abort':
				return { success: false, actions: ['Abort strategy: stopping execution'], attempts: 0 };

			case 'ask_user':
				actions.push('Ask user strategy: requires user intervention');
				return { success: false, actions, attempts: 0 };

			default:
				return { success: false, actions: [`Unknown strategy: ${action.strategy}`], attempts: 0 };
		}
	}

	private registerDefaultHandlers(): void {
		// Handler for rate limits with exponential backoff
		this.registerHandler(ErrorCode.LLM_RATE_LIMITED, async (error, action) => {
			if (this.config.debug) {
				console.log('[ErrorRecovery] Rate limit handler: waiting', action.delayMs, 'ms');
			}
			await this.sleep(action.delayMs);
			return true;
		});

		// Handler for timeouts
		this.registerHandler(ErrorCode.LLM_TIMEOUT, async (error, action) => {
			if (this.config.debug) {
				console.log('[ErrorRecovery] Timeout handler: waiting', action.delayMs, 'ms');
			}
			await this.sleep(action.delayMs);
			return true;
		});
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

/**
 * Create error recovery
 */
export function createErrorRecovery(config?: Partial<RecoveryConfig>): ErrorRecovery {
	return new ErrorRecovery(config);
}

/**
 * Utility: Sleep with exponential backoff
 */
export async function sleepWithBackoff(
	attempt: number,
	baseMs: number = 1000,
	maxMs: number = 10000
): Promise<void> {
	const delay = Math.min(maxMs, baseMs * Math.pow(2, attempt));
	const jitter = Math.floor(delay * 0.2 * Math.random());
	await new Promise(resolve => setTimeout(resolve, delay + jitter));
}

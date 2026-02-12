/**
 * Circuit Breaker Pattern
 *
 * Prevents cascade failures by opening the circuit after repeated failures.
 * Implements closed -> open -> half-open -> closed state machine.
 */

// ============================================================================
// Circuit Breaker Types
// ============================================================================

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
	/** Number of failures before opening */
	failureThreshold: number;
	/** Time in ms before attempting recovery */
	recoveryTimeout: number;
	/** Number of successful calls in half-open to close */
	successThreshold: number;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
	failureThreshold: 5,
	recoveryTimeout: 30000, // 30 seconds
	successThreshold: 3,
	debug: false
};

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
	/** Current state */
	state: CircuitState;
	/** Total calls */
	totalCalls: number;
	/** Successful calls */
	successfulCalls: number;
	/** Failed calls */
	failedCalls: number;
	/** Consecutive failures */
	consecutiveFailures: number;
	/** Consecutive successes (in half-open) */
	consecutiveSuccesses: number;
	/** Last failure time */
	lastFailureTime?: number;
	/** Last state change time */
	lastStateChange?: number;
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit Breaker - Protects against cascade failures
 */
export class CircuitBreaker {
	private state: CircuitState = 'closed';
	private config: CircuitBreakerConfig;
	private stats: CircuitBreakerStats;
	private stateChangeCallbacks: Array<(from: CircuitState, to: CircuitState) => void> = [];

	constructor(config: Partial<CircuitBreakerConfig> = {}) {
		this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
		this.stats = {
			state: 'closed',
			totalCalls: 0,
			successfulCalls: 0,
			failedCalls: 0,
			consecutiveFailures: 0,
			consecutiveSuccesses: 0
		};
	}

	/**
	 * Execute a function through the circuit breaker
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		// Check if circuit is open
		if (this.state === 'open') {
			if (this.shouldAttemptRecovery()) {
				this.transitionTo('half-open');
			} else {
				throw new Error('Circuit breaker is open');
			}
		}

		try {
			const result = await fn();
			this.onSuccess();
			return result;
		} catch (error) {
			this.onFailure();
			throw error;
		}
	}

	/**
	 * Check if the circuit allows calls
	 */
	isAllowed(): boolean {
		if (this.state === 'closed') return true;
		if (this.state === 'half-open') return true;
		if (this.state === 'open') {
			return this.shouldAttemptRecovery();
		}
		return false;
	}

	/**
	 * Get current state
	 */
	getState(): CircuitState {
		return this.state;
	}

	/**
	 * Get statistics
	 */
	getStats(): Readonly<CircuitBreakerStats> {
		return { ...this.stats };
	}

	/**
	 * Reset the circuit breaker
	 */
	reset(): void {
		this.transitionTo('closed');
		this.stats.consecutiveFailures = 0;
		this.stats.consecutiveSuccesses = 0;
	}

	/**
	 * Force open the circuit
	 */
	trip(): void {
		this.transitionTo('open');
	}

	/**
	 * Subscribe to state changes
	 */
	onStateChange(callback: (from: CircuitState, to: CircuitState) => void): () => void {
		this.stateChangeCallbacks.push(callback);
		return () => {
			const index = this.stateChangeCallbacks.indexOf(callback);
			if (index !== -1) {
				this.stateChangeCallbacks.splice(index, 1);
			}
		};
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private onSuccess(): void {
		this.stats.totalCalls++;
		this.stats.successfulCalls++;
		this.stats.consecutiveFailures = 0;
		this.stats.consecutiveSuccesses++;

		if (this.state === 'half-open') {
			if (this.stats.consecutiveSuccesses >= this.config.successThreshold) {
				this.transitionTo('closed');
			}
		}

		if (this.config.debug) {
			console.log(`[CircuitBreaker] Success in ${this.state} state`);
		}
	}

	private onFailure(): void {
		this.stats.totalCalls++;
		this.stats.failedCalls++;
		this.stats.consecutiveFailures++;
		this.stats.consecutiveSuccesses = 0;
		this.stats.lastFailureTime = Date.now();

		if (this.state === 'closed') {
			if (this.stats.consecutiveFailures >= this.config.failureThreshold) {
				this.transitionTo('open');
			}
		} else if (this.state === 'half-open') {
			// Any failure in half-open immediately opens
			this.transitionTo('open');
		}

		if (this.config.debug) {
			console.log(
				`[CircuitBreaker] Failure in ${this.state} state: ${this.stats.consecutiveFailures} consecutive`
			);
		}
	}

	private shouldAttemptRecovery(): boolean {
		if (this.state !== 'open') return false;
		if (!this.stats.lastFailureTime) return true;

		const elapsed = Date.now() - this.stats.lastFailureTime;
		return elapsed >= this.config.recoveryTimeout;
	}

	private transitionTo(newState: CircuitState): void {
		const oldState = this.state;
		this.state = newState;
		this.stats.state = newState;
		this.stats.lastStateChange = Date.now();

		if (newState === 'closed') {
			this.stats.consecutiveFailures = 0;
			this.stats.consecutiveSuccesses = 0;
		} else if (newState === 'open') {
			this.stats.consecutiveSuccesses = 0;
		}

		if (this.config.debug) {
			console.log(`[CircuitBreaker] State change: ${oldState} -> ${newState}`);
		}

		// Notify subscribers
		for (const callback of this.stateChangeCallbacks) {
			try {
				callback(oldState, newState);
			} catch (error) {
				console.error('[CircuitBreaker] Error in state change callback:', error);
			}
		}
	}
}

/**
 * Create a circuit breaker with default configuration
 */
export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
	return new CircuitBreaker(config);
}

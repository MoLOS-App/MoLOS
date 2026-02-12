/**
 * Fallback Manager - Provider fallback on errors
 *
 * Manages fallback to alternative providers when the primary fails.
 * Supports priority-based fallback chains and provider health tracking.
 */

import type { ILlmProvider, ProviderConfig, ProviderError } from './provider-interface';
import { CircuitBreaker, createCircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker';

// ============================================================================
// Fallback Types
// ============================================================================

/**
 * Provider entry in the fallback chain
 */
export interface ProviderEntry {
	/** Provider instance */
	provider: ILlmProvider;
	/** Priority (lower = higher priority) */
	priority: number;
	/** Circuit breaker for this provider */
	circuitBreaker: CircuitBreaker;
	/** Whether this provider is enabled */
	enabled: boolean;
	/** Last error from this provider */
	lastError?: Error;
	/** Last successful call time */
	lastSuccess?: number;
}

/**
 * Fallback manager configuration
 */
export interface FallbackManagerConfig {
	/** Circuit breaker configuration */
	circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
	/** Enable fallback */
	enableFallback: boolean;
	/** Max providers to try */
	maxProvidersToTry: number;
	/** Enable debug logging */
	debug: boolean;
}

/**
 * Default fallback manager configuration
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackManagerConfig = {
	enableFallback: true,
	maxProvidersToTry: 3,
	debug: false
};

/**
 * Fallback event
 */
export interface FallbackEvent {
	/** Original provider */
	fromProvider: string;
	/** Fallback provider */
	toProvider: string;
	/** Reason for fallback */
	reason: string;
	/** Error that triggered fallback */
	error?: Error;
	/** Timestamp */
	timestamp: number;
}

// ============================================================================
// Fallback Manager
// ============================================================================

/**
 * Fallback Manager - Manages provider fallback chains
 */
export class FallbackManager {
	private providers: Map<string, ProviderEntry> = new Map();
	private config: FallbackManagerConfig;
	private fallbackHistory: FallbackEvent[] = [];
	private fallbackCallbacks: Array<(event: FallbackEvent) => void> = [];

	constructor(config: Partial<FallbackManagerConfig> = {}) {
		this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
	}

	/**
	 * Register a provider with priority
	 */
	registerProvider(
		provider: ILlmProvider,
		priority: number = 100,
		circuitBreakerConfig?: Partial<CircuitBreakerConfig>
	): void {
		const circuitBreaker = createCircuitBreaker({
			...this.config.circuitBreakerConfig,
			...circuitBreakerConfig
		});

		const entry: ProviderEntry = {
			provider,
			priority,
			circuitBreaker,
			enabled: true,
			lastError: undefined,
			lastSuccess: undefined
		};

		this.providers.set(provider.name, entry);

		if (this.config.debug) {
			console.log(`[FallbackManager] Registered provider: ${provider.name} (priority ${priority})`);
		}
	}

	/**
	 * Unregister a provider
	 */
	unregisterProvider(name: string): boolean {
		return this.providers.delete(name);
	}

	/**
	 * Enable a provider
	 */
	enableProvider(name: string): void {
		const entry = this.providers.get(name);
		if (entry) {
			entry.enabled = true;
		}
	}

	/**
	 * Disable a provider
	 */
	disableProvider(name: string): void {
		const entry = this.providers.get(name);
		if (entry) {
			entry.enabled = false;
		}
	}

	/**
	 * Get available providers sorted by priority
	 */
	getAvailableProviders(): ILlmProvider[] {
		return Array.from(this.providers.values())
			.filter(entry => entry.enabled && entry.circuitBreaker.isAllowed())
			.sort((a, b) => a.priority - b.priority)
			.map(entry => entry.provider);
	}

	/**
	 * Get the primary (highest priority) provider
	 */
	getPrimaryProvider(): ILlmProvider | null {
		const available = this.getAvailableProviders();
		return available[0] || null;
	}

	/**
	 * Execute with fallback
	 */
	async executeWithFallback<T>(
		fn: (provider: ILlmProvider) => Promise<T>,
		preferredProvider?: string
	): Promise<T> {
		if (!this.config.enableFallback) {
			// No fallback, use primary only
			const primary = preferredProvider
				? this.providers.get(preferredProvider)?.provider
				: this.getPrimaryProvider();

			if (!primary) {
				throw new Error('No provider available');
			}

			return this.executeProvider(primary, fn);
		}

		// Get providers to try
		const providersToTry = this.getProvidersToTry(preferredProvider);
		const errors: Error[] = [];

		for (const provider of providersToTry) {
			const entry = this.providers.get(provider.name);
			if (!entry) continue;

			try {
				const result = await entry.circuitBreaker.execute(() => this.executeProvider(provider, fn));
				entry.lastSuccess = Date.now();
				entry.lastError = undefined;
				return result;
			} catch (error) {
				entry.lastError = error instanceof Error ? error : new Error(String(error));

				errors.push(entry.lastError);

				if (this.config.debug) {
					console.log(`[FallbackManager] Provider ${provider.name} failed:`, entry.lastError.message);
				}

				// Try next provider
				const nextProvider = this.getNextProvider(provider.name);
				if (nextProvider) {
					this.recordFallback(provider.name, nextProvider.name, entry.lastError.message, entry.lastError);
				}
			}
		}

		// All providers failed
		throw new Error(
			`All providers failed. Errors: ${errors.map(e => e.message).join('; ')}`
		);
	}

	/**
	 * Get provider health status
	 */
	getProviderHealth(): Map<string, {
		available: boolean;
		circuitState: string;
		lastError?: string;
		lastSuccess?: number;
	}> {
		const health = new Map();

		for (const [name, entry] of this.providers) {
			health.set(name, {
				available: entry.enabled && entry.circuitBreaker.isAllowed(),
				circuitState: entry.circuitBreaker.getState(),
				lastError: entry.lastError?.message,
				lastSuccess: entry.lastSuccess
			});
		}

		return health;
	}

	/**
	 * Get fallback history
	 */
	getFallbackHistory(): FallbackEvent[] {
		return [...this.fallbackHistory];
	}

	/**
	 * Subscribe to fallback events
	 */
	onFallback(callback: (event: FallbackEvent) => void): () => void {
		this.fallbackCallbacks.push(callback);
		return () => {
			const index = this.fallbackCallbacks.indexOf(callback);
			if (index !== -1) {
				this.fallbackCallbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Reset all circuit breakers
	 */
	resetAll(): void {
		for (const entry of this.providers.values()) {
			entry.circuitBreaker.reset();
			entry.lastError = undefined;
		}
		this.fallbackHistory = [];
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private async executeProvider<T>(provider: ILlmProvider, fn: (provider: ILlmProvider) => Promise<T>): Promise<T> {
		// Initialize provider if needed
		await provider.initialize();
		return fn(provider);
	}

	private getProvidersToTry(preferredProvider?: string): ILlmProvider[] {
		const available = this.getAvailableProviders();

		if (preferredProvider) {
			// Move preferred to front if available
			const preferred = available.find(p => p.name === preferredProvider);
			if (preferred) {
				const others = available.filter(p => p.name !== preferredProvider);
				return [preferred, ...others].slice(0, this.config.maxProvidersToTry);
			}
		}

		return available.slice(0, this.config.maxProvidersToTry);
	}

	private getNextProvider(currentProvider: string): ILlmProvider | null {
		const available = this.getAvailableProviders();
		const currentIndex = available.findIndex(p => p.name === currentProvider);

		if (currentIndex === -1 || currentIndex >= available.length - 1) {
			return null;
		}

		return available[currentIndex + 1];
	}

	private recordFallback(from: string, to: string, reason: string, error?: Error): void {
		const event: FallbackEvent = {
			fromProvider: from,
			toProvider: to,
			reason,
			error,
			timestamp: Date.now()
		};

		this.fallbackHistory.push(event);

		// Notify subscribers
		for (const callback of this.fallbackCallbacks) {
			try {
				callback(event);
			} catch (err) {
				console.error('[FallbackManager] Error in fallback callback:', err);
			}
		}
	}
}

/**
 * Create a fallback manager
 */
export function createFallbackManager(config?: Partial<FallbackManagerConfig>): FallbackManager {
	return new FallbackManager(config);
}

/**
 * Cooldown Tracker - Rate Limiting with Exponential Backoff
 *
 * ## Purpose
 * Implements intelligent rate limiting that prevents API exhaustion while maximizing
 * throughput. Uses exponential backoff to give failing providers time to recover
 * without permanently blacklisting them.
 *
 * ## Rate Limiting Pattern
 *
 * ```
 * Request ──► Check cooldown
 *                │
 *                ├─[In cooldown]──► Skip (log as skipped, try next candidate)
 *                │
 *                └─[Available]──► Make request
 *                                   │
 *                                   ├─[Success]──► Reset error count
 *                                   │
 *                                   └─[Failure]──► Record failure
 *                                                     │
 *                                                     ▼
 *                                              Increment cooldown
 *                                              based on error type
 * ```
 *
 * ## Cooldown Formulas
 *
 * ### Standard Errors (Rate Limit, Timeout, Auth, Overloaded, Unknown)
 * ```
 * cooldown = min(1 hour, 1 minute × 5^min(errorCount-1, 3))
 *
 * errorCount=1 → 1 min
 * errorCount=2 → 5 min
 * errorCount=3 → 25 min
 * errorCount=4+ → 1 hour (cap)
 * ```
 *
 * ### Billing Errors (402 - Payment Required)
 * ```
 * cooldown = min(24 hours, 5 hours × 2^min(errorCount-1, 10))
 *
 * errorCount=1 → 5 hours
 * errorCount=2 → 10 hours
 * errorCount=3 → 20 hours
 * errorCount=4+ → 24 hours (cap)
 * ```
 *
 * ## 24-Hour Failure Window Reset
 * If no failure occurs within 24 hours, error counts are automatically reset:
 * ```
 * if (now - lastFailure > 24 hours) {
 *   errorCount = 0
 *   failureCounts = { all: 0 }
 * }
 * ```
 * This prevents indefinite cooldown for providers that had temporary issues.
 *
 * ## Per-Provider vs Per-Model Tracking
 * Tracking is done at the **provider/model combination** level:
 * ```
 * "openai/gpt-4o"          → Independent cooldown
 * "openai/gpt-3.5-turbo"   → Independent cooldown
 * "anthropic/claude-sonnet" → Independent cooldown
 * ```
 * This allows:
 * - `gpt-4o` to be unavailable while `gpt-3.5-turbo` works fine
 * - A provider to recover for one model but not another
 *
 * ## Failover Reasons
 * | Reason       | HTTP Code | Retriable | Cooldown Type |
 * |--------------|-----------|-----------|---------------|
 * | `auth`       | 401, 403  | Yes       | Standard      |
 * | `rate_limit` | 429       | Yes       | Standard      |
 * | `billing`    | 402       | Yes       | Billing (5h+) |
 * | `timeout`    | 408       | Yes       | Standard      |
 * | `format`     | 400       | **No**    | None (abort)  |
 * | `overloaded` | 503       | Yes       | Standard      |
 * | `unknown`    | Other     | Yes       | Standard      |
 *
 * ## AI Context Optimization Tips
 * 1. **Check Before Calling**: Use `shouldSkip()` to avoid wasted context
 * 2. **Leverage 24h Reset**: Don't manually clear - the tracker self-heals
 * 3. **Billing = Longer Wait**: Accept the 5h+ billing cooldown as necessary
 * 4. **Debug with `getEntriesArray()`**: See all active cooldowns for monitoring
 * 5. **Concurrent Safety**: Thread-safe for concurrent access from multiple providers
 *
 * ## Thread Safety
 * The tracker uses simple Map-based storage suitable for single-process usage.
 * For multi-process/instance deployments, consider external Redis-based tracking.
 *
 * @example
 * const tracker = new CooldownTracker();
 *
 * // Before calling provider
 * if (tracker.shouldSkip('openai', 'gpt-4o')) {
 *   console.log('Skipping - in cooldown for',
 *     formatCooldownDuration(tracker.getRemainingCooldown('openai', 'gpt-4o')));
 *   return;
 * }
 *
 * // After failure
 * const cooldown = tracker.recordFailure('openai', 'gpt-4o', 'rate_limit');
 * if (cooldown) {
 *   console.log(`Entered cooldown for ${formatCooldownDuration(cooldown)}`);
 * }
 *
 * // After success
 * tracker.recordSuccess('openai', 'gpt-4o');
 */

// =============================================================================
// Types
// =============================================================================

export type FailoverReason =
	| 'auth' // 401, 403, invalid api key
	| 'rate_limit' // 429, too many requests
	| 'billing' // 402, payment required
	| 'timeout' // 408, deadline exceeded
	| 'format' // 400, string should match pattern
	| 'overloaded' // overloaded_error
	| 'unknown'; // everything else

export interface CooldownEntry {
	errorCount: number;
	failureCounts: Record<FailoverReason, number>;
	cooldownEnd: number; // Standard cooldown end time (timestamp)
	disabledUntil: number; // Billing-specific disable (timestamp)
	disabledReason?: FailoverReason;
	lastFailure: number;
}

export interface CooldownTrackerConfig {
	/**
	 * Failure window in milliseconds.
	 * If no failure occurs within this window, error counts are reset.
	 * Default: 24 hours
	 */
	failureWindowMs?: number;
	/**
	 * Function that returns current timestamp in ms.
	 * Useful for testing. Defaults to Date.now().
	 */
	nowFunc?: () => number;
}

// =============================================================================
// Cooldown Duration Formulas
// =============================================================================

import { COOLDOWN } from '../constants.js';

/**
 * Calculate standard exponential backoff cooldown.
 *
 * Formula: min(1h, 1min * 5^min(n-1, 3))
 *
 * - 1 error  → 1 min
 * - 2 errors → 5 min
 * - 3 errors → 25 min
 * - 4+ errors → 1 hour (cap)
 */
export function getStandardCooldown(errorCount: number): number {
	const n = Math.max(1, errorCount);
	const exp = Math.min(n - 1, COOLDOWN.STANDARD_MAX_EXP);
	const ms = COOLDOWN.STANDARD_BACKOFF_BASE_MS * Math.pow(COOLDOWN.STANDARD_BACKOFF_BASE, exp);
	return Math.min(COOLDOWN.STANDARD_BACKOFF_CAP_MS, ms);
}

/**
 * Calculate billing-specific exponential backoff cooldown.
 *
 * Formula: min(24h, 5h * 2^min(n-1, 10))
 *
 * - 1 error  → 5 hours
 * - 2 errors → 10 hours
 * - 3 errors → 20 hours
 * - 4+ errors → 24 hours (cap)
 */
export function getBillingCooldown(errorCount: number): number {
	const n = Math.max(1, errorCount);
	const exp = Math.min(n - 1, COOLDOWN.BILLING_MAX_EXP);
	const raw = COOLDOWN.BILLING_BACKOFF_BASE_MS * Math.pow(COOLDOWN.BILLING_BACKOFF_BASE, exp);
	return Math.min(COOLDOWN.BILLING_BACKOFF_CAP_MS, raw);
}

// =============================================================================
// Cooldown Tracker
// =============================================================================

/**
 * Thread-safe cooldown tracker for provider failover.
 *
 * Tracks failure counts and cooldown times per provider/model combination.
 * Implements exponential backoff for repeated failures.
 */
export class CooldownTracker {
	private readonly entries: Map<string, CooldownEntry> = new Map();
	private readonly failureWindowMs: number;
	private readonly nowFunc: () => number;

	constructor(config?: CooldownTrackerConfig) {
		this.failureWindowMs = config?.failureWindowMs ?? COOLDOWN.FAILURE_WINDOW_DEFAULT_MS;
		this.nowFunc = config?.nowFunc ?? (() => Date.now());
	}

	/**
	 * Check if a provider/model is in cooldown.
	 */
	isInCooldown(provider: string, model: string): boolean {
		const key = this.createKey(provider, model);
		return !this.isAvailable(key);
	}

	/**
	 * Get remaining cooldown time in milliseconds.
	 * Returns 0 if not in cooldown.
	 */
	getRemainingCooldown(provider: string, model: string): number {
		const key = this.createKey(provider, model);
		const entry = this.entries.get(key);
		if (!entry) {
			return 0;
		}

		const now = this.nowFunc();
		let remaining = 0;

		// Check billing disable first (takes precedence)
		if (entry.disabledUntil > now) {
			remaining = Math.max(remaining, entry.disabledUntil - now);
		}

		// Check standard cooldown
		if (entry.cooldownEnd > now) {
			remaining = Math.max(remaining, entry.cooldownEnd - now);
		}

		return remaining;
	}

	/**
	 * Record a failure and return the cooldown duration if newly cooldowned.
	 * Returns null if the provider is already in cooldown or doesn't need one.
	 */
	recordFailure(provider: string, model: string, reason: FailoverReason): number | null {
		const key = this.createKey(provider, model);
		const now = this.nowFunc();

		const entry = this.getOrCreate(key);

		// 24h failure window reset: if no failure in failureWindow, reset counters
		if (entry.lastFailure > 0 && now - entry.lastFailure > this.failureWindowMs) {
			entry.errorCount = 0;
			entry.failureCounts = {
				auth: 0,
				billing: 0,
				format: 0,
				overloaded: 0,
				rate_limit: 0,
				timeout: 0,
				unknown: 0
			};
		}

		entry.errorCount++;
		entry.failureCounts[reason] = (entry.failureCounts[reason] || 0) + 1;
		entry.lastFailure = now;

		let cooldownDuration: number | null = null;

		if (reason === 'billing') {
			// Billing errors get longer cooldowns
			const billingCount = entry.failureCounts.billing || 0;
			const newDisabledUntil = now + getBillingCooldown(billingCount);

			// Only update if this is a longer cooldown
			if (newDisabledUntil > entry.disabledUntil) {
				entry.disabledUntil = newDisabledUntil;
				entry.disabledReason = 'billing';
				cooldownDuration = getBillingCooldown(billingCount);
			}
		} else {
			// Standard errors get exponential backoff
			const newCooldownEnd = now + getStandardCooldown(entry.errorCount);

			// Only update if this is a longer cooldown
			if (newCooldownEnd > entry.cooldownEnd) {
				entry.cooldownEnd = newCooldownEnd;
				cooldownDuration = getStandardCooldown(entry.errorCount);
			}
		}

		return cooldownDuration;
	}

	/**
	 * Record success, resetting all cooldown counters for a provider/model.
	 */
	recordSuccess(provider: string, model: string): void {
		const key = this.createKey(provider, model);
		const entry = this.entries.get(key);
		if (!entry) {
			return;
		}

		entry.errorCount = 0;
		entry.failureCounts = {
			auth: 0,
			billing: 0,
			format: 0,
			overloaded: 0,
			rate_limit: 0,
			timeout: 0,
			unknown: 0
		};
		entry.cooldownEnd = 0;
		entry.disabledUntil = 0;
		entry.disabledReason = undefined;
	}

	/**
	 * Get all entries (for debugging).
	 */
	getAllEntries(): Map<string, CooldownEntry> {
		const result = new Map<string, CooldownEntry>();
		for (const [key, entry] of Array.from(this.entries.entries())) {
			// Deep copy to prevent external mutation
			result.set(key, { ...entry, failureCounts: { ...entry.failureCounts } });
		}
		return result;
	}

	/**
	 * Clear all entries.
	 */
	clear(): void {
		this.entries.clear();
	}

	/**
	 * Check if a candidate should be skipped due to cooldown.
	 * Alias for isInCooldown for semantic clarity in fallback chains.
	 */
	shouldSkip(provider: string, model: string): boolean {
		return this.isInCooldown(provider, model);
	}

	/**
	 * Get the error count for a provider/model.
	 */
	getErrorCount(provider: string, model: string): number {
		const key = this.createKey(provider, model);
		const entry = this.entries.get(key);
		return entry?.errorCount ?? 0;
	}

	/**
	 * Get the failure count for a specific reason.
	 */
	getFailureCount(provider: string, model: string, reason: FailoverReason): number {
		const key = this.createKey(provider, model);
		const entry = this.entries.get(key);
		return entry?.failureCounts[reason] ?? 0;
	}

	/**
	 * Get all cooldown entries as an array (for debugging/display).
	 */
	getEntriesArray(): Array<{ key: string; entry: CooldownEntry }> {
		const result: Array<{ key: string; entry: CooldownEntry }> = [];
		for (const [key, entry] of Array.from(this.entries.entries())) {
			result.push({ key, entry: { ...entry, failureCounts: { ...entry.failureCounts } } });
		}
		return result;
	}

	// -------------------------------------------------------------------------
	// Private Methods
	// -------------------------------------------------------------------------

	private createKey(provider: string, model: string): string {
		return `${provider}/${model}`;
	}

	private getOrCreate(key: string): CooldownEntry {
		let entry = this.entries.get(key);
		if (!entry) {
			entry = {
				errorCount: 0,
				failureCounts: {
					auth: 0,
					billing: 0,
					format: 0,
					overloaded: 0,
					rate_limit: 0,
					timeout: 0,
					unknown: 0
				},
				cooldownEnd: 0,
				disabledUntil: 0,
				lastFailure: 0
			};
			this.entries.set(key, entry);
		}
		return entry;
	}

	private isAvailable(key: string): boolean {
		const entry = this.entries.get(key);
		if (!entry) {
			return true;
		}

		const now = this.nowFunc();

		// Billing disable takes precedence (longer cooldown)
		if (entry.disabledUntil > now) {
			return false;
		}

		// Standard cooldown
		if (entry.cooldownEnd > now) {
			return false;
		}

		return true;
	}
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatCooldownDuration(ms: number): string {
	if (ms <= 0) return '0s';

	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
	}
	if (minutes > 0) {
		const remainingSeconds = seconds % 60;
		return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
	}
	return `${seconds}s`;
}

/**
 * Check if a reason is a retriable error type.
 * Retriable errors should trigger fallback to next candidate.
 */
export function isRetriableReason(reason: FailoverReason): boolean {
	// Format errors are non-retriable (bad request structure)
	return reason !== 'format';
}

/**
 * Get a human-readable description of a failover reason.
 */
export function describeFailoverReason(reason: FailoverReason): string {
	switch (reason) {
		case 'auth':
			return 'Authentication failed (invalid API key, unauthorized)';
		case 'rate_limit':
			return 'Rate limit exceeded (too many requests)';
		case 'billing':
			return 'Billing error (payment required, insufficient credits)';
		case 'timeout':
			return 'Request timeout (deadline exceeded)';
		case 'format':
			return 'Invalid request format (bad request structure)';
		case 'overloaded':
			return 'Provider overloaded (temporary server issue)';
		case 'unknown':
		default:
			return 'Unknown error';
	}
}

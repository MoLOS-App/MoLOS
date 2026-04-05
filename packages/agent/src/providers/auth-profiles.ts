/**
 * Auth Profile Manager - Multi-Key Authentication with Transient Error Tracking
 *
 * ## Purpose
 * Manages multiple API keys (auth profiles) per provider with intelligent rotation,
 * transient error tracking, and cooldown probing for automatic recovery detection.
 *
 * ## Key Concepts
 *
 * ### Auth Profile
 * An auth profile represents a single API key with its associated state:
 * - `id`: Unique identifier for the profile
 * - `apiKey`: The actual API key
 * - `isActive`: Whether this profile is currently selected
 * - `cooldownUntil`: Timestamp when cooldown expires (transient errors only)
 * - `transientErrors`: Count of consecutive transient errors
 * - `lastErrorAt`: Timestamp of last error for this profile
 *
 * ### Transient vs Permanent Errors
 * - **Transient Errors**: Rate limit, overloaded - profile goes into cooldown but may recover
 * - **Permanent Errors**: Auth failure (invalid key), billing - profile should be deactivated
 *
 * ### Rotation Strategy
 * When a profile encounters a transient error:
 * 1. Record the error and increment transient error count
 * 2. Put profile in cooldown with exponential backoff (5s, 10s, 20s, 40s, max 60s)
 * 3. Rotate to next available profile
 *
 * When a profile succeeds:
 * 1. Reset transient error count to 0
 * 2. Clear any cooldown
 *
 * ## Cooldown Formula (Transient Errors)
 * ```
 * cooldown = min(60s, 5s × 2^(transientErrors-1))
 *
 * transientErrors=1 → 5s
 * transientErrors=2 → 10s
 * transientErrors=3 → 20s
 * transientErrors=4 → 40s
 * transientErrors=5+ → 60s (cap)
 * ```
 *
 * ## AI Context Optimization Tips
 * 1. **Use for High-Volume**: Essential when hitting rate limits with single keys
 * 2. **Probe for Recovery**: Use `probe()` to check if a cooled-down profile has recovered
 * 3. **Decouple from Fallback**: Auth profiles handle per-key rotation, fallback handles per-provider
 * 4. **Reset on Success**: Always call `recordSuccess()` on successful API calls
 *
 * @example
 * const manager = new AuthProfileManager();
 *
 * // Add profiles for a provider
 * manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-...' });
 * manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-...' });
 *
 * // Get active profile
 * const profile = manager.getActiveProfile('openai');
 * if (profile) {
 *   console.log(`Using key: ${profile.id}`);
 * }
 *
 * // Record transient error (rate limit) - rotates to next key
 * manager.recordTransientError('openai', 'key-1');
 * const next = manager.getActiveProfile('openai');
 *
 * // Record success - resets error count
 * manager.recordSuccess('openai', manager.activeProfileId.get('openai')!);
 *
 * @example
 * // Async probe for recovery
 * const isRecovered = await manager.probe('openai', 'key-1');
 * if (isRecovered) {
 *   // Profile has recovered, can rotate back to it
 *   manager.rotate('openai');
 * }
 */

import type { LanguageModelV3 } from '@ai-sdk/provider';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a single API key profile with its error state.
 */
export interface AuthProfile {
	/** Unique identifier for this profile */
	id: string;
	/** The actual API key */
	apiKey: string;
	/** Whether this profile is currently the active one */
	isActive: boolean;
	/** Timestamp when cooldown expires (transient errors only) */
	cooldownUntil?: number;
	/** Count of consecutive transient errors */
	transientErrors: number;
	/** Timestamp of last error */
	lastErrorAt?: number;
}

/**
 * Configuration for creating an auth profile.
 */
export interface AuthProfileConfig {
	/** Unique identifier for this profile */
	id: string;
	/** The API key */
	apiKey: string;
}

/**
 * Configuration for AuthProfileManager.
 */
export interface AuthProfileManagerConfig {
	/**
	 * Function that returns current timestamp in ms.
	 * Useful for testing. Defaults to Date.now().
	 */
	nowFunc?: () => number;
	/**
	 * Maximum number of profiles to track per provider.
	 * @default 10
	 */
	maxProfilesPerProvider?: number;
}

// =============================================================================
// Auth Profile Manager
// =============================================================================

/**
 * Manages multiple API key profiles per provider with rotation and cooldown.
 *
 * Handles transient error tracking (rate limits, overloaded) with automatic
 * profile rotation. For permanent errors (auth failures), use `deactivateProfile()`.
 */
export class AuthProfileManager {
	private readonly profiles: Map<string, AuthProfile[]> = new Map();
	private readonly activeProfileId: Map<string, string> = new Map();
	private readonly nowFunc: () => number;
	private readonly maxProfilesPerProvider: number;

	constructor(config?: AuthProfileManagerConfig) {
		this.nowFunc = config?.nowFunc ?? (() => Date.now());
		this.maxProfilesPerProvider = config?.maxProfilesPerProvider ?? 10;
	}

	/**
	 * Add an auth profile for a provider.
	 */
	addProfile(provider: string, config: AuthProfileConfig): AuthProfile {
		const profiles = this.profiles.get(provider) || [];

		// Check if profile with same ID already exists
		const existing = profiles.find((p) => p.id === config.id);
		if (existing) {
			// Update existing profile
			existing.apiKey = config.apiKey;
			return existing;
		}

		// Check max profiles limit
		if (profiles.length >= this.maxProfilesPerProvider) {
			throw new Error(
				`auth-profiles: max profiles (${this.maxProfilesPerProvider}) reached for provider: ${provider}`
			);
		}

		const profile: AuthProfile = {
			id: config.id,
			apiKey: config.apiKey,
			isActive: profiles.length === 0, // First profile is active
			transientErrors: 0
		};

		if (profile.isActive) {
			this.activeProfileId.set(provider, profile.id);
		}

		profiles.push(profile);
		this.profiles.set(provider, profiles);

		return profile;
	}

	/**
	 * Remove a profile from a provider.
	 */
	removeProfile(provider: string, profileId: string): boolean {
		const profiles = this.profiles.get(provider) || [];
		const index = profiles.findIndex((p) => p.id === profileId);

		if (index === -1) {
			return false;
		}

		const wasActive = profiles[index]?.isActive ?? false;
		profiles.splice(index, 1);

		// If removed profile was active, activate first remaining profile
		if (wasActive && profiles.length > 0) {
			const firstProfile = profiles[0];
			if (firstProfile) {
				firstProfile.isActive = true;
				this.activeProfileId.set(provider, firstProfile.id);
			}
		} else if (profiles.length === 0) {
		} else if (profiles.length === 0) {
			this.activeProfileId.delete(provider);
		}

		return true;
	}

	/**
	 * Get all profiles for a provider.
	 */
	getProfiles(provider: string): AuthProfile[] {
		return this.profiles.get(provider) || [];
	}

	/**
	 * Get the currently active profile for a provider.
	 */
	getActiveProfile(provider: string): AuthProfile | null {
		const profileId = this.activeProfileId.get(provider);
		if (!profileId) {
			return null;
		}

		const profiles = this.profiles.get(provider) || [];
		return profiles.find((p) => p.id === profileId) || null;
	}

	/**
	 * Get the active profile ID for a provider.
	 */
	getActiveProfileId(provider: string): string | undefined {
		return this.activeProfileId.get(provider);
	}

	/**
	 * Record a transient error (rate_limit, overloaded) for a profile.
	 * This puts the profile in cooldown and rotates to the next available profile.
	 *
	 * @returns The cooldown duration in ms, or null if no rotation occurred
	 */
	recordTransientError(provider: string, profileId: string): number | null {
		const profiles = this.profiles.get(provider) || [];
		const profile = profiles.find((p) => p.id === profileId);

		if (!profile) {
			return null;
		}

		// Increment transient errors and set cooldown
		profile.transientErrors++;
		profile.lastErrorAt = this.nowFunc();
		const cooldownDuration = this.getCooldownDuration(profile.transientErrors);
		profile.cooldownUntil = this.nowFunc() + cooldownDuration;

		// Rotate to next available profile
		const rotated = this.rotate(provider);

		return rotated !== null ? cooldownDuration : null;
	}

	/**
	 * Record a permanent auth error (invalid API key, unauthorized).
	 * This deactivates the profile permanently (until manually reactivated).
	 */
	recordAuthError(provider: string, profileId: string): void {
		const profiles = this.profiles.get(provider) || [];
		const profile = profiles.find((p) => p.id === profileId);

		if (!profile) {
			return;
		}

		// Mark as inactive (permanent failure)
		profile.isActive = false;
		profile.transientErrors = 0;
		profile.cooldownUntil = undefined;

		// If this was the active profile, rotate to next
		if (this.activeProfileId.get(provider) === profileId) {
			this.rotateToNextAvailable(provider);
		}
	}

	/**
	 * Record success for a profile.
	 * Resets transient error count and clears cooldown.
	 */
	recordSuccess(provider: string, profileId: string): void {
		const profiles = this.profiles.get(provider) || [];
		const profile = profiles.find((p) => p.id === profileId);

		if (!profile) {
			return;
		}

		profile.transientErrors = 0;
		profile.cooldownUntil = undefined;
		profile.lastErrorAt = undefined;
	}

	/**
	 * Deactivate a profile (e.g., when manually disabled).
	 */
	deactivateProfile(provider: string, profileId: string): void {
		const profiles = this.profiles.get(provider) || [];
		const profile = profiles.find((p) => p.id === profileId);

		if (!profile) {
			return;
		}

		profile.isActive = false;

		// If this was the active profile, rotate to next
		if (this.activeProfileId.get(provider) === profileId) {
			this.rotateToNextAvailable(provider);
		}
	}

	/**
	 * Activate a profile (e.g., after being manually re-enabled).
	 */
	activateProfile(provider: string, profileId: string): void {
		const profiles = this.profiles.get(provider) || [];
		const profile = profiles.find((p) => p.id === profileId);

		if (!profile) {
			return;
		}

		// Deactivate all other profiles first
		for (const p of profiles) {
			p.isActive = false;
		}

		// Activate this one
		profile.isActive = true;
		profile.transientErrors = 0;
		profile.cooldownUntil = undefined;
		this.activeProfileId.set(provider, profile.id);
	}

	/**
	 * Rotate to the next available profile (not in cooldown).
	 * Returns the new active profile, or null if no profiles are available.
	 *
	 * This method checks if the current profile is in cooldown. If it is, it rotates
	 * to the next available profile. If not, it returns the current profile.
	 */
	rotate(provider: string): AuthProfile | null {
		const profiles = this.profiles.get(provider) || [];
		const now = this.nowFunc();

		// Find profiles not in cooldown (being "active" doesn't help if in cooldown)
		const available = profiles.filter((p) => !p.cooldownUntil || p.cooldownUntil <= now);

		if (available.length === 0) {
			return null;
		}

		// If current active profile is not in cooldown, don't rotate
		const currentActiveId = this.activeProfileId.get(provider);
		const currentActive = profiles.find((p) => p.id === currentActiveId);

		if (currentActive && (!currentActive.cooldownUntil || currentActive.cooldownUntil <= now)) {
			return currentActive;
		}

		// Deactivate current if it exists
		if (currentActive) {
			currentActive.isActive = false;
		}

		// Pick first available profile
		const next = available[0];
		if (!next) {
			return null;
		}
		next.isActive = true;
		this.activeProfileId.set(provider, next.id);

		return next;
	}

	/**
	 * Force rotate to the next available profile, regardless of current profile's state.
	 * Used when explicitly deactivating or removing the current profile.
	 *
	 * Returns the new active profile, or null if no profiles are available.
	 */
	private rotateToNextAvailable(provider: string): AuthProfile | null {
		const profiles = this.profiles.get(provider) || [];
		const now = this.nowFunc();

		// Find profiles not in cooldown AND not the one we just deactivated
		const currentActiveId = this.activeProfileId.get(provider);

		const available = profiles.filter(
			(p) => p.id !== currentActiveId && (!p.cooldownUntil || p.cooldownUntil <= now)
		);

		if (available.length === 0) {
			return null;
		}

		// Deactivate current
		const currentActive = profiles.find((p) => p.id === currentActiveId);
		if (currentActive) {
			currentActive.isActive = false;
		}

		// Pick first available profile
		const next = available[0];
		if (!next) {
			return null;
		}
		next.isActive = true;
		this.activeProfileId.set(provider, next.id);

		return next;
	}

	/**
	 * Probe if a profile has recovered (async check).
	 * Default implementation just checks if cooldown has expired.
	 * Can be overridden to make actual API calls to verify recovery.
	 *
	 * @param provider The provider name
	 * @param profileId The profile ID to probe
	 * @returns True if the profile has recovered and can be used
	 */
	async probe(provider: string, profileId: string): Promise<boolean> {
		const profile = this.profiles.get(provider)?.find((p) => p.id === profileId);

		if (!profile) {
			return false;
		}

		// Check if cooldown has expired
		if (profile.cooldownUntil && profile.cooldownUntil > this.nowFunc()) {
			return false;
		}

		return true;
	}

	/**
	 * Probe all profiles for a provider and activate any that have recovered.
	 * Useful for periodic recovery checks.
	 *
	 * @returns Array of profiles that were activated
	 */
	async probeAndRecover(provider: string): Promise<AuthProfile[]> {
		const profiles = this.profiles.get(provider) || [];
		const recovered: AuthProfile[] = [];

		for (const profile of profiles) {
			if (!profile.isActive && profile.cooldownUntil && profile.cooldownUntil <= this.nowFunc()) {
				// Check if we can actually recover (e.g., not permanently deactivated)
				const isRecovered = await this.probe(provider, profile.id);

				if (isRecovered) {
					this.activateProfile(provider, profile.id);
					recovered.push(profile);
				}
			}
		}

		return recovered;
	}

	/**
	 * Get the current cooldown duration based on transient error count.
	 * Uses exponential backoff: 5s, 10s, 20s, 40s, max 60s.
	 */
	private getCooldownDuration(transientErrors: number): number {
		const base = 5_000; // 5 seconds
		const max = 60_000; // 60 seconds cap

		if (transientErrors <= 0) {
			return base;
		}

		const duration = base * Math.pow(2, transientErrors - 1);
		return Math.min(duration, max);
	}

	/**
	 * Check if a profile is in cooldown.
	 */
	isInCooldown(provider: string, profileId: string): boolean {
		const profile = this.profiles.get(provider)?.find((p) => p.id === profileId);

		if (!profile) {
			return false;
		}

		if (!profile.cooldownUntil) {
			return false;
		}

		return profile.cooldownUntil > this.nowFunc();
	}

	/**
	 * Get remaining cooldown time for a profile.
	 */
	getRemainingCooldown(provider: string, profileId: string): number {
		const profile = this.profiles.get(provider)?.find((p) => p.id === profileId);

		if (!profile || !profile.cooldownUntil) {
			return 0;
		}

		const remaining = profile.cooldownUntil - this.nowFunc();
		return remaining > 0 ? remaining : 0;
	}

	/**
	 * Get all providers being managed.
	 */
	getProviders(): string[] {
		return Array.from(this.profiles.keys());
	}

	/**
	 * Clear all profiles (for testing).
	 */
	clear(): void {
		this.profiles.clear();
		this.activeProfileId.clear();
	}

	/**
	 * Get a deep copy of all profiles (for debugging/monitoring).
	 */
	getAllProfiles(): Map<string, AuthProfile[]> {
		const result = new Map<string, AuthProfile[]>();

		for (const [provider, profiles] of this.profiles.entries()) {
			result.set(
				provider,
				profiles.map((p) => ({
					...p,
					cooldownUntil: p.cooldownUntil,
					lastErrorAt: p.lastErrorAt
				}))
			);
		}

		return result;
	}
}

// =============================================================================
// Integration Helper
// =============================================================================

/**
 * Create an auth profile manager from a map of provider to API keys.
 * Convenience function for setting up multiple keys.
 *
 * @example
 * const manager = createAuthProfileManager({
 *   openai: ['key-1', 'key-2', 'key-3'],
 *   anthropic: ['key-anthropic']
 * });
 */
export function createAuthProfileManager(
	providerKeys: Record<string, string[]>,
	config?: AuthProfileManagerConfig
): AuthProfileManager {
	const manager = new AuthProfileManager(config);

	for (const [provider, keys] of Object.entries(providerKeys)) {
		for (let i = 0; i < keys.length; i++) {
			const apiKey = keys[i];
			if (apiKey) {
				manager.addProfile(provider, {
					id: `${provider}-${i + 1}`,
					apiKey
				});
			}
		}
	}

	return manager;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format remaining cooldown time in milliseconds to human-readable string.
 */
export function formatProfileCooldown(ms: number): string {
	if (ms <= 0) return '0s';

	const seconds = Math.floor(ms / 1000);

	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (minutes < 60) {
		return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
}

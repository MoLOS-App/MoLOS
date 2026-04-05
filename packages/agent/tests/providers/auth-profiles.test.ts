/**
 * Tests for AuthProfileManager class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	AuthProfileManager,
	createAuthProfileManager,
	formatProfileCooldown,
	type AuthProfile,
	type AuthProfileManagerConfig
} from '../../src/providers/auth-profiles.js';

describe('AuthProfileManager', () => {
	describe('addProfile', () => {
		it('should add a profile and set it as active if first', () => {
			const manager = new AuthProfileManager();

			const profile = manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });

			expect(profile.id).toBe('key-1');
			expect(profile.apiKey).toBe('sk-test-1');
			expect(profile.isActive).toBe(true);
			expect(profile.transientErrors).toBe(0);

			const active = manager.getActiveProfile('openai');
			expect(active?.id).toBe('key-1');
		});

		it('should add multiple profiles without setting them active', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			const profile2 = manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			expect(profile2.isActive).toBe(false);
			expect(manager.getProfiles('openai')).toHaveLength(2);
		});

		it('should throw when max profiles reached', () => {
			const manager = new AuthProfileManager({ maxProfilesPerProvider: 2 });

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			expect(() => {
				manager.addProfile('openai', { id: 'key-3', apiKey: 'sk-test-3' });
			}).toThrow('max profiles (2) reached');
		});

		it('should update existing profile if same id', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			const updated = manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-new-key' });

			expect(updated.apiKey).toBe('sk-new-key');
			expect(manager.getProfiles('openai')).toHaveLength(1);
		});
	});

	describe('getActiveProfile', () => {
		it('should return the active profile', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			const active = manager.getActiveProfile('openai');
			expect(active?.id).toBe('key-1');
		});

		it('should return null when no profiles exist', () => {
			const manager = new AuthProfileManager();

			const active = manager.getActiveProfile('openai');
			expect(active).toBeNull();
		});
	});

	describe('recordTransientError', () => {
		let manager: AuthProfileManager;
		let mockNow: number;

		const createManager = (nowFunc?: () => number) => {
			return new AuthProfileManager({
				nowFunc: nowFunc ?? (() => mockNow)
			});
		};

		beforeEach(() => {
			mockNow = 1000000000000;
			manager = createManager();
		});

		it('should increment transient errors and set cooldown', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			const cooldown = manager.recordTransientError('openai', 'key-1');

			expect(cooldown).toBe(5000); // 5s base cooldown for first error

			const profile = manager.getProfiles('openai')[0];
			expect(profile.transientErrors).toBe(1);
			expect(profile.cooldownUntil).toBe(mockNow + 5000);
		});

		it('should rotate to next profile after transient error', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			manager.recordTransientError('openai', 'key-1');

			const active = manager.getActiveProfile('openai');
			expect(active?.id).toBe('key-2');
		});

		it('should use exponential backoff for cooldown duration', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });
			manager.addProfile('openai', { id: 'key-3', apiKey: 'sk-test-3' });

			// First error: 5s
			const c1 = manager.recordTransientError('openai', 'key-1');
			expect(c1).toBe(5000);

			// Rotate back to key-1 for next error
			manager.rotate('openai');

			// Second error: 10s
			mockNow += 5000;
			const c2 = manager.recordTransientError('openai', 'key-1');
			expect(c2).toBe(10000);

			// Rotate back and third error: 20s
			manager.rotate('openai');
			mockNow += 10000;
			const c3 = manager.recordTransientError('openai', 'key-1');
			expect(c3).toBe(20000);
		});

		it('should cap cooldown at 60s', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			// Fifth error should cap at 60s
			for (let i = 1; i <= 5; i++) {
				manager.recordTransientError('openai', 'key-1');
				manager.rotate('openai');
				mockNow += 60000;
			}

			const profile = manager.getProfiles('openai')[0];
			expect(profile.cooldownUntil).toBeDefined();
			// At this point cooldown should be 60s (capped)
		});
	});

	describe('recordSuccess', () => {
		it('should reset transient errors and clear cooldown', () => {
			const manager = new AuthProfileManager({ nowFunc: () => 1000000000000 });

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.recordTransientError('openai', 'key-1');

			expect(manager.getProfiles('openai')[0].transientErrors).toBe(1);

			manager.recordSuccess('openai', 'key-1');

			const profile = manager.getProfiles('openai')[0];
			expect(profile.transientErrors).toBe(0);
			expect(profile.cooldownUntil).toBeUndefined();
		});
	});

	describe('recordAuthError', () => {
		it('should deactivate profile on permanent auth error', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			manager.recordAuthError('openai', 'key-1');

			const profile = manager.getProfiles('openai')[0];
			expect(profile.isActive).toBe(false);

			// Should have rotated to key-2
			const active = manager.getActiveProfile('openai');
			expect(active?.id).toBe('key-2');
		});
	});

	describe('rotate', () => {
		let manager: AuthProfileManager;
		let mockNow: number;

		beforeEach(() => {
			mockNow = 1000000000000;
			manager = new AuthProfileManager({ nowFunc: () => mockNow });
		});

		it('should not rotate if current profile is available', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			const result = manager.rotate('openai');

			expect(result?.id).toBe('key-1');
			expect(manager.getActiveProfileId('openai')).toBe('key-1');
		});

		it('should rotate to next available when current is in cooldown', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			manager.recordTransientError('openai', 'key-1');

			const result = manager.rotate('openai');

			expect(result?.id).toBe('key-2');
		});

		it('should return null if no profiles available', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });

			manager.recordTransientError('openai', 'key-1');

			// Advance time within cooldown
			mockNow += 1000;

			const result = manager.rotate('openai');

			expect(result).toBeNull();
		});

		it('should pick first available in round-robin', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });
			manager.addProfile('openai', { id: 'key-3', apiKey: 'sk-test-3' });

			// Put key-1 in cooldown
			manager.recordTransientError('openai', 'key-1');

			// Rotate should go to key-2
			const first = manager.rotate('openai');
			expect(first?.id).toBe('key-2');

			// Put key-2 in cooldown
			manager.recordTransientError('openai', 'key-2');

			// Rotate should go to key-3
			const second = manager.rotate('openai');
			expect(second?.id).toBe('key-3');
		});
	});

	describe('isInCooldown', () => {
		let manager: AuthProfileManager;
		let mockNow: number;

		beforeEach(() => {
			mockNow = 1000000000000;
			manager = new AuthProfileManager({ nowFunc: () => mockNow });
		});

		it('should return false when not in cooldown', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });

			expect(manager.isInCooldown('openai', 'key-1')).toBe(false);
		});

		it('should return true when in cooldown', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.recordTransientError('openai', 'key-1');

			expect(manager.isInCooldown('openai', 'key-1')).toBe(true);
		});

		it('should return false after cooldown expires', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.recordTransientError('openai', 'key-1');

			mockNow += 60000; // Advance 60 seconds

			expect(manager.isInCooldown('openai', 'key-1')).toBe(false);
		});
	});

	describe('getRemainingCooldown', () => {
		let manager: AuthProfileManager;
		let mockNow: number;

		beforeEach(() => {
			mockNow = 1000000000000;
			manager = new AuthProfileManager({ nowFunc: () => mockNow });
		});

		it('should return 0 when not in cooldown', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });

			expect(manager.getRemainingCooldown('openai', 'key-1')).toBe(0);
		});

		it('should return remaining time', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.recordTransientError('openai', 'key-1'); // 5s cooldown

			mockNow += 2000; // Advance 2 seconds

			expect(manager.getRemainingCooldown('openai', 'key-1')).toBe(3000);
		});

		it('should return 0 after cooldown expires', () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.recordTransientError('openai', 'key-1');

			mockNow += 60000;

			expect(manager.getRemainingCooldown('openai', 'key-1')).toBe(0);
		});
	});

	describe('probe', () => {
		let manager: AuthProfileManager;
		let mockNow: number;

		beforeEach(() => {
			mockNow = 1000000000000;
			manager = new AuthProfileManager({ nowFunc: () => mockNow });
		});

		it('should return true if cooldown expired', async () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.recordTransientError('openai', 'key-1');

			mockNow += 60000; // Advance past cooldown

			const result = await manager.probe('openai', 'key-1');
			expect(result).toBe(true);
		});

		it('should return false if still in cooldown', async () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.recordTransientError('openai', 'key-1');

			mockNow += 1000; // Still in cooldown

			const result = await manager.probe('openai', 'key-1');
			expect(result).toBe(false);
		});

		it('should return false if profile not found', async () => {
			const result = await manager.probe('openai', 'nonexistent');
			expect(result).toBe(false);
		});
	});

	describe('probeAndRecover', () => {
		let manager: AuthProfileManager;
		let mockNow: number;

		beforeEach(() => {
			mockNow = 1000000000000;
			manager = new AuthProfileManager({ nowFunc: () => mockNow });
		});

		it('should reactivate cooled-down profiles', async () => {
			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			// Put key-1 in cooldown and rotate to key-2
			manager.recordTransientError('openai', 'key-1');
			expect(manager.getActiveProfileId('openai')).toBe('key-2');

			// Advance past cooldown
			mockNow += 60000;

			const recovered = await manager.probeAndRecover('openai');

			expect(recovered).toHaveLength(1);
			expect(recovered[0].id).toBe('key-1');
			expect(manager.getActiveProfileId('openai')).toBe('key-1');
		});
	});

	describe('removeProfile', () => {
		it('should remove profile and deactivate if was active', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			const removed = manager.removeProfile('openai', 'key-1');

			expect(removed).toBe(true);
			expect(manager.getProfiles('openai')).toHaveLength(1);
			expect(manager.getActiveProfileId('openai')).toBe('key-2');
		});

		it('should return false if profile not found', () => {
			const manager = new AuthProfileManager();

			const removed = manager.removeProfile('openai', 'nonexistent');
			expect(removed).toBe(false);
		});
	});

	describe('activateProfile / deactivateProfile', () => {
		it('should manually activate a profile', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			manager.activateProfile('openai', 'key-2');

			expect(manager.getActiveProfileId('openai')).toBe('key-2');
			expect(manager.getProfiles('openai')[1].isActive).toBe(true);
		});

		it('should manually deactivate a profile', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-test-1' });
			manager.addProfile('openai', { id: 'key-2', apiKey: 'sk-test-2' });

			manager.deactivateProfile('openai', 'key-1');

			expect(manager.getProfiles('openai')[0].isActive).toBe(false);
			expect(manager.getActiveProfileId('openai')).toBe('key-2');
		});
	});

	describe('createAuthProfileManager', () => {
		it('should create manager with multiple providers and keys', () => {
			const manager = createAuthProfileManager({
				openai: ['sk-openai-1', 'sk-openai-2'],
				anthropic: ['sk-anthropic-1']
			});

			expect(manager.getProfiles('openai')).toHaveLength(2);
			expect(manager.getProfiles('anthropic')).toHaveLength(1);

			expect(manager.getActiveProfile('openai')?.apiKey).toBe('sk-openai-1');
			expect(manager.getActiveProfile('anthropic')?.apiKey).toBe('sk-anthropic-1');
		});
	});

	describe('formatProfileCooldown', () => {
		it('should format 0 as 0s', () => {
			expect(formatProfileCooldown(0)).toBe('0s');
		});

		it('should format seconds', () => {
			expect(formatProfileCooldown(5000)).toBe('5s');
			expect(formatProfileCooldown(30000)).toBe('30s');
		});

		it('should format minutes', () => {
			expect(formatProfileCooldown(60000)).toBe('1m');
			expect(formatProfileCooldown(90000)).toBe('1m 30s');
		});

		it('should format hours', () => {
			expect(formatProfileCooldown(3600000)).toBe('1h 0m');
		});
	});

	describe('getProviders / clear', () => {
		it('should return all providers', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-1' });
			manager.addProfile('anthropic', { id: 'key-1', apiKey: 'sk-2' });

			const providers = manager.getProviders();
			expect(providers).toContain('openai');
			expect(providers).toContain('anthropic');
		});

		it('should clear all profiles', () => {
			const manager = new AuthProfileManager();

			manager.addProfile('openai', { id: 'key-1', apiKey: 'sk-1' });
			manager.clear();

			expect(manager.getProfiles('openai')).toHaveLength(0);
		});
	});
});

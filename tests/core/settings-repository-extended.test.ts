/**
 * Extended Tests for SettingsRepository
 *
 * Comprehensive tests covering edge cases, error handling, and concurrent access
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsRepository } from '../../src/lib/repositories/settings/settings-repository';
import { createTestDb, UserFactory, SettingsFactory } from '../utils/test-helpers';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { user } from '../../src/lib/server/db/schema';

describe('SettingsRepository - Extended Tests', () => {
	let db: BetterSQLite3Database<Record<string, unknown>>;
	let repository: SettingsRepository;
	let testUser1: any;
	let testUser2: any;

	beforeEach(async () => {
		db = await createTestDb();
		repository = new SettingsRepository(db);

		// Create test users
		testUser1 = UserFactory.build({ id: 'user-1', email: 'user1@test.com' });
		testUser2 = UserFactory.build({ id: 'user-2', email: 'user2@test.com' });

		await db.insert(user).values([testUser1, testUser2]);
	});

	describe('Theme Settings', () => {
		it('should update theme to valid values', async () => {
			const themes = ['light', 'dark', 'system'];

			for (const theme of themes) {
				const result = await repository.updateTheme(testUser1.id, theme as any);
				expect(result[0].theme).toBe(theme);
			}
		});

		it('should get default settings when none exist', async () => {
			const settings = await repository.getUserSettings(testUser1.id);
			// Should return null or default settings
			expect(settings).toBeDefined();
		});

		it('should maintain user isolation in theme settings', async () => {
			await repository.updateTheme(testUser1.id, 'dark');
			await repository.updateTheme(testUser2.id, 'light');

			const settings1 = await repository.getUserSettings(testUser1.id);
			const settings2 = await repository.getUserSettings(testUser2.id);

			expect(settings1?.theme).toBe('dark');
			expect(settings2?.theme).toBe('light');
		});

		it('should handle rapid theme updates', async () => {
			// Simulate rapid toggling
			for (let i = 0; i < 10; i++) {
				await repository.updateTheme(testUser1.id, i % 2 === 0 ? 'dark' : 'light');
			}

			const settings = await repository.getUserSettings(testUser1.id);
			expect(settings?.theme).toBe('light'); // Last update
		});
	});

	describe('Module State Management', () => {
		it('should handle multiple module states for single user', async () => {
			const modules = ['tasks', 'health', 'finance'];

			for (const moduleId of modules) {
				await repository.updateModuleState(testUser1.id, {
					moduleId,
					submoduleId: 'main',
					enabled: true,
					menuOrder: modules.indexOf(moduleId)
				});
			}

			const states = await repository.getModuleStates(testUser1.id);
			expect(states.length).toBe(3);
			expect(states.map((s: any) => s.moduleId).sort()).toEqual(modules.sort());
		});

		it('should update existing module state', async () => {
			await repository.updateModuleState(testUser1.id, {
				moduleId: 'tasks',
				submoduleId: 'main',
				enabled: true,
				menuOrder: 1
			});

			// Update the same module
			await repository.updateModuleState(testUser1.id, {
				moduleId: 'tasks',
				submoduleId: 'main',
				enabled: false,
				menuOrder: 2
			});

			const states = await repository.getModuleStates(testUser1.id);
			expect(states.length).toBe(1);
			expect(states[0].enabled).toBe(false);
			expect(states[0].menuOrder).toBe(2);
		});

		it('should maintain module state isolation between users', async () => {
			await repository.updateModuleState(testUser1.id, {
				moduleId: 'tasks',
				submoduleId: 'main',
				enabled: true
			});

			await repository.updateModuleState(testUser2.id, {
				moduleId: 'tasks',
				submoduleId: 'main',
				enabled: false
			});

			const states1 = await repository.getModuleStates(testUser1.id);
			const states2 = await repository.getModuleStates(testUser2.id);

			expect(states1[0].enabled).toBe(true);
			expect(states2[0].enabled).toBe(false);
		});

		it('should handle multiple submodules per module', async () => {
			await repository.updateModuleState(testUser1.id, {
				moduleId: 'health',
				submoduleId: 'dashboard',
				enabled: true,
				menuOrder: 1
			});

			await repository.updateModuleState(testUser1.id, {
				moduleId: 'health',
				submoduleId: 'profile',
				enabled: false,
				menuOrder: 2
			});

			const states = await repository.getModuleStates(testUser1.id);
			expect(states.length).toBe(2);
		});
	});

	describe('System Settings', () => {
		it('should create and retrieve system settings', async () => {
			await repository.updateSystemSetting('test_key', 'test_value', 'Test description');

			const value = await repository.getSystemSetting('test_key');
			expect(value).toBe('test_value');
		});

		it('should update existing system settings', async () => {
			await repository.updateSystemSetting('test_key', 'value1');
			await repository.updateSystemSetting('test_key', 'value2');

			const value = await repository.getSystemSetting('test_key');
			expect(value).toBe('value2');
		});

		it('should return null for non-existent settings', async () => {
			const value = await repository.getSystemSetting('nonexistent_key');
			expect(value).toBeNull();
		});

		it('should handle complex setting values', async () => {
			const complexValue = JSON.stringify({ nested: { object: true } });
			await repository.updateSystemSetting('complex_setting', complexValue);

			const value = await repository.getSystemSetting('complex_setting');
			expect(value).toBe(complexValue);
			expect(JSON.parse(value!)).toEqual({ nested: { object: true } });
		});

		it('should handle multiple system settings', async () => {
			const settings = [
				{ key: 'setting1', value: 'value1' },
				{ key: 'setting2', value: 'value2' },
				{ key: 'setting3', value: 'value3' }
			];

			for (const setting of settings) {
				await repository.updateSystemSetting(setting.key, setting.value);
			}

			for (const setting of settings) {
				const value = await repository.getSystemSetting(setting.key);
				expect(value).toBe(setting.value);
			}
		});
	});

	describe('Error Handling', () => {
		it('should handle invalid user ID gracefully', async () => {
			// These should not throw
			await expect(repository.getUserSettings('nonexistent-user')).resolves.toBeDefined();
			await expect(repository.getModuleStates('nonexistent-user')).resolves.toBeDefined();
		});

		it('should handle empty module states', async () => {
			const states = await repository.getModuleStates(testUser1.id);
			expect(states).toEqual([]);
		});
	});

	describe('Performance', () => {
		it('should handle large number of module states efficiently', async () => {
			const moduleCount = 50;

			const startTime = Date.now();

			for (let i = 0; i < moduleCount; i++) {
				await repository.updateModuleState(testUser1.id, {
					moduleId: `module-${i}`,
					submoduleId: 'main',
					enabled: i % 2 === 0,
					menuOrder: i
				});
			}

			const duration = Date.now() - startTime;

			// Should complete in reasonable time (< 5 seconds)
			expect(duration).toBeLessThan(5000);

			const states = await repository.getModuleStates(testUser1.id);
			expect(states.length).toBe(moduleCount);
		});
	});
});

describe('SettingsRepository - Concurrent Access', () => {
	let db: BetterSQLite3Database<Record<string, unknown>>;
	let repository: SettingsRepository;
	let testUser: any;

	beforeEach(async () => {
		db = await createTestDb();
		repository = new SettingsRepository(db);
		testUser = UserFactory.build();
		await db.insert(user).values([testUser]);
	});

	it('should handle concurrent theme updates', async () => {
		const updates = Array.from({ length: 5 }, (_, i) =>
			repository.updateTheme(testUser.id, i % 2 === 0 ? 'dark' : 'light')
		);

		await Promise.all(updates);

		// Should have completed without errors
		const settings = await repository.getUserSettings(testUser.id);
		expect(settings).toBeDefined();
	});

	it('should handle concurrent module state updates', async () => {
		const updates = Array.from({ length: 10 }, (_, i) =>
			repository.updateModuleState(testUser.id, {
				moduleId: `module-${i}`,
				submoduleId: 'main',
				enabled: true
			})
		);

		await Promise.all(updates);

		const states = await repository.getModuleStates(testUser.id);
		expect(states.length).toBe(10);
	});
});

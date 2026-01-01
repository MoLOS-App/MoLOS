import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsRepository } from './settings-repository';
import { createTestDb } from '$lib/test-utils';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { user } from '$lib/server/db/schema';

describe('SettingsRepository', () => {
	let db: BetterSQLite3Database<Record<string, unknown>>;
	let repository: SettingsRepository;
	const userId = 'test-user-1';

	beforeEach(async () => {
		db = (await createTestDb()) as unknown as BetterSQLite3Database<Record<string, unknown>>;
		repository = new SettingsRepository(db);
		// Insert test users
		await db.insert(user).values([{ id: userId, name: 'Test User 1', email: 'test1@example.com' }]);
	});

	it('should update theme for a user', async () => {
		const result = await repository.updateTheme(userId, 'dark');
		expect(result[0].userId).toBe(userId);
		expect(result[0].theme).toBe('dark');
	});

	it('should get user settings', async () => {
		await repository.updateTheme(userId, 'light');
		const settings = await repository.getUserSettings(userId);
		expect(settings).not.toBeNull();
		expect(settings?.theme).toBe('light');
	});

	it('should update module state', async () => {
		const state = {
			moduleId: 'health',
			submoduleId: 'main',
			enabled: true,
			menuOrder: 1
		};

		const result = await repository.updateModuleState(userId, state);
		expect(result[0].moduleId).toBe('health');
		expect(result[0].enabled).toBe(true);
	});

	it('should get module states', async () => {
		await repository.updateModuleState(userId, {
			moduleId: 'tasks',
			submoduleId: 'main',
			enabled: true
		});

		const states = await repository.getModuleStates(userId);
		expect(states.length).toBe(1);
		expect(states[0].moduleId).toBe('tasks');
	});

	it('should update system setting', async () => {
		const result = await repository.updateSystemSetting('test_key', 'test_value', 'Test setting');
		expect(result[0].key).toBe('test_key');
		expect(result[0].value).toBe('test_value');
	});

	it('should get system setting', async () => {
		await repository.updateSystemSetting('test_key', 'test_value');
		const value = await repository.getSystemSetting('test_key');
		expect(value).toBe('test_value');
	});
});

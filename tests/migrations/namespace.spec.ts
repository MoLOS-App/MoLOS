import { describe, it, expect } from 'vitest';

describe('Table Namespacing', () => {
	it('should generate correct table names with namespaceTableName', async () => {
		const { namespaceTableName } = await import('@molos/database/utils');

		expect(namespaceTableName('MoLOS-Tasks', 'tasks')).toBe('MoLOS-Tasks_tasks');
		expect(namespaceTableName('MoLOS-Goals', 'tracker')).toBe('MoLOS-Goals_tracker');
		expect(namespaceTableName('MoLOS-AI-Knowledge', 'prompts')).toBe('MoLOS-AI-Knowledge_prompts');
	});

	it('should identify tables that should be namespaced', async () => {
		const { shouldNamespace, RESERVED_TABLE_NAMES } = await import('@molos/database/utils');

		// Core tables should NOT be namespaced
		expect(shouldNamespace('user')).toBe(false);
		expect(shouldNamespace('session')).toBe(false);
		expect(shouldNamespace('ai_messages')).toBe(false);

		// Module tables SHOULD be namespaced
		expect(shouldNamespace('tasks')).toBe(true);
		expect(shouldNamespace('goals')).toBe(true);
		expect(shouldNamespace('expenses')).toBe(true);
	});

	it('should have correct reserved table names', async () => {
		const { RESERVED_TABLE_NAMES } = await import('@molos/database/utils');

		expect(RESERVED_TABLE_NAMES).toContain('user');
		expect(RESERVED_TABLE_NAMES).toContain('session');
		expect(RESERVED_TABLE_NAMES).toContain('ai_messages');
		expect(RESERVED_TABLE_NAMES).toContain('settings_external_modules');
	});
});

describe('Text Enum Utility', () => {
	it('should create text enum columns', async () => {
		const { textEnum } = await import('@molos/database/utils');
		const { sqliteTable, text } = await import('drizzle-orm/sqlite-core');

		const TestStatus = {
			ACTIVE: 'active',
			INACTIVE: 'inactive',
			PENDING: 'pending'
		} as const;

		const table = sqliteTable('test_enum_table', {
			id: text('id').primaryKey(),
			status: textEnum('status', TestStatus).notNull().default(TestStatus.PENDING)
		});

		// Verify the table definition exists
		expect(table).toBeDefined();
		expect(table.status).toBeDefined();
	});
});

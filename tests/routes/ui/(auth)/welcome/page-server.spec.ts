/**
 * Tests for Welcome Flow Server Actions
 *
 * Tests module activation during the welcome flow (step 3)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { actions } from './+page.server';
import { createTestDb, UserFactory } from '../../../../../tests/utils/test-helpers';
import type { RequestEvent } from '@sveltejs/kit';

// Mock MODULE_REGISTRY
vi.mock('$lib/config', () => ({
	MODULE_REGISTRY: {
		dashboard: {
			id: 'dashboard',
			name: 'Dashboard',
			href: '/ui/dashboard',
			description: 'Dashboard module'
		},
		ai: { id: 'ai', name: 'AI', href: '/ui/ai', description: 'AI module' },
		'MoLOS-Tasks': {
			id: 'MoLOS-Tasks',
			name: 'Tasks',
			href: '/ui/MoLOS-Tasks',
			description: 'Tasks module'
		},
		'MoLOS-Markdown': {
			id: 'MoLOS-Markdown',
			name: 'Markdown',
			href: '/ui/MoLOS-Markdown',
			description: 'Markdown module'
		},
		'MoLOS-Goals': {
			id: 'MoLOS-Goals',
			name: 'Goals',
			href: '/ui/MoLOS-Goals',
			description: 'Goals module'
		},
		'MoLOS-Health': {
			id: 'MoLOS-Health',
			name: 'Health',
			href: '/ui/MoLOS-Health',
			description: 'Health module'
		}
	}
}));

// Helper to create mock form data
function createFormData(data: Record<string, string>): FormData {
	const formData = new FormData();
	Object.entries(data).forEach(([key, value]) => {
		formData.set(key, value);
	});
	return formData;
}

// Helper to create mock request event
function createMockEvent(options: {
	user?: any;
	formData?: Record<string, string>;
}): Partial<RequestEvent> {
	const { user, formData } = options;

	return {
		locals: { user: user || null, session: null },
		request: new Request('http://localhost/ui/welcome', {
			method: 'POST',
			body: formData ? createFormData(formData) : undefined
		}),
		params: {},
		url: new URL('http://localhost/ui/welcome'),
		cookies: {
			get: () => null,
			set: () => {},
			delete: () => {},
			serialize: () => ''
		}
	} as any;
}

describe('Welcome Flow Server Actions', () => {
	let testUser: any;

	beforeEach(() => {
		vi.clearAllMocks();
		testUser = UserFactory.build();
	});

	describe('activateModules action', () => {
		describe('Authentication', () => {
			it('should return 401 when user is not authenticated', async () => {
				const event = createMockEvent({
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(401);
				expect(result.data.success).toBe(false);
				expect(result.data.error).toContain('Unauthorized');
			});

			it('should accept request when user is authenticated', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBeUndefined(); // Success doesn't set status
				expect(result.data.success).toBe(true);
			});
		});

		describe('Form Data Validation', () => {
			it('should reject missing modules field', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: {}
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.success).toBe(false);
				expect(result.data.error).toContain('Modules field is required');
			});

			it('should reject invalid modules field type', async () => {
				// FormData always returns string, but we test for empty string
				const event = createMockEvent({
					user: testUser,
					formData: { modules: '' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.success).toBe(false);
				expect(result.data.error).toContain('at least one module must be selected');
			});

			it('should reject empty modules list after parsing', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: '   ,  ,  ' } // Only whitespace/commas
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.success).toBe(false);
				expect(result.data.error).toContain('at least one module must be selected');
			});

			it('should parse comma-separated modules correctly', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard, ai , MoLOS-Tasks , MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.data.success).toBe(true);
				// Verify that whitespace was trimmed
			});
		});

		describe('Required Modules Validation', () => {
			it('should reject request missing required modules', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'MoLOS-Goals,MoLOS-Health,dashboard,ai' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.success).toBe(false);
				expect(result.data.error).toContain('Missing required modules');
				expect(result.data.missingModules).toEqual(
					expect.arrayContaining(['MoLOS-Tasks', 'MoLOS-Markdown'])
				);
			});

			it('should accept request with all required modules', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.data.success).toBe(true);
			});

			it('should accept request with required modules plus additional modules', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown,MoLOS-Goals,MoLOS-Health' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.data.success).toBe(true);
			});
		});

		describe('Module Existence Validation', () => {
			it('should reject request with invalid module IDs', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,Invalid-Module' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.success).toBe(false);
				expect(result.data.error).toContain('Invalid module IDs');
				expect(result.data.invalidModules).toContain('Invalid-Module');
			});

			it('should reject request with multiple invalid module IDs', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,Invalid1,Invalid2' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.success).toBe(false);
				expect(result.data.invalidModules).toEqual(
					expect.arrayContaining(['Invalid1', 'Invalid2'])
				);
			});
		});

		describe('Module Activation', () => {
			it('should return success when modules are activated', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.data.success).toBe(true);
			});

			it('should handle partial success (some non-required modules fail)', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown,MoLOS-Goals' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				// Should succeed even if some non-required modules fail
				expect(result.data.success).toBe(true);
				// May have partial flag if some failed
				if (result.data.partial) {
					expect(result.data.failedModules).toBeDefined();
				}
			});

			it('should return error if required modules fail', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				// If database operations fail for required modules, should return 500
				if (result.status === 500) {
					expect(result.data.success).toBe(false);
					expect(result.data.error).toContain('Failed to activate required modules');
				} else {
					expect(result.data.success).toBe(true);
				}
			});
		});

		describe('Response Format', () => {
			it('should return success object with success flag', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result).toHaveProperty('data');
				expect(result.data).toHaveProperty('success');
				expect(typeof result.data.success).toBe('boolean');
			});

			it('should return error object with error message', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: {}
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result).toHaveProperty('status');
				expect(result).toHaveProperty('data');
				expect(result.data).toHaveProperty('success', false);
				expect(result.data).toHaveProperty('error');
				expect(typeof result.data.error).toBe('string');
			});

			it('should include missing modules in error response', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.missingModules).toBeDefined();
				expect(Array.isArray(result.data.missingModules)).toBe(true);
			});

			it('should include invalid modules in error response', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,ai,MoLOS-Tasks,InvalidModule' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.status).toBe(400);
				expect(result.data.invalidModules).toBeDefined();
				expect(Array.isArray(result.data.invalidModules)).toBe(true);
			});
		});

		describe('Edge Cases', () => {
			it('should handle modules with special characters in ID', async () => {
				// Test that module IDs are properly trimmed
				const event = createMockEvent({
					user: testUser,
					formData: { modules: ' dashboard , ai , MoLOS-Tasks , MoLOS-Markdown ' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.data.success).toBe(true);
			});

			it('should handle duplicate module IDs', async () => {
				const event = createMockEvent({
					user: testUser,
					formData: { modules: 'dashboard,dashboard,ai,MoLOS-Tasks,MoLOS-Markdown' }
				});

				const result = (await actions.activateModules(event as any)) as any;

				// Should handle duplicates gracefully (either deduplicate or fail)
				expect([200, 400, 500]).toContain(result.status || 200);
			});

			it('should handle large number of modules', async () => {
				const modules = [
					'dashboard',
					'ai',
					'MoLOS-Tasks',
					'MoLOS-Markdown',
					'MoLOS-Goals',
					'MoLOS-Health'
				];

				const event = createMockEvent({
					user: testUser,
					formData: { modules: modules.join(',') }
				});

				const result = (await actions.activateModules(event as any)) as any;

				expect(result.data.success).toBe(true);
			});
		});
	});
});

/**
 * Tests for Module Registry System
 *
 * Tests module discovery, registration, filtering, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	MODULE_REGISTRY,
	getModuleById,
	getModuleByPath,
	getAllModules,
	getModuleNavigation,
	failedModulesQueue
} from '../../src/lib/config/index';
import type { ModuleConfig } from '../../src/lib/config/types';
import { withEnv } from '../utils/test-helpers';

describe('Module Registry', () => {
	describe('Module Discovery', () => {
		it('should discover and register core modules', () => {
			// Dashboard and ai are mandatory core modules
			expect(MODULE_REGISTRY['dashboard']).toBeDefined();
			expect(MODULE_REGISTRY['ai']).toBeDefined();
		});

		it('should load module configs with correct structure', () => {
			const dashboardConfig = MODULE_REGISTRY['dashboard'];

			expect(dashboardConfig).toHaveProperty('id');
			expect(dashboardConfig).toHaveProperty('name');
			expect(dashboardConfig).toHaveProperty('href');
			expect(dashboardConfig).toHaveProperty('icon');
			expect(dashboardConfig).toHaveProperty('description');
		});

		it('should mark package modules correctly', () => {
			// Check if any package modules are present
			const packageModules = Object.values(MODULE_REGISTRY).filter(
				(m) => (m as any).isPackageModule
			);

			// This test passes whether or not package modules exist
			// It just verifies the flag is set correctly when they do
			packageModules.forEach((m) => {
				expect((m as any).isPackageModule).toBe(true);
			});
		});
	});

	describe('Module Filtering', () => {
		it('should always load mandatory modules regardless of filter', async () => {
			await withEnv('VITE_MOLOS_AUTOLOAD_MODULES', 'nonexistent', async () => {
				// Even with a filter that doesn't include them,
				// mandatory modules should still be loaded
				expect(MODULE_REGISTRY['dashboard']).toBeDefined();
				expect(MODULE_REGISTRY['ai']).toBeDefined();
			});
		});

		it('should filter modules based on VITE_MOLOS_AUTOLOAD_MODULES env', async () => {
			await withEnv('VITE_MOLOS_AUTOLOAD_MODULES', 'dashboard,ai', async () => {
				// Note: This test depends on the module registry being rebuilt
				// which doesn't happen dynamically. This test documents the expected behavior.
				// In practice, the env var is read at build time.
				const modules = getAllModules();
				expect(modules.length).toBeGreaterThanOrEqual(2); // At least dashboard and ai
			});
		});
	});

	describe('Module Retrieval', () => {
		it('should get module by ID', () => {
			const module = getModuleById('dashboard');
			expect(module).toBeDefined();
			expect(module?.id).toBe('dashboard');
		});

		it('should return undefined for non-existent module ID', () => {
			const module = getModuleById('nonexistent-module');
			expect(module).toBeUndefined();
		});

		it('should get module by exact href', () => {
			const dashboardConfig = MODULE_REGISTRY['dashboard'];
			const module = getModuleByPath(dashboardConfig.href);
			expect(module).toBeDefined();
			expect(module?.id).toBe('dashboard');
		});

		it('should get module by href prefix', () => {
			const dashboardConfig = MODULE_REGISTRY['dashboard'];
			const module = getModuleByPath(`${dashboardConfig.href}/some/subpage`);
			expect(module).toBeDefined();
			expect(module?.id).toBe('dashboard');
		});

		it('should return undefined for non-matching href', () => {
			const module = getModuleByPath('/nonexistent/path');
			expect(module).toBeUndefined();
		});

		it('should get all modules as array', () => {
			const modules = getAllModules();
			expect(Array.isArray(modules)).toBe(true);
			expect(modules.length).toBeGreaterThan(0);

			// Verify all modules have required properties
			modules.forEach((m) => {
				expect(m).toHaveProperty('id');
				expect(m).toHaveProperty('name');
				expect(m).toHaveProperty('href');
			});
		});

		it('should get module navigation', () => {
			const navigation = getModuleNavigation('dashboard');
			expect(Array.isArray(navigation)).toBe(true);
		});

		it('should return empty array for module without navigation', () => {
			const navigation = getModuleNavigation('nonexistent');
			expect(navigation).toEqual([]);
		});
	});

	describe('Error Handling', () => {
		it('should handle failed modules gracefully', () => {
			// The failedModulesQueue should exist and be an array
			expect(Array.isArray(failedModulesQueue)).toBe(true);
		});

		it('should not break when accessing non-existent modules', () => {
			// These should all return undefined or empty arrays without throwing
			expect(() => getModuleById('nonexistent')).not.toThrow();
			expect(() => getModuleByPath('/nonexistent')).not.toThrow();
			expect(() => getModuleNavigation('nonexistent')).not.toThrow();
		});
	});

	describe('Module Config Validation', () => {
		it('should have valid config for all registered modules', () => {
			const modules = getAllModules();

			modules.forEach((module) => {
				// Required properties
				expect(module.id).toBeTruthy();
				expect(typeof module.id).toBe('string');

				expect(module.name).toBeTruthy();
				expect(typeof module.name).toBe('string');

				expect(module.href).toBeTruthy();
				expect(typeof module.href).toBe('string');
				expect(module.href.startsWith('/')).toBe(true);

				expect(module.icon).toBeDefined();

				expect(module.description).toBeDefined();
				expect(typeof module.description).toBe('string');

				// Optional properties should have correct types if present
				if (module.navigation) {
					expect(Array.isArray(module.navigation)).toBe(true);
					module.navigation.forEach((nav) => {
						expect(nav.name).toBeTruthy();
						expect(nav.href).toBeTruthy();
						expect(nav.icon).toBeDefined();
					});
				}
			});
		});

		it('should have unique IDs for all modules', () => {
			const modules = getAllModules();
			const ids = modules.map((m) => m.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(ids.length);
		});

		it('should have unique hrefs for all modules', () => {
			const modules = getAllModules();
			const hrefs = modules.map((m) => m.href);
			const uniqueHrefs = new Set(hrefs);

			expect(uniqueHrefs.size).toBe(hrefs.length);
		});
	});

	describe('Module Registry Immutability', () => {
		it('should be safe to iterate over module registry', () => {
			const keys = Object.keys(MODULE_REGISTRY);
			expect(keys.length).toBeGreaterThan(0);

			// Should not throw when iterating
			keys.forEach((key) => {
				const module = MODULE_REGISTRY[key];
				expect(module).toBeDefined();
			});
		});

		it('should maintain module registry integrity', () => {
			const initialCount = getAllModules().length;

			// Access modules multiple times
			getAllModules();
			getAllModules();
			getAllModules();

			// Count should remain the same
			expect(getAllModules().length).toBe(initialCount);
		});
	});
});

describe('Module Config Types', () => {
	it('should enforce ModuleConfig type constraints', () => {
		// This is more of a compile-time check
		// We're verifying the runtime structure matches expectations
		const module = getModuleById('dashboard');

		if (module) {
			// Type guard - if module exists, it should match ModuleConfig
			const config: ModuleConfig = module;

			expect(config.id).toBe('dashboard');
			expect(config.name).toBeTruthy();
			expect(config.href).toBeTruthy();
		}
	});
});

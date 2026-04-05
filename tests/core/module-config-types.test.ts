/**
 * Tests for Module Configuration Types
 *
 * Tests ModuleConfig type validation, NavItem structure, and config utilities
 */

import { describe, it, expect } from 'vitest';
import { createMockModuleConfig, createMockModuleSet } from '../utils/mock-module';
import type { ModuleConfig } from '../../src/lib/config/types';

describe('ModuleConfig Type Validation', () => {
	describe('Required Properties', () => {
		it('should require id property', () => {
			const config = createMockModuleConfig('test-module');
			expect(config.id).toBeDefined();
			expect(typeof config.id).toBe('string');
		});

		it('should require name property', () => {
			const config = createMockModuleConfig('test-module');
			expect(config.name).toBeDefined();
			expect(typeof config.name).toBe('string');
		});

		it('should require href property', () => {
			const config = createMockModuleConfig('test-module');
			expect(config.href).toBeDefined();
			expect(typeof config.href).toBe('string');
			expect(config.href.startsWith('/')).toBe(true);
		});

		it('should require icon property', () => {
			const config = createMockModuleConfig('test-module');
			expect(config.icon).toBeDefined();
		});

		it('should require description property', () => {
			const config = createMockModuleConfig('test-module');
			expect(config.description).toBeDefined();
			expect(typeof config.description).toBe('string');
		});
	});

	describe('Optional Properties', () => {
		it('should support optional navigation array', () => {
			const config = createMockModuleConfig('test-module', {
				navigation: [
					{ name: 'Dashboard', href: '/test/dashboard', icon: {} as any },
					{ name: 'Settings', href: '/test/settings', icon: {} as any }
				]
			});

			expect(config.navigation).toBeDefined();
			expect(Array.isArray(config.navigation)).toBe(true);
			expect(config.navigation?.length).toBe(2);
		});

		it('should support empty navigation', () => {
			const config = createMockModuleConfig('test-module', {
				navigation: []
			});

			expect(config.navigation).toEqual([]);
		});

		it('should support missing navigation', () => {
			const config = createMockModuleConfig('test-module');
			expect(config.navigation).toBeDefined();
		});
	});

	describe('Navigation Items', () => {
		it('should have valid navigation item structure', () => {
			const config = createMockModuleConfig('test-module', {
				navigation: [{ name: 'Test', href: '/test', icon: {} as any }]
			});

			const navItem = config.navigation![0];
			expect(navItem.name).toBeDefined();
			expect(navItem.href).toBeDefined();
			expect(navItem.icon).toBeDefined();
		});

		it('should support nested navigation paths', () => {
			const config = createMockModuleConfig('test-module', {
				navigation: [
					{ name: 'Level 1', href: '/test/level1', icon: {} as any },
					{ name: 'Level 2', href: '/test/level1/level2', icon: {} as any }
				]
			});

			expect(config.navigation!.length).toBe(2);
		});
	});
});

describe('Module Config Factories', () => {
	describe('createMockModuleConfig', () => {
		it('should create valid config with defaults', () => {
			const config = createMockModuleConfig('test');

			expect(config.id).toBe('test');
			expect(config.name).toBe('Test Module');
			expect(config.href).toBe('/test-module');
			expect(config.description).toBe('A test module');
		});

		it('should allow overrides', () => {
			const config = createMockModuleConfig('custom', {
				name: 'Custom Name',
				description: 'Custom description'
			});

			expect(config.id).toBe('custom');
			expect(config.name).toBe('Custom Name');
			expect(config.description).toBe('Custom description');
		});

		it('should preserve required fields when overriding', () => {
			const config = createMockModuleConfig('test', {
				name: 'Overridden'
			});

			expect(config.id).toBe('test'); // Preserved
			expect(config.name).toBe('Overridden'); // Overridden
			expect(config.href).toBe('/test-module'); // Preserved
		});
	});

	describe('createMockModuleSet', () => {
		it('should create multiple configs', () => {
			const configs = createMockModuleSet(5);

			expect(configs.length).toBe(5);
			configs.forEach((config, index) => {
				expect(config.id).toBe(`test-module-${index}`);
				expect(config.name).toBe(`Test Module ${index}`);
			});
		});

		it('should create unique configs', () => {
			const configs = createMockModuleSet(10);
			const ids = configs.map((c) => c.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(10);
		});

		it('should allow default count', () => {
			const configs = createMockModuleSet();
			expect(configs.length).toBe(3);
		});
	});
});

describe('Module Config Validation', () => {
	describe('ID Validation', () => {
		it('should accept valid IDs', () => {
			const validIds = ['simple', 'with-dash', 'with123', 'MoLOS-Tasks', 'UPPERCASE'];

			validIds.forEach((id) => {
				const config = createMockModuleConfig(id);
				expect(config.id).toBe(id);
			});
		});

		it('should preserve ID case', () => {
			const config = createMockModuleConfig('MoLOS-Tasks');
			expect(config.id).toBe('MoLOS-Tasks');
		});
	});

	describe('Href Validation', () => {
		it('should start with forward slash', () => {
			const config = createMockModuleConfig('test');
			expect(config.href.startsWith('/')).toBe(true);
		});

		it('should accept custom hrefs', () => {
			const customHrefs = ['/test', '/test-module', '/modules/test', '/MoLOS-Tasks'];

			customHrefs.forEach((href) => {
				const config = createMockModuleConfig('test', { href });
				expect(config.href).toBe(href);
			});
		});
	});

	describe('Description Validation', () => {
		it('should accept string descriptions', () => {
			const config = createMockModuleConfig('test', {
				description: 'A longer description of the module'
			});

			expect(config.description).toBe('A longer description of the module');
		});

		it('should accept empty descriptions', () => {
			const config = createMockModuleConfig('test', {
				description: ''
			});

			expect(config.description).toBe('');
		});
	});
});

describe('Module Config Type Safety', () => {
	it('should enforce ModuleConfig type at compile time', () => {
		const config: ModuleConfig = createMockModuleConfig('test');

		// These should all be valid
		expect(config.id).toBeDefined();
		expect(config.name).toBeDefined();
		expect(config.href).toBeDefined();
		expect(config.icon).toBeDefined();
		expect(config.description).toBeDefined();
	});

	it('should allow type-safe navigation', () => {
		const config: ModuleConfig = createMockModuleConfig('test', {
			navigation: [{ name: 'Nav', href: '/nav', icon: {} as any }]
		});

		if (config.navigation) {
			config.navigation.forEach((nav) => {
				expect(nav.name).toBeDefined();
				expect(nav.href).toBeDefined();
				expect(nav.icon).toBeDefined();
			});
		}
	});
});

describe('Module Config Immutability', () => {
	it('should create new objects for each call', () => {
		const config1 = createMockModuleConfig('test');
		const config2 = createMockModuleConfig('test');

		expect(config1).not.toBe(config2);
	});

	it('should not share navigation arrays', () => {
		const config1 = createMockModuleConfig('test', {
			navigation: [{ name: 'Nav', href: '/nav', icon: {} as any }]
		});
		const config2 = createMockModuleConfig('test', {
			navigation: [{ name: 'Nav', href: '/nav', icon: {} as any }]
		});

		expect(config1.navigation).not.toBe(config2.navigation);
	});
});

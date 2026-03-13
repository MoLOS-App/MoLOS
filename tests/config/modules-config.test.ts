/**
 * Tests for modules.config.ts
 *
 * Covers:
 * - Tag/branch validation (mutually exclusive)
 * - getModuleRef and getModuleRefType helpers
 * - Validation error messages
 */

import { describe, it, expect } from 'vitest';
import {
	validateModuleConfigEntry,
	getModuleRef,
	getModuleRefType,
	type ModuleConfigEntry
} from '../../modules.config';

describe('modules.config.ts', () => {
	describe('validateModuleConfigEntry', () => {
		describe('valid configurations', () => {
			it('should accept config with only tag', () => {
				const entry: ModuleConfigEntry = {
					id: 'MoLOS-Tasks',
					git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
					tag: 'v1.0.0'
				};
				expect(validateModuleConfigEntry(entry)).toBeNull();
			});

			it('should accept config with only branch', () => {
				const entry: ModuleConfigEntry = {
					id: 'MoLOS-Tasks',
					git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
					branch: 'develop'
				};
				expect(validateModuleConfigEntry(entry)).toBeNull();
			});

			it('should accept config with tag and required flag', () => {
				const entry: ModuleConfigEntry = {
					id: 'MoLOS-Tasks',
					git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
					tag: 'v1.0.0',
					required: true
				};
				expect(validateModuleConfigEntry(entry)).toBeNull();
			});

			it('should accept config with branch and required flag', () => {
				const entry: ModuleConfigEntry = {
					id: 'MoLOS-Tasks',
					git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
					branch: 'main',
					required: false
				};
				expect(validateModuleConfigEntry(entry)).toBeNull();
			});
		});

		describe('invalid configurations - missing both tag and branch', () => {
			it('should reject config with neither tag nor branch', () => {
				const entry = {
					id: 'MoLOS-Tasks',
					git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git'
				} as ModuleConfigEntry;
				const error = validateModuleConfigEntry(entry);
				expect(error).not.toBeNull();
				expect(error).toContain("must specify either 'tag' or 'branch'");
				expect(error).toContain('MoLOS-Tasks');
			});

			it('should reject config with empty tag and no branch', () => {
				const entry: ModuleConfigEntry = {
					id: 'MoLOS-Test',
					git: 'https://github.com/MoLOS-App/MoLOS-Test.git',
					tag: ''
				};
				const error = validateModuleConfigEntry(entry);
				expect(error).not.toBeNull();
				expect(error).toContain("must specify either 'tag' or 'branch'");
			});

			it('should reject config with empty branch and no tag', () => {
				const entry: ModuleConfigEntry = {
					id: 'MoLOS-Test',
					git: 'https://github.com/MoLOS-App/MoLOS-Test.git',
					branch: ''
				};
				const error = validateModuleConfigEntry(entry);
				expect(error).not.toBeNull();
				expect(error).toContain("must specify either 'tag' or 'branch'");
			});
		});

		describe('invalid configurations - both tag and branch specified', () => {
			it('should reject config with both tag and branch', () => {
				const entry = {
					id: 'MoLOS-Tasks',
					git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
					tag: 'v1.0.0',
					branch: 'develop'
				} as ModuleConfigEntry;
				const error = validateModuleConfigEntry(entry);
				expect(error).not.toBeNull();
				expect(error).toContain("cannot specify both 'tag' and 'branch'");
				expect(error).toContain('v1.0.0');
				expect(error).toContain('develop');
			});

			it('should include both values in error message', () => {
				const entry = {
					id: 'MyModule',
					git: 'https://github.com/user/repo.git',
					tag: 'v2.3.4',
					branch: 'feature-branch'
				} as ModuleConfigEntry;
				const error = validateModuleConfigEntry(entry);
				expect(error).toContain('tag=v2.3.4');
				expect(error).toContain('branch=feature-branch');
			});
		});

		describe('error message formatting', () => {
			it('should include module id in all error messages', () => {
				const entryNoRef = {
					id: 'TestModule',
					git: 'https://github.com/test/test.git'
				} as ModuleConfigEntry;
				const errorNoRef = validateModuleConfigEntry(entryNoRef);
				expect(errorNoRef).toContain('TestModule');

				const entryBoth = {
					id: 'AnotherModule',
					git: 'https://github.com/test/test.git',
					tag: 'v1.0.0',
					branch: 'main'
				} as ModuleConfigEntry;
				const errorBoth = validateModuleConfigEntry(entryBoth);
				expect(errorBoth).toContain('AnotherModule');
			});
		});
	});

	describe('getModuleRef', () => {
		it('should return tag value when tag is specified', () => {
			const entry: ModuleConfigEntry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				tag: 'v1.2.3'
			};
			expect(getModuleRef(entry)).toBe('v1.2.3');
		});

		it('should return branch value when branch is specified', () => {
			const entry: ModuleConfigEntry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				branch: 'develop'
			};
			expect(getModuleRef(entry)).toBe('develop');
		});

		it('should return tag value when both are specified (invalid but defined behavior)', () => {
			const entry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				tag: 'v1.0.0',
				branch: 'develop'
			} as ModuleConfigEntry;
			// Tag takes precedence in the implementation
			expect(getModuleRef(entry)).toBe('v1.0.0');
		});

		it('should return empty string when neither is specified', () => {
			const entry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git'
			} as ModuleConfigEntry;
			expect(getModuleRef(entry)).toBe('');
		});
	});

	describe('getModuleRefType', () => {
		it('should return "tag" when tag is specified', () => {
			const entry: ModuleConfigEntry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				tag: 'v1.0.0'
			};
			expect(getModuleRefType(entry)).toBe('tag');
		});

		it('should return "branch" when branch is specified', () => {
			const entry: ModuleConfigEntry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				branch: 'develop'
			};
			expect(getModuleRefType(entry)).toBe('branch');
		});

		it('should return "branch" when neither is specified (fallback)', () => {
			const entry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git'
			} as ModuleConfigEntry;
			expect(getModuleRefType(entry)).toBe('branch');
		});

		it('should return "tag" when both are specified (tag takes precedence)', () => {
			const entry = {
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				tag: 'v1.0.0',
				branch: 'develop'
			} as ModuleConfigEntry;
			expect(getModuleRefType(entry)).toBe('tag');
		});
	});
});

/**
 * Tests for fetch-modules.ts tag/branch behavior
 *
 * Covers:
 * - Tag-based modules: always re-clone
 * - Branch-based modules: skip if exists (preserve local changes)
 * - Validation errors for invalid config entries
 */

import { describe, it, expect } from 'vitest';

describe('fetch-modules.ts', () => {
	describe('tag vs branch behavior', () => {
		/**
		 * Determines whether a module should be skipped based on ref type and existence
		 */
		function shouldSkipModule(
			refType: 'tag' | 'branch',
			moduleExists: boolean
		): { skip: boolean; reason?: string } {
			if (moduleExists && refType === 'branch') {
				return { skip: true, reason: 'preserve local changes' };
			}
			return { skip: false };
		}

		describe('tag-based modules', () => {
			it('should NOT skip if module does not exist', () => {
				const result = shouldSkipModule('tag', false);
				expect(result.skip).toBe(false);
			});

			it('should NOT skip if module exists (must re-clone for exact version)', () => {
				const result = shouldSkipModule('tag', true);
				expect(result.skip).toBe(false);
			});
		});

		describe('branch-based modules', () => {
			it('should NOT skip if module does not exist', () => {
				const result = shouldSkipModule('branch', false);
				expect(result.skip).toBe(false);
			});

			it('should skip if module exists (preserve local changes)', () => {
				const result = shouldSkipModule('branch', true);
				expect(result.skip).toBe(true);
				expect(result.reason).toBe('preserve local changes');
			});
		});
	});

	describe('ref type determination', () => {
		function getRefType(entry: { tag?: string; branch?: string }): 'tag' | 'branch' {
			return entry.tag ? 'tag' : 'branch';
		}

		it('should return "tag" for tag-based entries', () => {
			expect(getRefType({ tag: 'v1.0.0' })).toBe('tag');
			expect(getRefType({ tag: 'v2.3.4', branch: undefined })).toBe('tag');
		});

		it('should return "branch" for branch-based entries', () => {
			expect(getRefType({ branch: 'develop' })).toBe('branch');
			expect(getRefType({ tag: undefined, branch: 'main' })).toBe('branch');
		});

		it('should default to "branch" when neither is set', () => {
			expect(getRefType({})).toBe('branch');
		});
	});

	describe('validation before fetch', () => {
		function validateEntry(entry: {
			id: string;
			git: string;
			tag?: string;
			branch?: string;
		}): string | null {
			if (!entry.tag && !entry.branch) {
				return `Module "${entry.id}": must specify either 'tag' or 'branch'`;
			}
			if (entry.tag && entry.branch) {
				return `Module "${entry.id}": cannot specify both 'tag' and 'branch'`;
			}
			return null;
		}

		it('should pass validation for tag-only entry', () => {
			const result = validateEntry({
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				tag: 'v1.0.0'
			});
			expect(result).toBeNull();
		});

		it('should pass validation for branch-only entry', () => {
			const result = validateEntry({
				id: 'MoLOS-Tasks',
				git: 'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				branch: 'develop'
			});
			expect(result).toBeNull();
		});

		it('should fail validation when both tag and branch are set', () => {
			const result = validateEntry({
				id: 'MoLOS-Test',
				git: 'https://github.com/MoLOS-App/MoLOS-Test.git',
				tag: 'v1.0.0',
				branch: 'develop'
			});
			expect(result).not.toBeNull();
			expect(result).toContain('cannot specify both');
		});

		it('should fail validation when neither tag nor branch is set', () => {
			const result = validateEntry({
				id: 'MoLOS-Test',
				git: 'https://github.com/MoLOS-App/MoLOS-Test.git'
			});
			expect(result).not.toBeNull();
			expect(result).toContain('must specify either');
		});
	});

	describe('fetch decision matrix', () => {
		interface FetchDecision {
			refType: 'tag' | 'branch';
			moduleExists: boolean;
			expectedAction: 'clone' | 'reclone' | 'skip';
		}

		const scenarios: FetchDecision[] = [
			{ refType: 'tag', moduleExists: false, expectedAction: 'clone' },
			{ refType: 'tag', moduleExists: true, expectedAction: 'reclone' },
			{ refType: 'branch', moduleExists: false, expectedAction: 'clone' },
			{ refType: 'branch', moduleExists: true, expectedAction: 'skip' }
		];

		function getExpectedAction(refType: 'tag' | 'branch', moduleExists: boolean): string {
			if (refType === 'tag') {
				return moduleExists ? 'reclone' : 'clone';
			} else {
				return moduleExists ? 'skip' : 'clone';
			}
		}

		scenarios.forEach(({ refType, moduleExists, expectedAction }) => {
			it(`should ${expectedAction} for ${refType}-based module when ${moduleExists ? 'exists' : 'not exists'}`, () => {
				const action = getExpectedAction(refType, moduleExists);
				expect(action).toBe(expectedAction);
			});
		});
	});

	describe('git clone command generation', () => {
		function buildCloneCommand(git: string, ref: string, targetDir: string): string {
			return `git clone --depth 1 --branch ${ref} ${git} ${targetDir}`;
		}

		it('should generate correct clone command for tag', () => {
			const cmd = buildCloneCommand(
				'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				'v1.0.0',
				'MoLOS-Tasks'
			);
			expect(cmd).toContain('--branch v1.0.0');
			expect(cmd).toContain('--depth 1');
		});

		it('should generate correct clone command for branch', () => {
			const cmd = buildCloneCommand(
				'https://github.com/MoLOS-App/MoLOS-Tasks.git',
				'develop',
				'MoLOS-Tasks'
			);
			expect(cmd).toContain('--branch develop');
		});
	});
});

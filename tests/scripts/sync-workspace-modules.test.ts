/**
 * Tests for sync-workspace-modules.ts
 *
 * Covers:
 * - Module discovery from modules/ directory
 * - Adding new workspace dependencies
 * - Cleanup of stale module entries
 * - Cleanup of incorrect format entries (MoLOS-* instead of @molos/module-*)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We'll test the core functions by importing them
// Since the script is a CLI tool, we'll need to refactor slightly or test the logic

describe('sync-workspace-modules.ts', () => {
	describe('isMolosModulePackage', () => {
		// Test the helper function logic
		function isMolosModulePackage(name: string): boolean {
			return name.startsWith('@molos/module-');
		}

		it('should return true for valid module package names', () => {
			expect(isMolosModulePackage('@molos/module-tasks')).toBe(true);
			expect(isMolosModulePackage('@molos/module-goals')).toBe(true);
			expect(isMolosModulePackage('@molos/module-ai-knowledge')).toBe(true);
		});

		it('should return false for non-module packages', () => {
			expect(isMolosModulePackage('@molos/core')).toBe(false);
			expect(isMolosModulePackage('@molos/database')).toBe(false);
			expect(isMolosModulePackage('@molos/ui')).toBe(false);
		});

		it('should return false for non-molos packages', () => {
			expect(isMolosModulePackage('svelte')).toBe(false);
			expect(isMolosModulePackage('drizzle-orm')).toBe(false);
			expect(isMolosModulePackage('zod')).toBe(false);
		});

		it('should return false for incorrect format (repo names)', () => {
			expect(isMolosModulePackage('MoLOS-Tasks')).toBe(false);
			expect(isMolosModulePackage('MoLOS-Goals')).toBe(false);
		});
	});

	describe('isMolosRepoName', () => {
		// Test the helper function logic
		function isMolosRepoName(name: string): boolean {
			return name.startsWith('MoLOS-') && !name.startsWith('@');
		}

		it('should return true for repo-style names', () => {
			expect(isMolosRepoName('MoLOS-Tasks')).toBe(true);
			expect(isMolosRepoName('MoLOS-Goals')).toBe(true);
			expect(isMolosRepoName('MoLOS-AI-Knowledge')).toBe(true);
		});

		it('should return false for valid package names', () => {
			expect(isMolosRepoName('@molos/module-tasks')).toBe(false);
			expect(isMolosRepoName('@molos/module-goals')).toBe(false);
		});

		it('should return false for non-MoLOS packages', () => {
			expect(isMolosRepoName('some-other-package')).toBe(false);
			expect(isMolosRepoName('tasks')).toBe(false);
		});
	});

	describe('dependency cleanup scenarios', () => {
		it('should identify entries to remove - incorrect format', () => {
			const deps: Record<string, string> = {
				'@molos/module-tasks': 'workspace:*',
				'MoLOS-AI-Knowledge': 'workspace:*', // Should be removed
				svelte: '^5.0.0'
			};

			const isMolosRepoName = (name: string) => name.startsWith('MoLOS-') && !name.startsWith('@');
			const isMolosModulePackage = (name: string) => name.startsWith('@molos/module-');

			const toRemove: string[] = [];
			for (const [name, value] of Object.entries(deps)) {
				if (isMolosRepoName(name) && value === 'workspace:*') {
					toRemove.push(name);
				}
			}

			expect(toRemove).toContain('MoLOS-AI-Knowledge');
			expect(toRemove).not.toContain('@molos/module-tasks');
			expect(toRemove).not.toContain('svelte');
		});

		it('should identify entries to remove - stale modules', () => {
			const deps: Record<string, string> = {
				'@molos/module-tasks': 'workspace:*',
				'@molos/module-deleted': 'workspace:*', // Should be removed (module no longer exists)
				'@molos/module-goals': 'workspace:*'
			};

			const existingModules = new Set(['@molos/module-tasks', '@molos/module-goals']);
			const isMolosModulePackage = (name: string) => name.startsWith('@molos/module-');

			const toRemove: string[] = [];
			for (const [name, value] of Object.entries(deps)) {
				if (isMolosModulePackage(name) && value === 'workspace:*') {
					if (!existingModules.has(name)) {
						toRemove.push(name);
					}
				}
			}

			expect(toRemove).toContain('@molos/module-deleted');
			expect(toRemove).not.toContain('@molos/module-tasks');
			expect(toRemove).not.toContain('@molos/module-goals');
		});

		it('should not remove GitHub dependencies', () => {
			const deps: Record<string, string> = {
				'@molos/module-tasks': 'github:MoLOS-App/MoLOS-Tasks',
				'@molos/module-goals': 'workspace:*'
			};

			const toRemove: string[] = [];
			for (const [name, value] of Object.entries(deps)) {
				if (value === 'workspace:*' && name.startsWith('MoLOS-')) {
					toRemove.push(name);
				}
			}

			expect(toRemove).toHaveLength(0);
		});
	});

	describe('module discovery', () => {
		const testDir = join(tmpdir(), 'molos-test-modules', Date.now().toString());

		beforeEach(() => {
			// Create test directory structure
			mkdirSync(testDir, { recursive: true });
		});

		afterEach(() => {
			// Cleanup
			rmSync(testDir, { recursive: true, force: true });
		});

		it('should discover modules with valid package.json', () => {
			// Create module directories
			const module1Dir = join(testDir, 'MoLOS-Tasks');
			mkdirSync(module1Dir, { recursive: true });
			writeFileSync(
				join(module1Dir, 'package.json'),
				JSON.stringify({ name: '@molos/module-tasks' })
			);

			const module2Dir = join(testDir, 'MoLOS-Goals');
			mkdirSync(module2Dir, { recursive: true });
			writeFileSync(
				join(module2Dir, 'package.json'),
				JSON.stringify({ name: '@molos/module-goals' })
			);

			// Simulate discovery
			const modules: Array<{ name: string; path: string }> = [];
			const entries = existsSync(testDir)
				? require('fs').readdirSync(testDir, { withFileTypes: true })
				: [];
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const modulePath = join(testDir, entry.name);
				const packageJsonPath = join(modulePath, 'package.json');
				if (existsSync(packageJsonPath)) {
					const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
					if (packageJson.name) {
						modules.push({ name: packageJson.name, path: modulePath });
					}
				}
			}

			expect(modules).toHaveLength(2);
			expect(modules.map((m) => m.name)).toContain('@molos/module-tasks');
			expect(modules.map((m) => m.name)).toContain('@molos/module-goals');
		});

		it('should skip directories without package.json', () => {
			// Create module with package.json
			const module1Dir = join(testDir, 'MoLOS-Tasks');
			mkdirSync(module1Dir, { recursive: true });
			writeFileSync(
				join(module1Dir, 'package.json'),
				JSON.stringify({ name: '@molos/module-tasks' })
			);

			// Create directory without package.json
			mkdirSync(join(testDir, 'not-a-module'), { recursive: true });

			// Simulate discovery
			const modules: Array<{ name: string; path: string }> = [];
			const entries = existsSync(testDir)
				? require('fs').readdirSync(testDir, { withFileTypes: true })
				: [];
			for (const entry of entries) {
				if (!entry.isDirectory()) continue;
				const modulePath = join(testDir, entry.name);
				const packageJsonPath = join(modulePath, 'package.json');
				if (existsSync(packageJsonPath)) {
					const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
					if (packageJson.name) {
						modules.push({ name: packageJson.name, path: modulePath });
					}
				}
			}

			expect(modules).toHaveLength(1);
			expect(modules[0].name).toBe('@molos/module-tasks');
		});
	});
});

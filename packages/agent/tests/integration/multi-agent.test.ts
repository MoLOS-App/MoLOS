/**
 * Integration tests for Multi-Agent System
 *
 * Tests subagent spawning, depth limits, child count limits,
 * session tracking, and cleanup behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	SubagentSpawner,
	createSubagentSpawner,
	resetSubagentSpawner,
	validateSpawnParams,
	type SpawnParams,
	type SpawnContext
} from '../../src/multi-agent/spawn.js';
import {
	ModuleRegistry,
	createModuleRegistry,
	resetModuleRegistry
} from '../../src/multi-agent/registry.js';
import { InMemorySessionStore, type SessionStore } from '../../src/core/session.js';
import { createEventBus, type EventBus } from '../../src/events/event-bus.js';

describe('Multi-Agent Integration', () => {
	// Test state
	let spawner: SubagentSpawner;
	let registry: ModuleRegistry;
	let sessionStore: SessionStore;
	let eventBus: EventBus;
	let capturedEvents: Array<{ type: string; data: Record<string, unknown> }> = [];

	beforeEach(() => {
		eventBus = createEventBus();
		sessionStore = new InMemorySessionStore();
		registry = createModuleRegistry(eventBus);
		spawner = createSubagentSpawner(registry, sessionStore, eventBus);

		capturedEvents = [];

		// Subscribe to all subagent events
		eventBus.subscribe('subagent:*', (event) => {
			capturedEvents.push({ type: event.type, data: event.data as Record<string, unknown> });
		});

		// Create a root session for testing
		sessionStore.create('root-session', { depth: 0 });
	});

	afterEach(() => {
		eventBus.close();
		spawner.clear();
		resetSubagentSpawner();
		resetModuleRegistry();
		vi.restoreAllMocks();
	});

	/**
	 * Helper to create spawn context
	 */
	function createSpawnContext(overrides: Partial<SpawnContext> = {}): SpawnContext {
		return {
			requesterSessionKey: 'root-session',
			maxDepth: 3,
			maxChildren: 5,
			...overrides
		};
	}

	describe('SubagentSpawner', () => {
		describe('spawn', () => {
			it('should spawn a subagent successfully', async () => {
				const params: SpawnParams = {
					task: 'Analyze the data',
					label: 'data-analyzer'
				};

				const result = await spawner.spawn(params, createSpawnContext());

				expect(result.status).toBe('success');
				expect(result.childSessionKey).toBeDefined();
				expect(result.runId).toBeDefined();
				expect(result.childSessionKey).toContain('agent:');
			});

			it('should create child session with correct metadata', async () => {
				const params: SpawnParams = {
					task: 'Test task',
					label: 'test-subagent'
				};

				const result = await spawner.spawn(params, createSpawnContext());

				expect(result.status).toBe('success');

				const childSession = sessionStore.get(result.childSessionKey!);
				expect(childSession).toBeDefined();
				expect(childSession?.metadata).toBeDefined();
				expect((childSession?.metadata as any)?.label).toBe('test-subagent');
				expect((childSession?.metadata as any)?.depth).toBe(1);
			});

			it('should add task message to child session', async () => {
				const params: SpawnParams = {
					task: 'Process the file'
				};

				const result = await spawner.spawn(params, createSpawnContext());

				expect(result.status).toBe('success');

				const history = sessionStore.getHistory(result.childSessionKey!);
				expect(history.length).toBe(1);
				expect(history[0].content).toBe('Process the file');
			});

			it('should handle attachments', async () => {
				const params: SpawnParams = {
					task: 'Review attachment',
					attachments: [
						{ name: 'report.pdf', content: 'PDF content here', mimeType: 'application/pdf' }
					]
				};

				const result = await spawner.spawn(params, createSpawnContext());

				expect(result.status).toBe('success');

				const history = sessionStore.getHistory(result.childSessionKey!);
				expect(history.length).toBe(2); // Task + attachment
				expect(history[1].content).toContain('report.pdf');
				expect(history[1].content).toContain('PDF content here');
			});

			it('should emit spawn event', async () => {
				const params: SpawnParams = {
					task: 'Test task'
				};

				await spawner.spawn(params, createSpawnContext());

				const spawnEvents = capturedEvents.filter((e) => e.type === 'subagent.spawn');
				expect(spawnEvents.length).toBe(1);
				expect(spawnEvents[0].data).toHaveProperty('runId');
				expect(spawnEvents[0].data).toHaveProperty('childSessionKey');
				expect(spawnEvents[0].data).toHaveProperty('depth');
			});

			it('should increment child count for parent', async () => {
				const params: SpawnParams = { task: 'Task 1' };

				const result1 = await spawner.spawn(params, createSpawnContext());
				expect(result1.status).toBe('success');

				const params2: SpawnParams = { task: 'Task 2' };
				const result2 = await spawner.spawn(params2, createSpawnContext());
				expect(result2.status).toBe('success');

				// Child count should be tracked
				const canSpawn = spawner.canSpawnSubagent('root-session', 3, 5);
				expect(canSpawn).toBe(true);
			});
		});

		describe('depth limits', () => {
			it('should enforce depth limit', async () => {
				// Create a chain of subagents at max depth
				let currentSession = 'root-session';
				const maxDepth = 3;

				for (let depth = 1; depth <= maxDepth; depth++) {
					const context = createSpawnContext({
						requesterSessionKey: currentSession,
						maxDepth
					});

					const result = await spawner.spawn({ task: `Task at depth ${depth}` }, context);

					if (depth < maxDepth) {
						expect(result.status).toBe('success');
						currentSession = result.childSessionKey!;
					} else {
						// At max depth, should be forbidden
						expect(result.status).toBe('forbidden');
						expect(result.error).toContain('Depth limit exceeded');
					}
				}
			});

			it('should return 0 depth for root session', () => {
				const depth = spawner.getSubagentDepth('root-session');
				expect(depth).toBe(0);
			});

			it('should calculate correct depth for nested subagents', async () => {
				const result1 = await spawner.spawn({ task: 'Level 1 task' }, createSpawnContext());
				expect(result1.status).toBe('success');

				const depth1 = spawner.getSubagentDepth(result1.childSessionKey!);
				expect(depth1).toBe(1);

				const result2 = await spawner.spawn(
					{ task: 'Level 2 task' },
					createSpawnContext({ requesterSessionKey: result1.childSessionKey })
				);
				expect(result2.status).toBe('success');

				const depth2 = spawner.getSubagentDepth(result2.childSessionKey!);
				expect(depth2).toBe(2);
			});

			it('should respect custom maxDepth in context', async () => {
				// With maxDepth=1, should only allow one level of subagents
				const result1 = await spawner.spawn(
					{ task: 'Level 1' },
					createSpawnContext({ maxDepth: 1 })
				);
				expect(result1.status).toBe('success');

				// Trying to spawn from the child should fail
				const result2 = await spawner.spawn(
					{ task: 'Level 2' },
					createSpawnContext({
						requesterSessionKey: result1.childSessionKey,
						maxDepth: 1
					})
				);
				expect(result2.status).toBe('forbidden');
			});
		});

		describe('child count limits', () => {
			it('should enforce max children limit', async () => {
				const maxChildren = 2;
				const context = createSpawnContext({ maxChildren });

				// Spawn up to the limit
				const result1 = await spawner.spawn({ task: 'Task 1' }, context);
				expect(result1.status).toBe('success');

				const result2 = await spawner.spawn({ task: 'Task 2' }, context);
				expect(result2.status).toBe('success');

				// Third should be forbidden
				const result3 = await spawner.spawn({ task: 'Task 3' }, context);
				expect(result3.status).toBe('forbidden');
				expect(result3.error).toContain('Max children limit exceeded');
			});

			it('should track child counts independently per parent', async () => {
				const maxChildren = 2;

				// Spawn two children from root
				await spawner.spawn({ task: 'Root child 1' }, createSpawnContext({ maxChildren }));
				await spawner.spawn({ task: 'Root child 2' }, createSpawnContext({ maxChildren }));

				// Both root children should be at max
				const rootCanSpawn = spawner.canSpawnSubagent('root-session', 3, maxChildren);
				expect(rootCanSpawn).toBe(false);

				// But we can still spawn from a child (if under its depth limit)
				const childContext = createSpawnContext({
					requesterSessionKey: 'child-session-1', // Non-existent, so depth 0
					maxDepth: 3,
					maxChildren
				});
				const childCanSpawn = spawner.canSpawnSubagent('child-session-1', 3, maxChildren);
				expect(childCanSpawn).toBe(true); // No children spawned yet
			});
		});

		describe('lifecycle management', () => {
			it('should mark subagent as started', async () => {
				const result = await spawner.spawn({ task: 'Test task' }, createSpawnContext());
				expect(result.status).toBe('success');

				spawner.markSubagentStarted(result.runId!);

				const run = spawner.getSubagentRun(result.runId!);
				expect(run?.startedAt).toBeDefined();
			});

			it('should mark subagent as ended', async () => {
				const result = await spawner.spawn({ task: 'Test task' }, createSpawnContext());
				expect(result.status).toBe('success');

				spawner.markSubagentStarted(result.runId!);
				spawner.markSubagentEnded(result.runId!, { success: true, output: 'Done' });

				const run = spawner.getSubagentRun(result.runId!);
				expect(run?.endedAt).toBeDefined();
				expect(run?.outcome?.success).toBe(true);
				expect(run?.outcome?.output).toBe('Done');
			});

			it('should decrement child count when subagent ends', async () => {
				const maxChildren = 2;
				const context = createSpawnContext({ maxChildren });

				const result1 = await spawner.spawn({ task: 'Task 1' }, context);
				const result2 = await spawner.spawn({ task: 'Task 2' }, context);

				expect(spawner.canSpawnSubagent('root-session', 3, maxChildren)).toBe(false);

				// End the first subagent
				spawner.markSubagentEnded(result1.runId!, { success: true });

				// Now should be able to spawn again
				expect(spawner.canSpawnSubagent('root-session', 3, maxChildren)).toBe(true);
			});

			it('should emit ended event on completion', async () => {
				const result = await spawner.spawn({ task: 'Test task' }, createSpawnContext());
				spawner.markSubagentStarted(result.runId!);
				spawner.markSubagentEnded(result.runId!, { success: true });

				const endedEvents = capturedEvents.filter((e) => e.type === 'subagent.ended');
				expect(endedEvents.length).toBe(1);
				expect(endedEvents[0].data).toHaveProperty('success', true);
			});
		});

		describe('cleanup', () => {
			it('should cleanup session when cleanup=delete', async () => {
				const result = await spawner.spawn(
					{ task: 'Temp task', cleanup: 'delete' },
					createSpawnContext()
				);
				const childKey = result.childSessionKey!;

				spawner.markSubagentStarted(result.runId!);
				spawner.markSubagentEnded(result.runId!, { success: true });

				// Session should be deleted
				expect(sessionStore.get(childKey)).toBeUndefined();
			});

			it('should keep session when cleanup=keep', async () => {
				const result = await spawner.spawn(
					{ task: 'Persistent task', cleanup: 'keep' },
					createSpawnContext()
				);
				const childKey = result.childSessionKey!;

				spawner.markSubagentStarted(result.runId!);
				spawner.markSubagentEnded(result.runId!, { success: true });

				// Session should still exist
				expect(sessionStore.get(childKey)).toBeDefined();
			});

			it('should emit cleanup event', async () => {
				const result = await spawner.spawn(
					{ task: 'Temp task', cleanup: 'delete' },
					createSpawnContext()
				);

				spawner.markSubagentStarted(result.runId!);
				spawner.markSubagentEnded(result.runId!, { success: true });

				const cleanupEvents = capturedEvents.filter((e) => e.type === 'subagent.cleanup');
				expect(cleanupEvents.length).toBe(1);
			});

			it('should cleanupSubagent directly', async () => {
				const result = await spawner.spawn(
					{ task: 'Temp task', cleanup: 'keep' },
					createSpawnContext()
				);
				const childKey = result.childSessionKey!;

				// Manual cleanup
				spawner.cleanupSubagent(result.runId!);

				// Session should be deleted
				expect(sessionStore.get(childKey)).toBeUndefined();
			});
		});

		describe('active run tracking', () => {
			it('should track active subagent runs', async () => {
				const result1 = await spawner.spawn({ task: 'Task 1' }, createSpawnContext());
				const result2 = await spawner.spawn({ task: 'Task 2' }, createSpawnContext());

				spawner.markSubagentStarted(result1.runId!);
				spawner.markSubagentStarted(result2.runId!);

				const activeRuns = spawner.getActiveSubagentRuns();
				expect(activeRuns.length).toBe(2);
			});

			it('should filter ended runs from active', async () => {
				const result1 = await spawner.spawn({ task: 'Task 1' }, createSpawnContext());
				const result2 = await spawner.spawn({ task: 'Task 2' }, createSpawnContext());

				spawner.markSubagentStarted(result1.runId!);
				spawner.markSubagentStarted(result2.runId!);

				// End first run
				spawner.markSubagentEnded(result1.runId!, { success: true });

				const activeRuns = spawner.getActiveSubagentRuns();
				expect(activeRuns.length).toBe(1);
				expect(activeRuns[0].runId).toBe(result2.runId);
			});

			it('should get runs for specific session', async () => {
				const result = await spawner.spawn({ task: 'Child task' }, createSpawnContext());

				const runs = spawner.getSubagentRunsForSession('root-session');
				expect(runs.length).toBe(1);
				expect(runs[0].runId).toBe(result.runId);
			});
		});
	});

	describe('validateSpawnParams', () => {
		it('should return no errors for valid params', () => {
			const errors = validateSpawnParams({
				task: 'Valid task'
			});
			expect(errors).toHaveLength(0);
		});

		it('should require task', () => {
			const errors = validateSpawnParams({});
			expect(errors).toContain('Task is required');
		});

		it('should reject empty task', () => {
			const errors = validateSpawnParams({ task: '   ' });
			expect(errors).toContain('Task is required');
		});

		it('should validate runTimeoutSeconds', () => {
			const errors1 = validateSpawnParams({ task: 'Test', runTimeoutSeconds: 0 });
			expect(errors1).toContain('runTimeoutSeconds must be positive');

			const errors2 = validateSpawnParams({ task: 'Test', runTimeoutSeconds: -1 });
			expect(errors2).toContain('runTimeoutSeconds must be positive');

			const errors3 = validateSpawnParams({ task: 'Test', runTimeoutSeconds: 60 });
			expect(errors3).toHaveLength(0);
		});

		it('should validate mode', () => {
			const errors1 = validateSpawnParams({ task: 'Test', mode: 'run' as any });
			expect(errors1).toHaveLength(0);

			const errors2 = validateSpawnParams({ task: 'Test', mode: 'session' as any });
			expect(errors2).toHaveLength(0);

			const errors3 = validateSpawnParams({ task: 'Test', mode: 'invalid' as any });
			expect(errors3).toContain('mode must be "run" or "session"');
		});

		it('should validate cleanup', () => {
			const errors1 = validateSpawnParams({ task: 'Test', cleanup: 'delete' });
			expect(errors1).toHaveLength(0);

			const errors2 = validateSpawnParams({ task: 'Test', cleanup: 'keep' });
			expect(errors2).toHaveLength(0);

			const errors3 = validateSpawnParams({ task: 'Test', cleanup: 'invalid' as any });
			expect(errors3).toContain('cleanup must be "delete" or "keep"');
		});

		it('should validate attachments', () => {
			const errors1 = validateSpawnParams({
				task: 'Test',
				attachments: [{ name: 'file.txt', content: 'hello' }]
			});
			expect(errors1).toHaveLength(0);

			const errors2 = validateSpawnParams({
				task: 'Test',
				attachments: [{ name: '', content: 'hello' }]
			});
			expect(errors2).toContain('Attachment 0 must have a name');

			const errors3 = validateSpawnParams({
				task: 'Test',
				attachments: [{ name: 'file', content: '' }]
			});
			expect(errors3).toContain('Attachment 0 must have content');
		});
	});

	describe('ModuleRegistry', () => {
		beforeEach(() => {
			registry.clear();
		});

		describe('register/unregister', () => {
			it('should register a module agent', () => {
				registry.register({
					id: 'test-module',
					name: 'Test Module',
					description: 'A test module',
					baseUrl: 'http://localhost:3001'
				});

				expect(registry.has('test-module')).toBe(true);
				expect(registry.size).toBe(1);
			});

			it('should get registered module', () => {
				registry.register({
					id: 'test-module',
					name: 'Test Module',
					description: 'A test module',
					baseUrl: 'http://localhost:3001'
				});

				const config = registry.get('test-module');
				expect(config).toBeDefined();
				expect(config?.name).toBe('Test Module');
			});

			it('should unregister a module', () => {
				registry.register({
					id: 'test-module',
					name: 'Test Module',
					description: 'A test module',
					baseUrl: 'http://localhost:3001'
				});

				const removed = registry.unregister('test-module');
				expect(removed).toBe(true);
				expect(registry.has('test-module')).toBe(false);
			});

			it('should return false when unregistering non-existent module', () => {
				const removed = registry.unregister('non-existent');
				expect(removed).toBe(false);
			});

			it('should load multiple configs at once', () => {
				registry.loadFromConfig([
					{ id: 'module1', name: 'Module 1', description: 'D1', baseUrl: 'http://localhost:3001' },
					{ id: 'module2', name: 'Module 2', description: 'D2', baseUrl: 'http://localhost:3002' }
				]);

				expect(registry.size).toBe(2);
			});
		});

		describe('getAll', () => {
			it('should return all registered modules', () => {
				registry.loadFromConfig([
					{ id: 'm1', name: 'M1', description: 'D1', baseUrl: 'http://localhost:3001' },
					{ id: 'm2', name: 'M2', description: 'D2', baseUrl: 'http://localhost:3002' }
				]);

				const all = registry.getAll();
				expect(all.length).toBe(2);
			});
		});

		describe('health checks', () => {
			it('should return unhealthy status for non-existent module', async () => {
				const status = await registry.checkHealth('non-existent');
				expect(status.healthy).toBe(false);
				expect(status.error).toBe('Module not found');
			});

			it('should get cached health status', () => {
				registry.register({
					id: 'test-module',
					name: 'Test',
					description: 'Test',
					baseUrl: 'http://localhost:3001'
				});

				const status = registry.getHealthStatus('test-module');
				expect(status).toBeDefined();
				expect(status?.healthy).toBe(false); // Not checked yet
			});

			it('should return all health statuses', () => {
				registry.loadFromConfig([
					{ id: 'm1', name: 'M1', description: 'D1', baseUrl: 'http://localhost:3001' },
					{ id: 'm2', name: 'M2', description: 'D2', baseUrl: 'http://localhost:3002' }
				]);

				const statuses = registry.getAllHealthStatuses();
				expect(statuses.size).toBe(2);
			});
		});

		describe('delegation tools', () => {
			it('should generate delegation tools for registered modules', () => {
				registry.register({
					id: 'tasks',
					name: 'Tasks Module',
					description: 'Task management',
					baseUrl: 'http://localhost:3001',
					capabilities: { tools: ['task.create', 'task.update'] }
				});

				const tools = registry.getDelegationTools();
				expect(tools.length).toBe(1);
				expect(tools[0].name).toBe('delegate_to_tasks');
				expect(tools[0].description).toContain('Tasks Module');
			});

			it('should return empty tools for no modules', () => {
				const tools = registry.getDelegationTools();
				expect(tools).toHaveLength(0);
			});
		});

		describe('module descriptions', () => {
			it('should describe all registered modules', () => {
				registry.loadFromConfig([
					{
						id: 'tasks',
						name: 'Tasks',
						description: 'Task management',
						baseUrl: 'http://localhost:3001',
						capabilities: { tools: ['create'] }
					},
					{
						id: 'goals',
						name: 'Goals',
						description: 'Goal tracking',
						baseUrl: 'http://localhost:3002'
					}
				]);

				const description = registry.getModuleDescriptions();
				expect(description).toContain('Tasks');
				expect(description).toContain('Goals');
				expect(description).toContain('tools: create');
			});

			it('should return no modules message when empty', () => {
				const description = registry.getModuleDescriptions();
				expect(description).toContain('No module agents');
			});
		});

		describe('clear', () => {
			it('should clear all modules', () => {
				registry.loadFromConfig([
					{ id: 'm1', name: 'M1', description: 'D1', baseUrl: 'http://localhost:3001' },
					{ id: 'm2', name: 'M2', description: 'D2', baseUrl: 'http://localhost:3002' }
				]);

				registry.clear();

				expect(registry.size).toBe(0);
			});
		});
	});

	describe('Integration: Full Multi-Agent Workflow', () => {
		it('should handle hierarchical subagent spawning with tracking', async () => {
			// Root spawns first level subagent
			const level1 = await spawner.spawn(
				{ task: 'Handle user request', label: 'handler' },
				createSpawnContext()
			);
			expect(level1.status).toBe('success');
			expect(spawner.getSubagentDepth(level1.childSessionKey!)).toBe(1);

			// First level spawns second level
			const level2 = await spawner.spawn(
				{ task: 'Process data', label: 'processor' },
				createSpawnContext({ requesterSessionKey: level1.childSessionKey })
			);
			expect(level2.status).toBe('success');
			expect(spawner.getSubagentDepth(level2.childSessionKey!)).toBe(2);

			// Second level spawns third level
			const level3 = await spawner.spawn(
				{ task: 'Analyze results', label: 'analyzer' },
				createSpawnContext({ requesterSessionKey: level2.childSessionKey })
			);
			expect(level3.status).toBe('success');
			expect(spawner.getSubagentDepth(level3.childSessionKey!)).toBe(3);

			// Third level should NOT be able to spawn (at max depth)
			const level4 = await spawner.spawn(
				{ task: 'Should not work', label: 'fail' },
				createSpawnContext({ requesterSessionKey: level3.childSessionKey })
			);
			expect(level4.status).toBe('forbidden');

			// All runs should be trackable
			const allRuns = spawner.getSubagentRunsForSession('root-session');
			expect(allRuns.length).toBe(3);
		});

		it('should cleanup entire chain when root session ends', async () => {
			// Create a chain
			const level1 = await spawner.spawn({ task: 'L1', cleanup: 'delete' }, createSpawnContext());
			const level2 = await spawner.spawn(
				{ task: 'L2', cleanup: 'delete' },
				createSpawnContext({ requesterSessionKey: level1.childSessionKey })
			);

			// Mark all as started and ended
			spawner.markSubagentStarted(level1.runId!);
			spawner.markSubagentStarted(level2.runId!);
			spawner.markSubagentEnded(level2.runId!, { success: true });
			spawner.markSubagentEnded(level1.runId!, { success: true });

			// Level2 session should be cleaned up
			expect(sessionStore.get(level2.childSessionKey!)).toBeUndefined();
			// Level1 session should also be cleaned up (cleanup=delete by default)
			expect(sessionStore.get(level1.childSessionKey!)).toBeUndefined();
		});
	});
});

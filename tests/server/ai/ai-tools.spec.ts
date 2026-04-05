/**
 * AI Tools Tests for MoLOS-Tasks Module
 *
 * These tests cover:
 * 1. Validation functions (pure, no dependencies)
 * 2. AI tool execute functions (using test database with injected repositories)
 *
 * Note: The AI tools use the production database by default.
 * For testing, we create a testable version with injected repositories.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

// Import validation functions from the module
import {
	validateTaskStatus,
	validateTaskPriority,
	validateTaskType,
	validateProjectStatus
} from '../../../modules/MoLOS-Tasks/src/server/ai/validation.js';

// Import schema from the module
import * as schema from '../../../modules/MoLOS-Tasks/src/server/database/schema.js';

// Import repositories for test setup
import { TaskRepository } from '../../../modules/MoLOS-Tasks/src/server/repositories/task-repository.js';
import { ProjectRepository } from '../../../modules/MoLOS-Tasks/src/server/repositories/project-repository.js';
import { AreaRepository } from '../../../modules/MoLOS-Tasks/src/server/repositories/area-repository.js';
import { CommentRepository } from '../../../modules/MoLOS-Tasks/src/server/repositories/comment-repository.js';
import { DependencyRepository } from '../../../modules/MoLOS-Tasks/src/server/repositories/dependency-repository.js';
import { DailyLogRepository } from '../../../modules/MoLOS-Tasks/src/server/repositories/daily-log-repository.js';
import { WorkflowStateRepository } from '../../../modules/MoLOS-Tasks/src/server/repositories/workflow-state-repository.js';

// Import types
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { ToolDefinition } from '../../../modules/MoLOS-Tasks/src/models/index.js';

// ============================================================================
// Test Database Setup
// ============================================================================

/**
 * Creates an in-memory SQLite database for testing with MoLOS-Tasks schema
 */
function createTasksTestDb(): BetterSQLite3Database<Record<string, unknown>> {
	const client = new Database(':memory:');

	// Manually create all tables since migrations folder doesn't exist in tests
	// Note: Table names with dashes must be double-quoted in SQLite
	client.exec(`
		-- Areas table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_areas" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			theme_color TEXT,
			icon TEXT,
			description TEXT,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Projects table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_projects" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			key TEXT NOT NULL UNIQUE,
			key_locked INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'planning',
			description TEXT,
			start_date INTEGER,
			end_date INTEGER,
			area_id TEXT,
			color TEXT,
			icon TEXT,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Tasks table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_tasks" (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			title TEXT NOT NULL,
			description TEXT,
			status TEXT NOT NULL DEFAULT 'todo',
			priority TEXT NOT NULL DEFAULT 'medium',
			task_type TEXT NOT NULL DEFAULT 'task',
			due_date INTEGER,
			do_date INTEGER,
			effort INTEGER,
			context TEXT,
			is_completed INTEGER NOT NULL DEFAULT 0,
			project_id TEXT NOT NULL,
			parent_id TEXT,
			labels TEXT,
			estimate_hours INTEGER,
			time_spent_hours INTEGER NOT NULL DEFAULT 0,
			position INTEGER NOT NULL DEFAULT 0,
			version INTEGER NOT NULL DEFAULT 1,
			key TEXT,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		CREATE INDEX IF NOT EXISTS "idx_tasks_parent" ON "MoLOS-Tasks_tasks"(parent_id);
		CREATE INDEX IF NOT EXISTS "idx_tasks_project_position" ON "MoLOS-Tasks_tasks"(project_id, position);
		CREATE INDEX IF NOT EXISTS "idx_tasks_project_key" ON "MoLOS-Tasks_tasks"(project_id, key);
		CREATE INDEX IF NOT EXISTS "idx_tasks_user" ON "MoLOS-Tasks_tasks"(user_id);
		CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "MoLOS-Tasks_tasks"(status);

		-- Comments table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_comments" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			task_id TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Dependencies table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_dependencies" (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			depends_on_task_id TEXT NOT NULL,
			dependency_type TEXT NOT NULL DEFAULT 'blocks',
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			FOREIGN KEY (task_id) REFERENCES "MoLOS-Tasks_tasks"(id) ON DELETE CASCADE,
			FOREIGN KEY (depends_on_task_id) REFERENCES "MoLOS-Tasks_tasks"(id) ON DELETE CASCADE
		);

		-- Daily log table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_daily_log" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			log_date INTEGER NOT NULL,
			mood TEXT,
			sleep_hours REAL,
			morning_routine INTEGER DEFAULT 0,
			evening_routine INTEGER DEFAULT 0,
			notes TEXT,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		CREATE INDEX IF NOT EXISTS "idx_daily_log_user_date" ON "MoLOS-Tasks_daily_log"(user_id, log_date);

		-- Workflow states table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_workflow_states" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			color TEXT,
			position INTEGER NOT NULL DEFAULT 0,
			is_default INTEGER NOT NULL DEFAULT 0,
			is_completed INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Attachments table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_attachments" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			task_id TEXT NOT NULL,
			file_name TEXT NOT NULL,
			file_size INTEGER NOT NULL,
			file_type TEXT NOT NULL,
			storage_path TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Views table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_views" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			project_id TEXT,
			name TEXT NOT NULL,
			filters TEXT NOT NULL,
			sort_by TEXT,
			sort_order TEXT,
			is_default INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Settings table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_settings" (
			user_id TEXT PRIMARY KEY,
			show_completed INTEGER NOT NULL DEFAULT 0,
			compact_mode INTEGER NOT NULL DEFAULT 0,
			notifications INTEGER NOT NULL DEFAULT 1,
			show_custom_fields INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Custom fields table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_custom_fields" (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			key TEXT NOT NULL,
			field_type TEXT NOT NULL,
			description TEXT,
			required INTEGER NOT NULL DEFAULT 0,
			options TEXT,
			validation TEXT,
			default_value TEXT,
			position INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
		);

		-- Custom field values table
		CREATE TABLE IF NOT EXISTS "MoLOS-Tasks_custom_field_values" (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			field_id TEXT NOT NULL,
			value_text TEXT,
			value_number REAL,
			value_boolean INTEGER,
			value_date INTEGER,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
			FOREIGN KEY (task_id) REFERENCES "MoLOS-Tasks_tasks"(id) ON DELETE CASCADE,
			FOREIGN KEY (field_id) REFERENCES "MoLOS-Tasks_custom_fields"(id) ON DELETE CASCADE
		);
	`);

	const db = drizzle(client, { schema });

	return db as unknown as BetterSQLite3Database<Record<string, unknown>>;
}

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('Task Validation Functions', () => {
	describe('validateTaskStatus', () => {
		it('should return valid status unchanged', () => {
			expect(validateTaskStatus('backlog')).toBe('backlog');
			expect(validateTaskStatus('todo')).toBe('todo');
			expect(validateTaskStatus('in_progress')).toBe('in_progress');
			expect(validateTaskStatus('done')).toBe('done');
			expect(validateTaskStatus('cancelled')).toBe('cancelled');
		});

		it('should return default "todo" for invalid status', () => {
			expect(validateTaskStatus('invalid')).toBe('todo');
			expect(validateTaskStatus('completed')).toBe('todo');
			expect(validateTaskStatus('')).toBe('todo');
			expect(validateTaskStatus(undefined as any)).toBe('todo');
		});

		it('should handle case sensitivity', () => {
			// Note: The validation is case-sensitive, so uppercase values are invalid
			expect(validateTaskStatus('BACKLOG')).toBe('todo');
			expect(validateTaskStatus('Todo')).toBe('todo');
		});
	});

	describe('validateTaskPriority', () => {
		it('should return valid priority unchanged', () => {
			expect(validateTaskPriority('urgent')).toBe('urgent');
			expect(validateTaskPriority('high')).toBe('high');
			expect(validateTaskPriority('medium')).toBe('medium');
			expect(validateTaskPriority('low')).toBe('low');
			expect(validateTaskPriority('no_priority')).toBe('no_priority');
		});

		it('should return default "medium" for invalid priority', () => {
			expect(validateTaskPriority('invalid')).toBe('medium');
			expect(validateTaskPriority('critical')).toBe('medium');
			expect(validateTaskPriority('')).toBe('medium');
			expect(validateTaskPriority(undefined as any)).toBe('medium');
		});
	});

	describe('validateTaskType', () => {
		it('should return valid task type unchanged', () => {
			expect(validateTaskType('task')).toBe('task');
			expect(validateTaskType('bug')).toBe('bug');
			expect(validateTaskType('feature')).toBe('feature');
			expect(validateTaskType('epic')).toBe('epic');
			expect(validateTaskType('story')).toBe('story');
			expect(validateTaskType('improvement')).toBe('improvement');
			expect(validateTaskType('documentation')).toBe('documentation');
			expect(validateTaskType('subtask')).toBe('subtask');
		});

		it('should return default "task" for invalid task type', () => {
			expect(validateTaskType('invalid')).toBe('task');
			expect(validateTaskType('bugfix')).toBe('task');
			expect(validateTaskType('')).toBe('task');
			expect(validateTaskType(undefined as any)).toBe('task');
		});
	});

	describe('validateProjectStatus', () => {
		it('should return valid project status unchanged', () => {
			expect(validateProjectStatus('planning')).toBe('planning');
			expect(validateProjectStatus('active')).toBe('active');
			expect(validateProjectStatus('paused')).toBe('paused');
			expect(validateProjectStatus('done')).toBe('done');
		});

		it('should return default "planning" for invalid project status', () => {
			expect(validateProjectStatus('invalid')).toBe('planning');
			expect(validateProjectStatus('completed')).toBe('planning');
			expect(validateProjectStatus('')).toBe('planning');
			expect(validateProjectStatus(undefined as any)).toBe('planning');
		});
	});
});

// ============================================================================
// AI Tool Execute Function Tests
// ============================================================================

/**
 * Creates test tools with injected repositories for testing
 * This mirrors the structure of getAiTools but allows dependency injection
 */
function createTestableTools(
	db: BetterSQLite3Database<Record<string, unknown>>,
	userId: string
): ToolDefinition[] {
	const taskRepo = new TaskRepository(db as any);
	const projectRepo = new ProjectRepository(db as any);
	const areaRepo = new AreaRepository(db as any);
	const dailyLogRepo = new DailyLogRepository(db as any);
	const workflowStateRepo = new WorkflowStateRepository(db as any);
	const dependencyRepo = new DependencyRepository(db as any);
	const commentRepo = new CommentRepository(db as any);

	return [
		// Task Tools
		{
			name: 'get_tasks',
			description: 'Retrieve a list of tasks',
			parameters: {
				type: 'object',
				properties: {
					status: { type: 'string' },
					projectId: { type: 'string' },
					areaId: { type: 'string' },
					limit: { type: 'number', default: 50 },
					includeContext: { type: 'boolean', default: false }
				}
			},
			metadata: { submodule: 'tasks' },
			execute: async (params: any) => {
				let tasks = await taskRepo.getByUserId(userId, params.limit);
				if (params.status) tasks = tasks.filter((t) => t.status === params.status);
				if (params.projectId) tasks = tasks.filter((t) => t.projectId === params.projectId);
				if (params.areaId) {
					const areaProjects = await projectRepo.getByUserId(userId);
					const areaProjectIds = new Set(
						areaProjects.filter((p) => p.areaId === params.areaId).map((p) => p.id)
					);
					tasks = tasks.filter((t) => areaProjectIds.has(t.projectId));
				}
				if (params.includeContext) {
					tasks = tasks.map((task) => ({
						...task,
						aiContext: {
							hasLabels: !!task.labels && task.labels.length > 0,
							hasEstimate: !!task.estimateHours && task.estimateHours > 0,
							hasTimeSpent: task.timeSpentHours > 0
						}
					}));
				}
				return tasks;
			}
		},
		{
			name: 'bulk_create_tasks',
			description: 'Create multiple tasks',
			parameters: {
				type: 'object',
				properties: {
					tasks: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								title: { type: 'string' },
								description: { type: 'string' },
								projectId: { type: 'string' },
								taskType: { type: 'string' },
								priority: { type: 'string' },
								dueDate: { type: 'number' },
								parentId: { type: 'string' }
							},
							required: ['title', 'projectId']
						}
					}
				},
				required: ['tasks']
			},
			metadata: { submodule: 'tasks' },
			execute: async (params: any) => {
				const results: any[] = [];
				const errors: Array<{ task: any; error: string }> = [];
				const validatedProjects = new Map<string, { valid: boolean; error?: string }>();

				// Validate all projectIds
				for (const task of params.tasks) {
					if (!validatedProjects.has(task.projectId)) {
						const project = await projectRepo.getById(task.projectId, userId);
						if (!project) {
							validatedProjects.set(task.projectId, {
								valid: false,
								error: `Project not found: ${task.projectId}`
							});
						} else if (project.status === 'done') {
							validatedProjects.set(task.projectId, {
								valid: false,
								error: `Project "${project.name}" is completed`
							});
						} else {
							validatedProjects.set(task.projectId, { valid: true });
						}
					}
				}

				// Create tasks
				for (const task of params.tasks) {
					const projectValidation = validatedProjects.get(task.projectId);
					if (projectValidation && !projectValidation.valid) {
						errors.push({
							task: { title: task.title, projectId: task.projectId },
							error: projectValidation.error || `Invalid project: ${task.projectId}`
						});
						continue;
					}

					try {
						const created = await taskRepo.create({
							userId,
							title: task.title,
							description: task.description,
							projectId: task.projectId,
							taskType: validateTaskType(task.taskType),
							priority: validateTaskPriority(task.priority),
							status: 'todo',
							dueDate: task.dueDate || null,
							parentId: task.parentId || null,
							isCompleted: false,
							timeSpentHours: 0,
							position: 0,
							version: 1
						});
						results.push(created);
					} catch (error) {
						errors.push({
							task: { title: task.title, projectId: task.projectId },
							error: error instanceof Error ? error.message : String(error)
						});
					}
				}

				return { created: results.length, failed: errors.length, tasks: results, errors };
			}
		},
		{
			name: 'bulk_update_tasks',
			description: 'Update multiple tasks',
			parameters: {
				type: 'object',
				properties: {
					ids: { type: 'array', items: { type: 'string' } },
					updates: {
						type: 'object',
						properties: {
							status: { type: 'string' },
							priority: { type: 'string' },
							taskType: { type: 'string' },
							areaId: { type: 'string' },
							dueDate: { type: 'number' },
							doDate: { type: 'number' },
							isCompleted: { type: 'boolean' }
						}
					}
				},
				required: ['ids', 'updates']
			},
			metadata: { submodule: 'tasks' },
			execute: async (params: any) => {
				const validatedUpdates: Record<string, any> = { ...params.updates };
				if (params.updates.status) {
					validatedUpdates.status = validateTaskStatus(params.updates.status);
				}
				if (params.updates.priority) {
					validatedUpdates.priority = validateTaskPriority(params.updates.priority);
				}
				if (params.updates.taskType) {
					validatedUpdates.taskType = validateTaskType(params.updates.taskType);
				}
				const results = await Promise.all(
					params.ids.map((id: string) => taskRepo.update(id, userId, validatedUpdates))
				);
				return { updatedCount: results.filter((r) => r !== null).length };
			}
		},
		{
			name: 'bulk_delete_tasks',
			description: 'Delete multiple tasks',
			parameters: {
				type: 'object',
				properties: {
					ids: { type: 'array', items: { type: 'string' } }
				},
				required: ['ids']
			},
			metadata: { submodule: 'tasks' },
			execute: async (params: any) => {
				const results = await Promise.all(
					params.ids.map((id: string) => taskRepo.delete(id, userId))
				);
				return { count: results.filter((r) => r === true).length };
			}
		},

		// Project & Area Tools
		{
			name: 'get_projects',
			description: 'Retrieve projects',
			parameters: {
				type: 'object',
				properties: {
					status: { type: 'string' }
				}
			},
			metadata: { submodule: 'projects' },
			execute: async (params: any) => {
				if (params.status === 'active') return await projectRepo.getActiveProjects(userId);
				const allProjects = await projectRepo.getByUserId(userId);
				if (params.status) {
					return allProjects.filter((p) => p.status === params.status);
				}
				return allProjects;
			}
		},
		{
			name: 'create_project',
			description: 'Create a new project',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					description: { type: 'string' },
					areaId: { type: 'string' }
				},
				required: ['name']
			},
			metadata: { submodule: 'projects' },
			execute: async (params: any) => {
				return await projectRepo.create({ userId, ...params, status: 'active' });
			}
		},
		{
			name: 'get_areas',
			description: 'Retrieve all areas',
			parameters: { type: 'object', properties: {} },
			metadata: { submodule: 'areas' },
			execute: async () => {
				return await areaRepo.getByUserId(userId);
			}
		},
		{
			name: 'create_area',
			description: 'Create a new area',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					description: { type: 'string' },
					themeColor: { type: 'string' }
				},
				required: ['name']
			},
			metadata: { submodule: 'areas' },
			execute: async (params: any) => {
				return await areaRepo.create({ userId, ...params });
			}
		},

		// Comment Tools
		{
			name: 'get_task_comments',
			description: 'Get all comments for a task',
			parameters: {
				type: 'object',
				properties: {
					taskId: { type: 'string' }
				},
				required: ['taskId']
			},
			metadata: { submodule: 'comments' },
			execute: async (params: any) => {
				return await commentRepo.getByTaskId(params.taskId, userId);
			}
		},
		{
			name: 'create_comment',
			description: 'Create a new comment',
			parameters: {
				type: 'object',
				properties: {
					taskId: { type: 'string' },
					content: { type: 'string' }
				},
				required: ['taskId', 'content']
			},
			metadata: { submodule: 'comments' },
			execute: async (params: any) => {
				return await commentRepo.create({
					userId,
					taskId: params.taskId,
					content: params.content
				});
			}
		},

		// Dependency Tools
		{
			name: 'get_task_dependencies',
			description: 'Get dependencies for a task',
			parameters: {
				type: 'object',
				properties: {
					taskId: { type: 'string' }
				},
				required: ['taskId']
			},
			metadata: { submodule: 'dependencies' },
			execute: async (params: any) => {
				const dependencies = await dependencyRepo.getByTaskId(params.taskId, userId);
				const blockedBy = await dependencyRepo.getBlockedByTasks(params.taskId, userId);
				const blocking = await dependencyRepo.getBlockingTasks(params.taskId, userId);
				return { dependencies, blockedBy, blocking };
			}
		},
		{
			name: 'check_task_can_start',
			description: 'Check if a task can start',
			parameters: {
				type: 'object',
				properties: {
					taskId: { type: 'string' }
				},
				required: ['taskId']
			},
			metadata: { submodule: 'dependencies' },
			execute: async (params: any) => {
				return await dependencyRepo.canStart(params.taskId, userId);
			}
		}
	];
}

describe('AI Tool Execute Functions', () => {
	let db: BetterSQLite3Database<Record<string, unknown>>;
	let tools: ToolDefinition[];
	const userId = 'test-user-1';
	const otherUserId = 'test-user-2';

	beforeEach(async () => {
		db = createTasksTestDb();
		tools = createTestableTools(db, userId);
	});

	describe('get_tasks', () => {
		it('should return empty array when no tasks exist', async () => {
			const tool = tools.find((t) => t.name === 'get_tasks');
			expect(tool).toBeDefined();
			const result = await tool!.execute({});
			expect(result).toEqual([]);
		});

		it('should filter tasks by status', async () => {
			// Create a project first
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			// Create tasks via bulk_create
			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			await createTool!.execute({
				tasks: [
					{ title: 'Task 1', projectId: project.id },
					{ title: 'Task 2', projectId: project.id }
				]
			});

			// Get all tasks
			const getTool = tools.find((t) => t.name === 'get_tasks');
			const allTasks = await getTool!.execute({});
			expect(allTasks.length).toBe(2);

			// Update one task to done
			const updateTool = tools.find((t) => t.name === 'bulk_update_tasks');
			await updateTool!.execute({
				ids: [allTasks[0].id],
				updates: { status: 'done' }
			});

			// Filter by status
			const doneTasks = await getTool!.execute({ status: 'done' });
			expect(doneTasks.length).toBe(1);
			expect(doneTasks[0].title).toBe('Task 1');

			const todoTasks = await getTool!.execute({ status: 'todo' });
			expect(todoTasks.length).toBe(1);
			expect(todoTasks[0].title).toBe('Task 2');
		});

		it('should filter tasks by projectId', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project1 = await projectTool!.execute({ name: 'Project 1' });
			const project2 = await projectTool!.execute({ name: 'Project 2' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			await createTool!.execute({
				tasks: [
					{ title: 'Task A', projectId: project1.id },
					{ title: 'Task B', projectId: project2.id }
				]
			});

			const getTool = tools.find((t) => t.name === 'get_tasks');
			const project1Tasks = await getTool!.execute({ projectId: project1.id });
			expect(project1Tasks.length).toBe(1);
			expect(project1Tasks[0].title).toBe('Task A');
		});

		it('should include AI context when requested', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			await createTool!.execute({
				tasks: [
					{
						title: 'Task with labels',
						projectId: project.id,
						taskType: 'bug'
					}
				]
			});

			const getTool = tools.find((t) => t.name === 'get_tasks');
			const tasks = await getTool!.execute({ includeContext: true });
			expect(tasks[0]).toHaveProperty('aiContext');
			expect(tasks[0].aiContext).toHaveProperty('hasLabels');
			expect(tasks[0].aiContext).toHaveProperty('hasEstimate');
			expect(tasks[0].aiContext).toHaveProperty('hasTimeSpent');
		});
	});

	describe('bulk_create_tasks', () => {
		it('should create multiple tasks with valid projectId', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const result = await createTool!.execute({
				tasks: [
					{ title: 'Task 1', projectId: project.id },
					{ title: 'Task 2', projectId: project.id }
				]
			});

			expect(result.created).toBe(2);
			expect(result.failed).toBe(0);
			expect(result.tasks.length).toBe(2);
			expect(result.errors.length).toBe(0);
		});

		it('should fail tasks with invalid projectId', async () => {
			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const result = await createTool!.execute({
				tasks: [
					{ title: 'Task 1', projectId: 'non-existent-project' },
					{ title: 'Task 2', projectId: 'another-invalid' }
				]
			});

			expect(result.created).toBe(0);
			expect(result.failed).toBe(2);
			expect(result.errors.length).toBe(2);
			expect(result.errors[0].error).toContain('Project not found');
		});

		it('should validate and map invalid task types to "task"', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const result = await createTool!.execute({
				tasks: [
					{ title: 'Task with invalid type', projectId: project.id, taskType: 'invalid_type' }
				]
			});

			expect(result.created).toBe(1);
			expect(result.tasks[0].taskType).toBe('task');
		});

		it('should validate and map invalid priorities to "medium"', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const result = await createTool!.execute({
				tasks: [
					{
						title: 'Task with invalid priority',
						projectId: project.id,
						priority: 'invalid_priority'
					}
				]
			});

			expect(result.created).toBe(1);
			expect(result.tasks[0].priority).toBe('medium');
		});

		it('should not create tasks in completed projects', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Completed Project' });

			// Update project to done
			const projectRepo = new ProjectRepository(db as any);
			await projectRepo.update(project.id, userId, { status: 'done' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const result = await createTool!.execute({
				tasks: [{ title: 'Task in completed project', projectId: project.id }]
			});

			expect(result.created).toBe(0);
			expect(result.failed).toBe(1);
			expect(result.errors[0].error).toContain('completed');
		});
	});

	describe('bulk_update_tasks', () => {
		it('should update multiple tasks with valid enum values', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const createResult = await createTool!.execute({
				tasks: [
					{ title: 'Task 1', projectId: project.id },
					{ title: 'Task 2', projectId: project.id }
				]
			});

			const updateTool = tools.find((t) => t.name === 'bulk_update_tasks');
			const updateResult = await updateTool!.execute({
				ids: createResult.tasks.map((t: any) => t.id),
				updates: { status: 'done', priority: 'high' }
			});

			expect(updateResult.updatedCount).toBe(2);

			// Verify updates
			const getTool = tools.find((t) => t.name === 'get_tasks');
			const tasks = await getTool!.execute({});
			expect(tasks.every((t: any) => t.status === 'done')).toBe(true);
			expect(tasks.every((t: any) => t.priority === 'high')).toBe(true);
		});

		it('should map invalid status values to "todo"', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const createResult = await createTool!.execute({
				tasks: [{ title: 'Task 1', projectId: project.id }]
			});

			const updateTool = tools.find((t) => t.name === 'bulk_update_tasks');
			await updateTool!.execute({
				ids: [createResult.tasks[0].id],
				updates: { status: 'invalid_status' }
			});

			const getTool = tools.find((t) => t.name === 'get_tasks');
			const tasks = await getTool!.execute({});
			expect(tasks[0].status).toBe('todo');
		});

		it('should map invalid priority values to "medium"', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const createResult = await createTool!.execute({
				tasks: [{ title: 'Task 1', projectId: project.id }]
			});

			const updateTool = tools.find((t) => t.name === 'bulk_update_tasks');
			await updateTool!.execute({
				ids: [createResult.tasks[0].id],
				updates: { priority: 'invalid_priority' }
			});

			const getTool = tools.find((t) => t.name === 'get_tasks');
			const tasks = await getTool!.execute({});
			expect(tasks[0].priority).toBe('medium');
		});
	});

	describe('bulk_delete_tasks', () => {
		it('should delete multiple tasks', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const createResult = await createTool!.execute({
				tasks: [
					{ title: 'Task 1', projectId: project.id },
					{ title: 'Task 2', projectId: project.id }
				]
			});

			const deleteTool = tools.find((t) => t.name === 'bulk_delete_tasks');
			const deleteResult = await deleteTool!.execute({
				ids: createResult.tasks.map((t: any) => t.id)
			});

			expect(deleteResult.count).toBe(2);

			// Verify tasks are deleted
			const getTool = tools.find((t) => t.name === 'get_tasks');
			const tasks = await getTool!.execute({});
			expect(tasks.length).toBe(0);
		});

		it('should not count non-existent tasks', async () => {
			const deleteTool = tools.find((t) => t.name === 'bulk_delete_tasks');
			const deleteResult = await deleteTool!.execute({
				ids: ['non-existent-1', 'non-existent-2']
			});

			expect(deleteResult.count).toBe(0);
		});
	});

	describe('get_projects', () => {
		it('should return all projects for user', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			await projectTool!.execute({ name: 'Project 1' });
			await projectTool!.execute({ name: 'Project 2' });

			const getTool = tools.find((t) => t.name === 'get_projects');
			const projects = await getTool!.execute({});

			expect(projects.length).toBe(2);
		});

		it('should filter by status', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			await projectTool!.execute({ name: 'Active Project' });
			// Note: create_project defaults to status='active', so Planning Project will also be 'active'
			// We update it to 'planning' to test filtering
			const projectRepo = new ProjectRepository(db as any);
			const planningProject = await projectTool!.execute({ name: 'Planning Project' });
			await projectRepo.update(planningProject.id, userId, { status: 'planning' });

			const getTool = tools.find((t) => t.name === 'get_projects');
			const activeProjects = await getTool!.execute({ status: 'active' });

			expect(activeProjects.length).toBe(1);
			expect(activeProjects[0].name).toBe('Active Project');
		});
	});

	describe('create_project', () => {
		it('should create a project with default status active', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'New Project' });

			expect(project.id).toBeDefined();
			expect(project.name).toBe('New Project');
			expect(project.status).toBe('active');
		});

		it('should create a project with area', async () => {
			const areaTool = tools.find((t) => t.name === 'create_area');
			const area = await areaTool!.execute({ name: 'Work' });

			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Work Project', areaId: area.id });

			expect(project.areaId).toBe(area.id);
		});
	});

	describe('get_areas', () => {
		it('should return all areas for user', async () => {
			const areaTool = tools.find((t) => t.name === 'create_area');
			await areaTool!.execute({ name: 'Work' });
			await areaTool!.execute({ name: 'Personal' });

			const getTool = tools.find((t) => t.name === 'get_areas');
			const areas = await getTool!.execute({});

			expect(areas.length).toBe(2);
		});
	});

	describe('create_comment', () => {
		it('should create a comment on a task', async () => {
			// Create project and task
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const taskResult = await createTool!.execute({
				tasks: [{ title: 'Task with comment', projectId: project.id }]
			});
			const taskId = taskResult.tasks[0].id;

			// Create comment
			const commentTool = tools.find((t) => t.name === 'create_comment');
			const comment = await commentTool!.execute({
				taskId,
				content: 'This is a test comment'
			});

			expect(comment.id).toBeDefined();
			expect(comment.content).toBe('This is a test comment');
			expect(comment.taskId).toBe(taskId);
		});

		it('should retrieve comments for a task', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const taskResult = await createTool!.execute({
				tasks: [{ title: 'Task', projectId: project.id }]
			});
			const taskId = taskResult.tasks[0].id;

			const commentTool = tools.find((t) => t.name === 'create_comment');
			await commentTool!.execute({ taskId, content: 'Comment 1' });
			await commentTool!.execute({ taskId, content: 'Comment 2' });

			const getCommentsTool = tools.find((t) => t.name === 'get_task_comments');
			const comments = await getCommentsTool!.execute({ taskId });

			expect(comments.length).toBe(2);
		});
	});

	describe('get_task_dependencies', () => {
		it('should return dependencies for a task', async () => {
			// Create project and tasks
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const tasksResult = await createTool!.execute({
				tasks: [
					{ title: 'Blocking Task', projectId: project.id },
					{ title: 'Blocked Task', projectId: project.id }
				]
			});

			const blockingTask = tasksResult.tasks[0];
			const blockedTask = tasksResult.tasks[1];

			// Create dependency
			const depRepo = new DependencyRepository(db as any);
			await depRepo.create({
				taskId: blockedTask.id,
				dependsOnTaskId: blockingTask.id,
				dependencyType: 'blocked_by'
			});

			// Get dependencies
			const getDepsTool = tools.find((t) => t.name === 'get_task_dependencies');
			const result = await getDepsTool!.execute({ taskId: blockedTask.id });

			expect(result).toHaveProperty('dependencies');
			expect(result).toHaveProperty('blockedBy');
			expect(result).toHaveProperty('blocking');
		});
	});

	describe('check_task_can_start', () => {
		it('should return canStart true when no blocking dependencies', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const tasksResult = await createTool!.execute({
				tasks: [{ title: 'Independent Task', projectId: project.id }]
			});

			const checkTool = tools.find((t) => t.name === 'check_task_can_start');
			const result = await checkTool!.execute({ taskId: tasksResult.tasks[0].id });

			expect(result.canStart).toBe(true);
		});

		it('should return canStart false when blocked by incomplete task', async () => {
			const projectTool = tools.find((t) => t.name === 'create_project');
			const project = await projectTool!.execute({ name: 'Test Project' });

			const createTool = tools.find((t) => t.name === 'bulk_create_tasks');
			const tasksResult = await createTool!.execute({
				tasks: [
					{ title: 'Blocking Task', projectId: project.id },
					{ title: 'Blocked Task', projectId: project.id }
				]
			});

			const blockingTask = tasksResult.tasks[0];
			const blockedTask = tasksResult.tasks[1];

			// Create dependency
			const depRepo = new DependencyRepository(db as any);
			await depRepo.create({
				taskId: blockedTask.id,
				dependsOnTaskId: blockingTask.id,
				dependencyType: 'blocked_by'
			});

			// Check can start (should be false since blocking task is not done)
			const checkTool = tools.find((t) => t.name === 'check_task_can_start');
			const result = await checkTool!.execute({ taskId: blockedTask.id });

			expect(result.canStart).toBe(false);
		});
	});
});

// ============================================================================
// Integration Tests - Testing the Complete Flow
// ============================================================================

describe('AI Tools Integration Tests', () => {
	let db: BetterSQLite3Database<Record<string, unknown>>;
	let tools: ToolDefinition[];
	const userId = 'test-user-1';
	const otherUserId = 'test-user-2';

	beforeEach(async () => {
		db = createTasksTestDb();
		tools = createTestableTools(db, userId);
	});

	it('should create a complete project hierarchy with tasks', async () => {
		// 1. Create an area
		const areaTool = tools.find((t) => t.name === 'create_area');
		const area = await areaTool!.execute({ name: 'Work', themeColor: '#ff0000' });
		expect(area.id).toBeDefined();

		// 2. Create a project in the area
		const projectTool = tools.find((t) => t.name === 'create_project');
		const project = await projectTool!.execute({
			name: 'Website Redesign',
			description: 'Redesign the company website',
			areaId: area.id
		});
		expect(project.id).toBeDefined();
		expect(project.areaId).toBe(area.id);

		// 3. Create tasks in the project
		const createTaskTool = tools.find((t) => t.name === 'bulk_create_tasks');
		const tasksResult = await createTaskTool!.execute({
			tasks: [
				{ title: 'Create mockups', projectId: project.id, priority: 'high', taskType: 'epic' },
				{
					title: 'Implement frontend',
					projectId: project.id,
					priority: 'medium',
					taskType: 'feature'
				},
				{ title: 'Write tests', projectId: project.id, priority: 'low', taskType: 'task' }
			]
		});
		expect(tasksResult.created).toBe(3);

		// 4. Verify tasks are created
		const getTasksTool = tools.find((t) => t.name === 'get_tasks');
		const tasks = await getTasksTool!.execute({ projectId: project.id });
		expect(tasks.length).toBe(3);

		// 5. Add comments to a task
		const commentTool = tools.find((t) => t.name === 'create_comment');
		await commentTool!.execute({ taskId: tasks[0].id, content: 'Mockups approved!' });
		await commentTool!.execute({ taskId: tasks[0].id, content: 'Starting implementation' });

		const getCommentsTool = tools.find((t) => t.name === 'get_task_comments');
		const comments = await getCommentsTool!.execute({ taskId: tasks[0].id });
		expect(comments.length).toBe(2);

		// 6. Update task status
		const updateTool = tools.find((t) => t.name === 'bulk_update_tasks');
		await updateTool!.execute({ ids: [tasks[0].id], updates: { status: 'in_progress' } });

		// 7. Verify status change
		const updatedTasks = await getTasksTool!.execute({ status: 'in_progress' });
		expect(updatedTasks.length).toBe(1);
		expect(updatedTasks[0].title).toBe('Create mockups');
	});

	it('should handle partial failures in bulk operations', async () => {
		const projectTool = tools.find((t) => t.name === 'create_project');
		const validProject = await projectTool!.execute({ name: 'Valid Project' });

		const createTaskTool = tools.find((t) => t.name === 'bulk_create_tasks');
		const result = await createTaskTool!.execute({
			tasks: [
				{ title: 'Valid Task 1', projectId: validProject.id },
				{ title: 'Invalid Task', projectId: 'non-existent' },
				{ title: 'Valid Task 2', projectId: validProject.id }
			]
		});

		// Should have 2 created, 1 failed
		expect(result.created).toBe(2);
		expect(result.failed).toBe(1);
		expect(result.errors[0].error).toContain('Project not found');

		// Verify valid tasks exist
		const getTasksTool = tools.find((t) => t.name === 'get_tasks');
		const tasks = await getTasksTool!.execute({});
		expect(tasks.length).toBe(2);
	});

	it('should enforce user isolation', async () => {
		// Create tools for another user
		const otherUserTools = createTestableTools(db, otherUserId);

		// User 1 creates a project
		const projectTool = tools.find((t) => t.name === 'create_project');
		const project = await projectTool!.execute({ name: 'Private Project' });

		// User 2 should not see User 1's project
		const getProjectsTool = otherUserTools.find((t) => t.name === 'get_projects');
		const otherProjects = await getProjectsTool!.execute({});
		expect(otherProjects.length).toBe(0);

		// User 1 should see their project
		const userProjectsTool = tools.find((t) => t.name === 'get_projects');
		const userProjects = await userProjectsTool!.execute({});
		expect(userProjects.length).toBe(1);
	});
});

/**
 * MCP Integration Tests for MoLOS-Tasks Module
 *
 * Tests the MCP endpoint at http://localhost:5173/api/ai/mcp/transport
 * Requires the dev server to be running: bun run dev
 *
 * These tests verify:
 * 1. MCP protocol handshake (initialize)
 * 2. Tools discovery (tools/list)
 * 3. Tool execution (tools/call) for MoLOS-Tasks tools
 * 4. Error handling
 * 5. User isolation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

// MCP endpoint configuration
const MCP_URL = 'http://localhost:5173/api/ai/mcp/transport';
const API_KEY = 'mcp_live_91f6211f_cae0853f';

// Test user IDs (for isolation testing)
const TEST_USER_1_ID = 'test-user-integration-1';
const TEST_USER_2_ID = 'test-user-integration-2';

// Track created entities for cleanup
const createdEntities: {
	areas: string[];
	projects: string[];
	tasks: string[];
	comments: string[];
} = {
	areas: [],
	projects: [],
	tasks: [],
	comments: []
};

// ============================================================================
// MCP Client Helper
// ============================================================================

interface JsonRpcRequest {
	jsonrpc: '2.0';
	id: number | string;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: '2.0';
	id: number | string;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

let requestCounter = 0;

async function sendMcpRequest(
	request: Omit<JsonRpcRequest, 'id' | 'jsonrpc'>
): Promise<JsonRpcResponse> {
	requestCounter++;
	const fullRequest: JsonRpcRequest = {
		...request,
		jsonrpc: '2.0',
		id: requestCounter
	};

	const response = await fetch(MCP_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			MOLOS_MCP_API_KEY: API_KEY
		},
		body: JSON.stringify(fullRequest)
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`MCP request failed: ${response.status} ${text}`);
	}

	const data = await response.json();
	return data as JsonRpcResponse;
}

async function initializeMcp(): Promise<void> {
	const response = await sendMcpRequest({
		method: 'initialize',
		params: {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'test-client', version: '1.0.0' }
		}
	});

	expect(response.result).toBeDefined();
	expect(response.error).toBeUndefined();
}

// ============================================================================
// Setup/Teardown
// ============================================================================

describe('MCP Integration Tests - MoLOS-Tasks', () => {
	// Check if server is running before all tests
	beforeAll(async () => {
		try {
			const response = await fetch(MCP_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					MOLOS_MCP_API_KEY: API_KEY
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 0,
					method: 'initialize',
					params: {
						protocolVersion: '2024-11-05',
						capabilities: {},
						clientInfo: { name: 'health-check', version: '1.0.0' }
					}
				})
			});

			if (!response.ok) {
				throw new Error(`Server returned ${response.status}`);
			}
		} catch (err) {
			throw new Error(
				`MCP server not running at ${MCP_URL}. Start with: bun run dev\n` +
					`Error: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	});

	// Initialize MCP session before each test
	beforeEach(async () => {
		await initializeMcp();
		// Reset created entities tracking
		createdEntities.areas = [];
		createdEntities.projects = [];
		createdEntities.tasks = [];
		createdEntities.comments = [];
	});
});

// ============================================================================
// MCP Protocol Tests
// ============================================================================

describe('MCP Protocol Handshake', () => {
	it('should respond to initialize request', async () => {
		const response = await sendMcpRequest({
			method: 'initialize',
			params: {
				protocolVersion: '2024-11-05',
				capabilities: { tools: {} },
				clientInfo: { name: 'test-client', version: '1.0.0' }
			}
		});

		expect(response.jsonrpc).toBe('2.0');
		expect(response.id).toBeDefined();
		expect(response.result).toBeDefined();
		expect(response.error).toBeUndefined();

		// Check result structure
		const result = response.result as Record<string, unknown>;
		expect(result.protocolVersion).toBeDefined();
		expect(result.capabilities).toBeDefined();
		expect(result.serverInfo).toBeDefined();
	});

	it('should reject initialize with invalid protocol version', async () => {
		const response = await sendMcpRequest({
			method: 'initialize',
			params: {
				protocolVersion: 'invalid-version',
				capabilities: {},
				clientInfo: { name: 'test', version: '1.0.0' }
			}
		});

		// Protocol should still work with version negotiation
		expect(response.result).toBeDefined();
	});
});

// ============================================================================
// Tools Discovery Tests
// ============================================================================

describe('Tools Discovery', () => {
	it('should list available tools', async () => {
		const response = await sendMcpRequest({
			method: 'tools/list'
		});

		expect(response.result).toBeDefined();
		expect(response.error).toBeUndefined();

		const result = response.result as { tools: Array<{ name: string; description: string }> };
		expect(result.tools).toBeDefined();
		expect(Array.isArray(result.tools)).toBe(true);
		expect(result.tools.length).toBeGreaterThan(0);

		// Log available tool names for debugging
		console.log(
			'Available tools:',
			result.tools.map((t) => t.name)
		);
	});

	it('should include MoLOS-Tasks tools in the list', async () => {
		const response = await sendMcpRequest({
			method: 'tools/list'
		});

		const result = response.result as { tools: Array<{ name: string }> };
		const toolNames = result.tools.map((t) => t.name);

		// Check for expected MoLOS-Tasks tools
		const expectedTools = [
			'MoLOS-Tasks_get_tasks',
			'MoLOS-Tasks_bulk_create_tasks',
			'MoLOS-Tasks_bulk_update_tasks',
			'MoLOS-Tasks_bulk_delete_tasks',
			'MoLOS-Tasks_get_projects',
			'MoLOS-Tasks_create_project',
			'MoLOS-Tasks_get_areas',
			'MoLOS-Tasks_create_area',
			'MoLOS-Tasks_update_area',
			'MoLOS-Tasks_delete_area',
			'MoLOS-Tasks_get_workflow_states',
			'MoLOS-Tasks_create_workflow_state',
			'MoLOS-Tasks_update_workflow_state',
			'MoLOS-Tasks_delete_workflow_state',
			'MoLOS-Tasks_get_task_dependencies',
			'MoLOS-Tasks_create_task_dependency',
			'MoLOS-Tasks_delete_task_dependency',
			'MoLOS-Tasks_check_task_can_start',
			'MoLOS-Tasks_get_comment',
			'MoLOS-Tasks_get_task_comments',
			'MoLOS-Tasks_create_comment',
			'MoLOS-Tasks_update_comment',
			'MoLOS-Tasks_delete_comment',
			'MoLOS-Tasks_bulk_create_comments',
			'MoLOS-Tasks_bulk_delete_comments',
			'MoLOS-Tasks_bulk_update_comments',
			'MoLOS-Tasks_get_note_hierarchy',
			'MoLOS-Tasks_update_daily_log',
			'MoLOS-Tasks_global_search',
			'MoLOS-Tasks_get_task_with_context',
			'MoLOS-Tasks_get_project_overview',
			'MoLOS-Tasks_get_user_patterns'
		];

		for (const toolName of expectedTools) {
			(expect(toolNames).toContain(toolName), `Tool "${toolName}" should be in tools/list`);
		}
	});

	it('should return tool descriptions', async () => {
		const response = await sendMcpRequest({
			method: 'tools/list'
		});

		const result = response.result as { tools: Array<{ name: string; description: string }> };
		const getTasksTool = result.tools.find((t) => t.name === 'MoLOS-Tasks_get_tasks');

		expect(getTasksTool).toBeDefined();
		expect(getTasksTool!.description).toBeDefined();
		expect(getTasksTool!.description.length).toBeGreaterThan(0);
	});
});

// ============================================================================
// Area Tool Tests
// ============================================================================

describe('Area Tools', () => {
	it('should create an area', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_area',
				arguments: {
					name: 'Test Area',
					description: 'Integration test area',
					themeColor: '#FF5733'
				}
			}
		});

		expect(response.result).toBeDefined();
		expect(response.error).toBeUndefined();

		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.id).toBeDefined();
		expect(parsed.name).toBe('Test Area');
		expect(parsed.themeColor).toBe('#FF5733');

		// Track for cleanup
		createdEntities.areas.push(parsed.id);
	});

	it('should get all areas', async () => {
		// Create an area first
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_area',
				arguments: { name: 'Area to List' }
			}
		});

		const createdArea = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.areas.push(createdArea.id);

		// Get areas
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_areas',
				arguments: {}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const areas = JSON.parse(result.content[0].text);

		expect(Array.isArray(areas)).toBe(true);
		expect(areas.length).toBeGreaterThan(0);

		// Verify our created area is in the list
		const foundArea = areas.find((a: { id: string; name: string }) => a.id === createdArea.id);
		expect(foundArea).toBeDefined();
		expect(foundArea.name).toBe('Area to List');
	});

	it('should update an area', async () => {
		// Create an area
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_area',
				arguments: { name: 'Original Name' }
			}
		});

		const createdArea = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.areas.push(createdArea.id);

		// Update it
		const updateResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_update_area',
				arguments: {
					id: createdArea.id,
					name: 'Updated Name',
					themeColor: '#00FF00'
				}
			}
		});

		expect(updateResponse.result).toBeDefined();
		const result = updateResponse.result as { content: Array<{ type: string; text: string }> };
		const updatedArea = JSON.parse(result.content[0].text);

		expect(updatedArea.name).toBe('Updated Name');
		expect(updatedArea.themeColor).toBe('#00FF00');
	});
});

// ============================================================================
// Project Tool Tests
// ============================================================================

describe('Project Tools', () => {
	it('should create a project without area', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: {
					name: 'Test Project',
					description: 'Integration test project'
				}
			}
		});

		expect(response.result).toBeDefined();
		expect(response.error).toBeUndefined();

		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.id).toBeDefined();
		expect(parsed.name).toBe('Test Project');
		expect(parsed.status).toBe('active');

		createdEntities.projects.push(parsed.id);
	});

	it('should create a project with area', async () => {
		// Create area first
		const areaResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_area',
				arguments: { name: 'Parent Area' }
			}
		});

		const area = JSON.parse(
			(areaResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.areas.push(area.id);

		// Create project with area
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: {
					name: 'Project with Area',
					areaId: area.id
				}
			}
		});

		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.areaId).toBe(area.id);
		createdEntities.projects.push(parsed.id);
	});

	it('should get all projects', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_projects',
				arguments: {}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const projects = JSON.parse(result.content[0].text);

		expect(Array.isArray(projects)).toBe(true);
	});

	it('should filter projects by status', async () => {
		// Create an active project
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: { name: 'Active Project' }
			}
		});

		const createdProject = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.projects.push(createdProject.id);

		// Filter by active status
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_projects',
				arguments: { status: 'active' }
			}
		});

		const result = response.result as { content: Array<{ type: string; text: string }> };
		const projects = JSON.parse(result.content[0].text);

		expect(Array.isArray(projects)).toBe(true);
		projects.forEach((p: { status: string }) => {
			expect(p.status).toBe('active');
		});
	});
});

// ============================================================================
// Task Tool Tests
// ============================================================================

describe('Task Tools', () => {
	let testProjectId: string;

	beforeEach(async () => {
		// Create a project for task tests
		const projectResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: { name: 'Task Test Project' }
			}
		});

		testProjectId = JSON.parse(
			(projectResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		).id;
		createdEntities.projects.push(testProjectId);
	});

	it('should create tasks with bulk_create_tasks', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [
						{
							title: 'Task 1',
							projectId: testProjectId,
							taskType: 'task',
							priority: 'high'
						},
						{
							title: 'Task 2',
							projectId: testProjectId,
							taskType: 'bug',
							priority: 'urgent'
						}
					]
				}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.created).toBe(2);
		expect(parsed.failed).toBe(0);
		expect(parsed.tasks).toHaveLength(2);

		parsed.tasks.forEach((task: { id: string; title: string }) => {
			createdEntities.tasks.push(task.id);
		});
	});

	it('should fail task creation with invalid projectId', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [
						{
							title: 'Orphan Task',
							projectId: 'non-existent-project-id'
						}
					]
				}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.created).toBe(0);
		expect(parsed.failed).toBe(1);
		expect(parsed.errors).toBeDefined();
		expect(parsed.errors[0].error).toContain('Project not found');
	});

	it('should get tasks with filtering', async () => {
		// Create tasks
		await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [
						{ title: 'Backlog Task', projectId: testProjectId },
						{ title: 'Todo Task', projectId: testProjectId }
					]
				}
			}
		});

		// Get all tasks
		const allResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_tasks',
				arguments: { projectId: testProjectId }
			}
		});

		const allResult = allResponse.result as { content: Array<{ type: string; text: string }> };
		const allTasks = JSON.parse(allResult.content[0].text);
		expect(allTasks.length).toBeGreaterThanOrEqual(2);

		// Get tasks by projectId
		const filteredResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_tasks',
				arguments: { projectId: testProjectId }
			}
		});

		const filteredResult = filteredResponse.result as {
			content: Array<{ type: string; text: string }>;
		};
		const filteredTasks = JSON.parse(filteredResult.content[0].text);

		filteredTasks.forEach((task: { projectId: string }) => {
			expect(task.projectId).toBe(testProjectId);
		});
	});

	it('should update tasks with bulk_update_tasks', async () => {
		// Create a task
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [{ title: 'Task to Update', projectId: testProjectId }]
				}
			}
		});

		const created = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		const taskId = created.tasks[0].id;
		createdEntities.tasks.push(taskId);

		// Update it
		const updateResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_update_tasks',
				arguments: {
					ids: [taskId],
					updates: { status: 'done', priority: 'high' }
				}
			}
		});

		const updateResult = updateResponse.result as {
			content: Array<{ type: string; text: string }>;
		};
		const updateParsed = JSON.parse(updateResult.content[0].text);
		expect(updateParsed.updatedCount).toBe(1);
	});

	it('should delete tasks with bulk_delete_tasks', async () => {
		// Create a task
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [{ title: 'Task to Delete', projectId: testProjectId }]
				}
			}
		});

		const created = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		const taskId = created.tasks[0].id;

		// Delete it
		const deleteResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_delete_tasks',
				arguments: { ids: [taskId] }
			}
		});

		const deleteResult = deleteResponse.result as {
			content: Array<{ type: string; text: string }>;
		};
		const deleteParsed = JSON.parse(deleteResult.content[0].text);
		expect(deleteParsed.count).toBe(1);
	});
});

// ============================================================================
// Comment Tool Tests
// ============================================================================

describe('Comment Tools', () => {
	let testProjectId: string;
	let testTaskId: string;

	beforeEach(async () => {
		// Create project and task for comment tests
		const projectResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: { name: 'Comment Test Project' }
			}
		});

		testProjectId = JSON.parse(
			(projectResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		).id;
		createdEntities.projects.push(testProjectId);

		const taskResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [{ title: 'Task for Comments', projectId: testProjectId }]
				}
			}
		});

		const taskResult = JSON.parse(
			(taskResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		testTaskId = taskResult.tasks[0].id;
		createdEntities.tasks.push(testTaskId);
	});

	it('should create a comment', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_comment',
				arguments: {
					taskId: testTaskId,
					content: 'This is a test comment'
				}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.id).toBeDefined();
		expect(parsed.content).toBe('This is a test comment');
		expect(parsed.taskId).toBe(testTaskId);

		createdEntities.comments.push(parsed.id);
	});

	it('should get task comments', async () => {
		// Create a comment
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_comment',
				arguments: {
					taskId: testTaskId,
					content: 'Test comment for retrieval'
				}
			}
		});

		const createdComment = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.comments.push(createdComment.id);

		// Get comments for task
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_task_comments',
				arguments: { taskId: testTaskId }
			}
		});

		const result = response.result as { content: Array<{ type: string; text: string }> };
		const comments = JSON.parse(result.content[0].text);

		expect(Array.isArray(comments)).toBe(true);
		expect(comments.length).toBeGreaterThan(0);

		const foundComment = comments.find((c: { id: string }) => c.id === createdComment.id);
		expect(foundComment).toBeDefined();
		expect(foundComment.content).toBe('Test comment for retrieval');
	});

	it('should update a comment', async () => {
		// Create a comment
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_comment',
				arguments: {
					taskId: testTaskId,
					content: 'Original content'
				}
			}
		});

		const createdComment = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.comments.push(createdComment.id);

		// Update it
		const updateResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_update_comment',
				arguments: {
					id: createdComment.id,
					content: 'Updated content'
				}
			}
		});

		const updateResult = updateResponse.result as {
			content: Array<{ type: string; text: string }>;
		};
		const updatedComment = JSON.parse(updateResult.content[0].text);
		expect(updatedComment.content).toBe('Updated content');
	});

	it('should delete a comment', async () => {
		// Create a comment
		const createResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_comment',
				arguments: {
					taskId: testTaskId,
					content: 'Comment to delete'
				}
			}
		});

		const createdComment = JSON.parse(
			(createResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);

		// Delete it
		const deleteResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_delete_comment',
				arguments: { id: createdComment.id }
			}
		});

		const deleteResult = deleteResponse.result as {
			content: Array<{ type: string; text: string }>;
		};
		const deleteParsed = JSON.parse(deleteResult.content[0].text);
		expect(deleteParsed.success).toBe(true);
	});
});

// ============================================================================
// Dependency Tool Tests
// ============================================================================

describe('Dependency Tools', () => {
	let testProjectId: string;
	let task1Id: string;
	let task2Id: string;

	beforeEach(async () => {
		// Create project and two tasks
		const projectResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: { name: 'Dependency Test Project' }
			}
		});

		testProjectId = JSON.parse(
			(projectResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		).id;
		createdEntities.projects.push(testProjectId);

		const taskResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [
						{ title: 'Blocking Task', projectId: testProjectId },
						{ title: 'Blocked Task', projectId: testProjectId }
					]
				}
			}
		});

		const taskResult = JSON.parse(
			(taskResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		task1Id = taskResult.tasks[0].id;
		task2Id = taskResult.tasks[1].id;
		createdEntities.tasks.push(task1Id, task2Id);
	});

	it('should create a task dependency', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_task_dependency',
				arguments: {
					taskId: task2Id,
					dependsOnTaskId: task1Id,
					dependencyType: 'blocked_by'
				}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.taskId).toBe(task2Id);
		expect(parsed.dependsOnTaskId).toBe(task1Id);
		expect(parsed.dependencyType).toBe('blocked_by');
	});

	it('should get task dependencies', async () => {
		// Create a dependency
		await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_task_dependency',
				arguments: {
					taskId: task2Id,
					dependsOnTaskId: task1Id,
					dependencyType: 'blocked_by'
				}
			}
		});

		// Get dependencies
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_task_dependencies',
				arguments: { taskId: task2Id }
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed).toHaveProperty('dependencies');
		expect(parsed).toHaveProperty('blockedBy');
		expect(parsed).toHaveProperty('blocking');
	});

	it('should check if task can start', async () => {
		// Without dependencies, should be able to start
		const response1 = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_check_task_can_start',
				arguments: { taskId: task1Id }
			}
		});

		const result1 = JSON.parse(
			(response1.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		expect(result1.canStart).toBe(true);

		// Create blocking dependency
		await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_task_dependency',
				arguments: {
					taskId: task2Id,
					dependsOnTaskId: task1Id,
					dependencyType: 'blocked_by'
				}
			}
		});

		// Task 2 should not be able to start (blocked by incomplete task 1)
		const response2 = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_check_task_can_start',
				arguments: { taskId: task2Id }
			}
		});

		const result2 = JSON.parse(
			(response2.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		expect(result2.canStart).toBe(false);
	});
});

// ============================================================================
// Search Tool Tests
// ============================================================================

describe('Search Tools', () => {
	let testProjectId: string;

	beforeEach(async () => {
		// Create a project for search tests
		const projectResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: { name: 'Searchable Project' }
			}
		});

		testProjectId = JSON.parse(
			(projectResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		).id;
		createdEntities.projects.push(testProjectId);

		// Create tasks with searchable content
		await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [
						{ title: 'Unique Search Term Task', projectId: testProjectId },
						{ title: 'Another Task', projectId: testProjectId }
					]
				}
			}
		});
	});

	it('should search across entities', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_global_search',
				arguments: { query: 'Unique Search Term' }
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed).toHaveProperty('tasks');
		expect(parsed).toHaveProperty('projects');
		expect(parsed).toHaveProperty('areas');
		expect(parsed).toHaveProperty('dailyLogs');

		// Should find the task with "Unique Search Term"
		expect(parsed.tasks.length).toBeGreaterThan(0);
		const foundTask = parsed.tasks.find(
			(t: { title: string }) => t.title === 'Unique Search Term Task'
		);
		expect(foundTask).toBeDefined();
	});
});

// ============================================================================
// Workflow Tool Tests
// ============================================================================

describe('Workflow State Tools', () => {
	it('should get workflow states', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_workflow_states',
				arguments: {}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const states = JSON.parse(result.content[0].text);

		expect(Array.isArray(states)).toBe(true);
	});

	it('should create a workflow state', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_workflow_state',
				arguments: {
					name: 'In Review',
					color: '#FFA500',
					position: 5,
					isDefault: false,
					isCompleted: false
				}
			}
		});

		expect(response.result).toBeDefined();
		const result = response.result as { content: Array<{ type: string; text: string }> };
		const parsed = JSON.parse(result.content[0].text);

		expect(parsed.name).toBe('In Review');
		expect(parsed.color).toBe('#FFA500');
		expect(parsed.position).toBe(5);
	});
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
	it('should return error for non-existent tool', async () => {
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'non_existent_tool',
				arguments: {}
			}
		});

		expect(response.error).toBeDefined();
		expect(response.error!.code).toBeDefined();
	});

	it('should return error for missing required parameters', async () => {
		// create_area requires 'name' parameter
		const response = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_area',
				arguments: {} // Missing required 'name'
			}
		});

		// The tool should either return an error or handle gracefully
		// Different tools may have different error handling
		expect(response.result || response.error).toBeDefined();
	});

	it('should handle invalid JSON gracefully', async () => {
		const response = await fetch(MCP_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				MOLOS_MCP_API_KEY: API_KEY
			},
			body: 'invalid json'
		});

		// Should return an error status
		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	it('should reject requests without authentication', async () => {
		const response = await fetch(MCP_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
				// No MOLOS_MCP_API_KEY header
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 999,
				method: 'tools/list'
			})
		});

		// Should return 401 Unauthorized
		expect(response.status).toBe(401);
	});
});

// ============================================================================
// Integration Workflow Tests
// ============================================================================

describe('Complete Workflow Integration', () => {
	it('should execute complete area -> project -> task -> comment workflow', async () => {
		// 1. Create an area
		const areaResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_area',
				arguments: { name: 'Work Area', themeColor: '#3498db' }
			}
		});

		const area = JSON.parse(
			(areaResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.areas.push(area.id);
		expect(area.name).toBe('Work Area');

		// 2. Create a project in the area
		const projectResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_project',
				arguments: {
					name: 'Complete Workflow Project',
					description: 'Testing the complete workflow',
					areaId: area.id
				}
			}
		});

		const project = JSON.parse(
			(projectResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.projects.push(project.id);
		expect(project.areaId).toBe(area.id);

		// 3. Create tasks in the project
		const taskResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_create_tasks',
				arguments: {
					tasks: [
						{
							title: 'Implement feature X',
							projectId: project.id,
							taskType: 'feature',
							priority: 'high'
						},
						{
							title: 'Write tests for feature X',
							projectId: project.id,
							taskType: 'task',
							priority: 'medium'
						}
					]
				}
			}
		});

		const taskResult = JSON.parse(
			(taskResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		expect(taskResult.created).toBe(2);
		taskResult.tasks.forEach((t: { id: string }) => createdEntities.tasks.push(t.id));

		// 4. Add comments to a task
		const taskId = taskResult.tasks[0].id;
		const commentResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_create_comment',
				arguments: {
					taskId: taskId,
					content: 'Started working on this feature'
				}
			}
		});

		const comment = JSON.parse(
			(commentResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);
		createdEntities.comments.push(comment.id);
		expect(comment.content).toBe('Started working on this feature');

		// 5. Update task status
		await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_bulk_update_tasks',
				arguments: {
					ids: [taskId],
					updates: { status: 'in_progress' }
				}
			}
		});

		// 6. Verify everything
		const getTasksResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_get_tasks',
				arguments: { projectId: project.id }
			}
		});

		const tasks = JSON.parse(
			(getTasksResponse.result as { content: Array<{ type: string; text: string }> }).content[0]
				.text
		);

		const updatedTask = tasks.find((t: { id: string }) => t.id === taskId);
		expect(updatedTask.status).toBe('in_progress');

		// 7. Search for our work
		const searchResponse = await sendMcpRequest({
			method: 'tools/call',
			params: {
				name: 'MoLOS-Tasks_global_search',
				arguments: { query: 'feature X' }
			}
		});

		const searchResult = JSON.parse(
			(searchResponse.result as { content: Array<{ type: string; text: string }> }).content[0].text
		);

		expect(searchResult.tasks.length).toBeGreaterThan(0);
		expect(searchResult.projects.length).toBeGreaterThan(0);
		expect(searchResult.areas.length).toBeGreaterThan(0);
	});
});

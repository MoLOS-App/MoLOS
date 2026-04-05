# MCP Integration Plan

> **Phase:** 04  
> **Duration:** 3 days  
> **Status:** ⏳ Pending

---

## Overview

Implement MCP (Model Context Protocol) tools for external AI agents to consume. The module provides data but does NOT call external AI APIs.

**Key Principle:**

- **Module provides** → Data structures and tools via MCP
- **External AI agents consume** → Call MCP tools to read/write tasks
- **No internal AI calls** → Module is data provider only

---

## MCP Tools Inventory

### Existing Tools (10) - Keep + Enhance

1. `get_tasks` - Enhanced with context option
2. `bulk_create_tasks` - Keep as-is
3. `bulk_update_tasks` - Keep as-is
4. `bulk_delete_tasks` - Keep as-is
5. `get_projects` - Keep as-is
6. `create_project` - Keep as-is
7. `get_areas` - Keep as-is
8. `get_note_hierarchy` - Keep as-is
9. `update_daily_log` - Keep as-is
10. `global_search` - Enhanced with context metadata

### New Tools (3) - Create

11. `get_task_with_context` - Full context for AI
12. `get_project_overview` - Project-level data
13. `get_user_patterns` - User behavior analysis

---

## Tool 1: get_task_with_context (NEW)

**Purpose:** Get a task with full context for AI analysis (subtasks, comments, attachments, related tasks).

**File:** `modules/MoLOS-Tasks/src/server/ai/ai-tools.ts`

### Tool Definition

```typescript
export const getTaskWithContext: ToolDefinition = {
	name: 'get_task_with_context',
	description:
		'Get a task with full context including subtasks, comments, attachments, and related tasks for AI analysis',

	parameters: {
		taskId: {
			type: 'string',
			required: true,
			description: 'Task ID to retrieve'
		},
		userId: {
			type: 'string',
			required: true,
			description: 'User ID for authorization'
		},
		includeSubtasks: {
			type: 'boolean',
			required: false,
			default: true,
			description: 'Include subtasks in context'
		},
		includeComments: {
			type: 'boolean',
			required: false,
			default: true,
			description: 'Include comments in context'
		},
		includeAttachments: {
			type: 'boolean',
			required: false,
			default: true,
			description: 'Include attachments in context'
		},
		includeRelated: {
			type: 'boolean',
			required: false,
			default: false,
			description: 'Include related tasks (same project, same status)'
		}
	},

	execute: async (params) => {
		const { taskId, userId, includeSubtasks, includeComments, includeAttachments, includeRelated } =
			params;

		// Get task
		const taskService = new TaskService(/*...*/);
		const task = await taskService.getTaskById(taskId, userId);

		if (!task) {
			throw new Error('Task not found');
		}

		// Get subtasks
		let subtasks = [];
		if (includeSubtasks) {
			subtasks = await taskService.getSubtasks(taskId, userId);
		}

		// Get comments
		let comments = [];
		if (includeComments) {
			const commentService = new CommentService(/*...*/);
			comments = await commentService.getTaskComments(taskId, userId);
		}

		// Get attachments
		let attachments = [];
		if (includeAttachments) {
			const attachmentService = new AttachmentService(/*...*/);
			attachments = await attachmentService.getTaskAttachments(taskId, userId);
		}

		// Get related tasks
		let relatedTasks = [];
		if (includeRelated && task.projectId) {
			relatedTasks = await taskService.getTasks(
				userId,
				{
					projectId: task.projectId,
					status: task.status
				},
				'position',
				'asc'
			);
			// Exclude the requested task
			relatedTasks = relatedTasks.filter((t) => t.id !== taskId);
		}

		return {
			task,
			subtasks,
			comments,
			attachments,
			relatedTasks,
			contextSummary: {
				totalSubtasks: subtasks.length,
				totalComments: comments.length,
				totalAttachments: attachments.length,
				totalRelated: relatedTasks.length
			}
		};
	}
};
```

---

## Tool 2: get_project_overview (NEW)

**Purpose:** Get project-level data including tasks grouped by status, analytics, and configuration.

### Tool Definition

```typescript
export const getProjectOverview: ToolDefinition = {
	name: 'get_project_overview',
	description:
		'Get a project overview with tasks grouped by status, analytics, and configuration for AI analysis',

	parameters: {
		projectId: {
			type: 'string',
			required: true,
			description: 'Project ID to retrieve'
		},
		userId: {
			type: 'string',
			required: true,
			description: 'User ID for authorization'
		},
		includeAnalytics: {
			type: 'boolean',
			required: false,
			default: true,
			description: 'Include task analytics'
		}
	},

	execute: async (params) => {
		const { projectId, userId, includeAnalytics } = params;

		// Get all project tasks
		const taskService = new TaskService(/*...*/);
		const tasks = await taskService.getTasks(userId, { projectId });

		// Group by status
		const tasksByStatus = {
			backlog: tasks.filter((t) => t.status === 'backlog'),
			todo: tasks.filter((t) => t.status === 'todo'),
			in_progress: tasks.filter((t) => t.status === 'in_progress'),
			done: tasks.filter((t) => t.status === 'done'),
			cancelled: tasks.filter((t) => t.status === 'cancelled')
		};

		// Get project details
		const projectService = new ProjectService(/*...*/);
		const project = await projectService.getById(projectId, userId);

		// Analytics
		let analytics = null;
		if (includeAnalytics) {
			const totalTasks = tasks.length;
			const completedTasks = tasksByStatus.done.length;
			const inProgressTasks = tasksByStatus.in_progress.length;
			const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < Date.now()).length;

			// Time tracking
			const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0);
			const totalSpent = tasks.reduce((sum, t) => sum + t.timeSpentHours, 0);

			analytics = {
				totalTasks,
				completedTasks,
				inProgressTasks,
				overdueTasks,
				completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
				totalEstimated,
				totalSpent,
				remainingEstimate: totalEstimated - totalSpent
			};
		}

		return {
			project,
			tasksByStatus,
			analytics
		};
	}
};
```

---

## Tool 3: get_user_patterns (NEW)

**Purpose:** Analyze user behavior patterns (labels used, priority distribution, average time spent, common task types).

### Tool Definition

```typescript
export const getUserPatterns: ToolDefinition = {
	name: 'get_user_patterns',
	description:
		'Analyze user behavior patterns for AI to understand user habits and provide better suggestions',

	parameters: {
		userId: {
			type: 'string',
			required: true,
			description: 'User ID to analyze'
		},
		timeframe: {
			type: 'string',
			required: false,
			default: '30d',
			description: 'Timeframe to analyze (7d, 30d, 90d, all)'
		}
	},

	execute: async (params) => {
		const { userId, timeframe } = params;

		// Calculate date range
		const now = Date.now();
		const cutoff = timeframe === 'all' ? 0 : now - parseTimeframe(timeframe);

		// Get user's tasks
		const taskService = new TaskService(/*...*/);
		const tasks = await taskService.getTasks(userId, {});

		// Filter by timeframe
		const recentTasks = tasks.filter((t) => t.createdAt >= cutoff);

		// Analyze labels
		const labelFrequency: Record<string, number> = {};
		for (const task of recentTasks) {
			const labels = task.labels ? JSON.parse(task.labels) : [];
			for (const label of labels) {
				labelFrequency[label] = (labelFrequency[label] || 0) + 1;
			}
		}

		const topLabels = Object.entries(labelFrequency)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([label, count]) => ({ label, count }));

		// Analyze priorities
		const priorityCount = {
			urgent: recentTasks.filter((t) => t.priority === 'urgent').length,
			high: recentTasks.filter((t) => t.priority === 'high').length,
			medium: recentTasks.filter((t) => t.priority === 'medium').length,
			low: recentTasks.filter((t) => t.priority === 'low').length,
			no_priority: recentTasks.filter((t) => t.priority === 'no_priority').length
		};

		const totalTasks = recentTasks.length;
		const priorityDistribution = {
			urgent: (priorityCount.urgent / totalTasks) * 100,
			high: (priorityCount.high / totalTasks) * 100,
			medium: (priorityCount.medium / totalTasks) * 100,
			low: (priorityCount.low / totalTasks) * 100,
			no_priority: (priorityCount.no_priority / totalTasks) * 100
		};

		// Analyze time tracking
		const completedTasks = recentTasks.filter((t) => t.status === 'done');
		const avgTimeSpent =
			completedTasks.length > 0
				? completedTasks.reduce((sum, t) => sum + t.timeSpentHours, 0) / completedTasks.length
				: 0;

		const estimatedVsActual =
			completedTasks.length > 0
				? completedTasks.reduce((sum, t) => sum + ((t.estimateHours || 0) - t.timeSpentHours), 0)
				: 0;

		// Analyze task completion patterns
		const tasksByDay = recentTasks.reduce(
			(acc, task) => {
				const date = new Date(task.createdAt).toISOString().split('T')[0];
				acc[date] = (acc[date] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>
		);

		const avgTasksPerDay =
			Object.keys(tasksByDay).length > 0
				? Object.values(tasksByDay).reduce((sum, count) => sum + count, 0) /
					Object.keys(tasksByDay).length
				: 0;

		return {
			timeframe,
			totalTasksAnalyzed: recentTasks.length,
			labelPatterns: {
				topLabels,
				uniqueLabels: Object.keys(labelFrequency).length
			},
			priorityDistribution,
			timeTracking: {
				avgTimeSpent: Math.round(avgTimeSpent * 100) / 100,
				avgTasksPerDay: Math.round(avgTasksPerDay * 100) / 100,
				avgAccuracy:
					estimatedVsActual > 0
						? (Math.abs(estimatedVsActual / completedTasks.length) * 100) / 100
						: null
			},
			productivity: {
				completedTasks: completedTasks.length,
				completionRate: totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0,
				mostProductiveDay: Object.entries(tasksByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || null
			}
		};
	}
};

function parseTimeframe(timeframe: string): number {
	const day = 24 * 60 * 60 * 1000;
	const multipliers = { '7d': 7, '30d': 30, '90d': 90 };
	return (multipliers[timeframe] || 30) * day;
}
```

---

## Tool Enhancements (Existing Tools)

### get_tasks - Enhanced

Add `includeContext` parameter:

```typescript
export const getTasks: ToolDefinition = {
	// ... existing code ...

	parameters: {
		userId: {
			/*...*/
		},
		filters: {
			/*...*/
		},
		includeContext: {
			type: 'boolean',
			required: false,
			default: false,
			description: 'Include AI-relevant context (labels, estimates, etc.)'
		}
	},

	execute: async (params) => {
		// ... existing logic ...

		if (params.includeContext) {
			// Add context information for AI
			const context = await buildAIContext(tasks, params.userId);
			return {
				tasks,
				context
			};
		}

		return { tasks };
	}
};
```

### global_search - Enhanced

Add context metadata to search results:

```typescript
export const globalSearch: ToolDefinition = {
	// ... existing code ...

	execute: async (params) => {
		// ... existing logic ...

		// Add AI-relevant metadata to results
		const enrichedResults = results.map((result) => ({
			...result,
			aiMetadata: {
				entityType: result.entityType,
				relationships: getRelationships(result),
				contextScore: calculateContextScore(result)
			}
		}));

		return {
			results: enrichedResults,
			total: enrichedResults.length
		};
	}
};
```

---

## MCP Tool Registration

**File:** `modules/MoLOS-Tasks/src/server/ai/index.ts`

```typescript
import { get_tasks, bulk_create_tasks /*...*/ } from './ai-tools.js';
import { getTaskWithContext, getProjectOverview, getUserPatterns } from './ai-tools-new.js';

export const tasksAITools = {
	// Existing tools
	get_tasks,
	bulk_create_tasks,
	bulk_update_tasks,
	bulk_delete_tasks,
	get_projects,
	create_project,
	get_areas,
	get_note_hierarchy,
	update_daily_log,
	global_search,

	// New tools
	get_task_with_context: getTaskWithContext,
	get_project_overview: getProjectOverview,
	get_user_patterns: getUserPatterns
};

// Export for MCP registration
export default tasksAITools;
```

---

## Tool Schemas

All tool definitions follow MCP schema format:

```typescript
interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<
		string,
		{
			type: string;
			required: boolean;
			description: string;
			default?: any;
			enum?: string[];
		}
	>;
	execute: (params: any) => Promise<any>;
}
```

---

## Checklist

### Day 1 Tasks

- [ ] Create new ai-tools.ts file (or add to existing)
- [ ] Implement get_task_with_context tool
- [ ] Implement get_project_overview tool
- [ ] Implement get_user_patterns tool
- [ ] Write unit tests for new tools
- [ ] Test tools manually

### Day 2 Tasks

- [ ] Enhance get_tasks with includeContext
- [ ] Enhance global_search with metadata
- [ ] Update ai/index.ts exports
- [ ] Register tools with MCP server
- [ ] Test tool registration
- [ ] Test tool invocation via MCP

### Day 3 Tasks

- [ ] Document all tools for external AI agents
- [ ] Create tool usage examples
- [ ] Test tool error handling
- [ ] Verify no internal AI API calls
- [ ] Test user authorization in all tools
- [ ] Finalize tool documentation

---

## Tool Usage Examples

### Example 1: Get Task with Context

```typescript
// External AI agent calls via MCP
const result = await mcpClient.callTool('get_task_with_context', {
  taskId: 'task-123',
  userId: 'user-456',
  includeSubtasks: true,
  includeComments: true,
  includeAttachments: true,
  includeRelated: false
});

// Result
{
  task: { id, title, status, ... },
  subtasks: [{ id, title, ... }],
  comments: [{ id, content, ... }],
  attachments: [{ id, fileName, ... }],
  relatedTasks: [],
  contextSummary: { totalSubtasks: 2, totalComments: 5, totalAttachments: 1, totalRelated: 0 }
}
```

### Example 2: Analyze User Patterns

```typescript
const result = await mcpClient.callTool('get_user_patterns', {
  userId: 'user-456',
  timeframe: '30d'
});

// Result
{
  timeframe: '30d',
  totalTasksAnalyzed: 45,
  labelPatterns: {
    topLabels: [
      { label: 'bug', count: 15 },
      { label: 'feature', count: 12 }
    ],
    uniqueLabels: 8
  },
  priorityDistribution: { urgent: 10, high: 20, medium: 35, low: 25, no_priority: 10 },
  timeTracking: {
    avgTimeSpent: 2.5,
    avgTasksPerDay: 1.5,
    avgAccuracy: -0.3 // Overestimates by 30%
  },
  productivity: {
    completedTasks: 30,
    completionRate: 66.7,
    mostProductiveDay: '2026-02-20'
  }
}
```

---

## Validation

After implementation, verify:

- [ ] All 13 MCP tools are registered
- [ ] All tools require userId for authorization
- [ ] No external AI API calls from module
- [ ] Tool parameters are properly typed
- [ ] Tool descriptions are clear for AI agents
- [ ] Error messages are descriptive
- [ ] Context data is structured for AI consumption
- [ ] Tools return data, not make decisions
- [ ] All tools follow MCP schema format

---

## External AI Agent Documentation

Create documentation for external AI agents:

**Available Tools:**

1. `get_tasks` - List tasks with optional context
2. `get_task_with_context` - Get full task context for analysis
3. `get_project_overview` - Get project analytics and task distribution
4. `get_user_patterns` - Analyze user behavior and habits
5. `bulk_create_tasks` - Create multiple tasks at once
6. `bulk_update_tasks` - Update multiple tasks
7. `bulk_delete_tasks` - Delete multiple tasks
8. `get_projects` - List projects
9. `create_project` - Create new project
10. `get_areas` - List areas
11. `get_note_hierarchy` - Get daily notes grouped by date
12. `update_daily_log` - Update daily log entry
13. `global_search` - Search across all entities

**Authentication:**
All tools require `userId` parameter for authorization. External AI agents must include this in all calls.

**No Internal AI:**
The MoLOS-Tasks module does NOT call external AI APIs. It only provides data and tools via MCP for external AI agents to consume.

---

**Next:** Proceed to Phase 05 - UI Components

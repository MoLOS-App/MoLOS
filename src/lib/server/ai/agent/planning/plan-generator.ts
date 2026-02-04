/**
 * Plan generation using LLM
 * Creates structured execution plans from user requests
 */

import type { ExecutionPlan, PlanStep } from '../core/agent-types';
import type { ToolDefinition } from '$lib/models/ai';
import { uuid } from '$lib/utils/uuid';

/**
 * Generates execution plans using the LLM
 */
export class PlanGenerator {
	/**
	 * Generate a plan from a user request
	 */
	async generatePlan(
		userRequest: string,
		availableTools: ToolDefinition[],
		callLLM: (prompt: string) => Promise<string>
	): Promise<ExecutionPlan> {
		const prompt = this.buildPlanningPrompt(userRequest, availableTools);

		// Call LLM without tools array - planning doesn't need function calling
		const response = await callLLM(prompt);

		return this.parsePlanResponse(response, userRequest);
	}

	/**
	 * Build the planning prompt with full tool schemas
	 */
	private buildPlanningPrompt(userRequest: string, availableTools: ToolDefinition[]): string {
		// Format tools with their parameter schemas
		const toolsInfo = availableTools.map((tool) => {
			const params = tool.parameters?.properties
				? Object.entries(tool.parameters.properties)
						.map(([name, schema]: [string, any]) => {
							const required = (tool.parameters?.required || []).includes(name) ? ' (required)' : ' (optional)';
							const typeInfo = schema.type === 'array' ? `array of ${schema.items?.type || 'objects'}` : schema.type || 'any';
							return `  - ${name}${required}: ${typeInfo}${schema.description ? ` - ${schema.description}` : ''}`;
						})
						.join('\n')
				: '  (no parameters)';
			return `${tool.name}:\n${params}`;
		}).join('\n\n');

		return `You are The Architect, an autonomous AI assistant. Your job is to break down the user's request into a clear, step-by-step execution plan.

User Request: ${userRequest}

Available Tools (with their parameters):
${toolsInfo}

IMPORTANT - Be Conservative:
1. Only suggest using tools if the user explicitly asks for information or actions that require them
2. For simple greetings, casual conversation, or basic questions, set toolName to null
3. Do NOT suggest getting user profile, current time, or checking modules just for conversation
4. Only use tools when there's a clear purpose (e.g., "create a task", "list my projects", "search for something")
5. If the request can be answered conversationally without tools, use null for toolName

CRITICAL - Extract Parameters from User Request:
When you specify a toolName, you MUST include the actual parameters extracted from the user's request.
The "parameters" field must be a valid JSON object with the exact parameter names the tool expects.

Examples of proper parameter extraction:

1. Simple parameter:
   User: "Create a project called 'Website Redesign'"
   Response: { "toolName": "create_project", "parameters": { "name": "Website Redesign" }, "description": "Create project 'Website Redesign'" }

2. Multiple parameters:
   User: "Create a task called 'Buy groceries' with high priority"
   Response: { "toolName": "create_task", "parameters": { "title": "Buy groceries", "priority": "high" }, "description": "Create task 'Buy groceries'" }

3. ARRAY parameters (pay attention!):
   User: "Create 3 tasks: Task A with high priority, Task B, and Task C with low priority"
   Response: { "toolName": "bulk_create_tasks", "parameters": { "tasks": [{ "title": "Task A", "priority": "high" }, { "title": "Task B" }, { "title": "Task C", "priority": "low" }] }, "description": "Create 3 tasks" }

4. Read-only tools (no parameters needed):
   User: "List all tasks"
   Response: { "toolName": "get_tasks", "parameters": {}, "description": "List all tasks" }

5. No tool needed:
   User: "Just say hi"
   Response: { "toolName": null, "parameters": null, "description": "Greet the user" }

Instructions:
1. Analyze what the user wants to accomplish
2. If this is a simple conversational request, create 1 step with toolName: null
3. Only break down into multiple steps if tools are genuinely needed
4. For each tool-using step, carefully extract ALL required parameters from the user's request
5. For array parameters, extract EACH item into a properly formatted array element
6. The "description" is for humans to read - "parameters" is what the tool actually executes

Respond in this exact JSON format:
{
  "goal": "brief summary of what we're accomplishing",
  "steps": [
    {
      "description": "Human-readable description of what we're doing",
      "toolName": "tool_name or null",
      "parameters": { tool parameters as JSON object, or {} if no params needed, or null if no tool },
      "reasoning": "why this step is necessary"
    }
  ]
}

Keep plans focused and actionable. 1-3 steps is ideal for most requests. Only use tools when clearly needed.`;
	}

	/**
	 * Parse the LLM response into an ExecutionPlan
	 */
	private parsePlanResponse(response: string, userRequest: string): ExecutionPlan {
		try {
			// Try to extract JSON from the response
			const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
			const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;

			const parsed = JSON.parse(jsonStr);

			if (!parsed.goal || !Array.isArray(parsed.steps)) {
				throw new Error('Invalid plan format');
			}

			const steps: PlanStep[] = parsed.steps.map((step: any, index: number) => ({
				id: uuid(),
				description: step.description,
				toolName: step.toolName || undefined,
				parameters: step.parameters || undefined,
				status: 'pending' as const,
				dependencies: step.dependencyIds || [],
				result: undefined,
				error: undefined
			}));

			return {
				id: uuid(),
				goal: parsed.goal,
				steps,
				status: 'draft',
				createdAt: Date.now()
			};
		} catch (error) {
			// Fallback: Create a simple plan with one step
			console.warn('Failed to parse plan response, using fallback:', error);
			return this.createFallbackPlan(userRequest);
		}
	}

	/**
	 * Create a fallback plan when parsing fails
	 * For simple conversational queries, create a minimal plan without steps
	 */
	private createFallbackPlan(userRequest: string): ExecutionPlan {
		// Simple heuristic: if short and doesn't look like a task, skip steps
		const trimmed = userRequest.toLowerCase().trim();
		const isSimple = trimmed.length < 50 && !trimmed.includes('create') && !trimmed.includes('help') && !trimmed.includes('need') && !trimmed.includes('list') && !trimmed.includes('show');

		if (isSimple) {
			return {
				id: uuid(),
				goal: `Respond to user message`,
				steps: [],
				status: 'draft',
				createdAt: Date.now()
			};
		}

		return {
			id: uuid(),
			goal: `Handle: ${userRequest.slice(0, 100)}${userRequest.length > 100 ? '...' : ''}`,
			steps: [
				{
					id: uuid(),
					description: `Process the user's request: "${userRequest}"`,
					status: 'pending',
					dependencies: []
				}
			],
			status: 'draft',
			createdAt: Date.now()
		};
	}

	/**
	 * Create a simple plan for quick tasks
	 */
	createQuickPlan(description: string, steps: Array<{ description: string; toolName?: string }>): ExecutionPlan {
		return {
			id: uuid(),
			goal: description,
			steps: steps.map(
				(s) =>
					({
						id: uuid(),
						description: s.description,
						toolName: s.toolName,
						status: 'pending',
						dependencies: []
					}) as PlanStep
			),
			status: 'draft',
			createdAt: Date.now()
		};
	}
}

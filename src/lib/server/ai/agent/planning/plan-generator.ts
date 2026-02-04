/**
 * Plan generation using LLM
 * Creates structured execution plans from user requests
 */

import type { ExecutionPlan, PlanStep } from '../core/agent-types';
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
		availableTools: string[],
		callLLM: (prompt: string) => Promise<string>
	): Promise<ExecutionPlan> {
		const prompt = this.buildPlanningPrompt(userRequest, availableTools);

		// Call LLM without tools array - planning doesn't need function calling
		const response = await callLLM(prompt);

		return this.parsePlanResponse(response, userRequest);
	}

	/**
	 * Build the planning prompt
	 */
	private buildPlanningPrompt(userRequest: string, availableTools: string[]): string {
		return `You are The Architect, an autonomous AI assistant. Your job is to break down the user's request into a clear, step-by-step execution plan.

User Request: ${userRequest}

Available Tools:
${availableTools.map((t) => `- ${t}`).join('\n')}

Instructions:
1. Analyze what the user wants to accomplish
2. Break down the request into specific, actionable steps
3. Each step should use one of the available tools (if applicable)
4. Steps should be ordered logically with dependencies
5. Be specific about what each step accomplishes

Respond in this exact JSON format:
{
  "goal": "brief summary of what we're accomplishing",
  "steps": [
    {
      "description": "First, I need to...",
      "toolName": "tool_name or null",
      "reasoning": "why this step is necessary"
    },
    {
      "description": "Then, I will...",
      "toolName": "tool_name or null",
      "reasoning": "how this builds on previous steps"
    }
  ]
}

Keep plans focused and actionable. 3-7 steps is ideal for most requests.`;
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
	 */
	private createFallbackPlan(userRequest: string): ExecutionPlan {
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

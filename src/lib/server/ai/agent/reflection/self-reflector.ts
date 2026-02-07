/**
 * Self-reflection and correction mechanism
 * Allows the agent to review its actions and adjust course
 */

import type {
	ReflectionResult,
	ToolExecutionResult,
	PlanStep,
	ExecutionPlan
} from '../core/agent-types';

/**
 * Handles agent self-reflection after actions
 */
export class SelfReflector {
	/**
	 * Reflect on a completed tool execution
	 */
	async reflectOnActionResult(
		step: PlanStep,
		result: ToolExecutionResult,
		plan: ExecutionPlan,
		callLLM: (prompt: string) => Promise<string>
	): Promise<ReflectionResult> {
		// Quick reflection without LLM for simple cases
		if (result.success && result.result) {
			return this.quickReflection(step, result, plan);
		}

		// Deep reflection with LLM for complex cases
		return await this.deepReflection(step, result, plan, callLLM);
	}

	/**
	 * Quick reflection for successful executions
	 */
	private quickReflection(
		step: PlanStep,
		result: ToolExecutionResult,
		plan: ExecutionPlan
	): ReflectionResult {
		// Check if we got meaningful data
		const hasData =
			result.result !== null &&
			result.result !== undefined &&
			!(typeof result.result === 'object' && 'error' in result.result);

		if (!hasData) {
			return {
				isSatisfied: false,
				shouldContinue: true,
				nextAction: 'continue',
				thoughts: `Step "${step.description}" completed but returned no data. Continuing to next step.`,
				corrections: []
			};
		}

		// Check if plan is complete
		const remainingSteps = plan.steps.filter(
			(s) => s.status === 'pending' || s.status === 'in_progress'
		);
		const isComplete = remainingSteps.length === 0;

		return {
			isSatisfied: true,
			shouldContinue: !isComplete,
			nextAction: isComplete ? 'complete' : 'continue',
			thoughts: `Successfully completed: ${step.description}. ${isComplete ? 'All steps complete!' : `Moving to next step.`}`,
			corrections: []
		};
	}

	/**
	 * Deep reflection using LLM for complex cases
	 */
	private async deepReflection(
		step: PlanStep,
		result: ToolExecutionResult,
		plan: ExecutionPlan,
		callLLM: (prompt: string) => Promise<string>
	): Promise<ReflectionResult> {
		const prompt = this.buildReflectionPrompt(step, result, plan);
		const response = await callLLM(prompt);

		return this.parseReflectionResponse(response);
	}

	/**
	 * Build reflection prompt
	 */
	private buildReflectionPrompt(
		step: PlanStep,
		result: ToolExecutionResult,
		plan: ExecutionPlan
	): string {
		return `You are The Architect, reflecting on your actions.

Plan Goal: ${plan.goal}

Step Just Completed: ${step.description}
Step Status: ${result.success ? 'Success' : 'Failed'}
Result: ${JSON.stringify(result.result)}
${result.error ? `Error: ${result.error}` : ''}

Remaining Steps:
${
	plan.steps
		.filter((s) => s.status === 'pending')
		.map((s) => `- ${s.description}`)
		.join('\n') || '(none)'
}

Analyze this situation and respond in JSON format:
{
  "isSatisfied": true/false,
  "shouldContinue": true/false,
  "nextAction": "continue" | "retry" | "skip" | "complete",
  "thoughts": "what you're thinking",
  "corrections": ["any corrections needed", "optional"]
}

Guidelines:
- If the step succeeded and you got useful data, isSatisfied=true
- If the step failed but you can work around it, shouldContinue=true
- If the step failed critically, nextAction="retry"
- If the step isn't necessary anymore, nextAction="skip"
- Be honest about what worked and what didn't`;
	}

	/**
	 * Parse reflection response
	 */
	private parseReflectionResponse(response: string): ReflectionResult {
		try {
			const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
			const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;

			const parsed = JSON.parse(jsonStr);

			return {
				isSatisfied: parsed.isSatisfied ?? false,
				shouldContinue: parsed.shouldContinue ?? true,
				nextAction: parsed.nextAction ?? 'continue',
				thoughts: parsed.thoughts || 'Continuing...',
				corrections: parsed.corrections || []
			};
		} catch (error) {
			console.warn('Failed to parse reflection response:', error);
			return {
				isSatisfied: false,
				shouldContinue: true,
				nextAction: 'continue',
				thoughts: 'Unable to parse reflection, continuing.',
				corrections: []
			};
		}
	}

	/**
	 * Verify task completion by checking the result
	 */
	verifyCompletion(result: ToolExecutionResult, expectedType?: string): boolean {
		if (!result.success) return false;

		const data = result.result;

		// Check for error in result
		if (typeof data === 'object' && data !== null && 'error' in data) {
			return false;
		}

		// Check expected type if provided
		if (expectedType) {
			switch (expectedType) {
				case 'array':
					return Array.isArray(data);
				case 'object':
					return typeof data === 'object' && data !== null && !Array.isArray(data);
				case 'string':
					return typeof data === 'string';
				case 'number':
					return typeof data === 'number';
				case 'boolean':
					return typeof data === 'boolean';
			}
		}

		// Default: assume success if no error
		return data !== null && data !== undefined;
	}
}

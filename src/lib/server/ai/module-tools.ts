import type { ToolDefinition } from '$lib/models/ai';
// import { getFinanceAiTools } from '$lib/server/ai/modules/finance/ai-tools';
// import { getHealthAiTools } from '$lib/server/ai/modules/health/ai-tools';
// import { getGoalsAiTools } from '$lib/server/ai/modules/goals/ai-tools';
// import { getMealsAiTools } from '$lib/server/ai/modules/meals/ai-tools';

/**
 * Registry of AI tool fetching functions for each module.
 * This is kept on the server side to avoid importing server-only code into the client.
 */
export const MODULE_AI_TOOLS: Record<
	string,
	(userId: string) => ToolDefinition[] | Promise<ToolDefinition[]>
> = {
	// finance: getFinanceAiTools,
	// health: getHealthAiTools,
	// goals: getGoalsAiTools,
	// meals: getMealsAiTools
};

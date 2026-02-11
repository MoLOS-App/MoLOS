import { getCoreAiTools } from './core-tools';
import { getAllModules } from '$lib/config';
import type { ToolDefinition } from '$lib/models/ai';
import { TtlCache } from './agent-utils';

const externalToolLoaders = import.meta.glob('./external_modules/*/ai-tools.ts');
const TOOLBOX_CACHE_TTL_MS = Number(process.env.AI_AGENT_TOOLBOX_CACHE_TTL_MS || 10_000);
const TOOLBOX_CACHE_SIZE = Number(process.env.AI_AGENT_TOOLBOX_CACHE_SIZE || 64);
const toolCache = new TtlCache<ToolDefinition[]>(TOOLBOX_CACHE_SIZE);
const promptCache = new TtlCache<string>(TOOLBOX_CACHE_SIZE);
const debugEnabled =
	process.env.AI_AGENT_DEBUG === '1' || process.env.AI_AGENT_DEBUG?.toLowerCase() === 'true';

function logDebug(message: string, ...args: unknown[]) {
	if (!debugEnabled) return;
	console.log(message, ...args);
}

export class AiToolbox {
	/**
	 * Dynamically discover and return all available tools for the user.
	 * This includes core tools and tools from active external modules.
	 */
	async getTools(userId: string, activeModuleIds: string[] = []): Promise<ToolDefinition[]> {
		console.log(
			'[AiToolbox] getTools called with userId:',
			userId,
			'activeModuleIds:',
			activeModuleIds
		);
		const cacheKey = `${userId}:${[...activeModuleIds].sort().join(',') || 'core'}`;
		const cached = toolCache.get(cacheKey);
		if (cached) {
			console.log('[AiToolbox] Returning cached tools, count:', cached.length);
			return cached;
		}

		// 1. Start with core tools (global/system level)
		let tools = getCoreAiTools(userId);
		console.log('[AiToolbox] Core tools loaded:', tools.length);

		// 2. Discover tools from all registered modules (core and external)
		const allModules = getAllModules();
		console.log(
			'[AiToolbox] All modules found:',
			allModules.map((m) => ({ id: m.id, name: m.name, isExternal: m.isExternal }))
		);

		// We include all core modules by default, and external modules only if active
		const modulesToLoad = allModules.filter((m) => !m.isExternal || activeModuleIds.includes(m.id));
		console.log('[AiToolbox] activeModuleIds:', activeModuleIds);
		console.log(
			'[AiToolbox] Modules to load:',
			modulesToLoad.map((m) => m.id)
		);

		for (const module of modulesToLoad) {
			logDebug(`[AiToolbox] Processing module: ${module.id} (external: ${module.isExternal})`);
			try {
				// Try to load AI tools from module
				try {
					if (!module.isExternal) {
						continue;
					}

					logDebug(`[AiToolbox] Importing tools for module: ${module.id}`);
					const loaderPath = `./external_modules/${module.id}/ai-tools.ts`;
					const loader = externalToolLoaders[loaderPath];

					if (!loader) {
						logDebug(`[AiToolbox] No AI tools found at ${loaderPath}`);
						continue;
					}

					const aiToolsModule = (await loader()) as {
						getAiTools?: (userId: string) => Promise<ToolDefinition[]> | ToolDefinition[];
					};
					logDebug(
						`[AiToolbox] Import successful for ${module.id}, has getAiTools:`,
						!!aiToolsModule.getAiTools
					);
					if (aiToolsModule.getAiTools) {
						logDebug(`[AiToolbox] Loading AI tools for module: ${module.name}`);
						const moduleTools = await aiToolsModule.getAiTools(userId);
						// Prefix tool names with module ID to avoid duplicates
						const prefixedTools = moduleTools.map((tool) => ({
							...tool,
							name: `${module.id}_${tool.name}`
						}));
						logDebug(`[AiToolbox] Module ${module.id} provided ${prefixedTools.length} tools`);
						tools = [...tools, ...prefixedTools];
					} else {
						logDebug(`[AiToolbox] Module ${module.id} has no getAiTools function`);
					}
				} catch (importError) {
					logDebug(`[AiToolbox] Import failed for module ${module.id}:`, importError);
					// No AI tools for this module
				}
			} catch (e) {
				console.warn(`[AiToolbox] Failed to load AI tools for module ${module.id}:`, e);
			}
		}

		toolCache.set(cacheKey, tools, TOOLBOX_CACHE_TTL_MS);
		logDebug('[AiToolbox] Total tools returned:', tools.length);
		return tools;
	}

	/**
	 * Generate a dynamic system prompt based on available tools and modules.
	 */
	async getDynamicSystemPrompt(userId: string, activeModuleIds: string[] = []): Promise<string> {
		const cacheKey = `${userId}:${[...activeModuleIds].sort().join(',') || 'core'}`;
		const cached = promptCache.get(cacheKey);
		if (cached) return cached;

		const allModules = getAllModules();
		const activeModules = allModules.filter((m) => activeModuleIds.includes(m.id) || !m.isExternal);

		const prompt = `You are the MoLOS Architect Agent, an advanced in-app developer assistant integrated into the Modular Life Organization System (MoLOS).
Your mission is to provide proactive, intelligent, and context-aware management of the user's digital life.

# CORE IDENTITY
- You are a world-class AI assistant specialized in life organization and productivity.
- You operate on the "AI Flow" paradigm: working independently when possible, and collaboratively when needed.
- You are proactive, not just reactive. You look for patterns and suggest improvements.

# CURRENTLY ACTIVE MODULES
${activeModules.map((m) => `- ${m.name}: ${m.description}`).join('\n')}

# OPERATING GUIDELINES
1. **Internal Reasoning (CRITICAL)**:
   - ALWAYS start your response by thinking out loud inside \`<thought>\` tags.
   - Analyze the user's intent and identify required data.
   - This section is for your internal logic and will be hidden from the user.

2. **Planning**:
   - For complex tasks, maintain a plan inside \`<plan>\` tags.
   - List the steps you intend to take and mark them as [ ] (pending) or [x] (completed).
   - Update the plan in each iteration as you progress.

3. **Tool Usage**:
	  - Use tools to gather information before making assumptions.
	  - If you need to read multiple pieces of data, call the tools in parallel if they are independent.
	  - For destructive or significant changes (create, update, delete), explain what you are about to do and ask for confirmation if it's a major change.
	  - Use "Action Tags" in your final response to show what you did (e.g., "I've updated your TaskRepository...").

4. **Data Synthesis & Analysis**:
	  - Look across modules. If a user asks about their day, check tasks, routines, and health data.
	  - Identify conflicts (e.g., "You have a task due at the same time as your morning routine").
	  - Suggest optimizations based on trends.

5. **Communication Style**:
	  - Be concise, professional, and helpful.
	  - Use Markdown for all responses (bold, lists, tables, etc.).
	  - Refer to the user in the second person ("you") and yourself in the first person ("I").

# TOOL CALLING PROTOCOL
- **Research First**: If you are unsure about data, use search/get tools. NEVER guess.
- **Parallel Execution**: Maximize efficiency by calling independent tools simultaneously.
- **Step-by-Step**: For multi-step tasks, update your internal plan in the \`<thought>\` block.

# EXAMPLES OF GOOD BEHAVIOR
<example>
USER: "How is my day looking?"
ASSISTANT:
<thought>
The user wants a summary of their day. I need to check tasks, routines, and any recent activity.
I will call get_daily_summary to get a comprehensive overview.
</thought>
<plan>
[ ] Get daily summary
[ ] Analyze results and present to user
</plan>
*Calls get_daily_summary*
</example>

<example>
USER: "Mark all my tasks as completed except the first one"
ASSISTANT:
<thought>
I need to:
1. Fetch all tasks to identify which ones to update.
2. Identify the "first" task (usually the oldest or the one at the top of the list).
3. Update all other tasks to 'completed'.
</thought>
<plan>
[ ] Fetch all tasks
[ ] Identify the first task
[ ] Update remaining tasks to completed
</plan>
*Calls get_tasks*
</example>

# CRITICAL: TOOL EXECUTION & MULTI-STEP PROCESSES
1. **Immediate Execution**: When you decide to call a tool, you MUST output the tool call immediately. DO NOT just describe what you will do.
2. **Sequential Logic**: If a task requires multiple steps (e.g., fetch data -> analyze -> update), perform the first step, wait for the result, then perform the next step.
3. **Verification**: After performing a "write" action (create, update, delete), ALWAYS verify the result by fetching the data again or checking the return value.
4. **Error Handling**: If a tool call fails, analyze the error in your thought block and try an alternative approach or ask the user for clarification.
5. **No Hallucinations**: NEVER claim you have completed a task unless you have successfully executed the corresponding tool calls and verified the results.

Use the provided tools to interact with the database. Your goal is to make the user's life more organized and efficient.

# MULTIMODAL CAPABILITIES
- You can now receive and process attachments and multi-part messages.
- If the user provides an image or a file, analyze its content and incorporate it into your reasoning.
- When responding, you can refer to specific parts of the input if necessary.`;

		promptCache.set(cacheKey, prompt, TOOLBOX_CACHE_TTL_MS);
		return prompt;
	}
}

/**
 * Clear the tool cache (for debugging)
 */
export function clearToolboxCache() {
	toolCache.clear();
	console.log('[AiToolbox] Cache cleared');
}

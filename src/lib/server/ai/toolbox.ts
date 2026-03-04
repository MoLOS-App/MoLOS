import { getCoreAiTools } from './core-tools';
import { getAllModules, getModuleById } from '$lib/config';
import type { ToolDefinition } from '$lib/models/ai';
import type { ModuleConfig } from '@molos/module-types';
import { TtlCache } from './agent-utils';

// Lazy load module AI tools - this is the CORRECT path to the modules directory
const moduleAiTools = import.meta.glob('../../../../modules/*/src/server/ai/ai-tools.ts', {
	eager: false
}) as Record<string, () => Promise<unknown>>;

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

/**
 * Extract module name from path like '../../../../modules/MoLOS-Tasks/src/server/ai/ai-tools.ts'
 */
function extractModuleNameFromPath(path: string): string | null {
	const match = path.match(/modules\/([^/]+)\/src\/server\/ai\/ai-tools\.ts$/);
	return match ? match[1] : null;
}

/**
 * Extract category from module ID (e.g., "MoLOS-Tasks" -> "tasks")
 */
function extractCategoryFromModuleId(moduleId: string): string {
	return moduleId.toLowerCase().replace(/^molos-/, '');
}

export class AiToolbox {
	/**
	 * Dynamically discover and return all available tools for the user.
	 * This includes core tools and tools from active external modules.
	 * Tools from mentioned modules are prioritized (appear first in the list).
	 */
	async getTools(
		userId: string,
		activeModuleIds: string[] = [],
		mentionedModuleIds: string[] = []
	): Promise<ToolDefinition[]> {
		console.log(
			'[AiToolbox] getTools called with userId:',
			userId,
			'activeModuleIds:',
			activeModuleIds,
			'mentionedModuleIds:',
			mentionedModuleIds
		);
		const cacheKey = `${userId}:${[...activeModuleIds].sort().join(',') || 'core'}:${[...mentionedModuleIds].sort().join(',') || 'none'}`;
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

		// If activeModuleIds is provided, ONLY load those modules
		// If activeModuleIds is empty, load all package modules
		const modulesToLoad =
			activeModuleIds.length > 0
				? allModules.filter((m) => activeModuleIds.includes(m.id))
				: allModules.filter((m) => m.isPackageModule);

		console.log('[AiToolbox] activeModuleIds:', activeModuleIds);
		console.log(
			'[AiToolbox] Modules to load:',
			modulesToLoad.map((m) => m.id)
		);

		for (const module of modulesToLoad) {
			logDebug(
				`[AiToolbox] Processing module: ${module.id} (packageModule: ${module.isPackageModule}, external: ${module.isExternal})`
			);
			try {
				// Skip non-package modules (they don't have AI tools in modules/*/src/server/ai/ai-tools.ts)
				if (!module.isPackageModule) {
					continue;
				}

				logDebug(`[AiToolbox] Looking for tools for module: ${module.id}`);

				// Find the AI tools module by matching the module ID
				const modulePath = Object.keys(moduleAiTools).find((p) => {
					const moduleName = extractModuleNameFromPath(p);
					return (
						moduleName === module.id ||
						// Handle legacy module IDs that may differ from directory names
						module.id.toLowerCase().includes(moduleName?.toLowerCase() || '') ||
						moduleName?.toLowerCase().includes(module.id.toLowerCase())
					);
				});

				if (!modulePath) {
					logDebug(`[AiToolbox] No AI tools found for module: ${module.id}`);
					continue;
				}

				logDebug(`[AiToolbox] Found AI tools at path: ${modulePath}`);

				// Lazy import with error handling for broken modules
				const aiToolsModule = await moduleAiTools[modulePath]().catch((err) => {
					console.warn(`[AiToolbox] Failed to import module ${module.id}:`, err.message);
					return null;
				});

				if (!aiToolsModule || !aiToolsModule.getAiTools) {
					logDebug(`[AiToolbox] Module ${module.id} has no getAiTools function`);
					continue;
				}

				logDebug(
					`[AiToolbox] Module found for ${module.id}, has getAiTools:`,
					!!aiToolsModule.getAiTools
				);

				logDebug(`[AiToolbox] Loading AI tools for module: ${module.name}`);
				const moduleTools = await aiToolsModule.getAiTools(userId);

				// Add metadata to tools that don't have it (backward compatibility)
				const category = extractCategoryFromModuleId(module.id);
				const toolsWithMetadata = moduleTools.map((tool: ToolDefinition) => ({
					...tool,
					metadata: tool.metadata || {
						category,
						tags: [],
						priority: 60,
						essential: false
					}
				}));

				// Prefix tool names with module ID to avoid duplicates
				const prefixedTools = toolsWithMetadata.map((tool: ToolDefinition) => ({
					...tool,
					name: `${module.id}_${tool.name}`
				}));
				logDebug(`[AiToolbox] Module ${module.id} provided ${prefixedTools.length} tools`);
				tools = [...tools, ...prefixedTools];
			} catch (importError) {
				logDebug(`[AiToolbox] Failed to load tools for module ${module.id}:`, importError);
			}
		}

		// Sort tools: mentioned module tools first, then other tools
		if (mentionedModuleIds.length > 0) {
			tools = this.prioritizeToolsByMentionedModules(tools, mentionedModuleIds);
			logDebug('[AiToolbox] Tools reordered with mentioned module tools first');
		}

		toolCache.set(cacheKey, tools, TOOLBOX_CACHE_TTL_MS);
		logDebug('[AiToolbox] Total tools returned:', tools.length);
		return tools;
	}

	/**
	 * Sort tools so that tools from mentioned modules appear first.
	 */
	private prioritizeToolsByMentionedModules(
		tools: ToolDefinition[],
		mentionedModuleIds: string[]
	): ToolDefinition[] {
		const mentionedSet = new Set(mentionedModuleIds);

		const mentionedTools: ToolDefinition[] = [];
		const otherTools: ToolDefinition[] = [];

		for (const tool of tools) {
			// Check if tool belongs to a mentioned module (tool name is prefixed with module ID)
			const toolModuleId = this.extractModuleIdFromToolName(tool.name);
			if (toolModuleId && mentionedSet.has(toolModuleId)) {
				mentionedTools.push(tool);
			} else {
				otherTools.push(tool);
			}
		}

		logDebug(`[AiToolbox] Prioritized ${mentionedTools.length} mentioned module tools`);
		return [...mentionedTools, ...otherTools];
	}

	/**
	 * Extract module ID from prefixed tool name (e.g., "MoLOS-Tasks_get_tasks" -> "MoLOS-Tasks")
	 */
	private extractModuleIdFromToolName(toolName: string): string | null {
		const underscoreIndex = toolName.indexOf('_');
		if (underscoreIndex === -1) return null;
		return toolName.substring(0, underscoreIndex);
	}

	/**
	 * Generate a dynamic system prompt based on available tools and modules.
	 */
	async getDynamicSystemPrompt(userId: string, activeModuleIds: string[] = []): Promise<string> {
		const cacheKey = `${userId}:${[...activeModuleIds].sort().join(',') || 'core'}`;
		const cached = promptCache.get(cacheKey);
		if (cached) return cached;

		const allModules = getAllModules();
		const activeModules = allModules.filter(
			(m) => activeModuleIds.includes(m.id) || m.isPackageModule
		);

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

	/**
	 * Generate a prompt section for priority modules that were @mentioned by the user.
	 */
	getPriorityModulesPrompt(mentionedModuleIds: string[]): string {
		const mentionedModules: Array<{ id: string; name: string; description: string }> = [];

		for (const moduleId of mentionedModuleIds) {
			const module = getModuleById(moduleId);
			if (module) {
				mentionedModules.push({
					id: module.id,
					name: module.name,
					description: module.description || 'No description available'
				});
			}
		}

		if (mentionedModules.length === 0) {
			return '';
		}

		const moduleList = mentionedModules
			.map((m) => `- **${m.name}** (${m.id}): ${m.description}`)
			.join('\n');

		return `# PRIORITY MODULES
The user has specifically mentioned these modules. **Prioritize using tools from these modules first**:

${moduleList}

These modules' tools should be your primary tools for this request. Only use tools from other modules if the mentioned modules cannot accomplish the task.`;
	}
}

/**
 * Clear the tool cache (for debugging)
 */
export function clearToolboxCache() {
	toolCache.clear();
	console.log('[AiToolbox] Cache cleared');
}

# 6. AI Tools Integration

MoLOS allows modules to provide custom AI tools that the Architect Agent can use to interact with the module's data.

## 1. Define AI Tools

Location: `src/lib/ai/modules/{module}/ai-tools.ts`

Create a function that returns an array of `ToolDefinition` objects. Each tool should encapsulate a specific action or query.

```typescript
import { EntityRepository } from '../../../repositories/{module}/entity-repository';
import type { ToolDefinition } from '$lib/models/ai';

export function getModuleAiTools(userId: string): ToolDefinition[] {
	const repo = new EntityRepository();

	return [
		{
			name: 'get_module_entities',
			description: 'Retrieve entities for the current user.',
			parameters: {
				type: 'object',
				properties: {
					limit: { type: 'number', default: 10 }
				}
			},
			execute: async (params) => {
				return await repo.getByUserId(userId, params.limit);
			}
		},
		{
			name: 'create_module_entity',
			description: 'Create a new entity.',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string' }
				},
				required: ['name']
			},
			execute: async (params) => {
				return await repo.create({ ...params, userId });
			}
		}
	];
}
```

## 2. Register Tools in Module Config

Location: `src/lib/config/modules/{module}/config.ts`

Import your tools function and add it to the `moduleConfig` object under the `getAiTools` property.

```typescript
import { getModuleAiTools } from '../../../ai/modules/{module}/ai-tools';
import type { ModuleConfig } from '../types';

export const moduleConfig: ModuleConfig = {
	id: 'module-id',
	// ... other config
	getAiTools: getModuleAiTools
};
```

## 3. How it Works

The `AiToolbox` automatically discovers all registered modules. When the AI agent starts a session, it:

1.  Iterates through all core modules.
2.  Checks for active external modules.
3.  Calls `getAiTools(userId)` for each module that defines it.
4.  Aggregates all tools into a single toolbox available to the LLM.

## Key Rules

1.  **Naming**: Use `snake_case` for tool names (e.g., `create_task`, `get_expenses`).
2.  **Descriptions**: Provide clear, concise descriptions so the LLM knows when to use the tool.
3.  **Parameters**: Use JSON Schema to define parameters. Always mark required fields.
4.  **User Isolation**: Always use the provided `userId` in repository calls.
5.  **Safety**: For destructive actions, ensure the tool returns enough information for the agent to explain what happened.

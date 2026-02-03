# MCP Prompt Template Engine

This directory is for implementing a template engine for MCP prompts.

## TODO

The current prompt implementation returns simple placeholder messages. To implement actual prompt templates:

1. **Template Engine** (`template-engine.ts`)
   - Parse and render template strings
   - Support variable substitution: `{{variable}}`
   - Support conditionals: `{{#if}}...{{/if}}`
   - Support loops: `{{#each}}...{{/each}}`
   - Escape HTML by default

2. **Prompt Templates Storage**
   - Store templates in database
   - Support template versioning
   - Enable/disable templates

3. **Argument Validation**
   - Validate arguments against template requirements
   - Provide clear error messages for missing arguments

4. **Built-in Templates**
   - Include common prompt templates
   - Allow user customization

## Template Syntax Example

```
You are a helpful assistant.
User's name: {{userName}}
Context: {{context}}

{{#if showDetails}}
Additional details: {{details}}
{{/if}}

{{#each items}}
- {{this}}
{{/each}}
```

## Example Implementation

```typescript
export class PromptTemplateEngine {
	render(template: string, args: Record<string, unknown>): string {
		// Simple variable substitution
		let result = template;
		for (const [key, value] of Object.entries(args)) {
			const regex = new RegExp(`{{${key}}}`, 'g');
			result = result.replace(regex, String(value));
		}
		return result;
	}
}
```

## Integration

Update `prompts-discovery.ts`:

```typescript
import { PromptTemplateEngine } from '../prompt-engine';

const engine = new PromptTemplateEngine();

export async function getMcpPrompt(context, name, args) {
	const prompt = await repo.getByName(context.userId, name);
	const rendered = engine.render(prompt.template, args);

	return {
		description: prompt.description,
		messages: [
			{ role: 'user', content: { type: 'text', text: rendered } }
		]
	};
}
```

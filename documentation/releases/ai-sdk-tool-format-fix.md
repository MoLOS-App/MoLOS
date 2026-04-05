# AI SDK Tool Format Compatibility Fix

> **Date**: March 26, 2026
> **Issue**: MissingToolResultsError and ZodError during multi-turn tool execution
> **Root Cause**: Format mismatch between AI SDK (`tool-call`, `tool-result`) and legacy code (`tool_call`, `tool_result`)

---

## Summary

Fixed a critical compatibility issue where the AI SDK uses hyphenated format (`tool-call`, `tool-result`) for tool content blocks, but the agent code was checking for underscore format (`tool_call`, `tool_result`). This caused:

1. **Assistant messages with tool calls** to be incorrectly identified as having no tool calls
2. **Tool result messages** to be dropped as "orphaned"
3. **Zod validation errors** due to improper `output` field formatting

---

## Files Modified

### Core Agent Package (`packages/agent/`)

#### `src/types/index.ts` (Lines 225-233)

Extended `MessageContent` type to support both AI SDK format and legacy format.

```typescript
/**
 * Content in a message (can be text or tool calls)
 *
 * NOTE: AI SDK uses 'tool-call' (hyphen) format with toolCallId/toolName properties.
 * We support both this format and the legacy 'tool_call' (underscore) format with id/name.
 */
export type MessageContent =
	| string
	| { type: 'text'; text: string }
	| { type: 'tool-call'; toolCallId: string; toolName: string; input: Record<string, unknown> }
	| { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> } // Legacy format
	| { type: 'tool_result'; toolCallId: string; content: string; isError?: boolean };
```

---

#### `src/core/context.ts` (Lines 1110-1157)

Updated `hasToolCalls()` and `getToolCallIds()` to check both formats.

**`hasToolCalls()` method (Lines 1116-1130):**

```typescript
/**
 * Check if a message has tool calls in its content array
 *
 * NOTE: AI SDK uses 'tool-call' (hyphen) format in content blocks, not 'tool_call' (underscore).
 * The block structure is: { type: 'tool-call', toolCallId: string, toolName: string, input: object }
 * We also support legacy 'tool_call' format for backward compatibility.
 */
private hasToolCalls(msg: AgentMessage): boolean {
	if (typeof msg.content === 'string') {
		return false;
	}
	if (!Array.isArray(msg.content)) {
		return false;
	}
	// Check for both 'tool-call' (AI SDK) and 'tool_call' (legacy) block types
	return msg.content.some(
		(block) =>
			typeof block === 'object' &&
			block !== null &&
			((block as any).type === 'tool-call' || (block as any).type === 'tool_call')
	);
}
```

**`getToolCallIds()` method (Lines 1138-1157):**

```typescript
/**
 * Extract tool call IDs from a message's content array
 *
 * NOTE: AI SDK uses 'tool-call' (hyphen) format and toolCallId property.
 * We also handle legacy 'tool_call' format with 'id' property for compatibility.
 */
private getToolCallIds(msg: AgentMessage): string[] {
	if (typeof msg.content === 'string') {
		return [];
	}
	if (!Array.isArray(msg.content)) {
		return [];
	}
	const ids: string[] = [];
	for (const block of msg.content) {
		// Support both 'tool-call' (AI SDK) and 'tool_call' (legacy) block types
		// Also handle both 'toolCallId' and 'id' property names
		if (typeof block === 'object' && block !== null) {
			const blockType = (block as any).type;
			if (blockType === 'tool-call' || blockType === 'tool_call') {
				ids.push((block as any).toolCallId || (block as any).id);
			}
		}
	}
	return ids;
}
```

---

#### `src/core/session.ts` (Lines 553-569)

Updated `sanitizeHistory()` to handle both formats when matching tool results to assistant messages.

```typescript
if (prevMsg.role === 'assistant') {
	const content = prevMsg.content;
	if (Array.isArray(content)) {
		for (const block of content) {
			// Support both 'tool-call' (AI SDK) and 'tool_call' (legacy) formats
			if (
				block &&
				typeof block === 'object' &&
				((block as any).type === 'tool_call' || (block as any).type === 'tool-call')
			) {
				foundAssistant = true;
				break;
			}
		}
	}
}
```

---

#### `src/core/token-estimator.ts` (Lines 211-225)

Updated token counting to handle both formats.

```typescript
} else if (block.type === 'tool_call' || block.type === 'tool-call') {
	// Tool call: id + name + JSON.stringify(input)
	// These are expensive (JSON strings add up)
	// Support both 'tool_call' (legacy) and 'tool-call' (AI SDK) formats
	const id = (block as any).id || (block as any).toolCallId || '';
	const name = (block as any).name || (block as any).toolName || '';
	const input = (block as any).input || {};
	contentLength += id.length;
	contentLength += name.length;
	contentLength += JSON.stringify(input).length;
} else if (block.type === 'tool_result') {
	// Tool result: toolCallId + content
	contentLength += block.toolCallId.length;
	contentLength += block.content.length;
}
```

---

### SvelteKit Backend (`src/lib/server/ai/`)

#### `src/lib/server/ai/molos-agent-adapter.ts`

##### Fix 1: History Parsing (Lines 430-448)

Parse JSON strings back to arrays for assistant messages when loading history from SQLite.

```typescript
// Convert history to AgentMessage format
const agentHistory: AgentMessage[] = history.map((m) => {
	let parsedContent: string | Array<any> = m.content;

	// If it's an assistant message, try to parse JSON array content (like tool calls)
	if (m.role === 'assistant' && typeof m.content === 'string' && m.content.startsWith('[')) {
		try {
			parsedContent = JSON.parse(m.content);
		} catch {
			// Fall back to string if not valid JSON
		}
	}

	return {
		role: m.role as 'user' | 'assistant' | 'system' | 'tool',
		content: parsedContent,
		toolCallId: m.toolCallId,
		name: m.toolCalls?.[0]?.name as string | undefined
	};
});
```

**Problem**: History stored in SQLite as JSON string (e.g., `[{\"type\":\"tool-call\"...}]`), but `hasToolCalls()` returned `false` for string content, causing all old tool results to be dropped as "orphaned".

##### Fix 2: `tool-result` Output Formatting (Lines 134-162)

Format `tool-result` output as `{ type: 'text' | 'json', value: any }` object for AI SDK strict typing.

```typescript
// Wrap in tool-result format (AI SDK uses tool-result with hyphen)
content = [
	{
		type: 'tool-result' as const,
		toolCallId: msg.toolCallId || '',
		toolName: msg.name || '',
		output: {
			type: typeof resultContent === 'string' ? 'text' : 'json',
			value: resultContent
		}
	}
] as any;
```

Or for array content:

```typescript
content = content.map((item) => {
	if (typeof item === 'object' && (item as any).type !== 'tool-result') {
		return {
			type: 'tool-result' as const,
			toolCallId: msg.toolCallId || '',
			toolName: msg.name || '',
			output: {
				type: 'json',
				value: item
			}
		};
	}
	return item;
}) as any;
```

**Problem**: AI SDK's `toolModelMessageSchema` requires `output` to be an object with `type` and `value` properties, not a raw string.

---

### Frontend Components (`src/lib/components/ai/`)

#### `src/lib/components/ai/AiChatWorkspace.svelte` (Lines 317-363)

Enhanced tool event handling for better progress display.

```typescript
case 'tool_start':
	// Tool call started - show progress
	currentProgress.status = 'executing';
	currentProgress.currentAction = {
		type: 'step_start',
		message: `Executing: ${data.toolName}`,
		toolName: data.toolName,
		timestamp: Date.now()
	};
	// Add to progress log
	const toolStartMsg = `🔧 ${data.toolName}`;
	progressLog = [...progressLog, toolStartMsg];
	console.log('[Tool Start]', data.toolName);
	// Reset content for next segment
	content = '';
	break;

case 'tool_delta':
	// Show tool argument progress (abbreviated)
	if (data.delta && data.delta.length > 50) {
		const truncatedDelta = data.delta.substring(0, 50) + '...';
		// Update last progress line with truncated info
		const lastIdx = progressLog.length - 1;
		if (lastIdx >= 0 && progressLog[lastIdx].startsWith('🔧')) {
			progressLog = [
				...progressLog.slice(0, lastIdx),
				`🔧 ${data.toolName}: ${truncatedDelta}`
			];
		}
	}
	break;

case 'tool_end':
	// Tool call completed
	if (data.result) {
		const resultStr = typeof data.result === 'string'
			? data.result.substring(0, 100) + (data.result.length > 100 ? '...' : '')
			: JSON.stringify(data.result).substring(0, 100);
		const lastIdx = progressLog.length - 1;
		if (lastIdx >= 0 && progressLog[lastIdx].startsWith('🔧')) {
			progressLog = [
				...progressLog.slice(0, lastIdx),
				`✅ ${data.toolName}: ${resultStr}`
			];
		}
	} else if (data.error) {
		const lastIdx = progressLog.length - 1;
		if (lastIdx >= 0 && progressLog[lastIdx].startsWith('🔧')) {
			progressLog = [
				...progressLog.slice(0, lastIdx),
				`❌ ${data.toolName}: ${data.error}`
			];
		}
	}
	console.log('[Tool End]', data.toolName, data.result ? 'success' : 'error');
	break;
```

---

#### `src/lib/components/ai/ProgressDisplay.svelte` (Full file)

Enhanced UI to show tool execution progress with specific tool name and streaming indicator.

```svelte
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { LoaderCircle, X, Wrench, Cog } from 'lucide-svelte';
	import type { ProgressState } from './progress-types';
	import { getStatusText } from './progress-types';

	let {
		isLoading = false,
		isStreaming = false,
		isCancelling = false,
		progress,
		onCancel
	}: {
		isLoading?: boolean;
		isStreaming?: boolean;
		isCancelling?: boolean;
		progress: ProgressState;
		onCancel?: () => void;
	} = $props();

	// Show cancel button only during active execution
	const canCancel = $derived(
		!isCancelling &&
			(progress.status === 'thinking' ||
				progress.status === 'planning' ||
				progress.status === 'executing')
	);

	const showCancelButton = $derived(isLoading && canCancel);

	// Determine if currently executing a tool
	const isExecutingTool = $derived(
		progress.status === 'executing' && progress.currentAction?.toolName
	);

	// Get status display text
	function getStatusDisplayText(status: string, isCancelling: boolean): string {
		if (isCancelling) return 'Cancelling...';
		if (status === 'executing' && progress.currentAction?.toolName) {
			return `Running: ${progress.currentAction.toolName}`;
		}
		return getStatusText(status);
	}
</script>

{#if isLoading || progress.status !== 'idle'}
	<div class="flex flex-col gap-3" in:fade>
		<!-- Loader with Status and Cancel -->
		{#if isLoading && !isStreaming}
			<div class="flex items-center gap-3">
				<div
					class="text-muted-foreground flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm font-bold tracking-wide shadow-sm"
					class:opacity-50={isCancelling}
					class:animate-pulse={!isExecutingTool && !isCancelling}
				>
					{#if isExecutingTool && !isCancelling}
						<Wrench class="h-4 w-4 animate-spin" />
					{:else}
						<LoaderCircle class="h-4 w-4 animate-spin" />
					{/if}
					<span class="uppercase">
						{getStatusDisplayText(progress.status, isCancelling)}
					</span>
					{#if !isCancelling && !isExecutingTool}
						<span class="inline-flex gap-1">
							<span
								class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40"
							></span>
							<span
								class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40 [animation-delay:0.2s]"
							></span>
							<span
								class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40 [animation-delay:0.4s]"
							></span>
						</span>
					{/if}
				</div>
				<!-- Cancel Button -->
				{#if showCancelButton}
					<button onclick={onCancel} ...>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
		{/if}

		<!-- Streaming indicator (when actively receiving text) -->
		{#if isStreaming && !isLoading}
			<div class="flex items-center gap-3">
				<div
					class="text-muted-foreground flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/35 px-4 py-3 text-sm font-bold tracking-wide shadow-sm"
				>
					<Cog class="h-4 w-4 animate-spin" />
					<span class="uppercase">Generating</span>
					<span class="inline-flex gap-1">
						<span
							class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40"
						></span>
						<span
							class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40 [animation-delay:0.2s]"
						></span>
						<span
							class="h-1 w-1 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-current opacity-40 [animation-delay:0.4s]"
						></span>
					</span>
				</div>
			</div>
		{/if}

		<!-- Current Action (prominently displayed) -->
		{#if progress.currentAction && progress.currentAction.type !== 'thinking'}
			<div class="text-muted-foreground flex items-center gap-3 text-sm" in:fade>
				<div
					class="h-2 w-2 animate-pulse rounded-full"
					class:bg-primary={!isCancelling}
					class:bg-destructive={isCancelling}
				></div>
				<span>
					{#if isCancelling}
						Cancelling...
					{:else if progress.currentAction.step && progress.currentAction.total}
						[{progress.currentAction.step}/{progress.currentAction.total}] {progress.currentAction
							.message}
					{:else}
						{progress.currentAction.message}
					{/if}
				</span>
			</div>
		{/if}
	</div>
{/if}
```

---

### Documentation

#### `documentation/getting-started/troubleshooting.md`

Added "AI Agent Issues" section with troubleshooting entries.

#### `documentation/packages/agent.md`

Added "AI SDK Compatibility" section explaining the dual format support.

#### `documentation/QUICK-REFERENCE.md`

Added troubleshooting entries:

- `MissingToolResultsError (tool results dropped)`
- `ZodError: expected object, received string (output field)`

#### `documentation/releases/v1.0.0.md`

Added post-release patch section (v1.0.1) documenting the fix.

---

## Technical Details

### AI SDK Tool Format

The AI SDK uses specific content block types:

```typescript
// Assistant message with tool calls
{
    role: 'assistant',
    content: [
        { type: 'text', text: 'Let me search for that' },
        { type: 'tool-call', toolCallId: 'abc123', toolName: 'search', input: { query: 'x' } }
    ]
}

// Tool message with results
{
    role: 'tool',
    content: [
        {
            type: 'tool-result',
            toolCallId: 'abc123',
            toolName: 'search',
            output: { type: 'text', value: 'Found 5 results...' } // NOT a raw string!
        }
    ]
}
```

### Why Both Formats Exist

- **AI SDK format** (`tool-call`, `tool-result`): Uses `toolCallId`/`toolName` properties
- **Legacy format** (`tool_call`): Uses `id`/`name` properties

The agent package originally only supported the legacy format, causing mismatches when the AI SDK returned `tool-call` format.

---

## Verification

### Build

```bash
cd packages/agent && npm run build  # Passes
```

### Tests

```bash
cd packages/agent && npx vitest run tests/core
# ✓ tests/core/turn-boundaries.test.ts (29 tests)
# ✓ tests/core/history-sanitization.test.ts (16 tests)
# ✓ tests/core/token-estimator.test.ts (22 tests)
# ✓ tests/core/memory-store.test.ts (21 tests)
# Test Files: 4 passed (4)
# Tests: 88 passed (88)
```

### Runtime Verification

1. Start dev server: `npm run dev`
2. Send a message that triggers tool calls
3. Verify:
   - Progress shows "Running: {toolName}" with Wrench icon
   - Progress log shows 🔧 {tool_name} → ✅ {tool_name}: result
   - No MissingToolResultsError in console
   - No ZodError in console

---

## Related Files (Unchanged but Related)

| File                                       | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `src/routes/api/ai/chat/+server.ts`        | Server-side event streaming (already correct) |
| `src/lib/repositories/ai/ai-repository.ts` | Database storage (works with changes)         |
| `packages/agent/src/core/agent-loop.ts`    | Already had fix for extractToolCalls          |

---

## See Also

- [Agent Package Documentation](./packages/agent.md)
- [Troubleshooting Guide](./getting-started/troubleshooting.md)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)

---

_Last Updated: 2026-03-26_

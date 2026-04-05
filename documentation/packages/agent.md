# @molos/agent Package

> Agent runtime for MoLOS - orchestrates LLM interactions, tool execution, and multi-agent coordination.

## Overview

The `@molos/agent` package provides a complete agent runtime inspired by the picoclaw/openclaw architecture:

- **Agent Loop**: Turn-based execution with retry logic and context management
- **Tool System**: Core/hidden tools with BM25 discovery and TTL-based visibility
- **Provider Fallback**: Multi-provider failover with cooldown tracking
- **Hook System**: Extensible hooks (void, modifying, claiming)
- **Event Bus**: Real-time event emission for UI updates
- **Multi-Agent**: Subagent spawning with depth limits
- **Session Management**: In-memory and ephemeral session stores

## Installation

```bash
npm install @molos/agent
```

## Package Structure

```
@molos/agent/
├── core/           # AgentLoop, TurnManager, Session, Context
├── tools/          # ToolRegistry, BM25 search, schema conversion
├── providers/      # FallbackChain, CooldownTracker, ErrorClassifier
├── hooks/          # HookManager with void/modifying/claiming hooks
├── events/         # EventBus with channel-based pub/sub
├── multi-agent/    # SubagentSpawner, ModuleRegistry, Announcer
└── types/          # TypeScript type definitions
```

## AI SDK Compatibility

The agent package is fully compatible with the AI SDK's tool format conventions:

### Content Block Formats

The `MessageContent` type supports both AI SDK format and legacy format:

```typescript
// AI SDK format (uses hyphens)
{
	type: 'tool-call';
	toolCallId: string;
	toolName: string;
	input: object;
}
{
	type: 'tool-result';
	toolCallId: string;
	toolName: string;
	output: object;
}

// Legacy format (uses underscores)
{
	type: 'tool_call';
	id: string;
	name: string;
	input: object;
}
{
	type: 'tool_result';
	id: string;
	name: string;
	output: string;
}
```

### Key Functions

- `hasToolCalls(msg)`: Checks for both `tool-call` and `tool_call` block types
- `getToolCallIds(msg)`: Extracts IDs from both formats
- `sanitizeHistory()`: Matches tool results to assistant messages regardless of format
- `tokenEstimator.countMessageTokens()`: Counts tokens correctly for both formats

### Provider Integration

When using `MolosLLMProviderClient` or similar adapters:

1. **Assistant messages**: Use `type: 'tool-call'` with `toolCallId`/`toolName`/`input`
2. **Tool messages**: Use `type: 'tool-result'` with `output: { type: 'text'|'json', value: any }`

> ⚠️ **Important**: The AI SDK's `tool-result` output must be an object with `type` and `value` properties, not a raw string.

See [AI SDK Tool Format Fix](../releases/ai-sdk-tool-format-fix.md) for detailed troubleshooting.

## Core Classes

### AgentLoop

Main orchestrator for agent execution. Handles turn management, tool execution, error handling, and streaming responses.

#### Factory Function

```typescript
import { createAgentLoop } from '@molos/agent';

const agent = createAgentLoop({
	provider: myProvider,
	tools: [],
	model: 'gpt-4',
	maxIterations: 20,
	maxTurns: 50
});
```

#### Configuration

```typescript
interface AgentLoopConfig {
	id?: string;
	model?: string;
	temperature?: number;
	maxTokens?: number;
	maxIterations?: number; // Default: 20
	maxTurns?: number; // Default: 50
	maxToolCallsPerTurn?: number; // Default: 20
	toolTimeout?: number; // Default: 30000ms
	tools?: ToolDefinition[];
	providers?: ProviderConfig[];
	primaryProvider?: string;
}
```

#### Methods

| Method                                     | Description                                            |
| ------------------------------------------ | ------------------------------------------------------ |
| `run(messages, input)`                     | Execute agent with input, returns `AgentRunResult`     |
| `runStream(messages, input, middlewares?)` | Execute with streaming support, returns `StreamResult` |
| `runTurn(turn, messages, input)`           | Execute a single turn                                  |
| `runSubTurn(parentTurn, input, config?)`   | Execute a sub-turn for nested agent calls              |
| `executeTool(toolName, args)`              | Execute a tool directly                                |
| `registerTool(tool)`                       | Register a tool at runtime                             |
| `unregisterTool(name)`                     | Remove a tool                                          |
| `setToolExecutor(fn)`                      | Set custom tool executor                               |
| `getIteration()`                           | Get current iteration number                           |
| `getTurnCount()`                           | Get total turns executed                               |
| `getToolCallCount()`                       | Get total tool calls                                   |
| `isRunning()`                              | Check if agent is currently running                    |
| `getUsage()`                               | Get token usage statistics                             |
| `reset()`                                  | Reset agent state                                      |
| `abort()`                                  | Abort current execution                                |
| `getSessionStore()`                        | Get the session store                                  |
| `getEventBus()`                            | Get the event bus                                      |
| `getContextBuilder()`                      | Get the context builder                                |
| `getTurnManager()`                         | Get the turn manager                                   |

#### Streaming

The agent supports streaming responses via `runStream()`:

```typescript
const result = agent.runStream(messages, 'Analyze this code', [
	// Custom middlewares (optional)
]);

for await (const chunk of result.stream) {
	switch (chunk.type) {
		case 'text-delta':
			console.log('Text:', chunk.delta);
			break;
		case 'tool-call-start':
			console.log('Tool call started:', chunk.toolName);
			break;
		case 'tool-call-delta':
			console.log('Tool args delta:', chunk.delta);
			break;
		case 'tool-call-end':
			console.log('Tool result:', chunk.result);
			break;
		case 'finish':
			console.log('Finished:', chunk.reason);
			break;
		case 'error':
			console.error('Error:', chunk.error);
			break;
	}
}
```

**Stream Chunk Types:**

```typescript
type StreamChunk =
	| { type: 'text-delta'; delta: string }
	| { type: 'tool-call-start'; toolName: string; toolCallId: string }
	| { type: 'tool-call-delta'; toolCallId: string; delta: string }
	| { type: 'tool-call-end'; toolCallId: string; result?: string }
	| { type: 'finish'; reason: string; usage?: { inputTokens: number; outputTokens: number } }
	| { type: 'error'; error: string };
```

**Built-in Streaming Middlewares:**

```typescript
import { streamingMiddlewares } from '@molos/agent';

// Available middlewares
streamingMiddlewares.sanitizeMalformedToolCalls; // Fix malformed tool names
streamingMiddlewares.trimToolCallNames; // Trim whitespace from names
streamingMiddlewares.repairMalformedToolCallArguments; // Fix malformed JSON args
```

**Stream Result:**

```typescript
interface StreamResult {
	stream: AsyncIterable<StreamChunk>;
	context: StreamContext;
}

interface StreamContext {
	turnId: string;
	iteration: number;
	toolCallCount: number;
	metadata: Record<string, unknown>;
	abortSignal?: AbortSignal;
}
```

#### Return Type

```typescript
interface AgentRunResult {
	messages: AgentMessage[];
	finalOutput: string;
	iterations: number;
	turns: TurnResult[];
	error?: AgentError;
	usage?: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

interface AgentError {
	type: 'timeout' | 'context_overflow' | 'provider_error' | 'tool_error' | 'unknown';
	message: string;
	cause?: unknown;
}
```

#### Example

```typescript
import { createAgentLoop, ToolRegistry, createEventBus } from '@molos/agent';

const tools = new ToolRegistry();
tools.register({
  name: 'search',
  description: 'Search the web for information',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' }
    },
    required: ['query']
  },
  execute: async ({ query }) => {
    // Perform search
    return JSON.stringify({ results: [...] });
  }
});

const agent = createAgentLoop({
  provider: myLLMProvider,
  tools: tools.getDefinitions(),
  model: 'gpt-4'
});

const result = await agent.run([], 'Search for TypeScript tutorials');
console.log(result.finalOutput);
```

---

### ToolRegistry

Tool registration and execution with core/hidden pattern. Hidden tools are discovered via BM25 search and have TTL-based visibility. The registry includes BM25 index caching for performance.

#### Constructor

```typescript
const registry = new ToolRegistry({
	maxConcurrent: 10 // Max parallel tool executions
});
```

#### Registration Methods

| Method                      | Description                           |
| --------------------------- | ------------------------------------- |
| `register(tool)`            | Register a core tool (always visible) |
| `registerHidden(tool, ttl)` | Register a hidden tool with TTL       |
| `registerMany(tools)`       | Register multiple tools at once       |
| `unregister(name)`          | Remove a tool                         |

```typescript
// Core tool - always visible
registry.register({
  name: 'search',
  description: 'Search the web',
  parameters: { type: 'object', properties: {...} },
  execute: async (args) => { ... }
});

// Hidden tool - requires BM25 discovery, TTL=3 iterations
registry.registerHidden({
  name: 'git_commit',
  description: 'Create a git commit with a message',
  parameters: { type: 'object', properties: {...} },
  execute: async (args) => { ... }
}, 3);
```

#### Tool Execution

```typescript
// Execute single tool
const result = await registry.execute('search', { query: 'test' });

// Execute multiple tools in parallel
const results = await registry.executeMany([
	{ id: 'call-1', tool: searchTool, arguments: { query: 'a' } },
	{ id: 'call-2', tool: readTool, arguments: { file: 'b' } }
]);
```

#### Discovery Methods

```typescript
// Find hidden tools via BM25 ranking (uses cached index)
const found = registry.searchBM25('git commit message', 5);

// Make hidden tools temporarily visible
registry.promoteTools(['git_commit'], ttl: 3);

// Atomic promote AND decrement TTL in one operation
// Preferred over separate promoteTools + tickTTL calls
const promoted = registry.promoteAndTick(['git_commit'], ttl: 3);

// Decrement TTL (call each iteration)
const expired = registry.tickTTL(); // Returns count of expired tools
```

#### BM25 Caching

The registry caches the BM25 index and only rebuilds when the tool registry version changes (on register/unregister). This provides O(1) cache hits for repeated searches.

```typescript
// Internal: get or build cached BM25 engine
const engine = registry.getOrBuildBM25Engine(); // Uses cached index if valid

// Snapshot hidden tools for external indexing
const snapshot = registry.snapshotHiddenTools();
// Returns { docs: [{name, description}], version: number }
```

#### Query Methods

```typescript
registry.getTools(includeHidden?: boolean)    // All tools
registry.getVisibleTools()                    // Only visible (respects TTL)
registry.getDefinitions()                     // For LLM providers
registry.get(name)                           // Single tool
registry.has(name)                           // Check existence
registry.listNames()                         // All names (sorted)
registry.count()                             // Total count
registry.versionNumber()                     // Registry version (increments on changes)
registry.getSummaries()                      // Human-readable tool summaries
```

#### Tool Result Cache

LRU cache for tool results with TTL and invalidation support:

```typescript
import { ToolResultCache } from '@molos/agent/tools';

const cache = new ToolResultCache({
	ttlMs: 60000, // 1 minute default TTL
	maxSize: 100 // Max 100 entries
});

// Get cached result
const cached = cache.get('search', { query: 'test' });

// Set cached result
cache.set('search', { query: 'test' }, { success: true, output: '...' });

// Invalidate all entries for a specific tool
cache.invalidate('search');

// Clear all cache
cache.clear();
```

**Note:** By default, only successful tool results are cached. Failed tool executions are not cached to prevent caching error states.

---

### ContextBuilder

---

### ContextBuilder

Builds system prompts with caching and mtime-based invalidation. Thread-safe with RWMutex pattern.

#### Factory

```typescript
import { createContextBuilder } from '@molos/agent';

const contextBuilder = createContextBuilder({
	workspace: '/path/to/workspace',
	agentId: 'my-agent',
	bootstrapFiles: {
		agent: 'AGENT.md',
		soul: 'SOUL.md',
		user: 'USER.md',
		identity: 'IDENTITY.md'
	}
});
```

#### Configuration

```typescript
interface ContextBuilderConfig {
	workspace: string;
	agentId?: string;
	bootstrapFiles?: {
		agent?: string;
		soul?: string;
		user?: string;
		identity?: string;
	};
	skillsPath?: string; // Workspace skills (default: {workspace}/skills)
	globalSkillsPath?: string; // Global skills (default: ~/.molos/skills)
	builtinSkillsPath?: string; // Builtin skills (bundled with app)
	memoryPath?: string;
	memory?: {
		memoryFile?: string;
		dailyNotesPath?: string;
	};
	runtimeInfo?: {
		os?: string;
		arch?: string;
		goVersion?: string;
	};
}
```

#### Thread Safety (RWMutex)

The ContextBuilder uses a reader-writer mutex for thread-safe caching:

- **Read lock**: Multiple readers can access cache simultaneously
- **Write lock**: Exclusive access for cache updates
- **Double-checked locking**: Fast path with read lock, slow path with write lock

```typescript
// buildSystemPromptWithCache uses double-checked locking:
// 1. Fast path: read lock → check if cache valid → return
// 2. Slow path: write lock → double-check → rebuild cache
```

#### Multi-Tier Skills

Skills are loaded from three tiers (in priority order):

| Tier        | Path                                   | Description                |
| ----------- | -------------------------------------- | -------------------------- |
| `workspace` | `{skillsPath}/` (default: `./skills/`) | User workspace skills      |
| `global`    | `~/.molos/skills/`                     | User's global skills       |
| `builtin`   | `{builtinSkillsPath}/`                 | Bundled application skills |

```typescript
// Skills are scanned from all tiers and merged
// In system prompt, workspace skills show no tag
// Global and builtin skills show [global] or [builtin] tag
```

#### Methods

| Method                          | Description                             |
| ------------------------------- | --------------------------------------- |
| `buildSystemPrompt()`           | Build system prompt (uncached)          |
| `buildSystemPromptWithCache()`  | Build with mtime-based cache (async)    |
| `buildDynamicContext(session)`  | Build time/runtime context (not cached) |
| `buildContext(session, extra?)` | Build full context for turn (async)     |
| `composeMessages(...)`          | Compose messages for LLM request        |
| `invalidateCache()`             | Force cache rebuild on next call        |
| `loadSkill(name)`               | Load a specific skill (async)           |
| `listSkills()`                  | List all available skills (async)       |

#### Caching

```typescript
// Returns cached prompt if source files haven't changed
const result = await contextBuilder.buildSystemPromptWithCache();
// Returns: { prompt: string, cachedAt: number, filesChecked: string[] }

// Cache invalidation triggers:
// - Source files (AGENT.md, SOUL.md, etc.) mtime changed
// - Skill root directories mtime changed
// - Individual skill files mtime changed
```

#### Skills Interface

```typescript
interface Skill {
	name: string;
	description: string;
	content: string;
	location: string;
	source: 'workspace' | 'global' | 'builtin';
}

interface SkillsLoader {
	loadSkill(name: string): Promise<Skill | undefined>;
	listSkills(): SkillMeta[];
	searchSkills(query: string, limit?: number): Promise<SkillSearchResult[]>;
}

// Set a custom skills loader
contextBuilder.setSkillsLoader(mySkillsLoader);
```

---

### Context Overflow Compaction

When the agent encounters context overflow errors, it can automatically compact the conversation history to continue execution.

#### Compaction Strategy

The agent keeps:

- First message (system prompt)
- Last N messages (configurable, default: 10)
- Summarized compaction message for middle messages

Middle messages are summarized into a single "context compaction" system message:

```typescript
// Example compaction summary
"[Context Compaction] Summarized 15 previous messages:
[User] Tell me about TypeScript
[Assistant] TypeScript is a typed superset of JavaScript...
[Tool: search] Found 3 articles about TypeScript
[Assistant] Based on my search, TypeScript is..."
```

#### Configuration

Compaction is automatic when context overflow occurs. Maximum 3 compaction attempts per run:

```typescript
// The agent loop handles compaction automatically
// Events emitted:
// - run:compaction (when compaction starts)
// - run:compaction:complete (when compaction finishes)
```

#### Hook Integration

Use modifying hooks to customize compaction behavior:

```typescript
hooks.registerModifyingHook({
	name: 'before_compaction',
	handler: async (event, context, messages) => {
		// Customize which messages to keep
		return { modified: messages };
	}
});

hooks.registerVoidHook({
	name: 'after_compaction',
	handler: async (event, context) => {
		console.log('Compaction complete:', context);
	}
});
```

---

### EventBus

Channel-based pub/sub event system for real-time updates.

#### Factory

```typescript
import { createEventBus, getGlobalEventBus } from '@molos/agent';

// Create new instance
const bus = createEventBus({
	maxSubscribers: 100, // Default: 100
	defaultBufferSize: 16 // Default: 16
});

// Or use global singleton
const global = getGlobalEventBus();
```

#### Subscribe

```typescript
// Subscribe to all events
const unsubAll = bus.subscribe('*', (event) => {
	console.log('Event:', event);
});

// Subscribe to specific stream
const unsubTool = bus.subscribe('tool', (event) => {
	if (event.type === 'tool_execution_start') {
		console.log('Starting:', event.data.toolName);
	}
});

// With filter
const unsubFiltered = bus.subscribe(
	'lifecycle',
	(event) => {
		return event.type === 'agent_end';
	},
	{
		filter: (event) => event.data.iterations > 5
	}
);
```

#### Emit

```typescript
// Non-blocking emit
bus.emit({
  runId: 'run-1',
  seq: 1,
  stream: 'tool',
  ts: Date.now(),
  type: 'tool_execution_start',
  data: { toolName: 'search', toolCallId: 'call-1', args: {...} }
});

// Blocking emit (waits for handlers)
await bus.emitSync({ ... });
```

#### Event Streams

| Stream       | Description                     |
| ------------ | ------------------------------- |
| `lifecycle`  | Agent start/end, turn start/end |
| `tool`       | Tool execution events           |
| `assistant`  | Message events                  |
| `error`      | Error events                    |
| `compaction` | Context compaction events       |

#### Monitoring

```typescript
bus.getSubscriberCount(); // Active subscriber count
bus.getDroppedCounts(); // Dropped event counts by stream
bus.clear(); // Clear all subscriptions
bus.close(); // Close the bus
```

---

### HookManager

Extensible hooks for modifying agent behavior with three patterns.

#### Factory

```typescript
import { createHookManager, getGlobalHookManager } from '@molos/agent';

const hooks = createHookManager({
	defaultTimeoutMs: 5000,
	continueOnError: true
});
```

#### Void Hooks

Fire-and-forget, parallel execution:

```typescript
hooks.registerVoidHook({
	name: 'agent_end',
	handler: async (event, context) => {
		console.log(`Agent finished in ${context.timestamp}ms`);
	},
	priority: 50,
	timeoutMs: 5000
});
```

#### Modifying Hooks

Sequential execution, can modify data:

```typescript
hooks.registerModifyingHook({
	name: 'before_tool_call',
	handler: async (event, context, currentArgs) => {
		// Can modify and return new args
		if (currentArgs.secret) {
			// Redact sensitive data
			return { modified: { ...currentArgs, secret: '[REDACTED]' } };
		}
		return { modified: currentArgs };
	}
});
```

#### Claiming Hooks

First handler to claim wins:

```typescript
hooks.registerClaimingHook({
	name: 'inbound_claim',
	handler: async (event, context) => {
		// Check if we can handle this
		if (event.data.message.includes('special')) {
			return { handled: true, result: 'Handled by custom logic!' };
		}
		return { handled: false };
	}
});
```

#### Running Hooks

```typescript
// Run void hook
await hooks.runVoidHook('agent_end', event, context);

// Run modifying hook
const modifiedArgs = await hooks.runModifyingHook('before_tool_call', event, context, originalArgs);

// Run claiming hook
const claim = await hooks.runClaimingHook('inbound_claim', event, context);
if (claim.handled) {
	console.log('Claimed:', claim.result);
}
```

#### Hook Names

| Type      | Names                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Void      | `agent_start`, `agent_end`, `llm_output`, `tool_result`                                                    |
| Modifying | `before_model_resolve`, `before_prompt_build`, `before_tool_call`, `before_compaction`, `after_compaction` |
| Claiming  | `inbound_claim`, `message_received`                                                                        |

#### Utility Methods

```typescript
hooks.hasHooks('before_tool_call'); // Check if hooks registered
hooks.getRegisteredHookNames(); // All registered hook names
hooks.runBeforeToolCall(toolName, args, context); // Convenience method
hooks.runAfterToolCall(toolName, result, context);
hooks.clear(); // Remove all hooks
```

---

### FallbackChain

Multi-provider failover with cooldown tracking. Supports both standard and streaming execution.

#### Constructor

```typescript
import { FallbackChain, CooldownTracker, ErrorClassifier, createFallbackChain } from '@molos/agent';

const chain = new FallbackChain({
	candidates: [
		{ provider: 'openai', model: 'gpt-4', config: openaiConfig },
		{ provider: 'anthropic', model: 'claude-3', config: anthropicConfig },
		{ provider: 'ollama', model: 'llama2', config: ollamaConfig }
	],
	cooldownTracker: new CooldownTracker(),
	errorClassifier: new ErrorClassifier(),
	maxRetries: 3
});

// Or use factory
const chain2 = createFallbackChain(
	[openaiConfig, anthropicConfig],
	new CooldownTracker(),
	new ErrorClassifier()
);
```

#### Execution

```typescript
// Standard execution
const result = await chain.execute((candidate) => createProvider(candidate), messages, tools, {
	temperature: 0.7
});

// Streaming execution
const streamResult = await chain.executeStream(
	(candidate) => createProvider(candidate),
	messages,
	tools,
	{ temperature: 0.7 }
);
// Returns: { stream: ReadableStream, provider, model, attempts }

// Result structure
interface FallbackResult {
	response: unknown;
	provider: string;
	model: string;
	attempts: FallbackAttempt[];
}

// Stream result structure
interface FallbackStreamResult {
	stream: ReadableStream<unknown>;
	provider: string;
	model: string;
	attempts: FallbackAttempt[];
}
```

**Note on streaming:** Once a stream starts yielding chunks successfully, the chain commits to that provider. Fallback only applies if the provider fails to _start_ streaming.

#### Utility Functions

```typescript
parseModelRef('openai/gpt-4'); // { provider: 'openai', model: 'gpt-4' }
parseModelRef('gpt-4'); // { provider: 'openai', model: 'gpt-4' }
resolveCandidates('gpt-4', ['claude-3', 'llama2']);
modelKey('openai', 'gpt-4'); // 'openai/gpt-4'
```

---

### CooldownTracker

Exponential backoff cooldown tracking for failed providers.

#### Cooldown Formulas

**Standard Errors:**
| Failures | Cooldown |
|----------|----------|
| 1 | 1 minute |
| 2 | 5 minutes |
| 3 | 25 minutes |
| 4+ | 1 hour (cap) |

**Billing Errors:**
| Failures | Cooldown |
|----------|----------|
| 1 | 5 hours |
| 2 | 10 hours |
| 3 | 20 hours |
| 4+ | 24 hours (cap) |

#### Usage

```typescript
const tracker = new CooldownTracker({
	failureWindowMs: 24 * 60 * 60 * 1000, // 24h reset window
	nowFunc: () => Date.now()
});

// Record failures
tracker.recordFailure('openai', 'gpt-4', 'rate_limit');
tracker.recordFailure('openai', 'gpt-4', 'timeout');

// Check cooldown
if (tracker.isInCooldown('openai', 'gpt-4')) {
	const remaining = tracker.getRemainingCooldown('openai', 'gpt-4');
	console.log(`Cooldown: ${formatCooldownDuration(remaining)}`);
}

// Record success (resets counters)
tracker.recordSuccess('openai', 'gpt-4');

// Query failures
tracker.getErrorCount('openai', 'gpt-4');
tracker.getFailureCount('openai', 'gpt-4', 'rate_limit');
```

---

### ErrorClassifier

Classifies LLM errors to determine failover strategy.

#### Failover Reasons

| Reason       | Retriable | Description               |
| ------------ | --------- | ------------------------- |
| `auth`       | Yes       | 401/403 - invalid API key |
| `rate_limit` | Yes       | 429 - too many requests   |
| `billing`    | Yes       | 402 - payment required    |
| `timeout`    | Yes       | 408 - request timeout     |
| `overloaded` | Yes       | Provider overloaded       |
| `format`     | No        | 400 - bad request format  |
| `unknown`    | Yes       | Everything else           |

#### Usage

```typescript
const classifier = new ErrorClassifier({
  patterns: [...],  // Custom error patterns
  retriableReasons: ['rate_limit', 'timeout']
});

const result = classifier.classify(error);
// {
//   reason: 'rate_limit',
//   shouldFailover: true,
//   retryable: true,
//   message: 'Rate limit exceeded'
// }

isRetriableReason('format')  // false
describeFailoverReason('rate_limit')  // 'Rate limit exceeded'
```

---

### TurnManager

Manages turn lifecycle and sub-turn tracking.

#### Factory

```typescript
import { createTurnManager } from '@molos/agent';

const manager = createTurnManager({
	maxTurns: 50,
	maxSubTurnDepth: 3
});
```

#### Methods

```typescript
// Create turns
const turn = manager.createTurn('user message');
const subTurn = manager.createSubTurn(parentTurnId, request, tools);

// Complete/fail turns
manager.completeTurn(turnId, turnResult);
manager.failTurn(turnId, error);
manager.cancelTurn(turnId);

// Query
manager.getTurn(turnId);
manager.getActiveTurns();
manager.getCompletedTurns();
manager.canSpawnSubTurn(parentTurnId);
manager.getSubTurnDepth(turnId);
manager.isAtMaxTurns();

// Stats
manager.getTotalTurns();
manager.getActiveTurnCount();
manager.currentTurn; // Getter
manager.turnCount; // Getter

manager.reset();
```

---

### SessionStore

Interface and implementations for session state management.

#### In-Memory Session Store

```typescript
import { createSessionStore } from '@molos/agent';

const store = createSessionStore({
	persistPath: './sessions/', // Optional persistence
	autoSave: true,
	maxHistorySize: 1000
});

// Create/get session
const session = store.create('session-1', { userId: 'user-1' });
const existing = store.get('session-1');

// Add messages
store.addMessage('session-1', { role: 'user', content: 'Hello' });

// Query
store.getHistory('session-1', 10); // Last 10 messages
store.truncateHistory('session-1', 100);

// Update
store.update('session-1', { summary: 'User greeted agent' });

// Save
await store.save('session-1');
await store.saveAll();
```

#### Ephemeral Session Store

For subagents - auto-truncates at 50 messages:

```typescript
import { createEphemeralSessionStore } from '@molos/agent';

const ephemeral = createEphemeralSessionStore(initialMessages);
ephemeral.addMessage('session-1', { role: 'assistant', content: 'Hi!' });
```

---

### SubagentSpawner

Spawns subagents with depth limits and isolation.

#### Factory

```typescript
import { createSubagentSpawner } from '@molos/agent';

const spawner = createSubagentSpawner({
	maxDepth: 3,
	defaultTimeout: 60000
});
```

#### Spawn Parameters

```typescript
interface SpawnParams {
	name: string;
	model?: string;
	tools?: ToolDefinition[];
	systemPrompt?: string;
	timeout?: number;
	maxContextRunes?: number;
}
```

#### Spawning

```typescript
const result = await spawner.spawn(params, context);
// Returns SpawnResult { success, sessionId?, error? }
```

---

### ModuleRegistry

Registry for multi-agent coordination.

```typescript
import { createModuleRegistry, getModuleRegistry } from '@molos/agent';

const registry = createModuleRegistry();

// Register agent
registry.register('session-1', {
	name: 'my-agent',
	config: agentConfig,
	userId: 'user-1'
});

// Query
const agent = registry.get('session-1');
const allAgents = registry.list();
const userAgents = registry.listByUser('user-1');
registry.getCount();

// Unregister
registry.unregister('session-1');
```

---

## Event Types

### Lifecycle Events

| Event         | Stream    | Data                                            |
| ------------- | --------- | ----------------------------------------------- |
| `agent_start` | lifecycle | `{ model, provider }`                           |
| `agent_end`   | lifecycle | `{ output, iterations, durationMs }`            |
| `turn_start`  | lifecycle | `{ turnId, input }`                             |
| `turn_end`    | lifecycle | `{ turnId, output, toolCallCount, durationMs }` |

### Tool Events

| Event                   | Stream | Data                                           |
| ----------------------- | ------ | ---------------------------------------------- |
| `tool_execution_start`  | tool   | `{ toolName, toolCallId, args }`               |
| `tool_execution_update` | tool   | `{ toolName, toolCallId, progress? }`          |
| `tool_execution_end`    | tool   | `{ toolName, toolCallId, result, durationMs }` |

### Assistant Events

| Event            | Stream    | Data                     |
| ---------------- | --------- | ------------------------ |
| `message_start`  | assistant | `{ messageId }`          |
| `message_update` | assistant | `{ messageId, delta }`   |
| `message_end`    | assistant | `{ messageId, content }` |

### Compaction Events

| Event                   | Stream     | Data                          |
| ----------------------- | ---------- | ----------------------------- |
| `auto_compaction_start` | compaction | `{ reason, tokensBefore }`    |
| `auto_compaction_end`   | compaction | `{ tokensAfter, durationMs }` |

### Error Events

| Event            | Stream | Data                             |
| ---------------- | ------ | -------------------------------- |
| `error`          | error  | `{ code, message, recoverable }` |
| `provider_error` | error  | `{ error, model }`               |

---

## Type Exports

All types are exported from `@molos/agent` directly:

```typescript
import type {
	// Message types
	AgentMessage,
	MessageRole,
	MessageContent,

	// Tool types
	ToolDefinition,
	ToolResult,
	ToolCall,
	ToolParameterSchema,

	// Turn types
	Turn,
	TurnResult,
	TurnStatus,
	SubTurn,
	SubTurnResult,

	// Session types
	Session,
	SessionConfig,
	SessionStore,

	// LLM types
	LlmRequest,
	LlmResponse,
	LlmProvider,
	ProviderConfig,
	ModelConfig,

	// Hook types
	HookContext,
	HookName,
	VoidHookHandler,
	ModifyingHookHandler,
	ClaimingHookHandler,

	// Event types
	AgentEvent,
	EventStream,

	// Streaming types
	StreamChunk,
	StreamContext,
	StreamMiddleware,
	StreamResult,

	// ContextBuilder types
	ContextBuilder,
	ContextBuilderConfig,
	Skill,
	SkillsLoader,
	SkillSearchResult,

	// Result type
	Result,
	ok,
	err,
	isOk,
	isErr
} from '@molos/agent';
```

---

## Error Handling

### AgentError Types

```typescript
type AgentError =
	| { type: 'timeout'; message: string; cause?: unknown }
	| { type: 'context_overflow'; message: string; cause?: unknown }
	| { type: 'provider_error'; message: string; cause?: unknown }
	| { type: 'tool_error'; message: string; cause?: unknown }
	| { type: 'unknown'; message: string; cause?: unknown };
```

### FallbackChain Errors

```typescript
// When all providers fail
throw new FallbackExhaustedError(attempts);

// Attempt structure
interface FallbackAttempt {
	candidate: FallbackCandidate;
	error?: FailoverError;
	durationMs: number;
	skipped?: boolean;
	skippedReason?: string;
}
```

### Tool Execution Errors

```typescript
// Tool not found
{ success: false, error: 'Tool "xyz" not found' }

// Validation error
{ success: false, error: 'Invalid arguments: missing required field "query"' }

// Execution error
{ success: false, error: 'Network request failed: timeout' }
```

---

## Best Practices

### Tool Design

1. **Use descriptive names**: `search_web` not `s`
2. **Clear descriptions**: Help the LLM understand when to use the tool
3. **Validate inputs**: Use Zod schemas via `createZodSchemaFromParams`
4. **Handle errors gracefully**: Return meaningful error messages

```typescript
registry.register({
	name: 'search_web',
	description:
		'Search the internet for current information. Use when users ask about recent events, weather, stock prices, or facts that may change over time.',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'The search query to look up'
			},
			numResults: {
				type: 'integer',
				description: 'Number of results to return (1-10)',
				minimum: 1,
				maximum: 10,
				default: 5
			}
		},
		required: ['query']
	},
	execute: async (args, context) => {
		// Implementation
	}
});
```

### Hook Usage

1. **Use void hooks for logging**: Non-blocking, fire-and-forget
2. **Use modifying hooks for transforms**: Can modify arguments/data
3. **Use claiming hooks sparingly**: First match wins, can be complex

### Provider Configuration

1. **Order by reliability**: Most reliable provider first
2. **Set appropriate cooldowns**: Billing errors need longer cooldowns
3. **Use error classification**: Different errors need different handling

---

## See Also

- [Agent Quick Reference](./agent-quick-reference.md)
- [Architecture Overview](../architecture/overview.md)
- [Module Development](../modules/development.md)
- [MCP Integration](../mcp/integration-prd.md)

---

_Last Updated: 2026-03-25_

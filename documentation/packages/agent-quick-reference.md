# @molos/agent Quick Reference

> Quick reference for the @molos/agent package

## Installation

```bash
npm install @molos/agent
```

## Common Patterns

### Basic Agent Setup

```typescript
import { createAgentLoop, ToolRegistry, createEventBus, createHookManager } from '@molos/agent';

const agent = createAgentLoop({
	provider: myProvider,
	tools: [],
	model: 'gpt-4'
});
```

### Tool Registration

```typescript
const tools = new ToolRegistry();

// Visible tool
tools.register({
  name: 'search',
  description: 'Search the web',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' }
    },
    required: ['query']
  },
  execute: async ({ query }) => ({ results: [...] })
});

// Hidden tool (BM25 discoverable)
tools.registerHidden({
  name: 'git_commit',
  description: 'Create a git commit'
}, 3); // TTL of 3 iterations
```

### Event Subscription

```typescript
const unsub = eventBus.subscribe('tool', (event) => {
	if (event.type === 'tool_execution_start') {
		console.log('Starting:', event.data.toolName);
	}
});
```

### Provider Fallback

```typescript
import { FallbackChain, CooldownTracker, ErrorClassifier, createFallbackChain } from '@molos/agent';

const chain = createFallbackChain(
	[openaiConfig, anthropicConfig],
	new CooldownTracker(),
	new ErrorClassifier()
);
```

### Hook Registration

```typescript
// Void hook (fire-and-forget)
hooks.registerVoidHook({
	name: 'agent_end',
	handler: async (event, context) => {
		console.log('Agent finished!');
	}
});

// Modifying hook (can modify args)
hooks.registerModifyingHook({
	name: 'before_tool_call',
	handler: async (event, context, args) => {
		return { modified: { ...args, extra: true } };
	}
});

// Claiming hook (first handler wins)
hooks.registerClaimingHook({
	name: 'inbound_claim',
	handler: async (event, context) => {
		if (context.message.includes('special')) {
			return { handled: true, result: 'Handled!' };
		}
		return { handled: false };
	}
});
```

---

## Default Values

| Option                       | Default  |
| ---------------------------- | -------- |
| `maxIterations`              | 20       |
| `maxTurns`                   | 50       |
| `maxToolCallsPerTurn`        | 20       |
| `toolTimeout`                | 30000ms  |
| `maxConcurrent` (tools)      | 10       |
| `maxSubTurnDepth`            | 3        |
| `defaultBufferSize` (events) | 16       |
| `defaultTimeoutMs` (hooks)   | 5000     |
| `failureWindowMs` (cooldown) | 24 hours |
| `MAX_EPHEMERAL_HISTORY`      | 50       |

---

## Key API Signatures

### AgentLoop

```typescript
createAgentLoop(config: AgentLoopConfig): AgentLoop

// Methods
agent.run(messages: AgentMessage[], input: string): Promise<AgentRunResult>
agent.runStream(messages: AgentMessage[], input: string, middlewares?: StreamMiddleware[]): StreamResult
agent.runTurn(turn: Turn, messages: AgentMessage[], input: string): Promise<TurnResult>
agent.runSubTurn(parentTurn: Turn, input: string, config?: SpawnConfig): Promise<SubTurnResult>
agent.executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult>
agent.registerTool(tool: ToolDefinition): void
agent.unregisterTool(toolName: string): boolean
agent.getIteration(): number
agent.getTurnCount(): number
agent.getUsage(): { inputTokens, outputTokens, totalTokens }
agent.reset(): void
agent.abort(): void
```

### ToolRegistry

```typescript
new ToolRegistry(config?: { maxConcurrent?: number })

// Registration
registry.register(tool: Tool): void
registry.registerHidden(tool: Tool, ttl: number): void
registry.registerMany(tools: Tool[]): void
registry.unregister(name: string): boolean

// Execution
registry.execute(toolName: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>
registry.executeMany(toolCalls: ToolCall[], context?: ToolContext): Promise<ToolResult[]>

// Discovery
registry.searchBM25(query: string, maxResults?: number): ToolSearchResult[]
registry.searchRegex(pattern: string, maxResults?: number): ToolSearchResult[]
registry.promoteTools(names: string[], ttl: number): void
registry.promoteAndTick(names: string[], ttl: number): number  // Atomic promote + tick
registry.tickTTL(): number

// Query
registry.getTools(includeHidden?: boolean): Tool[]
registry.getVisibleTools(): Tool[]
registry.getDefinitions(): ToolDefinition[]
registry.get(name: string): Tool | undefined
registry.has(name: string): boolean
registry.count(): number
registry.listNames(): string[]
registry.versionNumber(): number
registry.snapshotHiddenTools(): { docs: HiddenToolDoc[], version: number }
```

### EventBus

```typescript
createEventBus(config?: { maxSubscribers?: number, defaultBufferSize?: number }): EventBus

// Subscribe (returns unsubscribe function)
bus.subscribe(stream: EventStream | '*', handler: (event: AgentEvent) => void | Promise<void>, options?: { bufferSize?: number, filter?: (event: AgentEvent) => boolean }): () => void

// Emit
bus.emit(event: AgentEvent): void
bus.emitSync(event: AgentEvent): Promise<void>

// Monitoring
bus.getSubscriberCount(): number
bus.getDroppedCounts(): Record<string, number>
bus.clear(): void
bus.close(): void
```

### HookManager

```typescript
createHookManager(config?: { defaultTimeoutMs?: number, continueOnError?: boolean }): HookManager

// Register (returns unsubscribe function)
hooks.register(hook: AnyHookHandler): () => void
hooks.registerVoidHook(hook: VoidHookHandler): () => void
hooks.registerModifyingHook(hook: ModifyingHookHandler): () => void
hooks.registerClaimingHook(hook: ClaimingHookHandler): () => void

// Run
hooks.runVoidHook(hookName: VoidHookName, event: AgentEvent, context: HookContext): Promise<void>
hooks.runModifyingHook<T>(hookName: ModifyingHookName, event: AgentEvent, context: HookContext, initialValue: T, mergeResults?: (a: T, b: T) => T): Promise<T | undefined>
hooks.runClaimingHook<T>(hookName: ClaimingHookName, event: AgentEvent, context: HookContext): Promise<{ handled: boolean, result?: T }>

// Query
hooks.hasHooks(hookName: HookName): boolean
hooks.getRegisteredHookNames(): HookName[]
hooks.clear(): void
```

### FallbackChain

```typescript
new FallbackChain(config: FallbackChainConfig): FallbackChain

createFallbackChain(models: ModelConfig[], cooldownTracker: CooldownTracker, errorClassifier: ErrorClassifier): FallbackChain

// Execute
chain.execute(providerFactory: (candidate) => LanguageModelV2 | null, messages: unknown[], tools: unknown[], options?: Record<string, unknown>): Promise<FallbackResult>
chain.executeStream(providerFactory: (candidate) => LanguageModelV2 | null, messages: unknown[], tools: unknown[], options?: Record<string, unknown>): Promise<FallbackStreamResult>
```

### CooldownTracker

```typescript
new CooldownTracker(config?: { failureWindowMs?: number, nowFunc?: () => number }): CooldownTracker

tracker.isInCooldown(provider: string, model: string): boolean
tracker.getRemainingCooldown(provider: string, model: string): number
tracker.recordFailure(provider: string, model: string, reason: FailoverReason): number | null
tracker.recordSuccess(provider: string, model: string): void
tracker.getErrorCount(provider: string, model: string): number
tracker.getFailureCount(provider: string, model: string, reason: FailoverReason): number
tracker.clear(): void
```

---

## Event Streams

| Stream       | Events                                                          |
| ------------ | --------------------------------------------------------------- |
| `lifecycle`  | agent_start, agent_end, turn_start, turn_end                    |
| `tool`       | tool_execution_start, tool_execution_update, tool_execution_end |
| `assistant`  | message_start, message_update, message_end                      |
| `error`      | error, provider_error                                           |
| `compaction` | auto_compaction_start, auto_compaction_end                      |

---

## Hook Names

| Type      | Names                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Void      | `agent_start`, `agent_end`, `llm_output`, `tool_result`                                                    |
| Modifying | `before_model_resolve`, `before_prompt_build`, `before_tool_call`, `before_compaction`, `after_compaction` |
| Claiming  | `inbound_claim`, `message_received`                                                                        |

---

## Failover Reasons

| Reason       | Retriable | Default Cooldown         |
| ------------ | --------- | ------------------------ |
| `auth`       | Yes       | 1min, 5min, 25min, 1h    |
| `rate_limit` | Yes       | 1min, 5min, 25min, 1h    |
| `billing`    | Yes       | 5h, 10h, 20h, 24h        |
| `timeout`    | Yes       | 1min, 5min, 25min, 1h    |
| `overloaded` | Yes       | 1min, 5min, 25min, 1h    |
| `format`     | No        | None (abort immediately) |
| `unknown`    | Yes       | 1min, 5min, 25min, 1h    |

---

## Type Exports

All types are exported from `@molos/agent`:

```typescript
import type {
	// Core
	AgentMessage,
	ToolDefinition,
	ToolResult,
	ToolCall,

	// Turn & Session
	Turn,
	TurnResult,
	Session,
	SessionStore,

	// LLM
	LlmRequest,
	LlmResponse,
	ProviderConfig,
	ModelConfig,

	// Hooks
	HookContext,
	HookName,

	// Events
	AgentEvent,
	EventStream,

	// Streaming
	StreamChunk,
	StreamContext,
	StreamMiddleware,
	StreamResult,

	// ContextBuilder
	ContextBuilder,
	ContextBuilderConfig,
	Skill,
	SkillSearchResult,

	// Result
	Result,
	ok,
	err,
	isOk,
	isErr
} from '@molos/agent';
```

---

## Module Exports

```typescript
// Core
import { createAgentLoop, AgentLoop } from '@molos/agent';
import { createTurnManager, TurnManager } from '@molos/agent/core';
import { createSessionStore, createEphemeralSessionStore, SessionStore } from '@molos/agent/core';
import { createContextBuilder, ContextBuilder } from '@molos/agent/core';

// Tools
import { ToolRegistry } from '@molos/agent';
import { BM25Engine, BM25SearchTool, RegexSearchTool } from '@molos/agent/tools';
import {
	ToolResultCache,
	wrapToolDefinition,
	convertTools,
	buildCacheKey
} from '@molos/agent/tools';

// Providers
import {
	createProvider,
	mapProvider,
	FallbackChain,
	CooldownTracker,
	ErrorClassifier
} from '@molos/agent/providers';

// Hooks
import { createHookManager, HookManager } from '@molos/agent/hooks';

// Events
import { createEventBus, EventBus } from '@molos/agent/events';

// Multi-agent
import {
	createSubagentSpawner,
	SubagentSpawner,
	createModuleRegistry,
	ModuleRegistry
} from '@molos/agent/multi-agent';

// Streaming
import {
	streamingMiddlewares,
	type StreamChunk,
	type StreamContext,
	type StreamMiddleware,
	type StreamResult
} from '@molos/agent';
```

---

_Last Updated: 2026-03-25_

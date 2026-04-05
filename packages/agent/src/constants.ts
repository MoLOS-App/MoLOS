/**
 * Magic Numbers Elimination - Centralized Constants
 *
 * This module extracts all hardcoded numeric values from the codebase
 * into well-documented, grouped constants for easier maintenance.
 *
 * ## Why Use Constants?
 *
 * - **Meaning**: Names explain what values mean (e.g., `MAX_RETRIES = 3` vs `3`)
 * - **Consistency**: Single source of truth prevents inconsistencies
 * - **Changeability**: Update in one place affects all usages
 * - **Documentation**: Units in names prevent confusion (e.g., `_MS` vs `_COUNT`)
 *
 * ## Grouping
 *
 * Constants are grouped by what they control:
 *
 * | Group     | Prefix            | Purpose                              |
 * |-----------|-------------------|--------------------------------------|
 * | AGENT     | `AGENT_*`         | Core loop behavior                   |
 * | TOOL      | `TOOL_*`          | Tool execution and caching           |
 * | BM25      | `BM25_*`          | Search ranking algorithm             |
 * | PROVIDER  | `PROVIDER_*`      | LLM provider configuration           |
 * | COOLDOWN  | `COOLDOWN_*`      | Rate limiting and backoff            |
 * | HOOK      | `HOOK_*`          | Hook manager timeouts                |
 * | MULTI     | `MULTI_AGENT_*`   | Multi-agent orchestration            |
 * | TOKEN     | `TOKEN_*`         | Token estimation                     |
 * | REGEX     | `REGEX_*`         | Pattern validation limits            |
 * | EVENT     | `EVENT_*`         | Event bus configuration              |
 * | COMPACTION| `COMPACTION_*`    | Context compaction behavior          |
 *
 * @module constants
 */

// =============================================================================
// AGENT Constants - Core loop behavior
// =============================================================================

export const AGENT = {
	/** Maximum iterations before agent stops (default: 20) */
	MAX_ITERATIONS: 20,

	/** Maximum turns per iteration (default: 50) */
	MAX_TURNS: 50,

	/** Maximum tool calls allowed per turn (default: 20) */
	MAX_TOOL_CALLS_PER_TURN: 20,

	/** Tool execution timeout in milliseconds (default: 30 seconds) */
	TOOL_TIMEOUT_MS: 30_000,

	/** Base backoff time for retries in milliseconds (default: 1 second) */
	RETRY_BACKOFF_MS: 1_000,

	/** Maximum retry attempts for retriable errors (default: 3) */
	MAX_RETRIES: 3,

	/** Maximum overflow compaction attempts before truncation (default: 3) */
	MAX_OVERFLOW_COMPACTION_ATTEMPTS: 3,

	/** Panic threshold - abort after this many panics (default: 3) */
	PANIC_THRESHOLD: 3,

	/** Default max sub-turn depth for recursive tool calling (default: 3) */
	DEFAULT_MAX_SUB_TURN_DEPTH: 3,

	/** Default context window size when not specified (default: 128,000 tokens) */
	DEFAULT_CONTEXT_WINDOW: 128_000,

	/** Default max tokens for LLM requests (default: 4,096) */
	DEFAULT_MAX_TOKENS: 4096,

	/** Multiplier for estimating context window from max tokens (4x) */
	CONTEXT_WINDOW_MULTIPLIER: 4
} as const;

// =============================================================================
// TOOL Constants - Tool execution and caching
// =============================================================================

export const TOOL = {
	/** Default max concurrent tool executions (default: 10) */
	MAX_CONCURRENT: 10,

	/** Default TTL for cached tool results in milliseconds (default: 1 minute) */
	CACHE_TTL_MS: 60_000,

	/** Default TTL for cached error results in milliseconds (default: 10 seconds) */
	CACHE_ERROR_TTL_MS: 10_000,

	/** Default maximum cache size (number of entries, default: 100) */
	CACHE_MAX_SIZE: 100
} as const;

// =============================================================================
// TOOL_RESULT Constants - Tool result truncation behavior
// =============================================================================

export const TOOL_RESULT = {
	/** Maximum context share for a single tool result (30% of context window) */
	MAX_CONTEXT_SHARE: 0.3,

	/** Hard maximum characters for tool results (400K chars for large contexts) */
	HARD_MAX_CHARS: 400_000,

	/** Minimum characters to always keep when truncating (2,000 chars) */
	MIN_KEEP_CHARS: 2_000,

	/** Conservative headroom ratio for tokenizer variance (75%) */
	CONTEXT_HEADROOM_RATIO: 0.75,

	/** Maximum context share for single result during truncation (50% of budget) */
	SINGLE_RESULT_MAX_SHARE: 0.5
} as const;

// =============================================================================
// COMPACTION Constants - Context compaction behavior
// =============================================================================

export const COMPACTION = {
	/** Number of recent messages to keep during compaction (default: 10) */
	KEEP_RECENT_MESSAGES: 10,

	/** Tool result truncation limit in compaction summary (200 chars) */
	TOOL_RESULT_TRUNCATE_CHARS: 200,

	/** Text content truncation limit in compaction summary (300 chars) */
	TEXT_TRUNCATE_CHARS: 300,

	/** Tail slice size for important content detection (2000 chars) */
	TAIL_SLICE_CHARS: 2000,

	/** Maximum tail budget when preserving important content (4000 chars) */
	TAIL_MAX_CHARS: 4000,

	/** Tail budget ratio for head+tail preservation (30%) */
	TAIL_BUDGET_RATIO: 0.3
} as const;

// =============================================================================
// BM25 Constants - Search ranking algorithm
// =============================================================================

export const BM25 = {
	/** Term frequency saturation parameter (default: 1.2)
	 * Higher values allow higher TF to continue increasing score
	 * Lower values saturate faster
	 */
	DEFAULT_K1: 1.2,

	/** Document length normalization parameter (default: 0.75)
	 * b=0 disables normalization, b=1 fully normalizes
	 */
	DEFAULT_B: 0.75,

	/** Default limit for BM25 search results (default: 10) */
	DEFAULT_LIMIT: 10,

	/** Maximum regex pattern length for search (200 chars) */
	MAX_PATTERN_LENGTH: 200,

	/** Default TTL for hidden tool visibility (default: 5 iterations) */
	DEFAULT_TTL: 5,

	/** Default max search results for BM25 search (default: 10) */
	DEFAULT_MAX_SEARCH_RESULTS: 10,

	/** Snippet extraction length for regex search results (100 chars) */
	SNIPPET_LENGTH: 100
} as const;

// =============================================================================
// PROVIDER Constants - LLM provider configuration
// =============================================================================

export const PROVIDER = {
	/** Default provider request timeout in milliseconds (60 seconds) */
	DEFAULT_TIMEOUT_MS: 60_000,

	/** Maximum concurrent requests per provider (default: 10) */
	MAX_CONCURRENT_REQUESTS: 10,

	/** Default cooldown duration in milliseconds (30 seconds) */
	COOLDOWN_DEFAULT_MS: 30_000,

	/** Probe interval for health checks in milliseconds (5 seconds) */
	PROBE_INTERVAL_MS: 5_000
} as const;

// =============================================================================
// COOLDOWN Constants - Rate limiting and exponential backoff
// =============================================================================

export const COOLDOWN = {
	/** Standard backoff base: 1 minute */
	STANDARD_BACKOFF_BASE_MS: 60_000,

	/** Standard backoff cap: 1 hour */
	STANDARD_BACKOFF_CAP_MS: 3_600_000,

	/** Billing backoff base: 5 hours */
	BILLING_BACKOFF_BASE_MS: 5 * 60 * 60 * 1000,

	/** Billing backoff cap: 24 hours */
	BILLING_BACKOFF_CAP_MS: 24 * 60 * 60 * 1000,

	/** Default failure window before error count resets (24 hours) */
	FAILURE_WINDOW_DEFAULT_MS: 24 * 60 * 60 * 1000,

	/** Exponential base for standard backoff (5^x) */
	STANDARD_BACKOFF_BASE: 5,

	/** Exponential base for billing backoff (2^x) */
	BILLING_BACKOFF_BASE: 2,

	/** Maximum exponent for standard backoff (caps at 3) */
	STANDARD_MAX_EXP: 3,

	/** Maximum exponent for billing backoff (caps at 10) */
	BILLING_MAX_EXP: 10
} as const;

// =============================================================================
// HOOK Constants - Hook manager timeouts
// =============================================================================

export const HOOK = {
	/** Default timeout for hook execution (default: 5 seconds) */
	DEFAULT_TIMEOUT_MS: 5_000,

	/** Timeout for observer hooks (default: 500ms)
	 * Observers should be fast to avoid blocking event processing
	 */
	OBSERVER_TIMEOUT_MS: 500,

	/** Timeout for interceptor hooks (default: 5 seconds)
	 * BeforeLLM/AfterLLM, BeforeTool/AfterTool hooks
	 */
	INTERCEPTOR_TIMEOUT_MS: 5_000,

	/** Timeout for approval hooks (default: 60 seconds)
	 * ApproveTool hooks may need external API calls
	 */
	APPROVAL_TIMEOUT_MS: 60_000
} as const;

// =============================================================================
// MULTI_AGENT Constants - Multi-agent orchestration
// =============================================================================

export const MULTI_AGENT = {
	/** Default timeout for subagent completion wait (5 minutes) */
	COMPLETION_TIMEOUT_MS: 300_000,

	/** Base retry delay for delivery retries (1 second) */
	DELIVERY_RETRY_DELAY_MS: 1_000,

	/** Maximum delivery retry attempts (default: 3) */
	MAX_DELIVERY_RETRIES: 3,

	/** Polling interval for completion checking (100ms) */
	COMPLETION_CHECK_INTERVAL_MS: 100,

	/** Default health check interval (30 seconds) */
	HEALTH_CHECK_INTERVAL_MS: 30_000,

	/** Health check timeout (5 seconds) */
	HEALTH_CHECK_TIMEOUT_MS: 5_000
} as const;

// =============================================================================
// TOKEN Constants - Token estimation
// =============================================================================

export const TOKEN = {
	/** Estimated chars per token (2.5 - conservative to avoid underestimation) */
	CHARS_PER_TOKEN: 2.5,

	/** Per-message overhead in characters (roles, newlines, structure) */
	MESSAGE_OVERHEAD_CHARS: 12,

	/** Fixed token estimate per media item (images, audio, video, files) */
	MEDIA_TOKENS_PER_ITEM: 256,

	/** Per-tool overhead in characters (JSON structure, parameter metadata) */
	TOOL_DEFS_OVERHEAD_CHARS: 20,

	/** Thinking levels budget tokens */
	THINKING_BUDGET_OFF: 0,
	THINKING_BUDGET_MINIMAL: 1024,
	THINKING_BUDGET_LOW: 4096,
	THINKING_BUDGET_MEDIUM: 8192,
	THINKING_BUDGET_HIGH: 16384
} as const;

// =============================================================================
// REGEX Constants - Pattern validation limits
// =============================================================================

export const REGEX = {
	/** Maximum pattern length to prevent memory exhaustion (200 chars) */
	MAX_PATTERN_LENGTH: 200
} as const;

// =============================================================================
// EVENT Constants - Event bus configuration
// =============================================================================

export const EVENT = {
	/** Maximum subscribers per event bus (default: 100) */
	MAX_SUBSCRIBERS: 100,

	/** Default channel buffer size (default: 16 events) */
	DEFAULT_BUFFER_SIZE: 16
} as const;

// =============================================================================
// CONTEXT Constants - Context building and skill handling
// =============================================================================

export const CONTEXT = {
	/** Skill description max length for extraction (200 chars) */
	SKILL_DESCRIPTION_MAX_CHARS: 200,

	/** Default max chars for skills summary before switching to compact (30,000) */
	SKILLS_SUMMARY_MAX_CHARS: 30_000
} as const;

// =============================================================================
// SCHEMA Constants - Zod schema defaults
// =============================================================================

export const SCHEMA = {
	/** Default provider request timeout (matches PROVIDER.DEFAULT_TIMEOUT_MS) */
	PROVIDER_TIMEOUT: 60_000,

	/** Default max retries for provider requests */
	PROVIDER_MAX_RETRIES: 3,

	/** Default tool timeout (matches AGENT.TOOL_TIMEOUT_MS) */
	TOOL_TIMEOUT: 30_000
} as const;

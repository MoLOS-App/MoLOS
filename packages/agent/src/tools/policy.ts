/**
 * Tool Policy - Layered allow/deny policy system for tool execution
 *
 * ## Purpose
 * Provides fine-grained control over tool execution through a pipeline of
 * policy checks. Policies can deny tools based on deny lists, allow lists,
 * rate limits, or session ownership.
 *
 * ## Architecture
 *
 * ### PolicyResult
 * Every policy check returns a PolicyResult:
 * - allowed: boolean - Whether the tool can execute
 * - reason?: string - Human-readable explanation (when denied)
 * - code?: 'DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' - Machine-readable code
 *
 * ### ToolPolicy Interface
 * All policies implement the ToolPolicy interface:
 * ```typescript
 * canExecute(
 *   toolName: string,
 *   args: Record<string, unknown>,
 *   context: ToolExecutionContext
 * ): PolicyResult
 * ```
 *
 * ### ToolPolicyPipeline
 * Chains multiple policies together. Each policy runs in order.
 * If any policy denies, execution stops and returns the denial.
 *
 * ### Built-in Policies
 *
 * 1. **DenyListPolicy** - Blocks specific tools by name
 * 2. **AllowListPolicy** - Only allows specific tools (empty = allow all)
 * 3. **RateLimitPolicy** - Limits tool calls per time window
 * 4. **SessionOwnerPolicy** - Controls tool access based on session privileges
 *
 * ### Global Registry
 * ToolPolicyRegistry maintains global policies and per-session pipelines.
 * Sessions can have their own policy instances.
 *
 * ## Usage Pattern
 *
 * ```typescript
 * // Create a pipeline with multiple policies
 * const pipeline = new ToolPolicyPipeline([
 *   new DenyListPolicy(new Set(['dangerous_tool'])),
 *   new RateLimitPolicy(60, 60_000), // 60 calls per minute
 *   new AllowListPolicy(new Set(['allowed_tool']))
 * ]);
 *
 * // Check before execution
 * const result = pipeline.canExecute('my_tool', args, context);
 * if (!result.allowed) {
 *   throw new Error(`Tool denied: ${result.reason}`);
 * }
 * ```
 *
 * ## AI Context Optimization
 *
 * Policy checks are fast - O(1) for deny/allow lists, O(1) amortized for
 * rate limiting. No async operations needed, minimizing latency impact.
 *
 * @module tools/policy
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a policy check
 */
export interface PolicyResult {
	/** Whether the tool is allowed to execute */
	allowed: boolean;
	/** Human-readable reason for denial (when not allowed) */
	reason?: string;
	/** Machine-readable denial code */
	code?: 'DENIED' | 'NOT_FOUND' | 'RATE_LIMITED';
}

/**
 * Context passed to policy checks during tool execution
 */
export interface ToolExecutionContext {
	/** Session key for the current session */
	sessionKey?: string;
	/** User ID of the requester */
	userId?: string;
	/** Channel where the request originated */
	channel?: string;
	/** Chat ID if applicable */
	chatId?: string;
	/** Tool call ID for tracing */
	toolCallId?: string;
	/** Whether session has elevated privileges */
	elevated?: boolean;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Interface for tool policies
 */
export interface ToolPolicy {
	/**
	 * Check if a tool should be allowed to execute
	 */
	canExecute(
		toolName: string,
		args: Record<string, unknown>,
		context: ToolExecutionContext
	): PolicyResult;
}

// ============================================================================
// ToolPolicyPipeline - Chains multiple policies
// ============================================================================

/**
 * Pipeline that chains multiple policies together.
 * Policies are evaluated in order; first denial wins.
 */
export class ToolPolicyPipeline implements ToolPolicy {
	private readonly policies: ToolPolicy[];

	constructor(policies: ToolPolicy[] = []) {
		this.policies = policies;
	}

	/**
	 * Add a policy to the end of the pipeline
	 */
	addPolicy(policy: ToolPolicy): void {
		this.policies.push(policy);
	}

	/**
	 * Prepend a policy to the beginning of the pipeline
	 */
	prependPolicy(policy: ToolPolicy): void {
		this.policies.unshift(policy);
	}

	/**
	 * Remove a policy from the pipeline (by reference)
	 */
	removePolicy(policy: ToolPolicy): boolean {
		const index = this.policies.indexOf(policy);
		if (index !== -1) {
			this.policies.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Clear all policies from the pipeline
	 */
	clear(): void {
		this.policies.length = 0;
	}

	/**
	 * Get number of policies in pipeline
	 */
	get size(): number {
		return this.policies.length;
	}

	/**
	 * Execute all policies in order.
	 * Returns the first denial, or allows if all pass.
	 */
	canExecute(
		toolName: string,
		args: Record<string, unknown>,
		context: ToolExecutionContext
	): PolicyResult {
		for (const policy of this.policies) {
			const result = policy.canExecute(toolName, args, context);
			if (!result.allowed) {
				return result;
			}
		}
		return { allowed: true };
	}
}

// ============================================================================
// DenyListPolicy - Blocks specific tools
// ============================================================================

/**
 * Policy that denies execution of specific tools by name.
 * Useful for blocking known dangerous or deprecated tools.
 */
export class DenyListPolicy implements ToolPolicy {
	private readonly denied: Set<string>;

	/**
	 * @param denied - Set of tool names to deny
	 */
	constructor(denied: Set<string> = new Set()) {
		this.denied = denied;
	}

	/**
	 * Add a tool name to the deny list
	 */
	deny(toolName: string): void {
		this.denied.add(toolName);
	}

	/**
	 * Remove a tool name from the deny list
	 */
	allow(toolName: string): void {
		this.denied.delete(toolName);
	}

	/**
	 * Check if a tool is on the deny list
	 */
	isDenied(toolName: string): boolean {
		return this.denied.has(toolName);
	}

	/**
	 * Clear the entire deny list
	 */
	clear(): void {
		this.denied.clear();
	}

	canExecute(
		toolName: string,
		_args: Record<string, unknown>,
		_context: ToolExecutionContext
	): PolicyResult {
		if (this.denied.has(toolName)) {
			return {
				allowed: false,
				reason: `Tool '${toolName}' is on deny list`,
				code: 'DENIED'
			};
		}
		return { allowed: true };
	}
}

// ============================================================================
// AllowListPolicy - Only allows specific tools
// ============================================================================

/**
 * Policy that only allows execution of specific tools.
 * If no tools have been allowed, all tools are permitted.
 * If tools have been allowed, only those tools are permitted.
 * Removing all allowed tools returns to "deny all" (restrictions still apply).
 */
export class AllowListPolicy implements ToolPolicy {
	private readonly allowed: Set<string>;
	private hasRestrictions: boolean;

	/**
	 * @param allowed - Set of tool names to allow (empty = allow all initially)
	 */
	constructor(allowed: Set<string> = new Set()) {
		this.allowed = allowed;
		// Track if restrictions have been applied
		this.hasRestrictions = allowed.size > 0;
	}

	/**
	 * Add a tool name to the allow list
	 */
	allow(toolName: string): void {
		this.allowed.add(toolName);
		this.hasRestrictions = true;
	}

	/**
	 * Remove a tool name from the allow list
	 */
	deny(toolName: string): void {
		this.allowed.delete(toolName);
		// hasRestrictions stays true until explicitly cleared
	}

	/**
	 * Check if a tool is on the allow list
	 */
	isAllowed(toolName: string): boolean {
		// If no restrictions have been applied, allow all
		if (!this.hasRestrictions) {
			return true;
		}
		return this.allowed.has(toolName);
	}

	/**
	 * Clear the entire allow list (returns to allow all state)
	 */
	clear(): void {
		this.allowed.clear();
		this.hasRestrictions = false;
	}

	canExecute(
		toolName: string,
		_args: Record<string, unknown>,
		_context: ToolExecutionContext
	): PolicyResult {
		// If no restrictions have been applied, allow all
		if (!this.hasRestrictions) {
			return { allowed: true };
		}
		// If tool is not in allow list, deny
		if (!this.allowed.has(toolName)) {
			return {
				allowed: false,
				reason: `Tool '${toolName}' is not on allow list`,
				code: 'DENIED'
			};
		}
		return { allowed: true };
	}
}

// ============================================================================
// RateLimitPolicy - Limits tool calls per time window
// ============================================================================

/**
 * Policy that limits the number of times a tool can be called
 * within a time window. Uses a sliding window counter.
 */
export class RateLimitPolicy implements ToolPolicy {
	private readonly counts: Map<string, { count: number; resetAt: number }> = new Map();

	/**
	 * @param maxPerMinute - Maximum calls per tool per window (default: 60)
	 * @param windowMs - Time window in milliseconds (default: 60,000)
	 */
	constructor(
		private readonly maxPerMinute: number = 60,
		private readonly windowMs: number = 60_000
	) {}

	/**
	 * Check current count for a tool without incrementing
	 */
	getCount(toolName: string): number {
		const now = Date.now();
		const entry = this.counts.get(toolName);

		if (!entry || entry.resetAt < now) {
			return 0;
		}
		return entry.count;
	}

	/**
	 * Check if a tool is currently rate limited
	 */
	isRateLimited(toolName: string): boolean {
		return this.getCount(toolName) >= this.maxPerMinute;
	}

	/**
	 * Reset count for a specific tool
	 */
	reset(toolName: string): void {
		this.counts.delete(toolName);
	}

	/**
	 * Reset all rate limit counters
	 */
	resetAll(): void {
		this.counts.clear();
	}

	canExecute(
		toolName: string,
		_args: Record<string, unknown>,
		_context: ToolExecutionContext
	): PolicyResult {
		const now = Date.now();
		const entry = this.counts.get(toolName);

		// No existing entry or window expired - create new entry
		if (!entry || entry.resetAt < now) {
			this.counts.set(toolName, { count: 1, resetAt: now + this.windowMs });
			return { allowed: true };
		}

		// Check if rate limit exceeded
		if (entry.count >= this.maxPerMinute) {
			const retryAfterMs = entry.resetAt - now;
			return {
				allowed: false,
				reason: `Rate limit exceeded for '${toolName}' (${entry.count}/${this.maxPerMinute}). Retry after ${Math.ceil(retryAfterMs / 1000)}s.`,
				code: 'RATE_LIMITED'
			};
		}

		// Increment counter
		entry.count++;
		return { allowed: true };
	}
}

// ============================================================================
// SessionOwnerPolicy - Controls access based on session privileges
// ============================================================================

/**
 * Policy that controls tool access based on session ownership.
 * Useful for restricting privileged operations to elevated sessions.
 */
export class SessionOwnerPolicy implements ToolPolicy {
	// Tools that require elevated session
	private readonly privilegedTools: Set<string>;

	// Tools blocked for non-elevated sessions
	private readonly blockedForNonElevated: Set<string>;

	/**
	 * @param privilegedTools - Tools that require elevated session (default: ['sudo'])
	 * @param blockedForNonElevated - Additional tools blocked for non-elevated sessions
	 */
	constructor(
		privilegedTools: Set<string> = new Set(['sudo']),
		blockedForNonElevated: Set<string> = new Set()
	) {
		this.privilegedTools = privilegedTools;
		this.blockedForNonElevated = blockedForNonElevated;
	}

	/**
	 * Add a privileged tool that requires elevated session
	 */
	addPrivilegedTool(toolName: string): void {
		this.privilegedTools.add(toolName);
	}

	/**
	 * Remove a privileged tool
	 */
	removePrivilegedTool(toolName: string): void {
		this.privilegedTools.delete(toolName);
	}

	/**
	 * Add a tool to block for non-elevated sessions
	 */
	blockForNonElevated(toolName: string): void {
		this.blockedForNonElevated.add(toolName);
	}

	canExecute(
		toolName: string,
		_args: Record<string, unknown>,
		context: ToolExecutionContext
	): PolicyResult {
		// Check if session is elevated
		const isElevated = context.elevated ?? false;

		// Privileged tools require elevated session
		if (this.privilegedTools.has(toolName) && !isElevated) {
			return {
				allowed: false,
				reason: `Tool '${toolName}' requires elevated session privileges`,
				code: 'DENIED'
			};
		}

		// Block certain tools for non-elevated sessions
		if (this.blockedForNonElevated.has(toolName) && !isElevated) {
			return {
				allowed: false,
				reason: `Tool '${toolName}' is not available for non-elevated sessions`,
				code: 'DENIED'
			};
		}

		return { allowed: true };
	}
}

// ============================================================================
// ToolPolicyRegistry - Global policy management
// ============================================================================

/**
 * Global registry for managing tool policies.
 * Provides global policies and per-session policy pipelines.
 */
export class ToolPolicyRegistry {
	private readonly globalPolicies: ToolPolicy[] = [];
	private readonly sessionPipelines: Map<string, ToolPolicyPipeline> = new Map();
	private readonly defaultPipeline: ToolPolicyPipeline;

	constructor() {
		this.defaultPipeline = new ToolPolicyPipeline([]);
	}

	/**
	 * Add a global policy that applies to all sessions
	 */
	addGlobalPolicy(policy: ToolPolicy): void {
		this.globalPolicies.push(policy);
	}

	/**
	 * Remove a global policy (by reference)
	 */
	removeGlobalPolicy(policy: ToolPolicy): boolean {
		const index = this.globalPolicies.indexOf(policy);
		if (index !== -1) {
			this.globalPolicies.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Get all global policies
	 */
	getGlobalPolicies(): ReadonlyArray<ToolPolicy> {
		return this.globalPolicies;
	}

	/**
	 * Clear all global policies
	 */
	clearGlobalPolicies(): void {
		this.globalPolicies.length = 0;
	}

	/**
	 * Get or create a policy pipeline for a session
	 */
	getSessionPipeline(sessionId: string): ToolPolicyPipeline {
		if (!this.sessionPipelines.has(sessionId)) {
			// Create session pipeline with global policies as base
			this.sessionPipelines.set(sessionId, new ToolPolicyPipeline([...this.globalPolicies]));
		}
		return this.sessionPipelines.get(sessionId)!;
	}

	/**
	 * Check if a session pipeline exists
	 */
	hasSessionPipeline(sessionId: string): boolean {
		return this.sessionPipelines.has(sessionId);
	}

	/**
	 * Remove a session's policy pipeline
	 */
	clearSession(sessionId: string): void {
		this.sessionPipelines.delete(sessionId);
	}

	/**
	 * Clear all session pipelines
	 */
	clearAllSessions(): void {
		this.sessionPipelines.clear();
	}

	/**
	 * Get number of registered sessions
	 */
	get sessionCount(): number {
		return this.sessionPipelines.size;
	}

	/**
	 * Check execution against global policies only (no session-specific)
	 */
	checkGlobal(
		toolName: string,
		args: Record<string, unknown>,
		context: ToolExecutionContext
	): PolicyResult {
		for (const policy of this.globalPolicies) {
			const result = policy.canExecute(toolName, args, context);
			if (!result.allowed) {
				return result;
			}
		}
		return { allowed: true };
	}

	/**
	 * Check execution against both global and session policies.
	 * Uses session-specific pipeline if available, otherwise global only.
	 */
	check(
		toolName: string,
		args: Record<string, unknown>,
		context: ToolExecutionContext,
		sessionId?: string
	): PolicyResult {
		// If we have a session ID, use session pipeline (which includes globals)
		if (sessionId && this.sessionPipelines.has(sessionId)) {
			return this.sessionPipelines.get(sessionId)!.canExecute(toolName, args, context);
		}

		// Otherwise, check globals only
		return this.checkGlobal(toolName, args, context);
	}
}

// ============================================================================
// Global Policy Registry Instance
// ============================================================================

/**
 * Global policy registry instance.
 * Use this for application-wide policy management.
 */
export const globalPolicyRegistry = new ToolPolicyRegistry();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a deny list policy with initial tools
 */
export function createDenyListPolicy(...tools: string[]): DenyListPolicy {
	return new DenyListPolicy(new Set(tools));
}

/**
 * Create an allow list policy with initial tools
 */
export function createAllowListPolicy(...tools: string[]): AllowListPolicy {
	return new AllowListPolicy(new Set(tools));
}

/**
 * Create a rate limit policy with custom settings
 */
export function createRateLimitPolicy(maxPerMinute: number, windowMs?: number): RateLimitPolicy {
	return new RateLimitPolicy(maxPerMinute, windowMs);
}

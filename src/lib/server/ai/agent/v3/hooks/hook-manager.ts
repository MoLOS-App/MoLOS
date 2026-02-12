/**
 * HookManager - Simple hook system for pre/post tool execution
 */

export interface PreToolUseHook {
	toolName: string | '*';
	handler: (params: Record<string, unknown>) => Promise<{ blocked?: boolean; reason?: string; modifiedParams?: Record<string, unknown> }>;
}

export interface PostToolUseHook {
	toolName: string | '*';
	handler: (result: unknown) => Promise<void>;
}

export interface HookManagerOptions {
	debug?: boolean;
}

/**
 * Simple HookManager implementation
 */
export class HookManager {
	private preHooks: PreToolUseHook[] = [];
	private postHooks: PostToolUseHook[] = [];
	private debug: boolean;

	constructor(options: HookManagerOptions = {}) {
		this.debug = options.debug ?? false;
	}

	/**
	 * Register a pre-tool hook
	 */
	registerPreHook(hook: PreToolUseHook): void {
		this.preHooks.push(hook);
	}

	/**
	 * Register a post-tool hook
	 */
	registerPostHook(hook: PostToolUseHook): void {
		this.postHooks.push(hook);
	}

	/**
	 * Execute pre-tool hooks
	 */
	async executePreHooks(
		toolName: string,
		params: Record<string, unknown>
	): Promise<{ blocked: boolean; reason?: string; modifiedParams?: Record<string, unknown> }> {
		let currentParams = { ...params };

		for (const hook of this.preHooks) {
			if (hook.toolName === '*' || hook.toolName === toolName) {
				const result = await hook.handler(currentParams);

				if (result.blocked) {
					if (this.debug) {
						console.log(`[HookManager] Tool ${toolName} blocked: ${result.reason}`);
					}
					return { blocked: true, reason: result.reason };
				}

				if (result.modifiedParams) {
					currentParams = result.modifiedParams;
				}
			}
		}

		return { blocked: false, modifiedParams: currentParams };
	}

	/**
	 * Execute post-tool hooks
	 */
	async executePostHooks(toolName: string, result: unknown): Promise<void> {
		for (const hook of this.postHooks) {
			if (hook.toolName === '*' || hook.toolName === toolName) {
				await hook.handler(result);
			}
		}
	}

	/**
	 * Clear all hooks
	 */
	clear(): void {
		this.preHooks = [];
		this.postHooks = [];
	}
}

/**
 * Create a new hook manager instance
 */
export function createHookManager(options: HookManagerOptions = {}): HookManager {
	return new HookManager(options);
}

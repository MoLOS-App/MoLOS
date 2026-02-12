/**
 * Rule Engine - Rule-based validation for tools
 *
 * Provides a declarative way to define rules that validate or modify tool usage.
 * Rules are evaluated before hooks and can block or modify tool calls.
 */

import type { ToolCall, ToolDefinition } from '../core/types';
import type { IAgentContext } from '../core/context';

// ============================================================================
// Rule Types
// ============================================================================

/**
 * Rule severity level
 */
export type RuleSeverity = 'error' | 'warning' | 'info';

/**
 * Result of rule evaluation
 */
export interface RuleResult {
	/** Rule ID */
	ruleId: string;
	/** Whether the rule passed */
	passed: boolean;
	/** Severity if failed */
	severity: RuleSeverity;
	/** Message explaining the result */
	message: string;
	/** Suggested fix if available */
	suggestion?: string;
	/** Auto-fix function if available */
	autoFix?: (toolCall: ToolCall) => ToolCall;
}

/**
 * Rule definition
 */
export interface Rule {
	/** Unique rule identifier */
	id: string;
	/** Rule name */
	name: string;
	/** Rule description */
	description: string;
	/** Tools this rule applies to (empty = all) */
	toolPattern?: string | RegExp;
	/** Rule severity */
	severity: RuleSeverity;
	/** Whether the rule is enabled */
	enabled: boolean;
	/** Rule evaluation function */
	evaluate: RuleEvaluator;
}

/**
 * Rule evaluator function
 */
export type RuleEvaluator = (ctx: RuleContext) => RuleResult | Promise<RuleResult>;

/**
 * Context provided to rule evaluators
 */
export interface RuleContext {
	/** The tool call being evaluated */
	toolCall: ToolCall;
	/** Tool definition */
	tool: ToolDefinition;
	/** Agent context */
	context: IAgentContext;
	/** All available tools */
	allTools: ToolDefinition[];
}

// ============================================================================
// Built-in Rules
// ============================================================================

/**
 * Rule: Required parameters must be present
 */
export const requiredParamsRule: Rule = {
	id: 'required-params',
	name: 'Required Parameters',
	description: 'Ensures all required parameters are provided',
	severity: 'error',
	enabled: true,
	evaluate: (ctx: RuleContext): RuleResult => {
		const { tool, toolCall } = ctx;
		const required = tool.parameters?.required || [];
		const missing: string[] = [];

		for (const param of required) {
			if (toolCall.parameters[param] === undefined || toolCall.parameters[param] === null) {
				missing.push(param);
			}
		}

		if (missing.length > 0) {
			return {
				ruleId: 'required-params',
				passed: false,
				severity: 'error',
				message: `Missing required parameters: ${missing.join(', ')}`,
				suggestion: `Provide values for: ${missing.join(', ')}`
			};
		}

		return {
			ruleId: 'required-params',
			passed: true,
			severity: 'error',
			message: 'All required parameters provided'
		};
	}
};

/**
 * Rule: Parameter type validation
 */
export const paramTypeRule: Rule = {
	id: 'param-types',
	name: 'Parameter Types',
	description: 'Validates parameter types against schema',
	severity: 'error',
	enabled: true,
	evaluate: (ctx: RuleContext): RuleResult => {
		const { tool, toolCall } = ctx;
		const properties = tool.parameters?.properties || {};
		const errors: string[] = [];

		for (const [key, value] of Object.entries(toolCall.parameters)) {
			const schema = properties[key] as { type?: string; items?: { type?: string } } | undefined;
			if (!schema) continue;

			const expectedType = schema.type;
			if (!expectedType) continue;

			const actualType = Array.isArray(value) ? 'array' : typeof value;

			if (expectedType !== actualType) {
				// Allow some flexibility
				if (expectedType === 'string' && typeof value === 'number') {
					continue; // Numbers can be strings
				}
				if (expectedType === 'number' && typeof value === 'string') {
					const num = Number(value);
					if (!isNaN(num)) continue; // Numeric strings can be numbers
				}
				if (expectedType === 'boolean' && typeof value === 'string') {
					if (['true', 'false'].includes(value.toLowerCase())) continue;
				}

				errors.push(`${key}: expected ${expectedType}, got ${actualType}`);
			}

			// Validate array items
			if (expectedType === 'array' && Array.isArray(value) && schema.items?.type) {
				for (let i = 0; i < value.length; i++) {
					const itemType = typeof value[i];
					if (itemType !== schema.items.type) {
						errors.push(`${key}[${i}]: expected ${schema.items.type}, got ${itemType}`);
					}
				}
			}
		}

		if (errors.length > 0) {
			return {
				ruleId: 'param-types',
				passed: false,
				severity: 'error',
				message: `Type validation errors: ${errors.join('; ')}`,
				suggestion: 'Check parameter types against the tool schema'
			};
		}

		return {
			ruleId: 'param-types',
			passed: true,
			severity: 'error',
			message: 'All parameters have valid types'
		};
	}
};

/**
 * Rule: File path safety
 */
export const filePathSafetyRule: Rule = {
	id: 'file-path-safety',
	name: 'File Path Safety',
	description: 'Prevents access to sensitive file paths',
	severity: 'error',
	enabled: true,
	toolPattern: /file|read|write|path/i,
	evaluate: (ctx: RuleContext): RuleResult => {
		const { toolCall } = ctx;
		const params = toolCall.parameters;

		// Check for path traversal
		const pathParams = ['path', 'filePath', 'file_path', 'dir', 'directory', 'folder'];
		const dangerousPatterns = ['../', '..\\\\', '/etc/', '/root/', '~/', '${', '<%='];

		for (const param of pathParams) {
			const value = params[param];
			if (typeof value !== 'string') continue;

			for (const pattern of dangerousPatterns) {
				if (value.includes(pattern)) {
					return {
						ruleId: 'file-path-safety',
						passed: false,
						severity: 'error',
						message: `Potentially unsafe path: ${value}`,
						suggestion: 'Use relative paths within the project directory'
					};
				}
			}
		}

		return {
			ruleId: 'file-path-safety',
			passed: true,
			severity: 'error',
			message: 'File path is safe'
		};
	}
};

/**
 * Rule: Rate limiting per tool
 */
export const rateLimitRule: Rule = {
	id: 'rate-limit',
	name: 'Rate Limiting',
	description: 'Prevents excessive tool calls',
	severity: 'warning',
	enabled: true,
	evaluate: (ctx: RuleContext): RuleResult => {
		const { context, toolCall } = ctx;
		const state = context.getState();

		// Count recent calls to this tool
		const recentCalls = state.observations
			.filter(o => o.toolName === toolCall.name)
			.filter(o => Date.now() - o.timestamp < 60000) // Last minute
			.length;

		const maxCallsPerMinute = 30;
		if (recentCalls >= maxCallsPerMinute) {
			return {
				ruleId: 'rate-limit',
				passed: false,
				severity: 'warning',
				message: `Rate limit exceeded for ${toolCall.name}: ${recentCalls} calls in last minute`,
				suggestion: 'Consider batching operations or reducing call frequency'
			};
		}

		return {
			ruleId: 'rate-limit',
			passed: true,
			severity: 'warning',
			message: 'Within rate limits'
		};
	}
};

/**
 * Rule: Prevent duplicate calls
 */
export const noDuplicateCallsRule: Rule = {
	id: 'no-duplicates',
	name: 'No Duplicate Calls',
	description: 'Prevents identical consecutive tool calls',
	severity: 'warning',
	enabled: true,
	evaluate: (ctx: RuleContext): RuleResult => {
		const { context, toolCall } = ctx;
		const state = context.getState();

		if (state.observations.length === 0) {
			return {
				ruleId: 'no-duplicates',
				passed: true,
				severity: 'warning',
				message: 'No previous calls to compare'
			};
		}

		// Check last few observations for duplicates
		const recentObservations = state.observations.slice(-3);
		for (const obs of recentObservations) {
			if (obs.toolName !== toolCall.name) continue;

			// Compare parameters
			const params1 = JSON.stringify(toolCall.parameters);
			const params2 = JSON.stringify(obs.result || {});

			if (params1 === params2) {
				return {
					ruleId: 'no-duplicates',
					passed: false,
					severity: 'warning',
					message: 'Duplicate tool call detected',
					suggestion: 'Use cached result or modify parameters'
				};
			}
		}

		return {
			ruleId: 'no-duplicates',
			passed: true,
			severity: 'warning',
			message: 'No duplicate calls detected'
		};
	}
};

// ============================================================================
// Rule Engine
// ============================================================================

/**
 * Rule Engine - Evaluates rules against tool calls
 */
export class RuleEngine {
	private rules: Map<string, Rule> = new Map();
	private enabled: boolean = true;

	constructor() {
		// Register built-in rules
		this.registerBuiltInRules();
	}

	/**
	 * Register a rule
	 */
	register(rule: Rule): void {
		this.rules.set(rule.id, rule);
	}

	/**
	 * Unregister a rule
	 */
	unregister(ruleId: string): boolean {
		return this.rules.delete(ruleId);
	}

	/**
	 * Enable a rule
	 */
	enable(ruleId: string): void {
		const rule = this.rules.get(ruleId);
		if (rule) {
			rule.enabled = true;
		}
	}

	/**
	 * Disable a rule
	 */
	disable(ruleId: string): void {
		const rule = this.rules.get(ruleId);
		if (rule) {
			rule.enabled = false;
		}
	}

	/**
	 * Enable/disable the entire engine
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
	}

	/**
	 * Get all registered rules
	 */
	getRules(): Rule[] {
		return Array.from(this.rules.values());
	}

	/**
	 * Evaluate all applicable rules for a tool call
	 */
	async evaluate(ctx: RuleContext): Promise<RuleResult[]> {
		if (!this.enabled) {
			return [];
		}

		const results: RuleResult[] = [];
		const applicableRules = this.getApplicableRules(ctx.toolCall.name);

		for (const rule of applicableRules) {
			if (!rule.enabled) continue;

			try {
				const result = await Promise.race([
					rule.evaluate(ctx),
					this.timeout(rule.id)
				]);
				results.push(result);
			} catch (error) {
				results.push({
					ruleId: rule.id,
					passed: true, // On error, allow through
					severity: rule.severity,
					message: `Rule evaluation error: ${error}`
				});
			}
		}

		return results;
	}

	/**
	 * Check if any rules failed with error severity
	 */
	hasErrors(results: RuleResult[]): boolean {
		return results.some(r => !r.passed && r.severity === 'error');
	}

	/**
	 * Get error messages from results
	 */
	getErrorMessages(results: RuleResult[]): string[] {
		return results
			.filter(r => !r.passed && r.severity === 'error')
			.map(r => r.message);
	}

	/**
	 * Get warning messages from results
	 */
	getWarningMessages(results: RuleResult[]): string[] {
		return results
			.filter(r => !r.passed && r.severity === 'warning')
			.map(r => r.message);
	}

	// ============================================================================
	// Private Methods
	// ============================================================================

	private registerBuiltInRules(): void {
		this.register(requiredParamsRule);
		this.register(paramTypeRule);
		this.register(filePathSafetyRule);
		this.register(rateLimitRule);
		this.register(noDuplicateCallsRule);
	}

	private getApplicableRules(toolName: string): Rule[] {
		return Array.from(this.rules.values()).filter(rule => {
			if (!rule.toolPattern) return true;

			if (typeof rule.toolPattern === 'string') {
				return toolName === rule.toolPattern;
			}

			return rule.toolPattern.test(toolName);
		});
	}

	private timeout(ruleId: string): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`Rule ${ruleId} timed out`)), 5000);
		});
	}
}

/**
 * Create a default rule engine with built-in rules
 */
export function createRuleEngine(): RuleEngine {
	return new RuleEngine();
}

/**
 * MCP Request Validation Schemas
 *
 * Zod schemas for validating all MCP JSON-RPC request parameters.
 */

import { z } from 'zod';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Client information
 */
export const ClientInfoSchema = z.object({
	name: z.string().min(1).max(100),
	version: z.string().min(1).max(50)
});

/**
 * Client capabilities
 */
export const ClientCapabilitiesSchema = z.object({
	roots: z
		.object({
			listChanged: z.boolean().optional()
		})
		.optional(),
	sampling: z.object({}).optional(),
	tools: z.object({}).optional(),
	resources: z
		.object({
			subscribe: z.boolean().optional(),
			listChanged: z.boolean().optional()
		})
		.optional(),
	prompts: z.object({}).optional()
});

// ============================================================================
// Initialize Method
// ============================================================================

/**
 * Initialize request parameters
 */
export const InitializeRequestParamsSchema = z.object({
	protocolVersion: z.string().regex(/^2025-\d{2}-\d{2}$/, {
		message: 'Protocol version must be in format 2025-MM-DD'
	}),
	capabilities: ClientCapabilitiesSchema,
	clientInfo: ClientInfoSchema
});

// ============================================================================
// Tools Methods
// ============================================================================

/**
 * tools/list - no parameters required
 */
export const ToolsListRequestParamsSchema = z.object({}).optional().default({});

/**
 * Tool arguments (free-form object)
 */
export const ToolArgumentsSchema = z.record(z.string(), z.unknown());

/**
 * tools/call request parameters
 */
export const ToolsCallRequestParamsSchema = z.object({
	name: z.string().min(1).max(255),
	arguments: ToolArgumentsSchema.optional().default({})
});

// ============================================================================
// Resources Methods
// ============================================================================

/**
 * resources/list - no parameters required
 */
export const ResourcesListRequestParamsSchema = z.object({}).optional().default({});

/**
 * URI validation (must be valid URI format)
 */
const UriSchema = z
	.string()
	.min(1)
	.max(2000)
	.refine(
		(value) => {
			try {
				new URL(value);
				return true;
			} catch {
				return false;
			}
		},
		{ message: 'Invalid URI format' }
	);

/**
 * resources/read request parameters
 */
export const ResourcesReadRequestParamsSchema = z.object({
	uri: UriSchema
});

// ============================================================================
// Prompts Methods
// ============================================================================

/**
 * Prompt arguments (free-form object)
 */
export const PromptArgumentsSchema = z.record(z.string(), z.unknown());

/**
 * prompts/list - no parameters required
 */
export const PromptsListRequestParamsSchema = z.object({}).optional().default({});

/**
 * prompts/get request parameters
 */
export const PromptsGetRequestParamsSchema = z.object({
	name: z.string().min(1).max(255),
	arguments: PromptArgumentsSchema.optional().default({})
});

// ============================================================================
// Validation Error Response
// ============================================================================

/**
 * Create a JSON-RPC validation error response
 */
export interface ValidationError {
	code: number;
	message: string;
	data?: {
		field?: string;
		received?: unknown;
		issues?: Array<{
			path: Array<string | number>;
			message: string;
		}>;
	};
}

/**
 * Convert Zod error to MCP validation error format
 */
export function zodToValidationError(
	zodError: z.ZodError,
	requestId: number | string
): {
	jsonrpc: '2.0';
	id: number | string;
	error: ValidationError;
} {
	return {
		jsonrpc: '2.0',
		id: requestId,
		error: {
			code: -32602, // JSON-RPC invalid_params
			message: 'Invalid parameters',
			data: {
				issues: zodError.issues.map((err) => ({
					path: err.path.map(String),
					message: err.message
				}))
			}
		}
	};
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate request data against a schema
 */
export function validateRequest<T>(
	schema: z.ZodSchema<T>,
	data: unknown,
	requestId: number | string
): { success: true; data: T } | { success: false; error: ReturnType<typeof zodToValidationError> } {
	const result = schema.safeParse(data);

	if (result.success) {
		return { success: true, data: result.data };
	}

	return {
		success: false,
		error: zodToValidationError(result.error, requestId)
	};
}

/**
 * Type exports for inferred types
 */
export type InitializeRequestParams = z.infer<typeof InitializeRequestParamsSchema>;
export type ClientInfo = z.infer<typeof ClientInfoSchema>;
export type ClientCapabilities = z.infer<typeof ClientCapabilitiesSchema>;
export type ToolsCallRequestParams = z.infer<typeof ToolsCallRequestParamsSchema>;
export type ResourcesReadRequestParams = z.infer<typeof ResourcesReadRequestParamsSchema>;
export type PromptsGetRequestParams = z.infer<typeof PromptsGetRequestParamsSchema>;

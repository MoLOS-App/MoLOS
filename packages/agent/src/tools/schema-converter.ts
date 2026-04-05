/**
 * Schema Converter - JSON Schema to Zod conversion for tool parameters
 *
 * ## Purpose
 * Converts JSON Schema-like parameter definitions (used by AI SDKs) to
 * Zod schemas for runtime validation. This bridges the gap between
 * AI tool definitions and type-safe runtime checks.
 *
 * ## Schema Transformation Flow
 *
 *   AI Model -> ToolDefinition.parameters -> ParamSchema -> Zod Schema -> Validation
 *                                               |
 *                        JSON Schema format     |
 *                        (type, properties,     |
 *                         enum, constraints)    v
 *
 * ## Supported JSON Schema Features
 *
 * The converter handles a subset of JSON Schema:
 *
 * - type: string, number, integer, boolean, array, object
 * - enum: Enumeration values (creates z.enum)
 * - default: Default values (z.default())
 * - description: Field descriptions (z.describe())
 *
 * String constraints:
 * - minLength, maxLength: Length validation
 * - pattern: Regex validation
 *
 * Number constraints:
 * - minimum, maximum: Range validation
 *
 * Object constraints:
 * - properties: Nested object properties
 * - required: Required field names
 * - additionalProperties: Allow/disallow extra fields
 *
 * Array constraints:
 * - items: Schema for array elements
 *
 * ## Parameter Validation Flow
 *
 * 1. AI provides arguments (JSON object)
 * 2. validateToolArgs() checks:
 *    - Required fields present
 *    - Types match schema
 *    - Constraints satisfied (length, range, pattern, enum)
 *    - No unknown fields (if additionalProperties: false)
 * 3. Returns array of error messages (empty if valid)
 *
 * ## AI Context Optimization
 *
 * This module optimizes AI context by:
 *
 * - Converting complex schemas to compact Zod code
 * - Enabling pre-execution validation (fail fast)
 * - Providing clear error messages for AI to correct itself
 * - Supporting hidden tools whose schemas would bloat context
 *
 * ## Error Message Format
 *
 * Validation errors follow a consistent format:
 *
 * - Missing required: "Missing required field: fieldName"
 * - Type mismatch: 'Field "fieldName" must be a string'
 * - Enum violation: 'Field "fieldName" value must be one of: a, b, c'
 * - Length violation: 'Field "fieldName" must be at least 3 characters'
 * - Pattern violation: 'Field "fieldName" does not match pattern: regex'
 * - Range violation: 'Field "fieldName" must be >= 0'
 * - Unknown field: 'Unknown field: fieldName'
 *
 * ## Example Usage
 *
 *   const schema: ParamSchema = {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', minLength: 1 },
 *       limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
 *       format: { type: 'string', enum: ['json', 'xml', 'csv'] }
 *     },
 *     required: ['query']
 *   };
 *
 *   const zodSchema = createZodSchemaFromParams(schema.properties);
 *   const errors = validateToolArgs({ query: 'test' }, schema);
 *   // errors is empty if valid
 *
 * @module tools/schema-converter
 */

import { z } from 'zod';
import type { ToolParameterSchema } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ParamSchema {
	type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
	description?: string;
	enum?: unknown[];
	default?: unknown;
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	items?: ParamSchema;
	properties?: Record<string, ParamSchema>;
	required?: string[]; // Array of required field names
	additionalProperties?: boolean;
}

// ============================================================================
// Schema Conversion
// ============================================================================

/**
 * Convert a parameter schema to a Zod schema
 */
export function convertSchemaToZod(schema: ParamSchema): z.ZodObject<any> {
	const shape: Record<string, z.ZodTypeAny> = {};

	if (schema.properties) {
		for (const [key, propSchema] of Object.entries(schema.properties)) {
			shape[key] = inferZodType(propSchema.type || 'string', propSchema);

			// Apply string constraints
			if (propSchema.type === 'string') {
				let schemaAny = shape[key] as z.ZodString;
				if (propSchema.minLength !== undefined) {
					schemaAny = schemaAny.min(propSchema.minLength);
				}
				if (propSchema.maxLength !== undefined) {
					schemaAny = schemaAny.max(propSchema.maxLength);
				}
				if (propSchema.pattern) {
					schemaAny = schemaAny.regex(new RegExp(propSchema.pattern));
				}
				if (propSchema.enum) {
					// Override with enum
					shape[key] = z.enum(propSchema.enum as [string, ...string[]]);
				} else {
					shape[key] = schemaAny;
				}
			}

			// Apply number constraints
			if (propSchema.type === 'number' || propSchema.type === 'integer') {
				let schemaAny = shape[key] as z.ZodNumber;
				if (propSchema.minimum !== undefined) {
					schemaAny = schemaAny.min(propSchema.minimum);
				}
				if (propSchema.maximum !== undefined) {
					schemaAny = schemaAny.max(propSchema.maximum);
				}
				shape[key] = schemaAny;
			}

			// Apply description via .describe()
			if (propSchema.description) {
				shape[key] = shape[key].describe(propSchema.description);
			}

			// Apply default
			if (propSchema.default !== undefined) {
				shape[key] = shape[key].default(propSchema.default as any);
			}
		}
	}

	return z.object(shape);
}

/**
 * Create a Zod schema from a map of parameter schemas
 */
export function createZodSchemaFromParams(params: Record<string, ParamSchema>): z.ZodObject<any> {
	const requiredFields: string[] = [];
	const shape: Record<string, z.ZodTypeAny> = {};

	for (const [key, schema] of Object.entries(params)) {
		let fieldSchema = inferZodType(schema.type || 'string', schema);

		// Apply string constraints
		if (schema.type === 'string') {
			let schemaAny = fieldSchema as z.ZodString;
			if (schema.minLength !== undefined) {
				schemaAny = schemaAny.min(schema.minLength);
			}
			if (schema.maxLength !== undefined) {
				schemaAny = schemaAny.max(schema.maxLength);
			}
			if (schema.pattern) {
				schemaAny = schemaAny.regex(new RegExp(schema.pattern));
			}
			fieldSchema = schemaAny;
		}

		// Apply number constraints
		if (schema.type === 'number' || schema.type === 'integer') {
			let schemaAny = fieldSchema as z.ZodNumber;
			if (schema.minimum !== undefined) {
				schemaAny = schemaAny.min(schema.minimum);
			}
			if (schema.maximum !== undefined) {
				schemaAny = schemaAny.max(schema.maximum);
			}
			fieldSchema = schemaAny;
		}

		// Apply enum
		if (schema.enum) {
			fieldSchema = z.enum(schema.enum as [string, ...string[]]);
		}

		// Apply description
		if (schema.description) {
			fieldSchema = fieldSchema.describe(schema.description);
		}

		// Track required fields
		if (schema.required && Array.isArray(schema.required)) {
			requiredFields.push(key);
		}

		shape[key] = fieldSchema;
	}

	const result = z.object(shape);

	// If there are required fields, make non-required optional
	if (requiredFields.length > 0 && requiredFields.length < Object.keys(params).length) {
		const optionalFields = Object.keys(params).filter((k) => !requiredFields.includes(k));
		for (const field of optionalFields) {
			(result.shape as any)[field] = (result.shape as any)[field].optional();
		}
	}

	return result;
}

/**
 * Infer Zod type from a JSON Schema type string
 */
export function inferZodType(type: string, schema: ParamSchema): z.ZodTypeAny {
	switch (type) {
		case 'string':
			if (schema.enum) {
				return z.enum(schema.enum as [string, ...string[]]);
			}
			return z.string();

		case 'number':
			return z.number();

		case 'integer':
			return z.number().int();

		case 'boolean':
			return z.boolean();

		case 'array':
			if (schema.items) {
				return z.array(inferZodType(schema.items.type || 'string', schema.items));
			}
			return z.array(z.unknown());

		case 'object':
			if (schema.properties) {
				const objSchema = createZodSchemaFromParams(schema.properties);
				const shape = objSchema.shape;

				// Handle required fields
				if (schema.required && Array.isArray(schema.required)) {
					for (const key of Object.keys(shape)) {
						if (!schema.required.includes(key)) {
							(shape as any)[key] = (shape as any)[key].optional();
						}
					}
				}
				return z.object(shape);
			}
			return z.record(z.string(), z.unknown());

		default:
			return z.unknown();
	}
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate tool arguments against a parameter schema
 * @returns Array of error messages, empty if valid
 */
export function validateToolArgs(
	args: Record<string, unknown>,
	schema: ParamSchema | ToolParameterSchema
): string[] {
	const errors: string[] = [];

	// Check required fields
	if (schema.required && Array.isArray(schema.required)) {
		for (const field of schema.required) {
			if (args[field] === undefined || args[field] === null) {
				errors.push(`Missing required field: ${field}`);
			}
		}
	}

	// Validate each argument
	for (const [key, value] of Object.entries(args)) {
		const propSchema = schema.properties?.[key];
		if (!propSchema) {
			// Unknown field - check if additionalProperties is allowed
			if (schema.additionalProperties === false) {
				errors.push(`Unknown field: ${key}`);
			}
			continue;
		}

		// Type validation
		const typeError = validateType(key, value, propSchema);
		if (typeError) {
			errors.push(typeError);
		}

		// Enum validation
		if (propSchema.enum && value !== undefined && value !== null) {
			const enumArr = propSchema.enum as unknown[];
			if (!enumArr.includes(value)) {
				errors.push(`Field "${key}" value must be one of: ${propSchema.enum.join(', ')}`);
			}
		}

		// String constraints
		if (propSchema.type === 'string' && typeof value === 'string') {
			if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
				errors.push(`Field "${key}" must be at least ${propSchema.minLength} characters`);
			}
			if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
				errors.push(`Field "${key}" must be at most ${propSchema.maxLength} characters`);
			}
			if (propSchema.pattern && !new RegExp(propSchema.pattern).test(value)) {
				errors.push(`Field "${key}" does not match pattern: ${propSchema.pattern}`);
			}
		}

		// Number constraints
		if (
			(propSchema.type === 'number' || propSchema.type === 'integer') &&
			typeof value === 'number'
		) {
			if (propSchema.minimum !== undefined && value < propSchema.minimum) {
				errors.push(`Field "${key}" must be >= ${propSchema.minimum}`);
			}
			if (propSchema.maximum !== undefined && value > propSchema.maximum) {
				errors.push(`Field "${key}" must be <= ${propSchema.maximum}`);
			}
		}
	}

	return errors;
}

/**
 * Validate a single value against its type
 */
function validateType(key: string, value: unknown, schema: ParamSchema): string | null {
	if (value === undefined || value === null) {
		return null; // Skip validation for undefined/null
	}

	const expectedType = schema.type || 'string';

	switch (expectedType) {
		case 'string':
			if (typeof value !== 'string') {
				return `Field "${key}" must be a string`;
			}
			break;

		case 'number':
			if (typeof value !== 'number') {
				return `Field "${key}" must be a number`;
			}
			break;

		case 'integer':
			if (typeof value !== 'number' || !Number.isInteger(value)) {
				return `Field "${key}" must be an integer`;
			}
			break;

		case 'boolean':
			if (typeof value !== 'boolean') {
				return `Field "${key}" must be a boolean`;
			}
			break;

		case 'array':
			if (!Array.isArray(value)) {
				return `Field "${key}" must be an array`;
			}
			// Validate array items if items schema is provided
			if (schema.items) {
				for (let i = 0; i < value.length; i++) {
					const itemError = validateType(`${key}[${i}]`, value[i], schema.items);
					if (itemError) {
						return itemError;
					}
				}
			}
			break;

		case 'object':
			if (typeof value !== 'object' || Array.isArray(value)) {
				return `Field "${key}" must be an object`;
			}
			break;
	}

	return null;
}

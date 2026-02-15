/**
 * Schema Converter - TypeBox to Zod
 *
 * Converts v2 TypeBox/JSON Schema definitions to Zod schemas
 * for use with AI SDK tools.
 */

import { z } from 'zod';
import type { ToolParameterSchema } from '../types';

/**
 * Convert a JSON Schema property to a Zod type
 */
function convertPropertyToZod(prop: Record<string, unknown>): z.ZodTypeAny {
	const type = prop.type as string | undefined;
	const description = (prop.description as string) || '';

	// Handle enum
	if (prop.enum && Array.isArray(prop.enum)) {
		const enumValues = prop.enum as [string, ...string[]];
		let schema = z.enum(enumValues);
		if (description) {
			schema = schema.describe(description) as typeof schema;
		}
		return schema;
	}

	// Handle anyOf/oneOf
	if (prop.anyOf && Array.isArray(prop.anyOf)) {
		const types = prop.anyOf.map((p: Record<string, unknown>) => convertPropertyToZod(p));
		return z.union(types as [z.ZodTypeAny, z.ZodTypeAny]);
	}

	if (prop.oneOf && Array.isArray(prop.oneOf)) {
		const types = prop.oneOf.map((p: Record<string, unknown>) => convertPropertyToZod(p));
		return z.union(types as [z.ZodTypeAny, z.ZodTypeAny]);
	}

	// Handle by type
	let schema: z.ZodTypeAny;

	switch (type) {
		case 'string':
			schema = z.string();
			break;

		case 'number':
		case 'integer':
			schema = z.number();
			break;

		case 'boolean':
			schema = z.boolean();
			break;

		case 'array':
			const items = prop.items as Record<string, unknown> | undefined;
			const itemSchema = items ? convertPropertyToZod(items) : z.any();
			schema = z.array(itemSchema);
			break;

		case 'object':
			schema = convertTypeBoxToZod(prop as unknown as ToolParameterSchema);
			break;

		case 'null':
			schema = z.null();
			break;

		default:
			// Fallback to any for unknown types
			schema = z.any();
			break;
	}

	// Add description if present
	if (description && schema && typeof schema.describe === 'function') {
		schema = schema.describe(description);
	}

	return schema;
}

/**
 * Convert a v2 ToolParameterSchema (JSON Schema) to a Zod object schema
 */
export function convertTypeBoxToZod(schema: ToolParameterSchema): z.ZodObject<any> {
	const shape: Record<string, z.ZodTypeAny> = {};

	if (schema.properties) {
		for (const [key, prop] of Object.entries(schema.properties)) {
			const zodProp = convertPropertyToZod(prop as Record<string, unknown>);

			// Check if this property is required
			const isRequired = schema.required?.includes(key) ?? false;

			if (isRequired) {
				shape[key] = zodProp;
			} else {
				shape[key] = zodProp.optional();
			}
		}
	}

	return z.object(shape);
}

/**
 * Create a Zod schema from a simplified tool parameters definition
 */
export function createZodSchemaFromParams(
	params: Record<string, { type: string; description?: string; required?: boolean }>
): z.ZodObject<any> {
	const shape: Record<string, z.ZodTypeAny> = {};

	for (const [key, def] of Object.entries(params)) {
		let zodType: z.ZodTypeAny;

		switch (def.type) {
			case 'string':
				zodType = z.string();
				break;
			case 'number':
			case 'integer':
				zodType = z.number();
				break;
			case 'boolean':
				zodType = z.boolean();
				break;
			case 'array':
				zodType = z.array(z.any());
				break;
			case 'object':
				zodType = z.record(z.string(), z.any());
				break;
			default:
				zodType = z.any();
		}

		if (def.description) {
			zodType = zodType.describe(def.description);
		}

		if (!def.required) {
			zodType = zodType.optional();
		}

		shape[key] = zodType;
	}

	return z.object(shape);
}

/**
 * Infer Zod type from a JSON Schema type string
 */
export function inferZodTypeFromJsonSchema(type: string): z.ZodTypeAny {
	switch (type) {
		case 'string':
			return z.string();
		case 'number':
		case 'integer':
			return z.number();
		case 'boolean':
			return z.boolean();
		case 'array':
			return z.array(z.any());
		case 'object':
			return z.record(z.string(), z.any());
		case 'null':
			return z.null();
		default:
			return z.any();
	}
}

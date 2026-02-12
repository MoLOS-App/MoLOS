import { describe, it, expect } from 'vitest';
import {
	convertTypeBoxToZod,
	createZodSchemaFromParams,
	inferZodTypeFromJsonSchema
} from './schema-converter';
import type { ToolParameterSchema } from '../types';

describe('Schema Converter', () => {
	describe('convertTypeBoxToZod', () => {
		it('should convert a simple string property', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'The name' }
				},
				required: ['name']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ name: 'test' }).success).toBe(true);
			expect(zodSchema.safeParse({ name: 123 }).success).toBe(false);
		});

		it('should convert a simple number property', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					count: { type: 'number' }
				},
				required: ['count']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ count: 42 }).success).toBe(true);
			expect(zodSchema.safeParse({ count: '42' }).success).toBe(false);
		});

		it('should convert integer type to number', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					id: { type: 'integer' }
				},
				required: ['id']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ id: 123 }).success).toBe(true);
		});

		it('should convert boolean property', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					active: { type: 'boolean' }
				},
				required: ['active']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ active: true }).success).toBe(true);
			expect(zodSchema.safeParse({ active: false }).success).toBe(true);
			expect(zodSchema.safeParse({ active: 'yes' }).success).toBe(false);
		});

		it('should handle optional properties', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					required_field: { type: 'string' },
					optional_field: { type: 'string' }
				},
				required: ['required_field']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ required_field: 'test' }).success).toBe(true);
			expect(zodSchema.safeParse({ required_field: 'test', optional_field: 'extra' }).success).toBe(true);
			expect(zodSchema.safeParse({}).success).toBe(false);
		});

		it('should convert enum property', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					status: {
						type: 'string',
						enum: ['active', 'inactive', 'pending']
					}
				},
				required: ['status']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ status: 'active' }).success).toBe(true);
			expect(zodSchema.safeParse({ status: 'inactive' }).success).toBe(true);
			expect(zodSchema.safeParse({ status: 'unknown' }).success).toBe(false);
		});

		it('should convert array property', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					tags: {
						type: 'array',
						items: { type: 'string' }
					}
				},
				required: ['tags']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ tags: ['a', 'b', 'c'] }).success).toBe(true);
			expect(zodSchema.safeParse({ tags: [] }).success).toBe(true);
			expect(zodSchema.safeParse({ tags: 'not-array' }).success).toBe(false);
		});

		it('should convert nested object property', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					user: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							age: { type: 'number' }
						},
						required: ['name']
					}
				},
				required: ['user']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ user: { name: 'John', age: 30 } }).success).toBe(true);
			expect(zodSchema.safeParse({ user: { name: 'John' } }).success).toBe(true);
			expect(zodSchema.safeParse({ user: { age: 30 } }).success).toBe(false);
		});

		it('should convert null type', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					value: { type: 'null' }
				},
				required: ['value']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ value: null }).success).toBe(true);
			expect(zodSchema.safeParse({ value: 'not-null' }).success).toBe(false);
		});

		it('should handle anyOf union types', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					value: {
						anyOf: [
							{ type: 'string' },
							{ type: 'number' }
						]
					}
				},
				required: ['value']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ value: 'text' }).success).toBe(true);
			expect(zodSchema.safeParse({ value: 42 }).success).toBe(true);
			expect(zodSchema.safeParse({ value: true }).success).toBe(false);
		});

		it('should handle oneOf union types', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					config: {
						oneOf: [
							{ type: 'boolean' },
							{ type: 'string' }
						]
					}
				},
				required: ['config']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({ config: true }).success).toBe(true);
			expect(zodSchema.safeParse({ config: 'string-value' }).success).toBe(true);
		});

		it('should handle empty properties', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {}
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({}).success).toBe(true);
		});

		it('should fallback to any for unknown types', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					unknown: { type: 'custom_type' }
				},
				required: ['unknown']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			// any type accepts everything
			expect(zodSchema.safeParse({ unknown: 'anything' }).success).toBe(true);
			expect(zodSchema.safeParse({ unknown: 123 }).success).toBe(true);
			expect(zodSchema.safeParse({ unknown: { nested: 'object' } }).success).toBe(true);
		});

		it('should preserve descriptions', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					name: { type: 'string', description: 'User name' }
				},
				required: ['name']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			// Zod descriptions can be accessed via .description
			const shape = zodSchema.shape;
			expect(shape.name.description).toBe('User name');
		});

		it('should handle complex nested schema', () => {
			const schema: ToolParameterSchema = {
				type: 'object',
				properties: {
					settings: {
						type: 'object',
						properties: {
							notifications: {
								type: 'object',
								properties: {
									enabled: { type: 'boolean' },
									channels: {
										type: 'array',
										items: { type: 'string' }
									}
								},
								required: ['enabled']
							}
						},
						required: ['notifications']
					}
				},
				required: ['settings']
			};

			const zodSchema = convertTypeBoxToZod(schema);

			expect(zodSchema.safeParse({
				settings: {
					notifications: {
						enabled: true,
						channels: ['email', 'sms']
					}
				}
			}).success).toBe(true);

			expect(zodSchema.safeParse({
				settings: {
					notifications: {
						enabled: false
					}
				}
			}).success).toBe(true);
		});
	});

	describe('createZodSchemaFromParams', () => {
		it('should create schema from simplified params definition', () => {
			const params = {
				name: { type: 'string', description: 'User name', required: true },
				age: { type: 'number', required: false }
			};

			const zodSchema = createZodSchemaFromParams(params);

			expect(zodSchema.safeParse({ name: 'John' }).success).toBe(true);
			expect(zodSchema.safeParse({ name: 'John', age: 30 }).success).toBe(true);
			expect(zodSchema.safeParse({}).success).toBe(false);
		});

		it('should handle all basic types', () => {
			const params = {
				str: { type: 'string', required: true },
				num: { type: 'number', required: true },
				bool: { type: 'boolean', required: true },
				arr: { type: 'array', required: true },
				obj: { type: 'object', required: true },
				int: { type: 'integer', required: true }
			};

			const zodSchema = createZodSchemaFromParams(params);

			expect(zodSchema.safeParse({
				str: 'text',
				num: 42,
				bool: true,
				arr: [1, 2, 3],
				obj: { key: 'value' },
				int: 10
			}).success).toBe(true);
		});
	});

	describe('inferZodTypeFromJsonSchema', () => {
		it('should return correct Zod types for JSON Schema types', () => {
			expect(inferZodTypeFromJsonSchema('string')).toBeInstanceOf(Object);
			expect(inferZodTypeFromJsonSchema('number')).toBeInstanceOf(Object);
			expect(inferZodTypeFromJsonSchema('integer')).toBeInstanceOf(Object);
			expect(inferZodTypeFromJsonSchema('boolean')).toBeInstanceOf(Object);
			expect(inferZodTypeFromJsonSchema('array')).toBeInstanceOf(Object);
			expect(inferZodTypeFromJsonSchema('object')).toBeInstanceOf(Object);
			expect(inferZodTypeFromJsonSchema('null')).toBeInstanceOf(Object);
			expect(inferZodTypeFromJsonSchema('unknown')).toBeInstanceOf(Object);
		});

		it('should parse values correctly for inferred types', () => {
			expect(inferZodTypeFromJsonSchema('string').safeParse('text').success).toBe(true);
			expect(inferZodTypeFromJsonSchema('number').safeParse(42).success).toBe(true);
			expect(inferZodTypeFromJsonSchema('boolean').safeParse(true).success).toBe(true);
			expect(inferZodTypeFromJsonSchema('null').safeParse(null).success).toBe(true);
		});
	});
});

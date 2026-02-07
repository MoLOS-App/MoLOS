/**
 * MCP Log Repository
 *
 * Handles database operations for MCP request/response logs.
 */

import { eq, and, desc, count, sql } from 'drizzle-orm';
import { aiMcpLogs } from '$lib/server/db/schema';
import type { MCPLogEntry, PaginationParams, PaginatedResponse } from '$lib/models/ai/mcp';
import { BaseRepository } from '../../base-repository';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export class McpLogRepository extends BaseRepository {
	constructor(db?: BetterSQLite3Database<any>) {
		super(db);
	}

	/**
	 * Create a new MCP log entry
	 */
	async create(entry: Omit<MCPLogEntry, 'id' | 'createdAt'>): Promise<MCPLogEntry> {
		const now = new Date();
		const [log] = await this.db
			.insert(aiMcpLogs)
			.values({
				id: crypto.randomUUID(),
				userId: entry.userId,
				apiKeyId: entry.apiKeyId ?? null,
				sessionId: entry.sessionId,
				requestId: entry.requestId,
				method: entry.method,
				toolName: entry.toolName ?? null,
				resourceName: entry.resourceName ?? null,
				promptName: entry.promptName ?? null,
				params: entry.params ? JSON.stringify(entry.params) : null,
				result: entry.result ? JSON.stringify(entry.result) : null,
				errorMessage: entry.errorMessage ?? null,
				status: entry.status,
				durationMs: entry.durationMs ?? null,
				createdAt: now
			} as any)
			.returning();

		const logParams = log.params as string | null;
		const logResult = log.result as string | null;

		return {
			...log,
			params: logParams ? JSON.parse(logParams) : undefined,
			result: logResult ? JSON.parse(logResult) : undefined
		} as MCPLogEntry;
	}

	/**
	 * Get log entry by ID
	 */
	async getById(id: string): Promise<MCPLogEntry | null> {
		const [log] = await this.db.select().from(aiMcpLogs).where(eq(aiMcpLogs.id, id)).limit(1);

		if (!log) return null;

		const logParams = log.params as string | null;
		const logResult = log.result as string | null;

		return {
			...log,
			params: logParams ? JSON.parse(logParams) : undefined,
			result: logResult ? JSON.parse(logResult) : undefined
		} as MCPLogEntry;
	}

	/**
	 * Get log entry by user ID and ID (ensures ownership)
	 */
	async getByUserIdAndId(userId: string, id: string): Promise<MCPLogEntry | null> {
		const [log] = await this.db
			.select()
			.from(aiMcpLogs)
			.where(and(eq(aiMcpLogs.userId, userId), eq(aiMcpLogs.id, id)))
			.limit(1);

		if (!log) return null;

		const logParams = log.params as string | null;
		const logResult = log.result as string | null;

		return {
			...log,
			params: logParams ? JSON.parse(logParams) : undefined,
			result: logResult ? JSON.parse(logResult) : undefined
		} as MCPLogEntry;
	}

	/**
	 * List log entries for a user with filters and pagination
	 */
	async listByUserId(
		userId: string,
		filters: {
			apiKeyId?: string;
			method?: string;
			status?: 'success' | 'error';
			search?: string;
			from?: Date;
			to?: Date;
		} = {},
		pagination: PaginationParams = {}
	): Promise<PaginatedResponse<MCPLogEntry>> {
		const page = pagination.page ?? 1;
		const limit = Math.min(pagination.limit ?? 50, 200);
		const offset = (page - 1) * limit;

		// Build conditions
		const conditions = [eq(aiMcpLogs.userId, userId)];

		if (filters.apiKeyId) {
			conditions.push(eq(aiMcpLogs.apiKeyId, filters.apiKeyId));
		}

		if (filters.method) {
			conditions.push(eq(aiMcpLogs.method, filters.method));
		}

		if (filters.status) {
			conditions.push(eq(aiMcpLogs.status, filters.status));
		}

		if (filters.search) {
			conditions.push(
				sql`(${aiMcpLogs.toolName} LIKE ${'%' + filters.search + '%'} OR ${aiMcpLogs.resourceName} LIKE ${'%' + filters.search + '%'} OR ${aiMcpLogs.promptName} LIKE ${'%' + filters.search + '%'} OR ${aiMcpLogs.errorMessage} LIKE ${'%' + filters.search + '%'})`
			);
		}

		if (filters.from) {
			conditions.push(sql`${aiMcpLogs.createdAt} >= ${filters.from.getTime()}`);
		}

		if (filters.to) {
			conditions.push(sql`${aiMcpLogs.createdAt} <= ${filters.to.getTime()}`);
		}

		const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

		// Get total count
		const [{ total }] = await this.db.select({ total: count() }).from(aiMcpLogs).where(whereClause);

		// Get items
		const items = await this.db
			.select()
			.from(aiMcpLogs)
			.where(whereClause)
			.orderBy(desc(aiMcpLogs.createdAt))
			.limit(limit)
			.offset(offset);

		return {
			items: items.map((item) => {
				const itemParams = item.params as string | null;
				const itemResult = item.result as string | null;
				return {
					...item,
					params: itemParams ? JSON.parse(itemParams) : undefined,
					result: itemResult ? JSON.parse(itemResult) : undefined
				} as MCPLogEntry;
			}),
			total,
			page,
			limit,
			hasMore: offset + items.length < total
		};
	}

	/**
	 * Get recent logs for a specific API key
	 */
	async listByApiKey(
		apiKeyId: string,
		limit: number = 50
	): Promise<Pick<MCPLogEntry, 'id' | 'method' | 'status' | 'createdAt' | 'durationMs'>[]> {
		const items = await this.db
			.select({
				id: aiMcpLogs.id,
				method: aiMcpLogs.method,
				status: aiMcpLogs.status,
				createdAt: aiMcpLogs.createdAt,
				durationMs: aiMcpLogs.durationMs
			})
			.from(aiMcpLogs)
			.where(eq(aiMcpLogs.apiKeyId, apiKeyId))
			.orderBy(desc(aiMcpLogs.createdAt))
			.limit(limit);

		return items.map((item) => ({
			...item,
			durationMs: item.durationMs ?? 0
		})) as Pick<MCPLogEntry, 'id' | 'method' | 'status' | 'createdAt' | 'durationMs'>[];
	}

	/**
	 * Get stats for a user
	 */
	async getStats(
		userId: string,
		apiKeyId?: string
	): Promise<{
		totalRequests: number;
		successCount: number;
		errorCount: number;
		avgDuration: number;
	}> {
		const conditions = [eq(aiMcpLogs.userId, userId)];

		if (apiKeyId) {
			conditions.push(eq(aiMcpLogs.apiKeyId, apiKeyId));
		}

		const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

		const [stats] = await this.db
			.select({
				totalRequests: count(),
				successCount: count(sql`CASE WHEN ${aiMcpLogs.status} = 'success' THEN 1 END`),
				errorCount: count(sql`CASE WHEN ${aiMcpLogs.status} = 'error' THEN 1 END`),
				avgDuration: sql<number>`AVG(${aiMcpLogs.durationMs})`
			})
			.from(aiMcpLogs)
			.where(whereClause);

		return {
			totalRequests: stats.totalRequests ?? 0,
			successCount: stats.successCount ?? 0,
			errorCount: stats.errorCount ?? 0,
			avgDuration: stats.avgDuration ?? 0
		};
	}

	/**
	 * Delete old logs (for cleanup/maintenance)
	 */
	async deleteOlderThan(date: Date): Promise<number> {
		const result = await this.db
			.delete(aiMcpLogs)
			.where(sql`${aiMcpLogs.createdAt} < ${date.getTime()}`)
			.returning();

		return result.length;
	}

	/**
	 * Delete logs for a specific user
	 */
	async deleteByUserId(userId: string): Promise<number> {
		const result = await this.db.delete(aiMcpLogs).where(eq(aiMcpLogs.userId, userId)).returning();

		return result.length;
	}
}

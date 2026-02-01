import { eq, sql } from 'drizzle-orm';
import {
	settingsUser,
	settingsModules,
	settingsExternalModules,
	settingsServerLogs,
	settingsSystem
} from '../../server/db/schema';
import { BaseRepository } from '../base-repository';
import type { ModuleError } from '../../config/module-types.ts';

export interface ModuleState {
	moduleId: string;
	submoduleId: string;
	enabled: boolean;
	menuOrder?: number;
}

export class SettingsRepository extends BaseRepository {
	async getUserSettings(userId: string) {
		const result = await this.db
			.select()
			.from(settingsUser)
			.where(eq(settingsUser.userId, userId))
			.limit(1);
		return result[0] || null;
	}

	async updateTheme(userId: string, theme: string) {
		return await this.db
			.insert(settingsUser)
			.values({ userId, theme })
			.onConflictDoUpdate({
				target: settingsUser.userId,
				set: { theme, updatedAt: new Date() }
			})
			.returning();
	}

	async getModuleStates(userId: string): Promise<ModuleState[]> {
		const result = await this.db
			.select()
			.from(settingsModules)
			.where(eq(settingsModules.userId, userId));
		return result.map((r) => ({
			moduleId: r.moduleId,
			submoduleId: r.submoduleId,
			enabled: r.enabled,
			menuOrder: r.menuOrder
		}));
	}

	async updateModuleState(userId: string, state: ModuleState) {
		return await this.db
			.insert(settingsModules)
			.values({
				userId,
				moduleId: state.moduleId,
				submoduleId: state.submoduleId || 'main',
				enabled: state.enabled,
				menuOrder: state.menuOrder ?? 0
			})
			.onConflictDoUpdate({
				target: [settingsModules.userId, settingsModules.moduleId, settingsModules.submoduleId],
				set: {
					enabled: state.enabled,
					menuOrder: state.menuOrder ?? sql`${settingsModules.menuOrder}`,
					updatedAt: new Date()
				}
			})
			.returning();
	}

	async updateManyModuleStates(userId: string, states: ModuleState[]) {
		const results = [];
		for (const state of states) {
			results.push(await this.updateModuleState(userId, state));
		}
		return results;
	}

	async registerExternalModule(id: string, repoUrl: string, gitRef: string = 'main') {
		return await this.db
			.insert(settingsExternalModules)
			.values({ id, repoUrl, status: 'pending', gitRef })
			.onConflictDoUpdate({
				target: settingsExternalModules.id,
				set: {
					repoUrl,
					status: 'pending',
					gitRef,
					lastError: null,
					errorDetails: null,
					errorType: null,
					recoverySteps: null,
					updatedAt: new Date()
				}
			})
			.returning();
	}

	/**
	 * Update module status with comprehensive error tracking
	 */
	async updateExternalModuleStatus(
		id: string,
		status:
			| 'active'
			| 'error_manifest'
			| 'error_migration'
			| 'error_config'
			| 'disabled'
			| 'deleting'
			| 'pending',
		error?: ModuleError | null
	) {
		const updateData: Record<string, any> = {
			status,
			lastError: error?.message || null,
			errorType: error?.errorType || null,
			errorDetails: error?.details ? JSON.stringify(error.details) : null,
			recoverySteps: error?.recoverySteps ? JSON.stringify(error.recoverySteps) : null,
			updatedAt: new Date()
		};

		return await this.db
			.update(settingsExternalModules)
			.set(updateData)
			.where(eq(settingsExternalModules.id, id))
			.returning();
	}

	async getExternalModules() {
		return await this.db.select().from(settingsExternalModules);
	}

	async getExternalModuleById(id: string) {
		const result = await this.db
			.select()
			.from(settingsExternalModules)
			.where(eq(settingsExternalModules.id, id))
			.limit(1);
		return result[0] || null;
	}

	async deleteExternalModule(id: string) {
		return await this.db
			.delete(settingsExternalModules)
			.where(eq(settingsExternalModules.id, id))
			.returning();
	}

	/**
	 * Increment retry count for a module and update last retry timestamp
	 */
	async incrementRetryCount(id: string) {
		const result = await this.db
			.select({
				retryCount: settingsExternalModules.retryCount
			})
			.from(settingsExternalModules)
			.where(eq(settingsExternalModules.id, id))
			.limit(1);

		if (result[0]) {
			const newCount = (result[0].retryCount || 0) + 1;
			return await this.db
				.update(settingsExternalModules)
				.set({
					retryCount: newCount,
					lastRetryAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(settingsExternalModules.id, id))
				.returning();
		}
		return null;
	}

	/**
	 * Reset retry count for a module (called on successful initialization)
	 */
	async resetRetryCount(id: string) {
		return await this.db
			.update(settingsExternalModules)
			.set({
				retryCount: 0,
				lastRetryAt: null,
				updatedAt: new Date()
			})
			.where(eq(settingsExternalModules.id, id))
			.returning();
	}

	/**
	 * Check if module should be retried based on retry policy
	 */
	async shouldRetryModule(id: string, maxRetries: number = 3, gracePeriodMs: number = 300000) {
		const result = await this.db
			.select()
			.from(settingsExternalModules)
			.where(eq(settingsExternalModules.id, id))
			.limit(1);

		const module = result[0];
		if (!module) return false;

		// Don't retry if max retries exceeded
		if (module.retryCount >= maxRetries) return false;

		// Don't retry if within grace period (unless it's the first retry)
		if (module.lastRetryAt && module.retryCount > 0) {
			const timeSinceLastRetry = Date.now() - module.lastRetryAt;
			if (timeSinceLastRetry < gracePeriodMs) return false;
		}

		return true;
	}

	/**
	 * Get modules that are retryable (in error state but within retry limits)
	 */
	async getRetryableModules(maxRetries: number = 3) {
		return await this.db
			.select()
			.from(settingsExternalModules)
			.where(sql`(status LIKE 'error_%' OR status = 'pending') AND retry_count < ${maxRetries}`);
	}

	async log(level: 'info' | 'warn' | 'error', source: string, message: string, details?: unknown) {
		return await this.db
			.insert(settingsServerLogs)
			.values({
				level,
				source,
				message,
				details: details ? JSON.stringify(details) : null
			})
			.returning();
	}

	async getServerLogs(limit = 100) {
		return await this.db
			.select()
			.from(settingsServerLogs)
			.orderBy(settingsServerLogs.createdAt)
			.limit(limit);
	}

	async getSystemSetting(key: string) {
		const result = await this.db
			.select()
			.from(settingsSystem)
			.where(eq(settingsSystem.key, key))
			.limit(1);
		return result[0]?.value || null;
	}

	async updateSystemSetting(key: string, value: string, description?: string) {
		return await this.db
			.insert(settingsSystem)
			.values({ key, value, description })
			.onConflictDoUpdate({
				target: settingsSystem.key,
				set: {
					value,
					description: description || sql`${settingsSystem.description}`,
					updatedAt: new Date()
				}
			})
			.returning();
	}

	async getAllSystemSettings() {
		return await this.db.select().from(settingsSystem);
	}

	async updateExternalModuleGitRef(id: string, gitRef: string) {
		return await this.db
			.update(settingsExternalModules)
			.set({
				gitRef,
				updatedAt: new Date()
			})
			.where(eq(settingsExternalModules.id, id))
			.returning();
	}

	async updateExternalModuleBlockUpdates(id: string, blockUpdates: boolean) {
		return await this.db
			.update(settingsExternalModules)
			.set({
				blockUpdates,
				updatedAt: new Date()
			})
			.where(eq(settingsExternalModules.id, id))
			.returning();
	}
}

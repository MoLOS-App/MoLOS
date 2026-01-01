import { eq, sql } from 'drizzle-orm';
import {
	settingsUser,
	settingsModules,
	settingsExternalModules,
	settingsServerLogs,
	settingsSystem
} from '../../server/db/schema';
import { BaseRepository } from '../base-repository';

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

	async registerExternalModule(id: string, repoUrl: string) {
		return await this.db
			.insert(settingsExternalModules)
			.values({ id, repoUrl, status: 'pending' })
			.onConflictDoUpdate({
				target: settingsExternalModules.id,
				set: { repoUrl, status: 'pending', lastError: null, updatedAt: new Date() }
			})
			.returning();
	}

	async updateExternalModuleStatus(
		id: string,
		status: 'active' | 'error' | 'deleting' | 'pending',
		error?: string
	) {
		return await this.db
			.update(settingsExternalModules)
			.set({
				status,
				lastError: error || null,
				updatedAt: new Date()
			})
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
}

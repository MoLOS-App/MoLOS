import { eq } from "drizzle-orm";
import { tasksSettings } from "../database/schema";
import { BaseRepository } from "./base-repository";
import type { UpdateTasksSettingsInput } from "../../models";

export class TasksSettingsRepository extends BaseRepository {
  async getByUserId(userId: string) {
    const [result] = await this.db
      .select()
      .from(tasksSettings)
      .where(eq(tasksSettings.userId, userId))
      .limit(1);

    if (!result) {
      const [newSettings] = await this.db
        .insert(tasksSettings)
        .values({ userId })
        .returning();
      return newSettings;
    }

    return result;
  }

  async update(userId: string, data: UpdateTasksSettingsInput) {
    const [result] = await this.db
      .update(tasksSettings)
      .set({
        ...data,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(tasksSettings.userId, userId))
      .returning();
    return result;
  }
}

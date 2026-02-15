import { eq, and, like, or, sql } from "drizzle-orm";
import { tasksDailyLog } from "../database/schema";
import type { DailyLog } from "../../models";
import { BaseRepository } from "./base-repository";

export class DailyLogRepository extends BaseRepository {
  async getByUserId(userId: string, limit: number = 30): Promise<DailyLog[]> {
    const result = await this.db
      .select()
      .from(tasksDailyLog)
      .where(eq(tasksDailyLog.userId, userId))
      .limit(limit);

    return result as DailyLog[];
  }

  async getByDate(userId: string, logDate: number): Promise<DailyLog | null> {
    const result = await this.db
      .select()
      .from(tasksDailyLog)
      .where(
        and(
          eq(tasksDailyLog.userId, userId),
          eq(tasksDailyLog.logDate, logDate),
        ),
      )
      .limit(1);

    return result[0] ? (result[0] as DailyLog) : null;
  }

  async getLastNDays(userId: string, days: number = 7): Promise<DailyLog[]> {
    const now = Math.floor(Date.now() / 1000);
    const startDate = now - days * 86400;

    const result = await this.db
      .select()
      .from(tasksDailyLog)
      .where(and(eq(tasksDailyLog.userId, userId)))
      .limit(days);

    return result.filter((log: any) => log.logDate >= startDate) as DailyLog[];
  }

  async searchByUserId(
    userId: string,
    query: string,
    limit: number = 30,
  ): Promise<DailyLog[]> {
    const term = `%${query}%`;
    const result = await this.db
      .select()
      .from(tasksDailyLog)
      .where(
        and(
          eq(tasksDailyLog.userId, userId),
          or(
            like(sql<string>`coalesce(${tasksDailyLog.notes}, '')`, term),
            like(sql<string>`coalesce(${tasksDailyLog.mood}, '')`, term),
          ),
        ),
      )
      .limit(limit);

    return result as DailyLog[];
  }

  async create(
    log: Omit<DailyLog, "id" | "createdAt" | "updatedAt">,
  ): Promise<DailyLog> {
    const result = await this.db.insert(tasksDailyLog).values(log).returning();

    return result[0] as DailyLog;
  }

  async update(
    userId: string,
    logDate: number,
    updates: Partial<
      Omit<DailyLog, "id" | "userId" | "logDate" | "createdAt" | "updatedAt">
    >,
  ): Promise<DailyLog | null> {
    const result = await this.db
      .update(tasksDailyLog)
      .set({ ...updates, updatedAt: Math.floor(Date.now() / 1000) })
      .where(
        and(
          eq(tasksDailyLog.userId, userId),
          eq(tasksDailyLog.logDate, logDate),
        ),
      )
      .returning();

    return result[0] ? (result[0] as DailyLog) : null;
  }

  async delete(userId: string, logDate: number): Promise<boolean> {
    const result = await this.db
      .delete(tasksDailyLog)
      .where(
        and(
          eq(tasksDailyLog.userId, userId),
          eq(tasksDailyLog.logDate, logDate),
        ),
      );

    return result.changes > 0;
  }
}

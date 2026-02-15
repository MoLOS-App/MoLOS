import { eq, and, like, or, sql } from "drizzle-orm";
import { tasksAreas } from "../database/schema";
import type { Area } from "../../models";
import { BaseRepository } from "./base-repository";

export class AreaRepository extends BaseRepository {
  async getByUserId(userId: string): Promise<Area[]> {
    const result = await this.db
      .select()
      .from(tasksAreas)
      .where(eq(tasksAreas.userId, userId));

    return result as Area[];
  }

  async getById(id: string, userId: string): Promise<Area | null> {
    const result = await this.db
      .select()
      .from(tasksAreas)
      .where(and(eq(tasksAreas.id, id), eq(tasksAreas.userId, userId)))
      .limit(1);

    return result[0] ? (result[0] as Area) : null;
  }

  async create(
    area: Omit<Area, "id" | "createdAt" | "updatedAt">,
  ): Promise<Area> {
    const result = await this.db.insert(tasksAreas).values(area).returning();

    return result[0] as Area;
  }

  async searchByUserId(
    userId: string,
    query: string,
    limit: number = 50,
  ): Promise<Area[]> {
    const term = `%${query}%`;
    const result = await this.db
      .select()
      .from(tasksAreas)
      .where(
        and(
          eq(tasksAreas.userId, userId),
          or(
            like(tasksAreas.name, term),
            like(sql<string>`coalesce(${tasksAreas.description}, '')`, term),
          ),
        ),
      )
      .limit(limit);

    return result as Area[];
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<Omit<Area, "id" | "userId" | "createdAt" | "updatedAt">>,
  ): Promise<Area | null> {
    const result = await this.db
      .update(tasksAreas)
      .set({ ...updates, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(tasksAreas.id, id), eq(tasksAreas.userId, userId)))
      .returning();

    return result[0] ? (result[0] as Area) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(tasksAreas)
      .where(and(eq(tasksAreas.id, id), eq(tasksAreas.userId, userId)));

    return result.changes > 0;
  }
}

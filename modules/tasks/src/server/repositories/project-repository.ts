import { eq, and, like, or, sql } from "drizzle-orm";
import { tasksProjects } from "../database/schema";
import type { Project } from "../../models";
import { BaseRepository } from "./base-repository";

export class ProjectRepository extends BaseRepository {
  async getByUserId(userId: string, limit: number = 50): Promise<Project[]> {
    const result = await this.db
      .select()
      .from(tasksProjects)
      .where(eq(tasksProjects.userId, userId))
      .limit(limit);

    return result as Project[];
  }

  async getById(id: string, userId: string): Promise<Project | null> {
    const result = await this.db
      .select()
      .from(tasksProjects)
      .where(and(eq(tasksProjects.id, id), eq(tasksProjects.userId, userId)))
      .limit(1);

    return result[0] ? (result[0] as Project) : null;
  }

  async getByAreaId(areaId: string, userId: string): Promise<Project[]> {
    const result = await this.db
      .select()
      .from(tasksProjects)
      .where(
        and(eq(tasksProjects.areaId, areaId), eq(tasksProjects.userId, userId)),
      );

    return result as Project[];
  }

  async getActiveProjects(userId: string): Promise<Project[]> {
    const result = await this.db
      .select()
      .from(tasksProjects)
      .where(
        and(
          eq(tasksProjects.userId, userId),
          eq(tasksProjects.status, "active"),
        ),
      );

    return result as Project[];
  }

  async searchByUserId(
    userId: string,
    query: string,
    limit: number = 50,
  ): Promise<Project[]> {
    const term = `%${query}%`;
    const result = await this.db
      .select()
      .from(tasksProjects)
      .where(
        and(
          eq(tasksProjects.userId, userId),
          or(
            like(tasksProjects.name, term),
            like(sql<string>`coalesce(${tasksProjects.description}, '')`, term),
          ),
        ),
      )
      .limit(limit);

    return result as Project[];
  }

  async create(
    project: Omit<Project, "id" | "createdAt" | "updatedAt">,
  ): Promise<Project> {
    const result = await this.db
      .insert(tasksProjects)
      .values(project)
      .returning();

    return result[0] as Project;
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<
      Omit<Project, "id" | "userId" | "createdAt" | "updatedAt">
    >,
  ): Promise<Project | null> {
    const result = await this.db
      .update(tasksProjects)
      .set({ ...updates, updatedAt: Math.floor(Date.now() / 1000) })
      .where(and(eq(tasksProjects.id, id), eq(tasksProjects.userId, userId)))
      .returning();

    return result[0] ? (result[0] as Project) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(tasksProjects)
      .where(and(eq(tasksProjects.id, id), eq(tasksProjects.userId, userId)));

    return result.changes > 0;
  }
}

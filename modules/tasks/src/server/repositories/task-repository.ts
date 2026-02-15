import { eq, and, count, like, or, sql } from "drizzle-orm";
import { tasksTasks } from "../database/schema";
import type {
  Task,
  TaskStatus,
} from "../../models";
import { BaseRepository } from "./base-repository";

export class TaskRepository extends BaseRepository {
  private mapToTask(row: Record<string, unknown>): Task {
    return {
      ...row,
      userId: (row.userId as string) || "",
      description: (row.description as string) || undefined,
      dueDate: (row.dueDate as number) || undefined,
      doDate: (row.doDate as number) || undefined,
      effort: (row.effort as number) || undefined,
      projectId: (row.projectId as string) || undefined,
      areaId: (row.areaId as string) || undefined,
      context: row.context ? JSON.parse(row.context as string) : undefined,
    } as unknown as Task;
  }

  async getByUserId(userId: string, limit: number = 50): Promise<Task[]> {
    const result = await this.db
      .select()
      .from(tasksTasks)
      .where(eq(tasksTasks.userId, userId))
      .limit(limit);

    return result.map((row) => this.mapToTask(row));
  }

  async searchByUserId(
    userId: string,
    query: string,
    limit: number = 50,
  ): Promise<Task[]> {
    const term = `%${query}%`;
    const result = await this.db
      .select()
      .from(tasksTasks)
      .where(
        and(
          eq(tasksTasks.userId, userId),
          or(
            like(tasksTasks.title, term),
            like(sql<string>`coalesce(${tasksTasks.description}, '')`, term),
          ),
        ),
      )
      .limit(limit);

    return result.map((row) => this.mapToTask(row));
  }

  async getById(id: string, userId: string): Promise<Task | null> {
    const result = await this.db
      .select()
      .from(tasksTasks)
      .where(and(eq(tasksTasks.id, id), eq(tasksTasks.userId, userId)))
      .limit(1);

    return result[0] ? this.mapToTask(result[0]) : null;
  }

  async getByProjectId(projectId: string, userId: string): Promise<Task[]> {
    const result = await this.db
      .select()
      .from(tasksTasks)
      .where(
        and(eq(tasksTasks.projectId, projectId), eq(tasksTasks.userId, userId)),
      );

    return result.map((row) => this.mapToTask(row));
  }

  async getByAreaId(areaId: string, userId: string): Promise<Task[]> {
    const result = await this.db
      .select()
      .from(tasksTasks)
      .where(and(eq(tasksTasks.areaId, areaId), eq(tasksTasks.userId, userId)));

    return result.map((row) => this.mapToTask(row));
  }

  async getTodaysTasks(userId: string, today: number): Promise<Task[]> {
    const result = await this.db
      .select()
      .from(tasksTasks)
      .where(and(eq(tasksTasks.userId, userId)))
      .limit(100);

    // Filter for tasks due today or with do date today
    return result
      .filter((task) => {
        const taskStart = Math.floor(today / 86400) * 86400;
        const taskEnd = taskStart + 86400;
        const dueDate = task.dueDate as number | null;
        const doDate = task.doDate as number | null;
        return (
          (dueDate && dueDate >= taskStart && dueDate < taskEnd) ||
          (doDate && doDate >= taskStart && doDate < taskEnd)
        );
      })
      .map((row) => this.mapToTask(row));
  }

  async create(
    task: Omit<Task, "id" | "createdAt" | "updatedAt">,
  ): Promise<Task> {
    const result = await this.db
      .insert(tasksTasks)
      .values({
        ...task,
        context: task.context ? JSON.stringify(task.context) : undefined,
      })
      .returning();

    return this.mapToTask(result[0] as unknown as Record<string, unknown>);
  }

  async update(
    id: string,
    userId: string,
    updates: Partial<Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">>,
  ): Promise<Task | null> {
    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    if (updates.context) {
      updateData.context = JSON.stringify(updates.context);
    }

    const result = await this.db
      .update(tasksTasks)
      .set(updateData)
      .where(and(eq(tasksTasks.id, id), eq(tasksTasks.userId, userId)))
      .returning();

    return result[0]
      ? this.mapToTask(result[0] as unknown as Record<string, unknown>)
      : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(tasksTasks)
      .where(and(eq(tasksTasks.id, id), eq(tasksTasks.userId, userId)));

    return result.changes > 0;
  }

  async completeTask(id: string, userId: string): Promise<Task | null> {
    return this.update(id, userId, { isCompleted: true, status: "done" });
  }

  async countByStatus(userId: string, status: string): Promise<number> {
    const result = await this.db
      .select({ value: count() })
      .from(tasksTasks)
      .where(
        and(
          eq(tasksTasks.userId, userId),
          eq(tasksTasks.status, status as TaskStatus),
        ),
      );

    return result[0]?.value ?? 0;
  }
}

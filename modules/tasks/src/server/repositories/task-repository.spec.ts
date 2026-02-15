import { describe, it, expect, beforeEach } from "vitest";
import { TaskRepository } from "./task-repository";
import { createTestDb } from "$lib/test-utils";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { CreateTaskInput } from "$lib/models/external_modules/MoLOS-Tasks";

describe("TaskRepository", () => {
  let db: BetterSQLite3Database<Record<string, unknown>>;
  let repository: TaskRepository;
  const userId = "test-user-1";
  const otherUserId = "test-user-2";

  beforeEach(async () => {
    db = await createTestDb();
    repository = new TaskRepository(db as any);
  });

  it("should create and retrieve a task", async () => {
    const taskData: CreateTaskInput = {
      userId,
      title: "Test Task",
      description: "Test Description",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    };

    const created = await repository.create(taskData);
    expect(created.id).toBeDefined();
    expect(created.title).toBe(taskData.title);

    const retrieved = await repository.getById(created.id, userId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe(taskData.title);
  });

  it("should not retrieve a task belonging to another user", async () => {
    const taskData: CreateTaskInput = {
      userId: otherUserId,
      title: "Other User Task",
      status: "to_do",
      priority: "low",
      isCompleted: false,
    };

    const created = await repository.create(taskData);
    const retrieved = await repository.getById(created.id, userId);
    expect(retrieved).toBeNull();
  });

  it("should update a task", async () => {
    const created = await repository.create({
      userId,
      title: "Original Title",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });

    const updated = await repository.update(created.id, userId, {
      title: "Updated Title",
      status: "done",
    });

    expect(updated?.title).toBe("Updated Title");
    expect(updated?.status).toBe("done");
  });

  it("should delete a task", async () => {
    const created = await repository.create({
      userId,
      title: "To be deleted",
      status: "to_do",
      priority: "low",
      isCompleted: false,
    });

    const deleted = await repository.delete(created.id, userId);
    expect(deleted).toBe(true);

    const retrieved = await repository.getById(created.id, userId);
    expect(retrieved).toBeNull();
  });

  it("should list tasks for a user", async () => {
    await repository.create({
      userId,
      title: "Task 1",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });
    await repository.create({
      userId,
      title: "Task 2",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });
    await repository.create({
      userId: otherUserId,
      title: "Other Task",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });

    const tasks = await repository.getByUserId(userId);
    expect(tasks.length).toBe(2);
    expect(tasks.every((t) => t.userId === userId)).toBe(true);
  });
});

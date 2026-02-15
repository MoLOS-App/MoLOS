import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST, PUT, DELETE } from "./+server";
import { TaskRepository } from "../../server/repositories/task-repository";
import { error, json } from "@sveltejs/kit";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as moduleSchema from "../../server/database/schema";

// Mock SvelteKit error and json helpers
vi.mock("@sveltejs/kit", () => ({
  error: vi.fn((status, message) => ({ status, message })),
  json: vi.fn((data, init) => ({ data, init })),
}));

// Mock TaskRepository to use in-memory DB
vi.mock("$lib/repositories/external_modules/MoLOS-Tasks/task-repository", () => {
  return {
    TaskRepository: vi.fn().mockImplementation(function (this: any) {
      return (globalThis as any).mockRepoInstance;
    }),
  };
});

describe("Tasks API", () => {
  let mockRepo: any;
  const userId = "test-user-1";
  const mockLocals = { user: { id: userId } };

  beforeEach(async () => {
    vi.clearAllMocks();
    const client = new Database(":memory:");
    const db = drizzle(client, { schema: moduleSchema });

    // Create tables manually for in-memory database
    client.exec(`
			CREATE TABLE "MoLOS-Tasks_tasks" (
				"id" text PRIMARY KEY NOT NULL,
				"user_id" text,
				"title" text NOT NULL,
				"description" text,
				"status" text NOT NULL DEFAULT 'to_do',
				"priority" text NOT NULL DEFAULT 'medium',
				"due_date" integer,
				"do_date" integer,
				"effort" integer,
				"context" text,
				"is_completed" integer NOT NULL DEFAULT 0,
				"project_id" text,
				"area_id" text,
				"created_at" integer NOT NULL DEFAULT (strftime('%s','now')),
				"updated_at" integer NOT NULL DEFAULT (strftime('%s','now'))
			);
		`);

    // We need a real instance but pointing to test DB
    const { TaskRepository: RealRepo } = (await vi.importActual(
      "$lib/repositories/external_modules/MoLOS-Tasks/task-repository",
    )) as any;
    mockRepo = new RealRepo(db);
    (globalThis as any).mockRepoInstance = mockRepo;
  });

  it("GET should return tasks for user", async () => {
    await mockRepo.create({
      userId,
      title: "Task 1",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });

    const response: any = await GET({ locals: mockLocals } as any);

    expect(response.data.length).toBe(1);
    expect(response.data[0].title).toBe("Task 1");
  });

  it("POST should create a new task", async () => {
    const newTask = { title: "New Task", status: "to_do", priority: "high" };
    const request = {
      json: async () => newTask,
    };

    const response: any = await POST({ locals: mockLocals, request } as any);

    expect(response.init.status).toBe(201);
    expect(response.data.title).toBe("New Task");
    expect(response.data.userId).toBe(userId);
  });

  it("PUT should update a task", async () => {
    const created = await mockRepo.create({
      userId,
      title: "Old Title",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });
    const updates = { id: created.id, title: "New Title", status: "done" };
    const request = {
      json: async () => updates,
    };

    const response: any = await PUT({ locals: mockLocals, request } as any);

    expect(response.data.title).toBe("New Title");
    expect(response.data.isCompleted).toBe(true);
  });

  it("DELETE should remove a task", async () => {
    const created = await mockRepo.create({
      userId,
      title: "Delete me",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });
    const request = {
      json: async () => ({ id: created.id }),
    };

    const response: any = await DELETE({ locals: mockLocals, request } as any);

    expect(response.data.success).toBe(true);
    const check = await mockRepo.getById(created.id, userId);
    expect(check).toBeNull();
  });

  it("should return 401 if not authenticated", async () => {
    await expect(GET({ locals: {} } as any)).rejects.toBeDefined();
    expect(error).toHaveBeenCalledWith(401, "Unauthorized");
  });
});

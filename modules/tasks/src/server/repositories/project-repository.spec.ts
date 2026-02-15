import { describe, it, expect, beforeEach } from "vitest";
import { ProjectRepository } from "./project-repository";
import { createTestDb } from "$lib/test-utils";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { CreateProjectInput } from "$lib/models/external_modules/MoLOS-Tasks";

describe("ProjectRepository", () => {
  let db: BetterSQLite3Database<Record<string, unknown>>;
  let repository: ProjectRepository;
  const userId = "test-user-1";

  beforeEach(async () => {
    db = await createTestDb();
    repository = new ProjectRepository(db as any);
  });

  it("should create and retrieve a project", async () => {
    const projectData: CreateProjectInput = {
      userId,
      name: "Test Project",
      status: "active",
      description: "Test Description",
    };

    const created = await repository.create(projectData);
    expect(created.id).toBeDefined();
    expect(created.name).toBe(projectData.name);

    const retrieved = await repository.getById(created.id, userId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe(projectData.name);
  });

  it("should list active projects", async () => {
    await repository.create({ userId, name: "Active 1", status: "active" });
    await repository.create({ userId, name: "Planning 1", status: "planning" });
    await repository.create({ userId, name: "Active 2", status: "active" });

    const active = await repository.getActiveProjects(userId);
    expect(active.length).toBe(2);
    expect(active.every((p) => p.status === "active")).toBe(true);
  });
});

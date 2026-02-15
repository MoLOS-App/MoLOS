import { describe, it, expect, beforeEach } from "vitest";
import { AreaRepository } from "./area-repository";
import { createTestDb } from "$lib/test-utils";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { CreateAreaInput } from "$lib/models/external_modules/MoLOS-Tasks";

describe("AreaRepository", () => {
  let db: BetterSQLite3Database<Record<string, unknown>>;
  let repository: AreaRepository;
  const userId = "test-user-1";

  beforeEach(async () => {
    db = await createTestDb();
    repository = new AreaRepository(db as any);
  });

  it("should create and retrieve an area", async () => {
    const areaData: CreateAreaInput = {
      userId,
      name: "Work",
      themeColor: "#ff0000",
      description: "Work related tasks",
    };

    const created = await repository.create(areaData);
    expect(created.id).toBeDefined();
    expect(created.name).toBe(areaData.name);

    const retrieved = await repository.getById(created.id, userId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe(areaData.name);
  });

  it("should list areas for a user", async () => {
    await repository.create({ userId, name: "Work" });
    await repository.create({ userId, name: "Personal" });
    await repository.create({ userId: "other", name: "Other" });

    const areas = await repository.getByUserId(userId);
    expect(areas.length).toBe(2);
    expect(areas.map((a) => a.name)).toContain("Work");
    expect(areas.map((a) => a.name)).toContain("Personal");
  });
});

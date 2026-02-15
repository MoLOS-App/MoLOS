import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { TaskRepository } from "../../server/repositories/task-repository";
import { ProjectRepository } from "../../server/repositories/project-repository";
import { AreaRepository } from "../../server/repositories/area-repository";
import { DailyLogRepository } from "../../server/repositories/daily-log-repository";
import { db } from "$lib/server/db";

type SearchResult = {
  moduleId: string;
  moduleName?: string;
  entityType: string;
  entityId: string;
  title: string;
  snippet?: string;
  href: string;
  updatedAt?: number;
};

const SearchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const moduleId = "MoLOS-Tasks";
const moduleName = "Tasks";

const buildSnippet = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length <= 140) return trimmed;
  return `${trimmed.slice(0, 140).trim()}...`;
};

const toMs = (value?: number | null) => (value ? value * 1000 : undefined);

export const GET: RequestHandler = async ({ locals, url }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const parsed = SearchSchema.safeParse({
    q: url.searchParams.get("q"),
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message ?? "Invalid query");
  }

  const { q, limit } = parsed.data;
  const perTypeLimit = Math.min(20, limit ?? 20);

  const taskRepo = new TaskRepository(db);
  const projectRepo = new ProjectRepository(db);
  const areaRepo = new AreaRepository(db);
  const dailyLogRepo = new DailyLogRepository(db);

  const [tasks, projects, areas, dailyLogs] = await Promise.all([
    taskRepo.searchByUserId(userId, q, perTypeLimit),
    projectRepo.searchByUserId(userId, q, perTypeLimit),
    areaRepo.searchByUserId(userId, q, perTypeLimit),
    dailyLogRepo.searchByUserId(userId, q, perTypeLimit),
  ]);

  const results: SearchResult[] = [
    ...tasks.map((task) => ({
      moduleId,
      moduleName,
      entityType: "task",
      entityId: task.id,
      title: task.title,
      snippet: buildSnippet(task.description),
      href: "/ui/MoLOS-Tasks/my",
      updatedAt: toMs(task.updatedAt),
    })),
    ...projects.map((project) => ({
      moduleId,
      moduleName,
      entityType: "project",
      entityId: project.id,
      title: project.name,
      snippet: buildSnippet(project.description),
      href: "/ui/MoLOS-Tasks/projects",
      updatedAt: toMs(project.updatedAt),
    })),
    ...areas.map((area) => ({
      moduleId,
      moduleName,
      entityType: "area",
      entityId: area.id,
      title: area.name,
      snippet: buildSnippet(area.description),
      href: "/ui/MoLOS-Tasks/areas",
      updatedAt: toMs(area.updatedAt),
    })),
    ...dailyLogs.map((log) => ({
      moduleId,
      moduleName,
      entityType: "daily_log",
      entityId: log.id,
      title: `Daily Log: ${new Date(log.logDate * 1000).toISOString().slice(0, 10)}`,
      snippet: buildSnippet(log.notes || log.mood),
      href: "/ui/MoLOS-Tasks/daily-log",
      updatedAt: toMs(log.updatedAt),
    })),
  ];

  return json({ query: q, results, total: results.length });
};

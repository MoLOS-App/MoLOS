import { TaskRepository } from "../repositories/task-repository";
import { ProjectRepository } from "../repositories/project-repository";
import { AreaRepository } from "../repositories/area-repository";
import { DailyLogRepository } from "../repositories/daily-log-repository";
import type { ToolDefinition } from "../../models";
import { db } from "@molos/database";

export function getAiTools(userId: string): ToolDefinition[] {
  const taskRepo = new TaskRepository(db as any);
  const projectRepo = new ProjectRepository(db as any);
  const areaRepo = new AreaRepository(db as any);
  const dailyLogRepo = new DailyLogRepository(db as any);

  return [
    // Tasks
    {
      name: "get_tasks",
      description:
        "Retrieve a list of tasks for the user. Can be filtered by status, project, or area.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["to_do", "in_progress", "waiting", "done", "archived"],
          },
          projectId: { type: "string" },
          areaId: { type: "string" },
          limit: { type: "number", default: 50 },
        },
      },
      execute: async (params) => {
        let tasks = await taskRepo.getByUserId(userId, params.limit);
        if (params.status)
          tasks = tasks.filter((t) => t.status === params.status);
        if (params.projectId)
          tasks = tasks.filter((t) => t.projectId === params.projectId);
        if (params.areaId)
          tasks = tasks.filter((t) => t.areaId === params.areaId);
        return tasks;
      },
    },
    {
      name: "bulk_create_tasks",
      description: "Create multiple tasks at once.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                projectId: { type: "string" },
                areaId: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                dueDate: { type: "number" },
              },
              required: ["title"],
            },
          },
        },
        required: ["tasks"],
      },
      execute: async (params) => {
        const results = await Promise.all(
          params.tasks.map((task: any) =>
            taskRepo.create({
              userId,
              ...task,
              status: "to_do",
              priority: task.priority || "medium",
              isCompleted: false,
            }),
          ),
        );
        return { count: results.length };
      },
    },
    {
      name: "bulk_update_tasks",
      description:
        "Update multiple tasks at once. Use this for marking tasks as completed, changing priority, or rescheduling.",
      parameters: {
        type: "object",
        properties: {
          ids: {
            type: "array",
            items: { type: "string" },
            description: "List of task IDs to update.",
          },
          updates: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["to_do", "in_progress", "waiting", "done", "archived"],
              },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              dueDate: {
                type: "number",
                description: "Unix timestamp in seconds.",
              },
              doDate: {
                type: "number",
                description: "Unix timestamp in seconds.",
              },
              isCompleted: { type: "boolean" },
            },
          },
        },
        required: ["ids", "updates"],
      },
      execute: async (params) => {
        const results = await Promise.all(
          params.ids.map((id: string) =>
            taskRepo.update(id, userId, params.updates),
          ),
        );
        return { updatedCount: results.filter((r) => r !== null).length };
      },
    },
    {
      name: "bulk_delete_tasks",
      description: "Delete multiple tasks at once.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
        },
        required: ["ids"],
      },
      execute: async (params) => {
        const results = await Promise.all(
          params.ids.map((id: string) => taskRepo.delete(id, userId)),
        );
        return { count: results.filter((r) => r === true).length };
      },
    },

    // Projects & Areas
    {
      name: "get_projects",
      description: "Retrieve projects for the user.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "completed", "on_hold"] },
        },
      },
      execute: async (params) => {
        if (params.status === "active")
          return await projectRepo.getActiveProjects(userId);
        return await projectRepo.getByUserId(userId);
      },
    },
    {
      name: "create_project",
      description: "Create a new project.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          areaId: { type: "string" },
        },
        required: ["name"],
      },
      execute: async (params) => {
        return await projectRepo.create({
          userId,
          ...params,
          status: "active",
        });
      },
    },
    {
      name: "get_areas",
      description: "Retrieve all areas of responsibility.",
      parameters: { type: "object", properties: {} },
      execute: async () => {
        return await areaRepo.getByUserId(userId);
      },
    },

    // Daily Logs & Notes
    {
      name: "get_note_hierarchy",
      description: "Retrieve the hierarchy of daily notes and logs.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", default: 30 },
        },
      },
      execute: async (params) => {
        const logs = await dailyLogRepo.getByUserId(userId, params.limit);
        const hierarchy: Record<
          string,
          { id: string; date: string; hasNotes: boolean; mood?: string }[]
        > = {};

        logs.forEach((log) => {
          const date = new Date(log.logDate * 1000);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          if (!hierarchy[key]) hierarchy[key] = [];
          hierarchy[key].push({
            id: log.id,
            date: date.toISOString().split("T")[0],
            hasNotes: !!log.notes,
            mood: log.mood,
          });
        });

        return hierarchy;
      },
    },
    {
      name: "update_daily_log",
      description: "Update notes or mood for a specific daily log.",
      parameters: {
        type: "object",
        properties: {
          logDate: { type: "number", description: "Unix timestamp in seconds" },
          notes: { type: "string" },
          mood: { type: "string" },
        },
        required: ["logDate"],
      },
      execute: async (params) => {
        const { logDate, ...updates } = params;
        return await dailyLogRepo.update(userId, logDate, updates);
      },
    },

    // Search
    {
      name: "global_search",
      description:
        "Search across Tasks, Projects, Areas, and Daily Logs simultaneously.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search term" },
        },
        required: ["query"],
      },
      execute: async (params) => {
        const query = params.query.toLowerCase();
        const [tasks, projects, areas, logs] = await Promise.all([
          taskRepo.getByUserId(userId),
          projectRepo.getByUserId(userId),
          areaRepo.getByUserId(userId),
          dailyLogRepo.getByUserId(userId),
        ]);

        return {
          tasks: tasks.filter(
            (t) =>
              t.title.toLowerCase().includes(query) ||
              t.description?.toLowerCase().includes(query),
          ),
          projects: projects.filter(
            (p) =>
              p.name.toLowerCase().includes(query) ||
              p.description?.toLowerCase().includes(query),
          ),
          areas: areas.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.description?.toLowerCase().includes(query),
          ),
          dailyLogs: logs.filter((l) => l.notes?.toLowerCase().includes(query)),
        };
      },
    },
  ];
}

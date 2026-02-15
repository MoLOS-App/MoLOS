import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Area,
  CreateAreaInput,
  UpdateAreaInput,
  DailyLog,
  CreateDailyLogInput,
  UpdateDailyLogInput,
  TasksSettings,
  UpdateTasksSettingsInput,
} from "../models";

/**
 * Tasks API Client
 */

// Tasks
export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch("/api/MoLOS-Tasks");
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return await res.json();
}

export async function createTask(data: CreateTaskInput): Promise<Task> {
  const res = await fetch("/api/MoLOS-Tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return await res.json();
}

export async function updateTask(
  id: string,
  updates: UpdateTaskInput,
): Promise<Task> {
  const res = await fetch("/api/MoLOS-Tasks", {
    method: "PUT",
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) throw new Error("Failed to update task");
  return await res.json();
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch("/api/MoLOS-Tasks", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to delete task");
}

// Projects
export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/MoLOS-Tasks/projects");
  if (!res.ok) throw new Error("Failed to fetch projects");
  return await res.json();
}

export async function createProject(
  data: CreateProjectInput,
): Promise<Project> {
  const res = await fetch("/api/MoLOS-Tasks/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return await res.json();
}

export async function updateProject(
  id: string,
  updates: UpdateProjectInput,
): Promise<Project> {
  const res = await fetch("/api/MoLOS-Tasks/projects", {
    method: "PUT",
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) throw new Error("Failed to update project");
  return await res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch("/api/MoLOS-Tasks/projects", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to delete project");
}

// Areas
export async function fetchAreas(): Promise<Area[]> {
  const res = await fetch("/api/MoLOS-Tasks/areas");
  if (!res.ok) throw new Error("Failed to fetch areas");
  return await res.json();
}

export async function createArea(data: CreateAreaInput): Promise<Area> {
  const res = await fetch("/api/MoLOS-Tasks/areas", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create area");
  return await res.json();
}

export async function updateArea(
  id: string,
  updates: UpdateAreaInput,
): Promise<Area> {
  const res = await fetch("/api/MoLOS-Tasks/areas", {
    method: "PUT",
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) throw new Error("Failed to update area");
  return await res.json();
}

export async function deleteArea(id: string): Promise<void> {
  const res = await fetch("/api/MoLOS-Tasks/areas", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Failed to delete area");
}

// Daily Log
export async function fetchDailyLogs(): Promise<DailyLog[]> {
  const res = await fetch("/api/MoLOS-Tasks/daily-log");
  if (!res.ok) throw new Error("Failed to fetch daily logs");
  return await res.json();
}

export async function createDailyLog(
  data: CreateDailyLogInput,
): Promise<DailyLog> {
  const res = await fetch("/api/MoLOS-Tasks/daily-log", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create daily log");
  return await res.json();
}

export async function updateDailyLog(
  logDate: number,
  updates: UpdateDailyLogInput,
): Promise<DailyLog> {
  const res = await fetch("/api/MoLOS-Tasks/daily-log", {
    method: "PUT",
    body: JSON.stringify({ logDate, ...updates }),
  });
  if (!res.ok) throw new Error("Failed to update daily log");
  return await res.json();
}

export async function deleteDailyLog(logDate: number): Promise<void> {
  const res = await fetch("/api/MoLOS-Tasks/daily-log", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logDate }),
  });
  if (!res.ok) throw new Error("Failed to delete daily log");
}

/**
 * Settings API
 */
export async function fetchSettings(): Promise<TasksSettings> {
  const res = await fetch("/api/MoLOS-Tasks/settings");
  if (!res.ok) throw new Error("Failed to fetch tasks settings");
  return await res.json();
}

export async function updateSettings(
  data: UpdateTasksSettingsInput,
): Promise<TasksSettings> {
  const res = await fetch("/api/MoLOS-Tasks/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update tasks settings");
  return await res.json();
}

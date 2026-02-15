import { writable, derived } from "svelte/store";
import type {
  Task,
  Project,
  Area,
  DailyLog,
  TasksSettings,
  UpdateTasksSettingsInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateAreaInput,
  UpdateAreaInput,
  CreateDailyLogInput,
  UpdateDailyLogInput,
} from "../models";
import * as api from "./api";

/**
 * Tasks Module Store
 */

// Data Stores
export const tasksStore = writable<Task[]>([]);
export const projectsStore = writable<Project[]>([]);
export const areasStore = writable<Area[]>([]);
export const dailyLogsStore = writable<DailyLog[]>([]);

// Settings Store
export const tasksSettingsStore = writable<TasksSettings | null>(null);

// UI State Store
export const tasksUIState = writable({
  loading: false,
  error: null as string | null,
  lastLoaded: null as number | null,
});

// Derived Stats
export const taskStats = derived(tasksStore, ($tasks) => {
  const total = $tasks.length;
  const completed = $tasks.filter((t) => t.isCompleted).length;
  const active = total - completed;
  const now = Math.floor(Date.now() / 1000);
  const scheduled = $tasks.filter((t) => t.dueDate && t.dueDate > now).length;

  return { total, completed, active, scheduled };
});

/**
 * Actions
 */

export async function loadAllTasksData() {
  tasksUIState.update((s) => ({ ...s, loading: true, error: null }));

  try {
    const [tasks, projects, areas, logs, settings] = await Promise.all([
      api.fetchTasks(),
      api.fetchProjects(),
      api.fetchAreas(),
      api.fetchDailyLogs(),
      api.fetchSettings(),
    ]);

    tasksStore.set(tasks);
    projectsStore.set(projects);
    areasStore.set(areas);
    dailyLogsStore.set(logs);
    tasksSettingsStore.set(settings);

    tasksUIState.update((s) => ({
      ...s,
      loading: false,
      lastLoaded: Date.now(),
    }));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load tasks data";
    tasksUIState.update((s) => ({ ...s, loading: false, error: message }));
    console.error("Tasks store load error:", err);
  }
}

type TasksData = {
  tasks?: Task[];
  projects?: Project[];
  areas?: Area[];
  dailyLogs?: DailyLog[];
  settings?: TasksSettings | null;
};

export function hydrateTasksData(data: TasksData) {
  let hasData = false;

  if (data.tasks !== undefined) {
    tasksStore.set(data.tasks);
    hasData = true;
  }

  if (data.projects !== undefined) {
    projectsStore.set(data.projects);
    hasData = true;
  }

  if (data.areas !== undefined) {
    areasStore.set(data.areas);
    hasData = true;
  }

  if (data.dailyLogs !== undefined) {
    dailyLogsStore.set(data.dailyLogs);
    hasData = true;
  }

  if (data.settings !== undefined) {
    tasksSettingsStore.set(data.settings);
    hasData = true;
  }

  if (hasData) {
    tasksUIState.update((s) => ({
      ...s,
      loading: false,
      error: null,
      lastLoaded: Date.now(),
    }));
  }
}

// Task Actions
export async function addTaskStore(data: CreateTaskInput) {
  try {
    const newTask = await api.createTask(data);
    tasksStore.update((tasks) => [newTask, ...tasks]);
    return newTask;
  } catch (err) {
    console.error("Failed to add task:", err);
    throw err;
  }
}

export async function updateTaskStore(id: string, updates: UpdateTaskInput) {
  try {
    const updatedTask = await api.updateTask(id, updates);
    tasksStore.update((tasks) =>
      tasks.map((t) => (t.id === id ? updatedTask : t)),
    );
    return updatedTask;
  } catch (err) {
    console.error("Failed to update task:", err);
    throw err;
  }
}

export async function deleteTaskStore(id: string) {
  try {
    await api.deleteTask(id);
    tasksStore.update((tasks) => tasks.filter((t) => t.id !== id));
  } catch (err) {
    console.error("Failed to delete task:", err);
    throw err;
  }
}

// Project Actions
export async function addProjectStore(data: CreateProjectInput) {
  const newProject = await api.createProject(data);
  projectsStore.update((projects) => [newProject, ...projects]);
  return newProject;
}

export async function updateProjectStore(
  id: string,
  updates: UpdateProjectInput,
) {
  const updated = await api.updateProject(id, updates);
  projectsStore.update((projects) =>
    projects.map((p) => (p.id === id ? updated : p)),
  );
  return updated;
}

export async function deleteProjectStore(id: string) {
  await api.deleteProject(id);
  projectsStore.update((projects) => projects.filter((p) => p.id !== id));
}

// Area Actions
export async function addAreaStore(data: CreateAreaInput) {
  const newArea = await api.createArea(data);
  areasStore.update((areas) => [newArea, ...areas]);
  return newArea;
}

export async function updateAreaStore(id: string, updates: UpdateAreaInput) {
  const updated = await api.updateArea(id, updates);
  areasStore.update((areas) => areas.map((a) => (a.id === id ? updated : a)));
  return updated;
}

export async function deleteAreaStore(id: string) {
  await api.deleteArea(id);
  areasStore.update((areas) => areas.filter((a) => a.id !== id));
}

export async function updateTasksSettings(data: UpdateTasksSettingsInput) {
  const updated = await api.updateSettings(data);
  tasksSettingsStore.set(updated);
  return updated;
}

// Daily Log Actions
export async function addDailyLogStore(data: CreateDailyLogInput) {
  const newLog = await api.createDailyLog(data);
  dailyLogsStore.update((logs) => [newLog, ...logs]);
  return newLog;
}

export async function updateDailyLogStore(
  logDate: number,
  updates: UpdateDailyLogInput,
) {
  const updated = await api.updateDailyLog(logDate, updates);
  dailyLogsStore.update((logs) =>
    logs.map((log) => (log.logDate === logDate ? updated : log)),
  );
  return updated;
}

export async function deleteDailyLogStore(logDate: number) {
  await api.deleteDailyLog(logDate);
  dailyLogsStore.update((logs) =>
    logs.filter((log) => log.logDate !== logDate),
  );
}

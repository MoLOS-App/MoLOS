import { describe, it, expect, beforeEach, vi } from "vitest";
import { get } from "svelte/store";
import {
  tasksStore,
  taskStats,
  addTaskStore,
  updateTaskStore,
  deleteTaskStore,
} from "./tasks.store";
import * as api from "./api";

vi.mock("./api", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  fetchTasks: vi.fn(),
  fetchProjects: vi.fn(),
  fetchAreas: vi.fn(),
  fetchDailyLogs: vi.fn(),
}));

describe("Tasks Store", () => {
  beforeEach(() => {
    tasksStore.set([]);
    vi.clearAllMocks();
  });

  it("should calculate stats correctly", () => {
    tasksStore.set([
      { id: "1", title: "T1", isCompleted: false } as any,
      { id: "2", title: "T2", isCompleted: true } as any,
      { id: "3", title: "T3", isCompleted: false } as any,
    ]);

    const stats = get(taskStats);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.active).toBe(2);
  });

  it("addTaskStore should update store", async () => {
    const newTask = { id: "new", title: "New Task", isCompleted: false };
    (api.createTask as any).mockResolvedValue(newTask);

    await addTaskStore({
      title: "New Task",
      userId: "test-user-1",
      status: "to_do",
      priority: "medium",
      isCompleted: false,
    });

    const tasks = get(tasksStore);
    expect(tasks.length).toBe(1);
    expect(tasks[0]).toEqual(newTask);
  });

  it("updateTaskStore should update specific task", async () => {
    tasksStore.set([{ id: "1", title: "Old", isCompleted: false } as any]);
    const updatedTask = { id: "1", title: "New", isCompleted: true };
    (api.updateTask as any).mockResolvedValue(updatedTask);

    await updateTaskStore("1", { title: "New" });

    const tasks = get(tasksStore);
    expect(tasks[0].title).toBe("New");
    expect(tasks[0].isCompleted).toBe(true);
  });

  it("deleteTaskStore should remove task", async () => {
    tasksStore.set([{ id: "1", title: "T1" } as any]);
    (api.deleteTask as any).mockResolvedValue(undefined);

    await deleteTaskStore("1");

    const tasks = get(tasksStore);
    expect(tasks.length).toBe(0);
  });
});

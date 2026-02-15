import { render } from "vitest-browser-svelte";
import { describe, it, expect } from "vitest";
import TaskItem from "./task-item.svelte";
import {
  projectsStore,
  areasStore,
} from "../stores";

describe("TaskItem Component", () => {
  const mockTask = {
    id: "1",
    title: "Test Task",
    description: "Test Description",
    isCompleted: false,
    priority: "high",
    dueDate: Math.floor(Date.now() / 1000),
  };

  it("should render task details", async () => {
    projectsStore.set([]);
    areasStore.set([]);

    const { getByText } = render(TaskItem, { task: mockTask } as any);

    await expect.element(getByText("Test Task")).toBeInTheDocument();
    await expect.element(getByText("Test Description")).toBeInTheDocument();
    await expect.element(getByText("high")).toBeInTheDocument();
  });

  it("should show completed state", async () => {
    const completedTask = { ...mockTask, isCompleted: true };
    const { getByText } = render(TaskItem, { task: completedTask } as any);

    const title = getByText("Test Task");
    await expect.element(title).toHaveClass("line-through");
  });
});

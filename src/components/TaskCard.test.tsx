import { fireEvent, render, screen } from "@testing-library/react";
import type { Task } from "@/lib/types";
import { TaskCard } from "@/components/TaskCard";

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Focus task",
    description: null,
    notes_markdown: null,
    project_id: null,
    status: "TODO",
    priority: "NORMAL",
    is_important: 0,
    due_at: null,
    remind_at: null,
    recurrence: "NONE",
    created_at: "2026-02-20T10:00:00.000Z",
    updated_at: "2026-02-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("TaskCard focus controls", () => {
  it("starts a focus session from task row", () => {
    const task = createTask();
    const onStartFocus = vi.fn();

    render(
      <TaskCard
        task={task}
        onEdit={() => undefined}
        onStatusChange={() => undefined}
        onDelete={() => undefined}
        onStartFocus={onStartFocus}
        onStopFocus={() => undefined}
      />,
    );

    fireEvent.click(screen.getByTitle("Start focus session"));
    expect(onStartFocus).toHaveBeenCalledTimes(1);
    expect(onStartFocus).toHaveBeenCalledWith(task);
  });

  it("shows active focus timer and stops the same task session", () => {
    const task = createTask();
    const onStopFocus = vi.fn();

    render(
      <TaskCard
        task={task}
        onEdit={() => undefined}
        onStatusChange={() => undefined}
        onDelete={() => undefined}
        activeFocusTaskId={task.id}
        focusElapsedSeconds={65}
        onStartFocus={() => undefined}
        onStopFocus={onStopFocus}
      />,
    );

    expect(screen.getByText("Focus 1:05")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Stop and save focus session"));
    expect(onStopFocus).toHaveBeenCalledTimes(1);
    expect(onStopFocus).toHaveBeenCalledWith(task);
  });

  it("disables focus button when another task is already active", () => {
    const task = createTask();

    render(
      <TaskCard
        task={task}
        onEdit={() => undefined}
        onStatusChange={() => undefined}
        onDelete={() => undefined}
        activeFocusTaskId="task-other"
        onStartFocus={() => undefined}
        onStopFocus={() => undefined}
      />,
    );

    expect(
      screen.getByTitle("Focus session is running on another task"),
    ).toBeDisabled();
  });
});

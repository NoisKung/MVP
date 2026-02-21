import { APP_UI_STATE_STORAGE_KEY, useAppStore } from "@/store/app-store";
import { createTaskFixture } from "@/test/fixtures";

describe("app-store", () => {
  beforeEach(() => {
    window.localStorage.removeItem(APP_UI_STATE_STORAGE_KEY);
    useAppStore.setState({
      activeView: "board",
      editingTask: null,
      isCreateOpen: false,
      projectsViewContext: {
        selectedProjectId: null,
        projectSearch: "",
        projectStatusFilter: "ALL",
        taskSectionFilter: "ALL",
      },
      taskDetailFocus: {
        mode: "IDLE",
        taskId: null,
        projectId: null,
      },
    });
  });

  it("updates active view", () => {
    useAppStore.getState().setActiveView("projects");
    expect(useAppStore.getState().activeView).toBe("projects");
  });

  it("persists active view for resume last context", async () => {
    useAppStore.getState().setActiveView("projects");
    useAppStore.getState().setProjectsViewContext({
      selectedProjectId: "project-123",
      projectSearch: "alpha",
      projectStatusFilter: "ACTIVE",
      taskSectionFilter: "DOING",
    });
    useAppStore.getState().setTaskDetailFocus({
      mode: "EDIT",
      taskId: "task-42",
      projectId: "project-123",
    });
    const storedValue = window.localStorage.getItem(APP_UI_STATE_STORAGE_KEY);
    expect(storedValue).toContain('"activeView":"projects"');
    expect(storedValue).toContain('"selectedProjectId":"project-123"');
    expect(storedValue).toContain('"mode":"EDIT"');
    expect(storedValue).toContain('"taskId":"task-42"');

    useAppStore.setState({ activeView: "board" });
    window.localStorage.setItem(
      APP_UI_STATE_STORAGE_KEY,
      JSON.stringify({
        state: {
          activeView: "projects",
          projectsViewContext: {
            selectedProjectId: "project-123",
            projectSearch: "alpha",
            projectStatusFilter: "ACTIVE",
            taskSectionFilter: "DOING",
          },
          taskDetailFocus: {
            mode: "CREATE",
            taskId: null,
            projectId: "project-123",
          },
        },
        version: 0,
      }),
    );
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().activeView).toBe("projects");
    expect(useAppStore.getState().projectsViewContext).toEqual({
      selectedProjectId: "project-123",
      projectSearch: "alpha",
      projectStatusFilter: "ACTIVE",
      taskSectionFilter: "DOING",
    });
    expect(useAppStore.getState().taskDetailFocus).toEqual({
      mode: "CREATE",
      taskId: null,
      projectId: "project-123",
    });
  });

  it("sets editing task", () => {
    const task = createTaskFixture({ id: "t1", title: "Task 1" });
    useAppStore.getState().setEditingTask(task);
    expect(useAppStore.getState().editingTask).toEqual(task);

    useAppStore.getState().setEditingTask(null);
    expect(useAppStore.getState().editingTask).toBeNull();
  });

  it("toggles create form open state", () => {
    useAppStore.getState().setIsCreateOpen(true);
    expect(useAppStore.getState().isCreateOpen).toBe(true);

    useAppStore.getState().setIsCreateOpen(false);
    expect(useAppStore.getState().isCreateOpen).toBe(false);
  });

  it("patches projects view context without dropping existing fields", () => {
    useAppStore.getState().setProjectsViewContext({
      projectSearch: "beta",
      taskSectionFilter: "TODO",
    });
    expect(useAppStore.getState().projectsViewContext).toEqual({
      selectedProjectId: null,
      projectSearch: "beta",
      projectStatusFilter: "ALL",
      taskSectionFilter: "TODO",
    });
  });

  it("sets and clears task detail focus", () => {
    useAppStore.getState().setTaskDetailFocus({
      mode: "EDIT",
      taskId: "task-9",
      projectId: "project-9",
    });
    expect(useAppStore.getState().taskDetailFocus).toEqual({
      mode: "EDIT",
      taskId: "task-9",
      projectId: "project-9",
    });

    useAppStore.getState().clearTaskDetailFocus();
    expect(useAppStore.getState().taskDetailFocus).toEqual({
      mode: "IDLE",
      taskId: null,
      projectId: null,
    });
  });
});

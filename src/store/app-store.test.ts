import { useAppStore } from "@/store/app-store";
import { createTaskFixture } from "@/test/fixtures";

describe("app-store", () => {
  beforeEach(() => {
    useAppStore.setState({
      activeView: "board",
      editingTask: null,
      isCreateOpen: false,
    });
  });

  it("updates active view", () => {
    useAppStore.getState().setActiveView("projects");
    expect(useAppStore.getState().activeView).toBe("projects");
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
});

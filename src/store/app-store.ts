import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type {
  ProjectViewContextState,
  TaskDetailFocusState,
  ViewMode,
  Task,
} from "@/lib/types";

export const APP_UI_STATE_STORAGE_KEY = "solostack.app.ui-state.v1";

const DEFAULT_PROJECT_VIEW_CONTEXT: ProjectViewContextState = {
  selectedProjectId: null,
  projectSearch: "",
  projectStatusFilter: "ALL",
  taskSectionFilter: "ALL",
};
const DEFAULT_TASK_DETAIL_FOCUS: TaskDetailFocusState = {
  mode: "IDLE",
  taskId: null,
  projectId: null,
};

interface AppState {
  /** Current view mode */
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;

  /** Task being edited (null = form closed) */
  editingTask: Task | null;
  setEditingTask: (task: Task | null) => void;

  /** Whether the create form is open */
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;

  /** Persisted Projects view context for resume-last-context */
  projectsViewContext: ProjectViewContextState;
  setProjectsViewContext: (
    contextPatch: Partial<ProjectViewContextState>,
  ) => void;

  /** Persisted task detail focus for resume-last-context */
  taskDetailFocus: TaskDetailFocusState;
  setTaskDetailFocus: (focus: TaskDetailFocusState) => void;
  clearTaskDetailFocus: () => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: "board",
      setActiveView: (view) => set({ activeView: view }),

      editingTask: null,
      setEditingTask: (task) => set({ editingTask: task }),

      isCreateOpen: false,
      setIsCreateOpen: (open) => set({ isCreateOpen: open }),

      projectsViewContext: { ...DEFAULT_PROJECT_VIEW_CONTEXT },
      setProjectsViewContext: (contextPatch) =>
        set((state) => ({
          projectsViewContext: {
            ...state.projectsViewContext,
            ...contextPatch,
          },
        })),

      taskDetailFocus: { ...DEFAULT_TASK_DETAIL_FOCUS },
      setTaskDetailFocus: (focus) => set({ taskDetailFocus: focus }),
      clearTaskDetailFocus: () =>
        set({ taskDetailFocus: { ...DEFAULT_TASK_DETAIL_FOCUS } }),
    }),
    {
      name: APP_UI_STATE_STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : window.localStorage,
      ),
      partialize: (state) => ({
        activeView: state.activeView,
        projectsViewContext: state.projectsViewContext,
        taskDetailFocus: state.taskDetailFocus,
      }),
    },
  ),
);

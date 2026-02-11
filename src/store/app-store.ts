import { create } from "zustand";
import type { ViewMode, Task } from "@/lib/types";

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
}

export const useAppStore = create<AppState>((set) => ({
    activeView: "board",
    setActiveView: (view) => set({ activeView: view }),

    editingTask: null,
    setEditingTask: (task) => set({ editingTask: task }),

    isCreateOpen: false,
    setIsCreateOpen: (open) => set({ isCreateOpen: open }),
}));

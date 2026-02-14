import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { TaskBoard } from "./components/TaskBoard";
import { TaskForm } from "./components/TaskForm";
import { Dashboard } from "./components/Dashboard";
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "./hooks/use-tasks";
import { useAppStore } from "./store/app-store";
import type { CreateTaskInput, UpdateTaskInput, TaskStatus } from "./lib/types";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds — local DB is fast
      retry: 1,
    },
  },
});

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

function AppContent() {
  const {
    activeView,
    editingTask,
    setEditingTask,
    isCreateOpen,
    setIsCreateOpen,
  } = useAppStore();
  const {
    data: tasks = [],
    isLoading,
    isError,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [actionError, setActionError] = useState<string | null>(null);

  const openCreateModal = useCallback(() => {
    setEditingTask(null);
    setIsCreateOpen(true);
  }, [setEditingTask, setIsCreateOpen]);

  useEffect(() => {
    const handleCreateShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "n"
      ) {
        return;
      }

      event.preventDefault();
      openCreateModal();
    };

    window.addEventListener("keydown", handleCreateShortcut);
    return () => window.removeEventListener("keydown", handleCreateShortcut);
  }, [openCreateModal]);

  const handleCreate = async (input: CreateTaskInput | UpdateTaskInput) => {
    setActionError(null);
    try {
      await createTask.mutateAsync(input as CreateTaskInput);
      setIsCreateOpen(false);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleUpdate = async (input: CreateTaskInput | UpdateTaskInput) => {
    setActionError(null);
    try {
      await updateTask.mutateAsync(input as UpdateTaskInput);
      setEditingTask(null);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setActionError(null);
    void updateTask
      .mutateAsync({ id: taskId, status: newStatus })
      .catch((error) => setActionError(getErrorMessage(error)));
  };

  const handleDelete = (taskId: string) => {
    setActionError(null);
    void deleteTask
      .mutateAsync(taskId)
      .catch((error) => setActionError(getErrorMessage(error)));
  };

  const content = isLoading ? (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--border-default)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  ) : isError ? (
    <div
      style={{
        margin: 24,
        padding: "16px 18px",
        border: "1px solid var(--danger)",
        borderRadius: 10,
        background: "var(--danger-subtle)",
      }}
    >
      <h2
        style={{ fontSize: 16, marginBottom: 6, color: "var(--text-primary)" }}
      >
        Failed to load tasks
      </h2>
      <p
        style={{
          fontSize: 13,
          marginBottom: 12,
          color: "var(--text-secondary)",
        }}
      >
        {getErrorMessage(tasksError)}
      </p>
      <button
        style={{
          padding: "7px 12px",
          border: "1px solid var(--border-strong)",
          borderRadius: 8,
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          fontSize: 12,
          cursor: "pointer",
        }}
        onClick={() => void refetchTasks()}
      >
        Retry
      </button>
    </div>
  ) : activeView === "board" ? (
    <TaskBoard
      tasks={tasks}
      onEdit={(task) => setEditingTask(task)}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onCreateClick={openCreateModal}
    />
  ) : (
    <Dashboard />
  );

  return (
    <AppShell onCreateClick={openCreateModal}>
      {actionError && (
        <div
          style={{
            margin: "16px 24px 0",
            padding: "10px 12px",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            background: "var(--danger-subtle)",
            color: "var(--danger)",
            fontSize: 12,
          }}
        >
          {actionError}
        </div>
      )}
      {content}

      {/* Create Task Modal */}
      {isCreateOpen && (
        <TaskForm
          onSubmit={handleCreate}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskForm
          task={editingTask}
          onSubmit={handleUpdate}
          onClose={() => setEditingTask(null)}
        />
      )}
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;

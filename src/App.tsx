import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./components/AppShell";
import { TaskBoard } from "./components/TaskBoard";
import { TaskForm } from "./components/TaskForm";
import { Dashboard } from "./components/Dashboard";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "./hooks/use-tasks";
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

function AppContent() {
  const { activeView, editingTask, setEditingTask, isCreateOpen, setIsCreateOpen } = useAppStore();
  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleCreate = (input: CreateTaskInput | UpdateTaskInput) => {
    createTask.mutate(input as CreateTaskInput);
    setIsCreateOpen(false);
  };

  const handleUpdate = (input: CreateTaskInput | UpdateTaskInput) => {
    updateTask.mutate(input as UpdateTaskInput);
    setEditingTask(null);
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTask.mutate({ id: taskId, status: newStatus });
  };

  const handleDelete = (taskId: string) => {
    deleteTask.mutate(taskId);
  };

  return (
    <AppShell onCreateClick={() => setIsCreateOpen(true)}>
      {isLoading ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--color-text-muted)",
        }}>
          <div style={{
            width: 32,
            height: 32,
            border: "3px solid var(--color-border)",
            borderTopColor: "var(--color-accent)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
        </div>
      ) : activeView === "board" ? (
        <TaskBoard
          tasks={tasks}
          onEdit={(task) => setEditingTask(task)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      ) : (
        <Dashboard />
      )}

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

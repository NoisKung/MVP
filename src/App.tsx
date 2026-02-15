import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { TaskBoard } from "./components/TaskBoard";
import { TaskForm } from "./components/TaskForm";
import { QuickCapture } from "./components/QuickCapture";
import { Dashboard } from "./components/Dashboard";
import { TaskScheduleView } from "./components/TaskScheduleView";
import { ProjectView } from "./components/ProjectView";
import { CalendarView } from "./components/CalendarView";
import { ReminderSettings } from "./components/ReminderSettings";
import { TaskFiltersBar } from "./components/TaskFiltersBar";
import { CommandPalette } from "./components/CommandPalette";
import {
  useTasks,
  useProjects,
  useTodayTasks,
  useUpcomingTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "./hooks/use-tasks";
import { useReminderNotifications } from "./hooks/use-reminder-notifications";
import { useQuickCaptureShortcut } from "./hooks/use-quick-capture-shortcut";
import { useTaskFilters } from "./hooks/use-task-filters";
import { useAppStore } from "./store/app-store";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  Task,
} from "./lib/types";
import {
  getRemindersEnabledPreference,
  setRemindersEnabledPreference,
} from "./lib/reminder-settings";
import { applyTaskFilters } from "./lib/task-filters";
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
    setActiveView,
    editingTask,
    setEditingTask,
    isCreateOpen,
    setIsCreateOpen,
  } = useAppStore();
  const {
    data: allTasks = [],
    isLoading: isLoadingAllTasks,
    isError: isAllTasksError,
    error: allTasksError,
    refetch: refetchAllTasks,
  } = useTasks();
  const { data: projects = [] } = useProjects();
  const {
    data: todayTasks = [],
    isLoading: isLoadingTodayTasks,
    isError: isTodayTasksError,
    error: todayTasksError,
    refetch: refetchTodayTasks,
  } = useTodayTasks();
  const {
    data: upcomingTasks = [],
    isLoading: isLoadingUpcomingTasks,
    isError: isUpcomingTasksError,
    error: upcomingTasksError,
    refetch: refetchUpcomingTasks,
  } = useUpcomingTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const {
    filters,
    savedViews,
    activeSavedViewId,
    hasActiveFilters,
    setSearch,
    toggleProject,
    toggleStatus,
    togglePriority,
    setImportantOnly,
    setDueFilter,
    setSortBy,
    clearFilters,
    saveCurrentFiltersAsView,
    applySavedView,
    deleteSavedView,
  } = useTaskFilters(activeView);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickCaptureError, setQuickCaptureError] = useState<string | null>(
    null,
  );
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [createModalProjectId, setCreateModalProjectId] = useState<
    string | null
  >(null);
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(() =>
    getRemindersEnabledPreference(),
  );

  const closeQuickCapture = useCallback(() => {
    setQuickCaptureError(null);
    setIsQuickCaptureOpen(false);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const openQuickCapture = useCallback(() => {
    setActionError(null);
    setQuickCaptureError(null);
    setIsCommandPaletteOpen(false);
    setEditingTask(null);
    setCreateModalProjectId(null);
    setIsCreateOpen(false);
    setIsQuickCaptureOpen(true);
  }, [setEditingTask, setIsCreateOpen]);

  useQuickCaptureShortcut(openQuickCapture);

  const openCreateModal = useCallback(
    (projectId: string | null = null) => {
      closeQuickCapture();
      setIsCommandPaletteOpen(false);
      setEditingTask(null);
      setCreateModalProjectId(projectId);
      setIsCreateOpen(true);
    },
    [closeQuickCapture, setEditingTask, setIsCreateOpen],
  );

  const handleRemindersEnabledChange = useCallback((enabled: boolean) => {
    setRemindersEnabled(enabled);
    setRemindersEnabledPreference(enabled);
  }, []);

  const handleTaskNotificationOpen = useCallback(
    (taskId: string) => {
      const matchedTask = allTasks.find((task) => task.id === taskId);
      if (!matchedTask) return;

      closeQuickCapture();
      setCreateModalProjectId(null);
      setIsCreateOpen(false);
      setEditingTask(matchedTask);
      setActiveView("board");
    },
    [
      allTasks,
      closeQuickCapture,
      setActiveView,
      setCreateModalProjectId,
      setEditingTask,
      setIsCreateOpen,
    ],
  );

  const handleEditTask = useCallback(
    (task: Task) => {
      closeQuickCapture();
      setEditingTask(task);
    },
    [closeQuickCapture, setEditingTask],
  );

  useReminderNotifications(
    allTasks,
    remindersEnabled && !isLoadingAllTasks && !isAllTasksError,
    handleTaskNotificationOpen,
  );

  useEffect(() => {
    const handleCreateShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
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

  useEffect(() => {
    const handlePaletteShortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }

      if (isCreateOpen || editingTask || isQuickCaptureOpen) {
        return;
      }

      event.preventDefault();
      setIsCommandPaletteOpen((previousState) => !previousState);
    };

    window.addEventListener("keydown", handlePaletteShortcut);
    return () => window.removeEventListener("keydown", handlePaletteShortcut);
  }, [editingTask, isCreateOpen, isQuickCaptureOpen]);

  useEffect(() => {
    if (!isCommandPaletteOpen) return;
    if (isCreateOpen || editingTask || isQuickCaptureOpen) {
      setIsCommandPaletteOpen(false);
    }
  }, [editingTask, isCommandPaletteOpen, isCreateOpen, isQuickCaptureOpen]);

  const handleCreate = async (input: CreateTaskInput | UpdateTaskInput) => {
    setActionError(null);
    try {
      await createTask.mutateAsync(input as CreateTaskInput);
      setIsCreateOpen(false);
      setCreateModalProjectId(null);
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

  const handleQuickCaptureCreate = useCallback(
    async (title: string): Promise<void> => {
      setQuickCaptureError(null);
      try {
        await createTask.mutateAsync({
          title,
          project_id: null,
          priority: "NORMAL",
          is_important: false,
          due_at: null,
          remind_at: null,
          recurrence: "NONE",
        });
        setIsQuickCaptureOpen(false);
      } catch (error) {
        setQuickCaptureError(getErrorMessage(error));
      }
    },
    [createTask],
  );

  const taskViewState =
    activeView === "board"
      ? {
          tasks: allTasks,
          isLoading: isLoadingAllTasks,
          isError: isAllTasksError,
          error: allTasksError,
          refetch: refetchAllTasks,
        }
      : activeView === "today"
        ? {
            tasks: todayTasks,
            isLoading: isLoadingTodayTasks,
            isError: isTodayTasksError,
            error: todayTasksError,
            refetch: refetchTodayTasks,
          }
        : activeView === "upcoming"
          ? {
              tasks: upcomingTasks,
              isLoading: isLoadingUpcomingTasks,
              isError: isUpcomingTasksError,
              error: upcomingTasksError,
              refetch: refetchUpcomingTasks,
            }
          : null;

  const filteredTaskViewTasks = useMemo(() => {
    if (!taskViewState) return [];
    return applyTaskFilters(taskViewState.tasks, filters);
  }, [taskViewState, filters]);

  const availableProjects = useMemo(
    () => projects.map((project) => ({ id: project.id, name: project.name })),
    [projects],
  );
  const projectNameById = useMemo(() => {
    return Object.fromEntries(
      projects.map((project) => [project.id, project.name]),
    ) as Record<string, string>;
  }, [projects]);

  const content = taskViewState?.isLoading ? (
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
  ) : taskViewState?.isError ? (
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
        style={{
          fontSize: 16,
          marginBottom: 6,
          color: "var(--text-primary)",
        }}
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
        {getErrorMessage(taskViewState.error)}
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
        onClick={() => void taskViewState?.refetch()}
      >
        Retry
      </button>
    </div>
  ) : activeView === "board" ? (
    <TaskBoard
      tasks={filteredTaskViewTasks}
      projectNameById={projectNameById}
      onEdit={handleEditTask}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onCreateClick={() => openCreateModal(null)}
    />
  ) : activeView === "today" || activeView === "upcoming" ? (
    <TaskScheduleView
      view={activeView}
      tasks={filteredTaskViewTasks}
      projectNameById={projectNameById}
      onEdit={handleEditTask}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onCreateClick={() => openCreateModal(null)}
    />
  ) : activeView === "projects" ? (
    <ProjectView
      tasks={allTasks}
      projectNameById={projectNameById}
      isLoadingTasks={isLoadingAllTasks}
      isTasksError={isAllTasksError}
      tasksError={allTasksError}
      onEdit={handleEditTask}
      onStatusChange={handleStatusChange}
      onDelete={handleDelete}
      onCreateClick={openCreateModal}
    />
  ) : activeView === "calendar" ? (
    isLoadingAllTasks ? (
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
    ) : isAllTasksError ? (
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
          style={{
            fontSize: 16,
            marginBottom: 6,
            color: "var(--text-primary)",
          }}
        >
          Failed to load calendar
        </h2>
        <p
          style={{
            fontSize: 13,
            marginBottom: 12,
            color: "var(--text-secondary)",
          }}
        >
          {getErrorMessage(allTasksError)}
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
          onClick={() => void refetchAllTasks()}
        >
          Retry
        </button>
      </div>
    ) : (
      <CalendarView
        tasks={allTasks}
        projectNameById={projectNameById}
        onEdit={handleEditTask}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onCreateClick={() => openCreateModal(null)}
      />
    )
  ) : activeView === "settings" ? (
    <ReminderSettings
      remindersEnabled={remindersEnabled}
      onRemindersEnabledChange={handleRemindersEnabledChange}
    />
  ) : (
    <Dashboard />
  );

  return (
    <AppShell onCreateClick={() => openCreateModal(null)}>
      {taskViewState && !taskViewState.isLoading && !taskViewState.isError && (
        <TaskFiltersBar
          filters={filters}
          availableProjects={availableProjects}
          savedViews={savedViews}
          activeSavedViewId={activeSavedViewId}
          hasActiveFilters={hasActiveFilters}
          visibleTasks={filteredTaskViewTasks.length}
          totalTasks={taskViewState.tasks.length}
          onSearchChange={setSearch}
          onToggleProject={toggleProject}
          onToggleStatus={toggleStatus}
          onTogglePriority={togglePriority}
          onSetImportantOnly={setImportantOnly}
          onSetDueFilter={setDueFilter}
          onSetSortBy={setSortBy}
          onClearFilters={clearFilters}
          onSaveCurrentView={saveCurrentFiltersAsView}
          onApplySavedView={applySavedView}
          onDeleteSavedView={deleteSavedView}
        />
      )}
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

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        activeView={activeView}
        tasks={allTasks}
        onClose={closeCommandPalette}
        onOpenCreate={() => openCreateModal(null)}
        onOpenQuickCapture={openQuickCapture}
        onEditTask={handleEditTask}
        onChangeTaskStatus={handleStatusChange}
        onChangeView={setActiveView}
      />

      {isQuickCaptureOpen && (
        <QuickCapture
          isSubmitting={createTask.isPending}
          error={quickCaptureError}
          onSubmit={handleQuickCaptureCreate}
          onClose={closeQuickCapture}
        />
      )}

      {/* Create Task Modal */}
      {isCreateOpen && (
        <TaskForm
          initialProjectId={createModalProjectId}
          onSubmit={handleCreate}
          onClose={() => {
            setIsCreateOpen(false);
            setCreateModalProjectId(null);
          }}
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

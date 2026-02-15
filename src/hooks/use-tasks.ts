import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllTasks,
  getTodayTasks,
  getUpcomingTasks,
  createTask,
  updateTask,
  deleteTask,
  getTaskTemplates,
  upsertTaskTemplate,
  deleteTaskTemplate,
  getTaskDashboardStats,
  getTaskChangelogs,
} from "@/lib/database";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  UpsertTaskTemplateInput,
} from "@/lib/types";

const TASKS_KEY = ["tasks"] as const;
const TODAY_TASKS_KEY = ["tasks", "today"] as const;
const UPCOMING_TASKS_KEY = ["tasks", "upcoming"] as const;
const STATS_KEY = ["task-stats"] as const;
const CHANGELOGS_KEY = ["task-changelogs"] as const;
const TASK_TEMPLATES_KEY = ["task-templates"] as const;

/** Fetch all tasks */
export function useTasks() {
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: getAllTasks,
  });
}

/** Fetch open tasks due today or overdue */
export function useTodayTasks() {
  return useQuery({
    queryKey: TODAY_TASKS_KEY,
    queryFn: () => getTodayTasks(),
  });
}

/** Fetch open tasks due in the next 7 days (excluding today) */
export function useUpcomingTasks() {
  return useQuery({
    queryKey: UPCOMING_TASKS_KEY,
    queryFn: () => getUpcomingTasks(7),
  });
}

/** Fetch task stats (counts by status) */
export function useTaskStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: () => getTaskDashboardStats(),
  });
}

/** Fetch changelog history for a specific task */
export function useTaskChangelogs(taskId?: string) {
  return useQuery({
    queryKey: [...CHANGELOGS_KEY, taskId],
    queryFn: () => getTaskChangelogs(taskId as string),
    enabled: Boolean(taskId),
  });
}

/** Create a new task */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
    },
  });
}

/** Update an existing task */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
    },
  });
}

/** Delete a task */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      queryClient.invalidateQueries({ queryKey: CHANGELOGS_KEY });
    },
  });
}

/** Fetch reusable task templates */
export function useTaskTemplates(enabled = true) {
  return useQuery({
    queryKey: TASK_TEMPLATES_KEY,
    queryFn: getTaskTemplates,
    enabled,
  });
}

/** Create or update a task template */
export function useUpsertTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertTaskTemplateInput) => upsertTaskTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_TEMPLATES_KEY });
    },
  });
}

/** Delete a task template */
export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTaskTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_TEMPLATES_KEY });
    },
  });
}

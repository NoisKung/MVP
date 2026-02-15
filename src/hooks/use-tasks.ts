import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllTasks,
  getProjects,
  getTodayTasks,
  getUpcomingTasks,
  createProject,
  createTask,
  updateProject,
  updateTask,
  deleteProject,
  deleteTask,
  getTaskSubtasks,
  getTaskSubtaskStats,
  createTaskSubtask,
  updateTaskSubtask,
  deleteTaskSubtask,
  getTaskTemplates,
  upsertTaskTemplate,
  deleteTaskTemplate,
  getTaskDashboardStats,
  getTaskChangelogs,
} from "@/lib/database";
import type {
  CreateProjectInput,
  CreateTaskInput,
  CreateTaskSubtaskInput,
  UpdateProjectInput,
  UpdateTaskSubtaskInput,
  UpdateTaskInput,
  UpsertTaskTemplateInput,
} from "@/lib/types";

const TASKS_KEY = ["tasks"] as const;
const TODAY_TASKS_KEY = ["tasks", "today"] as const;
const UPCOMING_TASKS_KEY = ["tasks", "upcoming"] as const;
const STATS_KEY = ["task-stats"] as const;
const CHANGELOGS_KEY = ["task-changelogs"] as const;
const TASK_SUBTASKS_KEY = ["task-subtasks"] as const;
const TASK_SUBTASK_STATS_KEY = ["task-subtask-stats"] as const;
const TASK_TEMPLATES_KEY = ["task-templates"] as const;
const PROJECTS_KEY = ["projects"] as const;

/** Fetch all active/completed projects */
export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: getProjects,
  });
}

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

/** Fetch checklist items for a specific task */
export function useTaskSubtasks(taskId?: string, enabled = true) {
  return useQuery({
    queryKey: [...TASK_SUBTASKS_KEY, taskId],
    queryFn: () => getTaskSubtasks(taskId as string),
    enabled: Boolean(taskId) && enabled,
  });
}

/** Fetch checklist progress stats for a task list */
export function useTaskSubtaskStats(taskIds: string[], enabled = true) {
  const normalizedTaskIds = Array.from(
    new Set(taskIds.map((taskId) => taskId.trim()).filter(Boolean)),
  ).sort();

  return useQuery({
    queryKey: [...TASK_SUBTASK_STATS_KEY, normalizedTaskIds.join(",")],
    queryFn: () => getTaskSubtaskStats(normalizedTaskIds),
    enabled: enabled && normalizedTaskIds.length > 0,
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
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Create a new project */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

/** Update an existing project */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

/** Delete a project */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: UPCOMING_TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
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
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
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
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASKS_KEY });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Create a checklist item */
export function useCreateTaskSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskSubtaskInput) => createTaskSubtask(input),
    onSuccess: (subtask) => {
      queryClient.invalidateQueries({
        queryKey: [...TASK_SUBTASKS_KEY, subtask.task_id],
      });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Update a checklist item */
export function useUpdateTaskSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTaskSubtaskInput) => updateTaskSubtask(input),
    onSuccess: (subtask) => {
      queryClient.invalidateQueries({
        queryKey: [...TASK_SUBTASKS_KEY, subtask.task_id],
      });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
    },
  });
}

/** Delete a checklist item */
export function useDeleteTaskSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; taskId: string }) => {
      await deleteTaskSubtask(input.id);
      return input;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({
        queryKey: [...TASK_SUBTASKS_KEY, payload.taskId],
      });
      queryClient.invalidateQueries({ queryKey: TASK_SUBTASK_STATS_KEY });
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

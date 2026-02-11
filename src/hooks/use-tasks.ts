import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllTasks, createTask, updateTask, deleteTask, getTaskStats } from "@/lib/database";
import type { CreateTaskInput, UpdateTaskInput } from "@/lib/types";

const TASKS_KEY = ["tasks"] as const;
const STATS_KEY = ["task-stats"] as const;

/** Fetch all tasks */
export function useTasks() {
    return useQuery({
        queryKey: TASKS_KEY,
        queryFn: getAllTasks,
    });
}

/** Fetch task stats (counts by status) */
export function useTaskStats() {
    return useQuery({
        queryKey: STATS_KEY,
        queryFn: getTaskStats,
    });
}

/** Create a new task */
export function useCreateTask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateTaskInput) => createTask(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TASKS_KEY });
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
            queryClient.invalidateQueries({ queryKey: STATS_KEY });
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
            queryClient.invalidateQueries({ queryKey: STATS_KEY });
        },
    });
}

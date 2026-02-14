import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SavedTaskView,
  TaskDueFilter,
  TaskFilterState,
  TaskPriority,
  TaskSortBy,
  TaskStatus,
} from "@/lib/types";
import {
  DEFAULT_TASK_FILTERS,
  loadSavedTaskViewsFromStorage,
  loadTaskFiltersFromStorage,
  normalizeTaskFilters,
  saveSavedTaskViewsToStorage,
  saveTaskFiltersToStorage,
} from "@/lib/task-filters";

function createSavedViewId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `saved-view-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function hasFiltersApplied(filters: TaskFilterState): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.importantOnly ||
    filters.dueFilter !== "ALL" ||
    filters.sortBy !== DEFAULT_TASK_FILTERS.sortBy
  );
}

interface UseTaskFiltersResult {
  filters: TaskFilterState;
  savedViews: SavedTaskView[];
  activeSavedViewId: string | null;
  hasActiveFilters: boolean;
  setSearch: (search: string) => void;
  toggleStatus: (status: TaskStatus) => void;
  togglePriority: (priority: TaskPriority) => void;
  setImportantOnly: (importantOnly: boolean) => void;
  setDueFilter: (dueFilter: TaskDueFilter) => void;
  setSortBy: (sortBy: TaskSortBy) => void;
  clearFilters: () => void;
  saveCurrentFiltersAsView: (name: string) => SavedTaskView | null;
  applySavedView: (savedViewId: string) => void;
  deleteSavedView: (savedViewId: string) => void;
}

export function useTaskFilters(): UseTaskFiltersResult {
  const [filters, setFilters] = useState<TaskFilterState>(() =>
    loadTaskFiltersFromStorage(),
  );
  const [savedViews, setSavedViews] = useState<SavedTaskView[]>(() =>
    loadSavedTaskViewsFromStorage(),
  );
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    saveTaskFiltersToStorage(filters);
  }, [filters]);

  useEffect(() => {
    saveSavedTaskViewsToStorage(savedViews);
  }, [savedViews]);

  const setSearch = useCallback((search: string) => {
    setFilters((prevFilters) => ({ ...prevFilters, search }));
    setActiveSavedViewId(null);
  }, []);

  const toggleStatus = useCallback((status: TaskStatus) => {
    setFilters((prevFilters) => {
      const hasStatus = prevFilters.statuses.includes(status);
      const nextStatuses = hasStatus
        ? prevFilters.statuses.filter((item) => item !== status)
        : [...prevFilters.statuses, status];
      return { ...prevFilters, statuses: nextStatuses };
    });
    setActiveSavedViewId(null);
  }, []);

  const togglePriority = useCallback((priority: TaskPriority) => {
    setFilters((prevFilters) => {
      const hasPriority = prevFilters.priorities.includes(priority);
      const nextPriorities = hasPriority
        ? prevFilters.priorities.filter((item) => item !== priority)
        : [...prevFilters.priorities, priority];
      return { ...prevFilters, priorities: nextPriorities };
    });
    setActiveSavedViewId(null);
  }, []);

  const setImportantOnly = useCallback((importantOnly: boolean) => {
    setFilters((prevFilters) => ({ ...prevFilters, importantOnly }));
    setActiveSavedViewId(null);
  }, []);

  const setDueFilter = useCallback((dueFilter: TaskDueFilter) => {
    setFilters((prevFilters) => ({ ...prevFilters, dueFilter }));
    setActiveSavedViewId(null);
  }, []);

  const setSortBy = useCallback((sortBy: TaskSortBy) => {
    setFilters((prevFilters) => ({ ...prevFilters, sortBy }));
    setActiveSavedViewId(null);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_TASK_FILTERS });
    setActiveSavedViewId(null);
  }, []);

  const saveCurrentFiltersAsView = useCallback(
    (name: string): SavedTaskView | null => {
      const normalizedName = name.trim();
      if (!normalizedName) return null;

      const nowIso = new Date().toISOString();
      const normalizedFilters = normalizeTaskFilters(filters);

      const existingView = savedViews.find(
        (savedView) =>
          savedView.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      );

      if (existingView) {
        const updatedView: SavedTaskView = {
          ...existingView,
          name: normalizedName,
          filters: normalizedFilters,
          updated_at: nowIso,
        };

        setSavedViews((prevViews) =>
          prevViews.map((savedView) =>
            savedView.id === existingView.id ? updatedView : savedView,
          ),
        );
        setActiveSavedViewId(existingView.id);
        return updatedView;
      }

      const newSavedView: SavedTaskView = {
        id: createSavedViewId(),
        name: normalizedName,
        filters: normalizedFilters,
        created_at: nowIso,
        updated_at: nowIso,
      };

      setSavedViews((prevViews) => [newSavedView, ...prevViews]);
      setActiveSavedViewId(newSavedView.id);
      return newSavedView;
    },
    [filters, savedViews],
  );

  const applySavedView = useCallback(
    (savedViewId: string) => {
      const targetView = savedViews.find(
        (savedView) => savedView.id === savedViewId,
      );
      if (!targetView) return;

      setFilters(normalizeTaskFilters(targetView.filters));
      setActiveSavedViewId(savedViewId);
    },
    [savedViews],
  );

  const deleteSavedView = useCallback((savedViewId: string) => {
    setSavedViews((prevViews) =>
      prevViews.filter((savedView) => savedView.id !== savedViewId),
    );
    setActiveSavedViewId((prevId) => (prevId === savedViewId ? null : prevId));
  }, []);

  const hasActiveFilters = useMemo(() => hasFiltersApplied(filters), [filters]);

  return {
    filters,
    savedViews,
    activeSavedViewId,
    hasActiveFilters,
    setSearch,
    toggleStatus,
    togglePriority,
    setImportantOnly,
    setDueFilter,
    setSortBy,
    clearFilters,
    saveCurrentFiltersAsView,
    applySavedView,
    deleteSavedView,
  };
}

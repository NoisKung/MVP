import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SavedTaskView,
  TaskDueFilter,
  TaskFilterState,
  TaskPriority,
  TaskSortBy,
  TaskSortableView,
  TaskStatus,
  TaskViewFilterPreferences,
  ViewMode,
} from "@/lib/types";
import {
  DEFAULT_TASK_VIEW_FILTERS,
  loadSavedTaskViewsFromStorage,
  loadTaskViewFiltersFromStorage,
  normalizeTaskFilters,
  saveSavedTaskViewsToStorage,
  saveTaskViewFiltersToStorage,
} from "@/lib/task-filters";

function createSavedViewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `saved-view-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function toSortableView(view: ViewMode): TaskSortableView | null {
  if (view === "board" || view === "today" || view === "upcoming") return view;
  return null;
}

function hasFiltersApplied(
  filters: TaskFilterState,
  defaultFilters: TaskFilterState,
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.importantOnly ||
    filters.dueFilter !== defaultFilters.dueFilter ||
    filters.sortBy !== defaultFilters.sortBy
  );
}

type ActiveSavedViewIds = Record<TaskSortableView, string | null>;

const INITIAL_ACTIVE_SAVED_VIEW_IDS: ActiveSavedViewIds = {
  board: null,
  today: null,
  upcoming: null,
};

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

export function useTaskFilters(activeView: ViewMode): UseTaskFiltersResult {
  const currentSortableView = toSortableView(activeView);

  const [viewFilters, setViewFilters] = useState<TaskViewFilterPreferences>(() =>
    loadTaskViewFiltersFromStorage(),
  );
  const [savedViews, setSavedViews] = useState<SavedTaskView[]>(() =>
    loadSavedTaskViewsFromStorage(),
  );
  const [activeSavedViewIds, setActiveSavedViewIds] = useState<ActiveSavedViewIds>(
    INITIAL_ACTIVE_SAVED_VIEW_IDS,
  );

  useEffect(() => {
    saveTaskViewFiltersToStorage(viewFilters);
  }, [viewFilters]);

  useEffect(() => {
    saveSavedTaskViewsToStorage(savedViews);
  }, [savedViews]);

  const filters = useMemo<TaskFilterState>(() => {
    if (!currentSortableView) {
      return { ...DEFAULT_TASK_VIEW_FILTERS.board };
    }
    return viewFilters[currentSortableView];
  }, [currentSortableView, viewFilters]);

  const currentDefaultFilters = currentSortableView
    ? DEFAULT_TASK_VIEW_FILTERS[currentSortableView]
    : DEFAULT_TASK_VIEW_FILTERS.board;

  const hasActiveFilters = useMemo(
    () => hasFiltersApplied(filters, currentDefaultFilters),
    [filters, currentDefaultFilters],
  );

  const currentViewSavedViews = useMemo(() => {
    if (!currentSortableView) return [];
    return savedViews.filter((savedView) => savedView.scope === currentSortableView);
  }, [currentSortableView, savedViews]);

  const activeSavedViewId = currentSortableView
    ? activeSavedViewIds[currentSortableView]
    : null;

  const updateCurrentFilters = useCallback(
    (updater: (filters: TaskFilterState) => TaskFilterState) => {
      if (!currentSortableView) return;

      setViewFilters((prevFilters) => {
        const updatedFilters = normalizeTaskFilters(
          updater(prevFilters[currentSortableView]),
        );
        return { ...prevFilters, [currentSortableView]: updatedFilters };
      });
      setActiveSavedViewIds((prevIds) => ({
        ...prevIds,
        [currentSortableView]: null,
      }));
    },
    [currentSortableView],
  );

  const setSearch = useCallback(
    (search: string) => {
      updateCurrentFilters((prevFilters) => ({ ...prevFilters, search }));
    },
    [updateCurrentFilters],
  );

  const toggleStatus = useCallback(
    (status: TaskStatus) => {
      updateCurrentFilters((prevFilters) => {
        const hasStatus = prevFilters.statuses.includes(status);
        const nextStatuses = hasStatus
          ? prevFilters.statuses.filter((item) => item !== status)
          : [...prevFilters.statuses, status];
        return { ...prevFilters, statuses: nextStatuses };
      });
    },
    [updateCurrentFilters],
  );

  const togglePriority = useCallback(
    (priority: TaskPriority) => {
      updateCurrentFilters((prevFilters) => {
        const hasPriority = prevFilters.priorities.includes(priority);
        const nextPriorities = hasPriority
          ? prevFilters.priorities.filter((item) => item !== priority)
          : [...prevFilters.priorities, priority];
        return { ...prevFilters, priorities: nextPriorities };
      });
    },
    [updateCurrentFilters],
  );

  const setImportantOnly = useCallback(
    (importantOnly: boolean) => {
      updateCurrentFilters((prevFilters) => ({ ...prevFilters, importantOnly }));
    },
    [updateCurrentFilters],
  );

  const setDueFilter = useCallback(
    (dueFilter: TaskDueFilter) => {
      updateCurrentFilters((prevFilters) => ({ ...prevFilters, dueFilter }));
    },
    [updateCurrentFilters],
  );

  const setSortBy = useCallback(
    (sortBy: TaskSortBy) => {
      updateCurrentFilters((prevFilters) => ({ ...prevFilters, sortBy }));
    },
    [updateCurrentFilters],
  );

  const clearFilters = useCallback(() => {
    if (!currentSortableView) return;

    setViewFilters((prevFilters) => ({
      ...prevFilters,
      [currentSortableView]: { ...DEFAULT_TASK_VIEW_FILTERS[currentSortableView] },
    }));
    setActiveSavedViewIds((prevIds) => ({
      ...prevIds,
      [currentSortableView]: null,
    }));
  }, [currentSortableView]);

  const saveCurrentFiltersAsView = useCallback(
    (name: string): SavedTaskView | null => {
      if (!currentSortableView) return null;

      const normalizedName = name.trim();
      if (!normalizedName) return null;

      const nowIso = new Date().toISOString();
      const normalizedFilters = normalizeTaskFilters(viewFilters[currentSortableView]);

      const existingView = savedViews.find(
        (savedView) =>
          savedView.scope === currentSortableView &&
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
        setActiveSavedViewIds((prevIds) => ({
          ...prevIds,
          [currentSortableView]: existingView.id,
        }));
        return updatedView;
      }

      const newSavedView: SavedTaskView = {
        id: createSavedViewId(),
        name: normalizedName,
        scope: currentSortableView,
        filters: normalizedFilters,
        created_at: nowIso,
        updated_at: nowIso,
      };

      setSavedViews((prevViews) => [newSavedView, ...prevViews]);
      setActiveSavedViewIds((prevIds) => ({
        ...prevIds,
        [currentSortableView]: newSavedView.id,
      }));
      return newSavedView;
    },
    [currentSortableView, savedViews, viewFilters],
  );

  const applySavedView = useCallback(
    (savedViewId: string) => {
      if (!currentSortableView) return;

      const targetView = savedViews.find(
        (savedView) =>
          savedView.id === savedViewId && savedView.scope === currentSortableView,
      );
      if (!targetView) return;

      setViewFilters((prevFilters) => ({
        ...prevFilters,
        [currentSortableView]: normalizeTaskFilters(targetView.filters),
      }));
      setActiveSavedViewIds((prevIds) => ({
        ...prevIds,
        [currentSortableView]: savedViewId,
      }));
    },
    [currentSortableView, savedViews],
  );

  const deleteSavedView = useCallback((savedViewId: string) => {
    setSavedViews((prevViews) =>
      prevViews.filter((savedView) => savedView.id !== savedViewId),
    );
    setActiveSavedViewIds((prevIds) => ({
      board: prevIds.board === savedViewId ? null : prevIds.board,
      today: prevIds.today === savedViewId ? null : prevIds.today,
      upcoming: prevIds.upcoming === savedViewId ? null : prevIds.upcoming,
    }));
  }, []);

  return {
    filters,
    savedViews: currentViewSavedViews,
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

import { act, renderHook } from "@testing-library/react";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { DEFAULT_TASK_VIEW_FILTERS } from "@/lib/task-filters";
import type { SavedTaskView, ViewMode } from "@/lib/types";

describe("useTaskFilters", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("manages filters for sortable views", () => {
    const { result } = renderHook(({ view }) => useTaskFilters(view), {
      initialProps: { view: "board" as ViewMode },
    });

    act(() => {
      result.current.setSearch("  focus");
      result.current.toggleProject("p1");
      result.current.toggleStatus("TODO");
      result.current.togglePriority("URGENT");
      result.current.setImportantOnly(true);
      result.current.setDueFilter("TODAY");
      result.current.setSortBy("DUE_ASC");
    });

    expect(result.current.filters.search).toBe("focus");
    expect(result.current.filters.projectIds).toEqual(["p1"]);
    expect(result.current.filters.statuses).toEqual(["TODO"]);
    expect(result.current.filters.priorities).toEqual(["URGENT"]);
    expect(result.current.filters.importantOnly).toBe(true);
    expect(result.current.filters.dueFilter).toBe("TODAY");
    expect(result.current.filters.sortBy).toBe("DUE_ASC");
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.toggleProject("p1");
      result.current.toggleStatus("TODO");
      result.current.togglePriority("URGENT");
    });
    expect(result.current.filters.projectIds).toEqual([]);
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.filters.priorities).toEqual([]);
  });

  it("saves, updates, applies, and deletes saved views", () => {
    const { result } = renderHook(() => useTaskFilters("board"));

    act(() => {
      result.current.setSearch("urgent only");
      result.current.setDueFilter("OVERDUE");
    });

    let savedView: SavedTaskView | null = null;
    act(() => {
      savedView = result.current.saveCurrentFiltersAsView("Hot Queue");
    });
    expect(savedView).not.toBeNull();
    expect(result.current.savedViews).toHaveLength(1);
    expect(result.current.activeSavedViewId).toBe(savedView?.id ?? null);

    act(() => {
      result.current.setSearch("changed");
    });
    expect(result.current.activeSavedViewId).toBeNull();

    act(() => {
      result.current.applySavedView(savedView?.id ?? "");
    });
    expect(result.current.filters.search).toBe("urgent only");
    expect(result.current.filters.dueFilter).toBe("OVERDUE");

    act(() => {
      result.current.saveCurrentFiltersAsView("hot queue");
    });
    expect(result.current.savedViews).toHaveLength(1);

    act(() => {
      result.current.deleteSavedView(savedView?.id ?? "");
    });
    expect(result.current.savedViews).toHaveLength(0);
    expect(result.current.activeSavedViewId).toBeNull();
  });

  it("clears filters back to defaults", () => {
    const { result } = renderHook(() => useTaskFilters("today"));

    act(() => {
      result.current.setSearch("abc");
      result.current.togglePriority("LOW");
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual(DEFAULT_TASK_VIEW_FILTERS.today);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("keeps independent state per sortable view", () => {
    const { result, rerender } = renderHook(
      ({ view }) => useTaskFilters(view),
      { initialProps: { view: "board" as ViewMode } },
    );

    act(() => {
      result.current.setSearch("board-search");
    });
    expect(result.current.filters.search).toBe("board-search");

    rerender({ view: "upcoming" });
    expect(result.current.filters.search).toBe("");
    act(() => {
      result.current.setSearch("upcoming-search");
    });
    expect(result.current.filters.search).toBe("upcoming-search");

    rerender({ view: "board" });
    expect(result.current.filters.search).toBe("board-search");
  });

  it("returns defaults and no-op mutations for non-sortable views", () => {
    const { result } = renderHook(() => useTaskFilters("dashboard"));

    const initialFilters = result.current.filters;
    act(() => {
      result.current.setSearch("ignored");
      result.current.toggleProject("p1");
      result.current.toggleStatus("TODO");
      result.current.togglePriority("URGENT");
      result.current.setImportantOnly(true);
      result.current.setDueFilter("TODAY");
      result.current.setSortBy("TITLE_ASC");
      result.current.clearFilters();
      result.current.applySavedView("missing");
      result.current.deleteSavedView("missing");
    });

    expect(result.current.filters).toEqual(initialFilters);
    expect(result.current.filters).toEqual(DEFAULT_TASK_VIEW_FILTERS.board);
    expect(result.current.savedViews).toEqual([]);
    expect(result.current.activeSavedViewId).toBeNull();
    expect(result.current.saveCurrentFiltersAsView("x")).toBeNull();
  });

  it("handles empty names, missing saved views and id fallback without crypto", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useTaskFilters("board"));

    act(() => {
      result.current.setSearch("fallback-id-test");
    });
    expect(result.current.saveCurrentFiltersAsView("   ")).toBeNull();

    act(() => {
      result.current.applySavedView("missing-id");
    });
    expect(result.current.filters.search).toBe("fallback-id-test");

    let saved = null;
    act(() => {
      saved = result.current.saveCurrentFiltersAsView("Fallback Id");
    });
    expect(saved).not.toBeNull();
    expect(saved?.id.startsWith("saved-view-")).toBe(true);

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("updates one saved view among many and clears today/upcoming active ids on delete", () => {
    const { result, rerender } = renderHook(
      ({ view }) => useTaskFilters(view),
      { initialProps: { view: "board" as ViewMode } },
    );

    let boardViewA: SavedTaskView | null = null;
    let boardViewB: SavedTaskView | null = null;

    act(() => {
      result.current.setSearch("alpha");
    });
    act(() => {
      boardViewA = result.current.saveCurrentFiltersAsView("A");
    });
    act(() => {
      result.current.setSearch("beta");
    });
    act(() => {
      boardViewB = result.current.saveCurrentFiltersAsView("B");
    });
    act(() => {
      result.current.setSearch("alpha-updated");
    });
    act(() => {
      result.current.saveCurrentFiltersAsView("A");
    });
    expect(result.current.savedViews).toHaveLength(2);
    expect(boardViewA).not.toBeNull();
    expect(boardViewB).not.toBeNull();

    rerender({ view: "today" });
    let todayView: SavedTaskView | null = null;
    act(() => {
      result.current.setSearch("today-only");
      todayView = result.current.saveCurrentFiltersAsView("Today");
    });
    expect(result.current.activeSavedViewId).toBe(todayView?.id ?? null);
    act(() => {
      result.current.deleteSavedView(todayView?.id ?? "");
    });
    expect(result.current.activeSavedViewId).toBeNull();

    rerender({ view: "upcoming" });
    let upcomingView: SavedTaskView | null = null;
    act(() => {
      result.current.setSearch("upcoming-only");
      upcomingView = result.current.saveCurrentFiltersAsView("Upcoming");
    });
    expect(result.current.activeSavedViewId).toBe(upcomingView?.id ?? null);
    act(() => {
      result.current.deleteSavedView(upcomingView?.id ?? "");
    });
    expect(result.current.activeSavedViewId).toBeNull();
  });
});

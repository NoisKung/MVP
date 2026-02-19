import { useEffect, useRef, useState } from "react";
import type {
  SavedTaskView,
  TaskDueFilter,
  TaskFilterState,
  TaskPriority,
  TaskSortBy,
  TaskStatus,
} from "@/lib/types";
import {
  BookmarkPlus,
  ChevronDown,
  FilterX,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "TODO", label: "To Do" },
  { value: "DOING", label: "In Progress" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "URGENT", label: "Urgent" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];

const DUE_FILTER_OPTIONS: Array<{ value: TaskDueFilter; label: string }> = [
  { value: "ALL", label: "All due" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "TODAY", label: "Today" },
  { value: "NEXT_7_DAYS", label: "Next 7 days" },
  { value: "NO_DUE", label: "No due date" },
];

const SORT_OPTIONS: Array<{ value: TaskSortBy; label: string }> = [
  { value: "CREATED_DESC", label: "Newest created" },
  { value: "UPDATED_DESC", label: "Recently updated" },
  { value: "DUE_ASC", label: "Due date (earliest)" },
  { value: "PRIORITY_DESC", label: "Priority (high to low)" },
  { value: "TITLE_ASC", label: "Title (A-Z)" },
];

interface TaskFiltersBarProps {
  filters: TaskFilterState;
  availableProjects: Array<{ id: string; name: string }>;
  savedViews: SavedTaskView[];
  activeSavedViewId: string | null;
  hasActiveFilters: boolean;
  visibleTasks: number;
  totalTasks: number;
  onSearchChange: (search: string) => void;
  onToggleProject: (projectId: string) => void;
  onToggleStatus: (status: TaskStatus) => void;
  onTogglePriority: (priority: TaskPriority) => void;
  onSetImportantOnly: (importantOnly: boolean) => void;
  onSetDueFilter: (dueFilter: TaskDueFilter) => void;
  onSetSortBy: (sortBy: TaskSortBy) => void;
  onClearFilters: () => void;
  onSaveCurrentView: (name: string) => SavedTaskView | null;
  onApplySavedView: (savedViewId: string) => void;
  onDeleteSavedView: (savedViewId: string) => void;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export function TaskFiltersBar({
  filters,
  availableProjects,
  savedViews,
  activeSavedViewId,
  hasActiveFilters,
  visibleTasks,
  totalTasks,
  onSearchChange,
  onToggleProject,
  onToggleStatus,
  onTogglePriority,
  onSetImportantOnly,
  onSetDueFilter,
  onSetSortBy,
  onClearFilters,
  onSaveCurrentView,
  onApplySavedView,
  onDeleteSavedView,
}: TaskFiltersBarProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    if (hasActiveFilters) {
      setIsFiltersOpen(true);
    }
  }, [hasActiveFilters]);

  const handleSaveViewClick = () => {
    const suggestedName =
      activeSavedViewId &&
      savedViews.find((savedView) => savedView.id === activeSavedViewId)?.name;
    const inputName = window.prompt(
      "Name this saved view",
      suggestedName ?? "My View",
    );
    if (!inputName) return;
    onSaveCurrentView(inputName);
  };
  const handleClearSearch = () => {
    onSearchChange("");
    searchInputRef.current?.focus();
  };

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableEventTarget(event.target)) return;

      event.preventDefault();
      const inputElement = searchInputRef.current;
      if (!inputElement) return;
      inputElement.focus();
      inputElement.select();
    };

    window.addEventListener("keydown", handleGlobalSearchShortcut);
    return () =>
      window.removeEventListener("keydown", handleGlobalSearchShortcut);
  }, []);

  return (
    <div className="filters-wrap">
      <div className="filters-top-row">
        <div className={`search-wrap${filters.search ? " has-value" : ""}`}>
          <Search size={14} className="search-icon" />
          <input
            ref={searchInputRef}
            className="search-input"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              if (filters.search.trim()) {
                onSearchChange("");
              } else {
                searchInputRef.current?.blur();
              }
            }}
            placeholder="Search title or description..."
          />
          {filters.search ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClearSearch}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="search-shortcut">/</kbd>
          )}
        </div>

        <div className="top-actions">
          <button
            type="button"
            className="filters-btn"
            onClick={handleSaveViewClick}
          >
            <BookmarkPlus size={13} />
            Save View
          </button>
          <button
            type="button"
            className="filters-btn"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
          >
            <FilterX size={13} />
            Clear
          </button>
        </div>
      </div>

      <div className="filters-summary-row">
        <button
          type="button"
          className={`filters-toggle-btn${isFiltersOpen ? " open" : ""}`}
          onClick={() => setIsFiltersOpen((open) => !open)}
          aria-expanded={isFiltersOpen}
          aria-controls="advanced-filters-panel"
        >
          <ChevronDown size={14} />
          {isFiltersOpen ? "Hide Filters" : "Show Filters"}
        </button>

        <span className="result-count">
          Showing {visibleTasks} / {totalTasks}
        </span>
      </div>

      {isFiltersOpen ? (
        <div id="advanced-filters-panel" className="filters-advanced">
          <div className="filters-row">
            <span className="filters-label">Project</span>
            <div className="chip-row">
              {availableProjects.length === 0 ? (
                <span className="saved-view-empty">
                  No projects available for filtering.
                </span>
              ) : (
                availableProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`filter-chip${filters.projectIds.includes(project.id) ? " active" : ""}`}
                    onClick={() => onToggleProject(project.id)}
                  >
                    {project.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="filters-row">
            <span className="filters-label">Status</span>
            <div className="chip-row">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`filter-chip${filters.statuses.includes(option.value) ? " active" : ""}`}
                  onClick={() => onToggleStatus(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filters-row">
            <span className="filters-label">Priority</span>
            <div className="chip-row">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`filter-chip${filters.priorities.includes(option.value) ? " active" : ""}`}
                  onClick={() => onTogglePriority(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filters-row">
            <span className="filters-label">Due</span>
            <select
              className="due-select"
              value={filters.dueFilter}
              onChange={(event) =>
                onSetDueFilter(event.target.value as TaskDueFilter)
              }
            >
              {DUE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <span className="filters-label inline-label">Sort</span>
            <select
              className="due-select"
              value={filters.sortBy}
              onChange={(event) =>
                onSetSortBy(event.target.value as TaskSortBy)
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`filter-chip important-chip${filters.importantOnly ? " active" : ""}`}
              onClick={() => onSetImportantOnly(!filters.importantOnly)}
            >
              <Star size={12} />
              Important
            </button>
          </div>

          <div className="saved-views-row">
            <span className="filters-label">Saved Views</span>
            <div className="saved-views-list">
              {savedViews.length === 0 ? (
                <span className="saved-view-empty">
                  Save your favorite filter combinations here.
                </span>
              ) : (
                savedViews.map((savedView) => (
                  <button
                    key={savedView.id}
                    type="button"
                    className={`saved-view-chip${activeSavedViewId === savedView.id ? " active" : ""}`}
                    onClick={() => onApplySavedView(savedView.id)}
                    title="Apply saved view"
                  >
                    <span className="saved-view-name">{savedView.name}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="saved-view-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteSavedView(savedView.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteSavedView(savedView.id);
                      }}
                    >
                      <Trash2 size={12} />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .filters-wrap {
          margin: 16px 24px 0;
          padding: 12px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .filters-top-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .filters-summary-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .search-wrap {
          flex: 1;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          background: var(--bg-elevated);
          color: var(--text-muted);
          padding: 0 10px;
          height: 36px;
          transition: border-color var(--duration) var(--ease),
            background var(--duration) var(--ease);
        }
        .search-wrap:focus-within {
          border-color: var(--border-focus);
          background: var(--bg-hover);
        }
        .search-icon {
          flex-shrink: 0;
          color: var(--text-disabled);
        }
        .search-wrap.has-value .search-icon {
          color: var(--text-muted);
        }
        .search-input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 13px;
          font-family: inherit;
        }
        .search-input::placeholder {
          color: var(--text-disabled);
        }
        .search-shortcut {
          border: 1px solid var(--border-default);
          border-radius: 6px;
          background: transparent;
          color: var(--text-disabled);
          font-size: 10px;
          font-family: inherit;
          font-weight: 600;
          padding: 1px 5px;
          line-height: 1.4;
          user-select: none;
        }
        .search-clear-btn {
          width: 20px;
          height: 20px;
          border: 1px solid var(--border-default);
          border-radius: 999px;
          background: transparent;
          color: var(--text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
          flex-shrink: 0;
        }
        .search-clear-btn:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
          background: var(--bg-hover);
        }

        .top-actions {
          display: inline-flex;
          gap: 8px;
        }
        .filters-btn {
          height: 34px;
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          padding: 0 12px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .filters-btn:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .filters-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .filters-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .filters-advanced {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-top: 2px;
        }
        .filters-label {
          width: 72px;
          flex-shrink: 0;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .filters-label.inline-label {
          width: auto;
          min-width: auto;
          margin-left: 6px;
        }
        .chip-row {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .filter-chip {
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          height: 28px;
          padding: 0 10px;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all var(--duration) var(--ease);
        }
        .filter-chip.active {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-subtle);
        }
        .due-select {
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          height: 30px;
          padding: 0 10px;
          font-size: 12px;
          font-family: inherit;
          outline: none;
        }
        .important-chip {
          margin-left: 2px;
        }
        .filters-toggle-btn {
          height: 30px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .filters-toggle-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .filters-toggle-btn svg {
          transition: transform var(--duration) var(--ease);
        }
        .filters-toggle-btn.open svg {
          transform: rotate(180deg);
        }
        .result-count {
          margin-left: auto;
          color: var(--text-muted);
          font-size: 11px;
          font-variant-numeric: tabular-nums;
          padding-right: 2px;
        }

        .saved-views-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .saved-views-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-height: 28px;
          align-items: center;
        }
        .saved-view-empty {
          color: var(--text-disabled);
          font-size: 11px;
        }
        .saved-view-chip {
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          height: 28px;
          padding: 0 6px 0 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .saved-view-chip.active {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-subtle);
        }
        .saved-view-name {
          font-size: 11px;
          font-weight: 600;
          max-width: 160px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .saved-view-delete {
          width: 18px;
          height: 18px;
          border-radius: var(--radius-full);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: inherit;
          opacity: 0.75;
        }
        .saved-view-delete:hover {
          opacity: 1;
          background: rgba(248, 113, 113, 0.12);
          color: var(--danger);
        }

        @media (max-width: 640px) {
          .filters-wrap {
            margin: 8px 10px 0;
            gap: 8px;
          }
          .filters-top-row {
            flex-direction: column;
            align-items: stretch;
          }
          .top-actions {
            display: flex;
          }
          .filters-summary-row {
            align-items: center;
          }
          .filters-btn {
            flex: 1;
            justify-content: center;
          }
          .search-shortcut {
            display: none;
          }
          .filters-label {
            width: auto;
            min-width: 100%;
          }
          .filters-label.inline-label {
            min-width: auto;
            margin-left: 0;
          }
          .result-count {
            margin-left: 0;
            width: 100%;
            padding-top: 2px;
          }
        }
      `}</style>
    </div>
  );
}

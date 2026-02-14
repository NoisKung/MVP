import type {
  SavedTaskView,
  TaskDueFilter,
  TaskFilterState,
  TaskPriority,
  TaskSortBy,
  TaskStatus,
} from "@/lib/types";
import { BookmarkPlus, FilterX, Search, Star, Trash2 } from "lucide-react";

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
  savedViews: SavedTaskView[];
  activeSavedViewId: string | null;
  hasActiveFilters: boolean;
  visibleTasks: number;
  totalTasks: number;
  onSearchChange: (search: string) => void;
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

export function TaskFiltersBar({
  filters,
  savedViews,
  activeSavedViewId,
  hasActiveFilters,
  visibleTasks,
  totalTasks,
  onSearchChange,
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

  return (
    <div className="filters-wrap">
      <div className="filters-top-row">
        <div className="search-wrap">
          <Search size={14} />
          <input
            className="search-input"
            value={filters.search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title or description..."
          />
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
          onChange={(event) => onSetSortBy(event.target.value as TaskSortBy)}
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

        <span className="result-count">
          Showing {visibleTasks} / {totalTasks}
        </span>
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
        .search-wrap {
          flex: 1;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-muted);
          padding: 0 10px;
          height: 34px;
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
          .filters-btn {
            flex: 1;
            justify-content: center;
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

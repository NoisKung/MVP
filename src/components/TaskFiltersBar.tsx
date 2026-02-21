import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type {
  SavedTaskView,
  TaskDueFilter,
  TaskFilterState,
  TaskPriority,
  TaskRecurrence,
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

const STATUS_OPTIONS: TaskStatus[] = ["TODO", "DOING", "DONE"];

const PRIORITY_OPTIONS: TaskPriority[] = ["URGENT", "NORMAL", "LOW"];
const RECURRENCE_OPTIONS: TaskRecurrence[] = [
  "NONE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
];

const DUE_FILTER_OPTIONS: TaskDueFilter[] = [
  "ALL",
  "OVERDUE",
  "TODAY",
  "NEXT_7_DAYS",
  "NO_DUE",
];

const SORT_OPTIONS: TaskSortBy[] = [
  "CREATED_DESC",
  "UPDATED_DESC",
  "DUE_ASC",
  "PRIORITY_DESC",
  "TITLE_ASC",
];

interface TaskFiltersBarProps {
  filters: TaskFilterState;
  availableProjects: Array<{ id: string; name: string }>;
  savedViews: SavedTaskView[];
  activeSavedViewId: string | null;
  hasActiveFilters: boolean;
  visibleTasks: number;
  totalTasks: number;
  selectedTaskCount: number;
  allVisibleSelected: boolean;
  bulkEditBusy: boolean;
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
  onToggleSelectAllVisible: () => void;
  onClearSelectedTasks: () => void;
  onBulkSetStatus: (status: TaskStatus) => void;
  onBulkSetPriority: (priority: TaskPriority) => void;
  onBulkSetProject: (projectId: string | null) => void;
  onBulkSetImportant: (important: boolean) => void;
  onBulkSetDueAt: (dueAt: string | null) => void;
  onBulkSetRemindAt: (remindAt: string | null) => void;
  onBulkSetRecurrence: (recurrence: TaskRecurrence) => void;
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
  selectedTaskCount,
  allVisibleSelected,
  bulkEditBusy,
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
  onToggleSelectAllVisible,
  onClearSelectedTasks,
  onBulkSetStatus,
  onBulkSetPriority,
  onBulkSetProject,
  onBulkSetImportant,
  onBulkSetDueAt,
  onBulkSetRemindAt,
  onBulkSetRecurrence,
}: TaskFiltersBarProps) {
  const { t } = useI18n();
  const getStatusLabel = (status: TaskStatus): string => {
    if (status === "TODO") return t("taskForm.status.todo");
    if (status === "DOING") return t("taskForm.status.doing");
    return t("taskForm.status.done");
  };
  const getPriorityLabel = (priority: TaskPriority): string => {
    if (priority === "URGENT") return t("taskForm.priority.urgent");
    if (priority === "LOW") return t("taskForm.priority.low");
    return t("taskForm.priority.normal");
  };
  const getRecurrenceLabel = (recurrence: TaskRecurrence): string => {
    if (recurrence === "DAILY") return t("taskForm.recurrence.daily");
    if (recurrence === "WEEKLY") return t("taskForm.recurrence.weekly");
    if (recurrence === "MONTHLY") return t("taskForm.recurrence.monthly");
    return t("taskForm.recurrence.none");
  };
  const getDueFilterLabel = (value: TaskDueFilter): string => {
    if (value === "ALL") return t("taskFilters.due.all");
    if (value === "OVERDUE") return t("taskFilters.due.overdue");
    if (value === "TODAY") return t("taskFilters.due.today");
    if (value === "NEXT_7_DAYS") return t("taskFilters.due.next7Days");
    return t("taskFilters.due.noDue");
  };
  const getSortLabel = (value: TaskSortBy): string => {
    if (value === "CREATED_DESC") {
      return t("taskFilters.sort.createdDesc");
    }
    if (value === "UPDATED_DESC") {
      return t("taskFilters.sort.updatedDesc");
    }
    if (value === "DUE_ASC") {
      return t("taskFilters.sort.dueAsc");
    }
    if (value === "PRIORITY_DESC") {
      return t("taskFilters.sort.priorityDesc");
    }
    return t("taskFilters.sort.titleAsc");
  };
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [bulkStatusDraft, setBulkStatusDraft] = useState<"" | TaskStatus>("");
  const [bulkPriorityDraft, setBulkPriorityDraft] = useState<"" | TaskPriority>(
    "",
  );
  const [bulkProjectDraft, setBulkProjectDraft] = useState("");
  const [bulkDueAtDraft, setBulkDueAtDraft] = useState("");
  const [bulkRemindAtDraft, setBulkRemindAtDraft] = useState("");
  const [bulkRecurrenceDraft, setBulkRecurrenceDraft] = useState<
    "" | TaskRecurrence
  >("");

  useEffect(() => {
    if (hasActiveFilters) {
      setIsFiltersOpen(true);
    }
  }, [hasActiveFilters]);
  useEffect(() => {
    if (selectedTaskCount > 0) return;
    setBulkStatusDraft("");
    setBulkPriorityDraft("");
    setBulkProjectDraft("");
    setBulkDueAtDraft("");
    setBulkRemindAtDraft("");
    setBulkRecurrenceDraft("");
  }, [selectedTaskCount]);

  const handleSaveViewClick = () => {
    const suggestedName =
      activeSavedViewId &&
      savedViews.find((savedView) => savedView.id === activeSavedViewId)?.name;
    const inputName = window.prompt(
      t("taskFilters.prompt.saveViewName"),
      suggestedName ?? t("taskFilters.prompt.defaultViewName"),
    );
    if (!inputName) return;
    onSaveCurrentView(inputName);
  };
  const handleClearSearch = () => {
    onSearchChange("");
    searchInputRef.current?.focus();
  };
  const toIsoDateTime = (value: string): string | null => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return null;
    const parsedDate = new Date(normalizedValue);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate.toISOString();
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
            placeholder={t("taskFilters.search.placeholder")}
          />
          {filters.search ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClearSearch}
              aria-label={t("taskFilters.search.clear")}
              title={t("taskFilters.search.clear")}
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
            onClick={onToggleSelectAllVisible}
            disabled={visibleTasks === 0 || bulkEditBusy}
          >
            {allVisibleSelected
              ? t("taskFilters.bulk.unselectShown")
              : t("taskFilters.bulk.selectShown")}
          </button>
          {selectedTaskCount > 0 && (
            <button
              type="button"
              className="filters-btn"
              onClick={onClearSelectedTasks}
              disabled={bulkEditBusy}
            >
              {t("taskFilters.bulk.clearSelected")}
            </button>
          )}
          <button
            type="button"
            className="filters-btn"
            onClick={handleSaveViewClick}
          >
            <BookmarkPlus size={13} />
            {t("taskFilters.action.saveView")}
          </button>
          <button
            type="button"
            className="filters-btn"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
          >
            <FilterX size={13} />
            {t("taskFilters.action.clear")}
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
          {isFiltersOpen
            ? t("taskFilters.action.hideFilters")
            : t("taskFilters.action.showFilters")}
        </button>

        <span className="result-count">
          {t("taskFilters.summary.showing", {
            shown: visibleTasks,
            total: totalTasks,
          })}
        </span>
        {selectedTaskCount > 0 && (
          <span className="selected-count-chip">
            {t("taskFilters.bulk.selectedCount", {
              count: selectedTaskCount,
            })}
          </span>
        )}
      </div>

      {selectedTaskCount > 0 && (
        <div className="bulk-edit-row">
          <span className="filters-label">{t("taskFilters.bulk.title")}</span>
          <div className="bulk-edit-controls">
            <select
              className="due-select"
              value={bulkStatusDraft}
              onChange={(event) => {
                const value = event.target.value as "" | TaskStatus;
                setBulkStatusDraft(value);
                if (!value) return;
                onBulkSetStatus(value);
                setBulkStatusDraft("");
              }}
              disabled={bulkEditBusy}
            >
              <option value="">
                {t("taskFilters.bulk.statusPlaceholder")}
              </option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getStatusLabel(option)}
                </option>
              ))}
            </select>
            <select
              className="due-select"
              value={bulkPriorityDraft}
              onChange={(event) => {
                const value = event.target.value as "" | TaskPriority;
                setBulkPriorityDraft(value);
                if (!value) return;
                onBulkSetPriority(value);
                setBulkPriorityDraft("");
              }}
              disabled={bulkEditBusy}
            >
              <option value="">
                {t("taskFilters.bulk.priorityPlaceholder")}
              </option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getPriorityLabel(option)}
                </option>
              ))}
            </select>
            <select
              className="due-select"
              value={bulkProjectDraft}
              onChange={(event) => {
                const value = event.target.value;
                setBulkProjectDraft(value);
                if (!value) return;
                onBulkSetProject(value === "__none__" ? null : value);
                setBulkProjectDraft("");
              }}
              disabled={bulkEditBusy}
            >
              <option value="">
                {t("taskFilters.bulk.projectPlaceholder")}
              </option>
              <option value="__none__">
                {t("taskFilters.bulk.projectClear")}
              </option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="filter-chip"
              onClick={() => onBulkSetImportant(true)}
              disabled={bulkEditBusy}
            >
              {t("taskFilters.bulk.markImportant")}
            </button>
            <button
              type="button"
              className="filter-chip"
              onClick={() => onBulkSetImportant(false)}
              disabled={bulkEditBusy}
            >
              {t("taskFilters.bulk.unmarkImportant")}
            </button>
            <input
              type="datetime-local"
              className="bulk-datetime-input"
              value={bulkDueAtDraft}
              onChange={(event) => setBulkDueAtDraft(event.target.value)}
              aria-label={t("taskFilters.bulk.duePlaceholder")}
              disabled={bulkEditBusy}
            />
            <button
              type="button"
              className="filter-chip"
              onClick={() => {
                const dueAtIso = toIsoDateTime(bulkDueAtDraft);
                if (!dueAtIso) return;
                onBulkSetDueAt(dueAtIso);
                setBulkDueAtDraft("");
              }}
              disabled={bulkEditBusy || !bulkDueAtDraft.trim()}
            >
              {t("taskFilters.bulk.setDue")}
            </button>
            <button
              type="button"
              className="filter-chip"
              onClick={() => onBulkSetDueAt(null)}
              disabled={bulkEditBusy}
            >
              {t("taskFilters.bulk.clearDue")}
            </button>
            <input
              type="datetime-local"
              className="bulk-datetime-input"
              value={bulkRemindAtDraft}
              onChange={(event) => setBulkRemindAtDraft(event.target.value)}
              aria-label={t("taskFilters.bulk.reminderPlaceholder")}
              disabled={bulkEditBusy}
            />
            <button
              type="button"
              className="filter-chip"
              onClick={() => {
                const remindAtIso = toIsoDateTime(bulkRemindAtDraft);
                if (!remindAtIso) return;
                onBulkSetRemindAt(remindAtIso);
                setBulkRemindAtDraft("");
              }}
              disabled={bulkEditBusy || !bulkRemindAtDraft.trim()}
            >
              {t("taskFilters.bulk.setReminder")}
            </button>
            <button
              type="button"
              className="filter-chip"
              onClick={() => onBulkSetRemindAt(null)}
              disabled={bulkEditBusy}
            >
              {t("taskFilters.bulk.clearReminder")}
            </button>
            <select
              className="due-select"
              value={bulkRecurrenceDraft}
              onChange={(event) => {
                const value = event.target.value as "" | TaskRecurrence;
                setBulkRecurrenceDraft(value);
                if (!value) return;
                onBulkSetRecurrence(value);
                setBulkRecurrenceDraft("");
              }}
              disabled={bulkEditBusy}
            >
              <option value="">
                {t("taskFilters.bulk.recurrencePlaceholder")}
              </option>
              {RECURRENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getRecurrenceLabel(option)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isFiltersOpen ? (
        <div id="advanced-filters-panel" className="filters-advanced">
          <div className="filters-row">
            <span className="filters-label">
              {t("taskFilters.label.project")}
            </span>
            <div className="chip-row">
              {availableProjects.length === 0 ? (
                <span className="saved-view-empty">
                  {t("taskFilters.empty.noProjects")}
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
            <span className="filters-label">
              {t("taskFilters.label.status")}
            </span>
            <div className="chip-row">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`filter-chip${filters.statuses.includes(option) ? " active" : ""}`}
                  onClick={() => onToggleStatus(option)}
                >
                  {getStatusLabel(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="filters-row">
            <span className="filters-label">
              {t("taskFilters.label.priority")}
            </span>
            <div className="chip-row">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`filter-chip${filters.priorities.includes(option) ? " active" : ""}`}
                  onClick={() => onTogglePriority(option)}
                >
                  {getPriorityLabel(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="filters-row">
            <span className="filters-label">{t("taskFilters.label.due")}</span>
            <select
              className="due-select"
              value={filters.dueFilter}
              onChange={(event) =>
                onSetDueFilter(event.target.value as TaskDueFilter)
              }
            >
              {DUE_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getDueFilterLabel(option)}
                </option>
              ))}
            </select>

            <span className="filters-label inline-label">
              {t("taskFilters.label.sort")}
            </span>
            <select
              className="due-select"
              value={filters.sortBy}
              onChange={(event) =>
                onSetSortBy(event.target.value as TaskSortBy)
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getSortLabel(option)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`filter-chip important-chip${filters.importantOnly ? " active" : ""}`}
              onClick={() => onSetImportantOnly(!filters.importantOnly)}
            >
              <Star size={12} />
              {t("taskFilters.label.important")}
            </button>
          </div>

          <div className="saved-views-row">
            <span className="filters-label">
              {t("taskFilters.label.savedViews")}
            </span>
            <div className="saved-views-list">
              {savedViews.length === 0 ? (
                <span className="saved-view-empty">
                  {t("taskFilters.empty.savedViews")}
                </span>
              ) : (
                savedViews.map((savedView) => (
                  <button
                    key={savedView.id}
                    type="button"
                    className={`saved-view-chip${activeSavedViewId === savedView.id ? " active" : ""}`}
                    onClick={() => onApplySavedView(savedView.id)}
                    title={t("taskFilters.savedView.applyTitle")}
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
          flex-wrap: wrap;
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
        .bulk-datetime-input {
          border: 1px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          height: 30px;
          padding: 0 8px;
          font-size: 12px;
          font-family: inherit;
          outline: none;
          min-width: 178px;
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
        .selected-count-chip {
          border: 1px solid var(--accent);
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          font-variant-numeric: tabular-nums;
        }
        .bulk-edit-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding-top: 2px;
        }
        .bulk-edit-controls {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
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
          .bulk-edit-row {
            flex-direction: column;
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

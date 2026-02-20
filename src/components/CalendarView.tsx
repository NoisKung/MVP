import { useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { useTaskSubtaskStats } from "@/hooks/use-tasks";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localizeErrorMessage } from "@/lib/error-message";

type CalendarMode = "month" | "week";

interface CalendarViewProps {
  tasks: Task[];
  projectNameById: Record<string, string>;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onCreateClick: () => void;
}

function atStartOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function atStartOfWeek(date: Date): Date {
  const start = atStartOfDay(date);
  const day = start.getDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offsetToMonday);
  return start;
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHeaderDate(date: Date, locale: "en" | "th"): string {
  return date.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDayLabel(dateKey: string, locale: "en" | "th"): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatWeekLabel(anchorDate: Date, locale: "en" | "th"): string {
  const weekStart = atStartOfWeek(anchorDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatLocale = locale === "th" ? "th-TH" : "en-US";
  const startLabel = weekStart.toLocaleDateString(formatLocale, {
    month: "short",
    day: "numeric",
  });
  const endLabel = weekEnd.toLocaleDateString(formatLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function getWeekdayLabels(locale: "en" | "th"): string[] {
  const formatter = new Intl.DateTimeFormat(
    locale === "th" ? "th-TH" : "en-US",
    {
      weekday: "short",
    },
  );
  const monday = new Date(2024, 0, 1); // Monday anchor for Monday-first headers
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return formatter.format(day);
  });
}

function buildVisibleDays(anchorDate: Date, mode: CalendarMode): Date[] {
  if (mode === "week") {
    const weekStart = atStartOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + index);
      return day;
    });
  }

  const monthStart = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    1,
  );
  const gridStart = atStartOfWeek(monthStart);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(day.getDate() + index);
    return day;
  });
}

function getErrorMessage(error: unknown, locale: "en" | "th"): string {
  return localizeErrorMessage(error, locale, "calendar.error.unableLoadData");
}

export function CalendarView({
  tasks,
  projectNameById,
  onEdit,
  onStatusChange,
  onDelete,
  onCreateClick,
}: CalendarViewProps) {
  const { locale, t } = useI18n();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    getDateKey(new Date()),
  );

  const dueTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (!task.due_at) return false;
        return !Number.isNaN(new Date(task.due_at).getTime());
      }),
    [tasks],
  );

  const tasksByDateKey = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of dueTasks) {
      const dueDate = new Date(task.due_at as string);
      const key = getDateKey(dueDate);
      const existing = map.get(key);
      if (existing) {
        existing.push(task);
      } else {
        map.set(key, [task]);
      }
    }

    for (const [key, groupedTasks] of map.entries()) {
      map.set(
        key,
        [...groupedTasks].sort((leftTask, rightTask) => {
          const leftTime = new Date(leftTask.due_at as string).getTime();
          const rightTime = new Date(rightTask.due_at as string).getTime();
          return leftTime - rightTime;
        }),
      );
    }

    return map;
  }, [dueTasks]);

  const visibleDays = useMemo(
    () => buildVisibleDays(anchorDate, mode),
    [anchorDate, mode],
  );
  const visibleDayKeys = useMemo(
    () => new Set(visibleDays.map((day) => getDateKey(day))),
    [visibleDays],
  );
  const normalizedSelectedDateKey = visibleDayKeys.has(selectedDateKey)
    ? selectedDateKey
    : getDateKey(visibleDays[0]);

  const selectedDateTasks = tasksByDateKey.get(normalizedSelectedDateKey) ?? [];
  const selectedTaskIds = useMemo(
    () => selectedDateTasks.map((task) => task.id),
    [selectedDateTasks],
  );
  const {
    data: subtaskStats = [],
    isError: isSubtaskStatsError,
    error: subtaskStatsError,
  } = useTaskSubtaskStats(selectedTaskIds, selectedTaskIds.length > 0);
  const subtaskProgressByTaskId = useMemo(() => {
    const progressMap = new Map<string, { done: number; total: number }>();
    for (const stats of subtaskStats) {
      progressMap.set(stats.task_id, {
        done: Number(stats.done_count ?? 0),
        total: Number(stats.total_count ?? 0),
      });
    }
    return progressMap;
  }, [subtaskStats]);

  const handlePrev = () => {
    setAnchorDate((previousDate) => {
      const nextDate = new Date(previousDate);
      if (mode === "month") {
        nextDate.setMonth(nextDate.getMonth() - 1);
      } else {
        nextDate.setDate(nextDate.getDate() - 7);
      }
      return nextDate;
    });
  };

  const handleNext = () => {
    setAnchorDate((previousDate) => {
      const nextDate = new Date(previousDate);
      if (mode === "month") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else {
        nextDate.setDate(nextDate.getDate() + 7);
      }
      return nextDate;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setAnchorDate(today);
    setSelectedDateKey(getDateKey(today));
  };

  const currentMonth = anchorDate.getMonth();
  const todayKey = getDateKey(new Date());
  const headerLabel =
    mode === "month"
      ? formatHeaderDate(anchorDate, locale)
      : formatWeekLabel(anchorDate, locale);
  const weekdayLabels = useMemo(() => getWeekdayLabels(locale), [locale]);

  return (
    <div className="calendar-root">
      <div className="calendar-header">
        <div>
          <h1 className="calendar-title">{t("calendar.title")}</h1>
          <p className="calendar-subtitle">
            {t("calendar.subtitle.withDueTasks", {
              count: dueTasks.length,
            })}
          </p>
        </div>
        <button className="calendar-primary-btn" onClick={onCreateClick}>
          <Plus size={14} />
          {t("shell.createTask")}
        </button>
      </div>

      <div className="calendar-toolbar">
        <div className="calendar-nav-group">
          <button
            className="calendar-icon-btn"
            onClick={handlePrev}
            title={t("calendar.action.previous")}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="calendar-icon-btn"
            onClick={handleNext}
            title={t("calendar.action.next")}
          >
            <ChevronRight size={14} />
          </button>
          <button className="calendar-ghost-btn" onClick={handleToday}>
            {t("calendar.action.today")}
          </button>
        </div>
        <span className="calendar-range-label">{headerLabel}</span>
        <div className="calendar-mode-group">
          <button
            className={`calendar-mode-btn${mode === "month" ? " active" : ""}`}
            onClick={() => setMode("month")}
          >
            {t("calendar.mode.month")}
          </button>
          <button
            className={`calendar-mode-btn${mode === "week" ? " active" : ""}`}
            onClick={() => setMode("week")}
          >
            {t("calendar.mode.week")}
          </button>
        </div>
      </div>

      <div className="calendar-layout">
        <section className="calendar-grid-panel">
          <div className="calendar-weekdays">
            {weekdayLabels.map((label) => (
              <div key={label} className="calendar-weekday-cell">
                {label}
              </div>
            ))}
          </div>
          <div className={`calendar-grid calendar-grid-${mode}`}>
            {visibleDays.map((day) => {
              const key = getDateKey(day);
              const dayTasks = tasksByDateKey.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === normalizedSelectedDateKey;
              const isOutsideCurrentMonth =
                mode === "month" && day.getMonth() !== currentMonth;

              return (
                <button
                  key={key}
                  className={`calendar-day-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}${isOutsideCurrentMonth ? " outside" : ""}`}
                  onClick={() => setSelectedDateKey(key)}
                >
                  <div className="calendar-day-top">
                    <span className="calendar-day-number">{day.getDate()}</span>
                    {dayTasks.length > 0 && (
                      <span className="calendar-day-count">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="calendar-day-dots">
                    {dayTasks.slice(0, 3).map((task) => (
                      <span key={task.id} className="calendar-day-dot" />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="calendar-day-panel">
          <div className="calendar-day-panel-header">
            <CalendarDays size={14} />
            <span>{formatDayLabel(normalizedSelectedDateKey, locale)}</span>
          </div>
          {selectedDateTasks.length === 0 ? (
            <div className="calendar-day-empty">
              <p>{t("calendar.empty.noDueTasksOnDay")}</p>
            </div>
          ) : isSubtaskStatsError ? (
            <p className="calendar-day-error">
              {getErrorMessage(subtaskStatsError, locale)}
            </p>
          ) : (
            <div className="calendar-day-task-list">
              {selectedDateTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  projectName={
                    task.project_id ? projectNameById[task.project_id] : null
                  }
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  subtaskProgress={subtaskProgressByTaskId.get(task.id)}
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      <style>{`
        .calendar-root {
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px 24px;
        }
        .calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .calendar-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.4px;
        }
        .calendar-subtitle {
          margin-top: 2px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .calendar-primary-btn {
          height: 32px;
          border: none;
          border-radius: var(--radius-md);
          padding: 0 12px;
          background: var(--accent);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .calendar-primary-btn:hover {
          background: var(--accent-hover);
          box-shadow: var(--shadow-glow);
        }
        .calendar-toolbar {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .calendar-nav-group,
        .calendar-mode-group {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .calendar-icon-btn,
        .calendar-ghost-btn,
        .calendar-mode-btn {
          height: 28px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 0 9px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .calendar-icon-btn {
          width: 28px;
          padding: 0;
        }
        .calendar-icon-btn:hover,
        .calendar-ghost-btn:hover,
        .calendar-mode-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .calendar-mode-btn.active {
          color: var(--accent);
          border-color: var(--accent);
          background: var(--accent-subtle);
        }
        .calendar-range-label {
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 600;
        }
        .calendar-layout {
          min-height: 0;
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 12px;
        }
        .calendar-grid-panel,
        .calendar-day-panel {
          min-height: 0;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
        }
        .calendar-grid-panel {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 6px;
        }
        .calendar-weekday-cell {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          padding: 4px 0;
        }
        .calendar-grid {
          display: grid;
          gap: 6px;
          min-height: 0;
        }
        .calendar-grid-month {
          flex: 1;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          grid-auto-rows: 1fr;
        }
        .calendar-grid-week {
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }
        .calendar-day-cell {
          min-height: 74px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          padding: 6px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .calendar-grid-week .calendar-day-cell {
          min-height: 96px;
        }
        .calendar-day-cell:hover {
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .calendar-day-cell.today {
          border-color: var(--accent);
        }
        .calendar-day-cell.selected {
          box-shadow: 0 0 0 1px var(--accent) inset;
          background: rgba(35, 42, 58, 0.8);
        }
        .calendar-day-cell.outside {
          opacity: 0.45;
        }
        .calendar-day-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .calendar-day-number {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
        .calendar-day-count {
          font-size: 10px;
          color: var(--text-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          padding: 1px 6px;
          background: var(--bg-hover);
        }
        .calendar-day-dots {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 4px;
        }
        .calendar-day-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
        }
        .calendar-day-panel {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow: hidden;
        }
        .calendar-day-panel-header {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
        }
        .calendar-day-task-list {
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 2px;
        }
        .calendar-day-empty {
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-md);
          padding: 16px;
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
        }
        .calendar-day-error {
          font-size: 12px;
          color: var(--danger);
        }

        @media (max-width: 1100px) {
          .calendar-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 700px) {
          .calendar-root {
            padding: 10px;
          }
          .calendar-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .calendar-toolbar {
            flex-direction: column;
            align-items: stretch;
          }
          .calendar-range-label {
            text-align: center;
          }
          .calendar-grid-month {
            grid-auto-rows: minmax(74px, auto);
          }
        }
      `}</style>
    </div>
  );
}

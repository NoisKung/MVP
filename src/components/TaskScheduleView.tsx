import type { Task, TaskStatus, ViewMode } from "@/lib/types";
import { CalendarDays, CalendarRange, Plus } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { useMemo } from "react";
import { useTaskSubtaskStats } from "@/hooks/use-tasks";
import { translate, useI18n } from "@/lib/i18n";

interface TaskScheduleViewProps {
  view: Extract<ViewMode, "today" | "upcoming">;
  tasks: Task[];
  projectNameById: Record<string, string>;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onCreateClick: () => void;
}

interface TaskSection {
  id: string;
  label: string;
  tasks: Task[];
}

export function TaskScheduleView({
  view,
  tasks,
  projectNameById,
  onEdit,
  onStatusChange,
  onDelete,
  onCreateClick,
}: TaskScheduleViewProps) {
  const { locale, t } = useI18n();
  const visibleTaskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const { data: subtaskStats = [] } = useTaskSubtaskStats(visibleTaskIds);
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

  const sections = buildSections(view, tasks, locale);
  const isTodayView = view === "today";
  const title = isTodayView
    ? t("schedule.title.today")
    : t("schedule.title.upcoming");
  const subtitle = isTodayView
    ? t("schedule.subtitle.today", { count: tasks.length })
    : t("schedule.subtitle.upcoming", { count: tasks.length });

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <div>
          <h1 className="schedule-title">{title}</h1>
          <p className="schedule-subtitle">{subtitle}</p>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="schedule-empty">
          <div className="schedule-empty-icon">
            {isTodayView ? (
              <CalendarRange size={26} />
            ) : (
              <CalendarDays size={26} />
            )}
          </div>
          <h3 className="schedule-empty-title">
            {isTodayView
              ? t("schedule.empty.today.title")
              : t("schedule.empty.upcoming.title")}
          </h3>
          <p className="schedule-empty-desc">
            {isTodayView
              ? t("schedule.empty.today.desc")
              : t("schedule.empty.upcoming.desc")}
          </p>
          <button className="schedule-empty-action" onClick={onCreateClick}>
            <Plus size={14} />
            {t("schedule.action.createTask")}
          </button>
        </div>
      ) : (
        <div className="schedule-sections">
          {sections.map((section) => (
            <section key={section.id} className="schedule-section">
              <div className="schedule-section-header">
                <h2 className="schedule-section-title">{section.label}</h2>
                <span className="schedule-section-count">
                  {section.tasks.length}
                </span>
              </div>

              <div className="schedule-cards">
                {section.tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 0.04}s` }}
                  >
                    <TaskCard
                      task={task}
                      projectName={
                        task.project_id
                          ? projectNameById[task.project_id]
                          : null
                      }
                      onEdit={onEdit}
                      onStatusChange={onStatusChange}
                      onDelete={onDelete}
                      subtaskProgress={subtaskProgressByTaskId.get(task.id)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <style>{`
        .schedule-container {
          max-width: 860px;
          margin: 0 auto;
          padding: 24px 28px;
        }
        .schedule-header {
          margin-bottom: 20px;
        }
        .schedule-title {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--text-primary);
        }
        .schedule-subtitle {
          margin-top: 2px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .schedule-sections {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .schedule-section {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          overflow: hidden;
        }
        .schedule-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border-default);
          background: var(--bg-elevated);
        }
        .schedule-section-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .schedule-section-count {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-hover);
          padding: 2px 7px;
          border-radius: var(--radius-full);
          font-variant-numeric: tabular-nums;
        }
        .schedule-cards {
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .schedule-empty {
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          padding: 34px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .schedule-empty-icon {
          width: 52px;
          height: 52px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-subtle);
          color: var(--accent);
          margin-bottom: 12px;
        }
        .schedule-empty-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .schedule-empty-desc {
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-muted);
          max-width: 380px;
        }
        .schedule-empty-action {
          margin-top: 16px;
          border: none;
          border-radius: var(--radius-md);
          background: var(--accent);
          color: #fff;
          height: 34px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .schedule-empty-action:hover {
          background: var(--accent-hover);
          box-shadow: var(--shadow-glow);
        }

        @media (max-width: 640px) {
          .schedule-container {
            padding: 8px 10px;
          }
        }
      `}</style>
    </div>
  );
}

function buildSections(
  view: Extract<ViewMode, "today" | "upcoming">,
  tasks: Task[],
  locale: "en" | "th",
): TaskSection[] {
  const sortedTasks = [...tasks].sort(compareByDueDateAscending);
  if (view === "today") {
    return buildTodaySections(sortedTasks, locale);
  }
  return buildUpcomingSections(sortedTasks, locale);
}

function buildTodaySections(tasks: Task[], locale: "en" | "th"): TaskSection[] {
  const todayStart = getStartOfToday();
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const overdueTasks = tasks.filter((task) => {
    const dueAt = parseDueAt(task.due_at);
    return dueAt !== null && dueAt < todayStart;
  });
  const dueTodayTasks = tasks.filter((task) => {
    const dueAt = parseDueAt(task.due_at);
    return dueAt !== null && dueAt >= todayStart && dueAt < todayEnd;
  });

  const sections: TaskSection[] = [];
  if (overdueTasks.length > 0) {
    sections.push({
      id: "overdue",
      label: translate(locale, "schedule.section.overdue"),
      tasks: overdueTasks,
    });
  }
  if (dueTodayTasks.length > 0) {
    sections.push({
      id: "today",
      label: translate(locale, "schedule.section.dueToday"),
      tasks: dueTodayTasks,
    });
  }
  return sections;
}

function buildUpcomingSections(
  tasks: Task[],
  locale: "en" | "th",
): TaskSection[] {
  const grouped = new Map<string, Task[]>();

  for (const task of tasks) {
    const dueAt = parseDueAt(task.due_at);
    if (!dueAt) continue;

    const groupKey = getDayKey(dueAt);
    const existingGroup = grouped.get(groupKey) ?? [];
    existingGroup.push(task);
    grouped.set(groupKey, existingGroup);
  }

  return Array.from(grouped.entries())
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, groupedTasks]) => ({
      id: key,
      label: formatDayLabel(groupedTasks[0].due_at, locale),
      tasks: groupedTasks.sort(compareByDueDateAscending),
    }));
}

function getDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(dueAt: string | null, locale: "en" | "th"): string {
  const date = parseDueAt(dueAt);
  if (!date) return translate(locale, "schedule.day.noDate");
  return date.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getStartOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function parseDueAt(value: string | null): Date | null {
  if (!value) return null;
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
}

function compareByDueDateAscending(leftTask: Task, rightTask: Task): number {
  const leftDueAt = parseDueAt(leftTask.due_at);
  const rightDueAt = parseDueAt(rightTask.due_at);

  if (leftDueAt && rightDueAt) {
    return leftDueAt.getTime() - rightDueAt.getTime();
  }
  if (leftDueAt) return -1;
  if (rightDueAt) return 1;

  return (
    new Date(rightTask.created_at).getTime() -
    new Date(leftTask.created_at).getTime()
  );
}

import { useMemo } from "react";
import { useWeeklyReview } from "@/hooks/use-tasks";
import { translate, useI18n } from "@/lib/i18n";
import { localizeErrorMessage } from "@/lib/error-message";
import type { Task, TaskStatus, WeeklyReviewSnapshot } from "@/lib/types";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";

interface WeeklyReviewViewProps {
  projectNameById: Record<string, string>;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onCreateClick: () => void;
}

interface StatCard {
  id: string;
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "accent";
  subtitle: string;
}

function getErrorMessage(error: unknown, locale: "en" | "th"): string {
  return localizeErrorMessage(error, locale, "weeklyReview.error.unableLoad");
}

function getPluralLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}

function formatWeekRange(
  weekStart: string,
  weekEnd: string,
  locale: "en" | "th",
): string {
  const startDate = new Date(weekStart);
  const endDateExclusive = new Date(weekEnd);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDateExclusive.getTime())
  ) {
    return translate(locale, "weeklyReview.range.thisWeek");
  }

  const endDate = new Date(endDateExclusive.getTime() - 1);
  const formatLocale = locale === "th" ? "th-TH" : "en-US";
  const startLabel = startDate.toLocaleDateString(formatLocale, {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString(formatLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function formatDateTime(value: string, locale: "en" | "th"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return translate(locale, "weeklyReview.date.unknown");
  }
  return date.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDueLabel(dueAt: string | null, locale: "en" | "th"): string {
  if (!dueAt) return translate(locale, "weeklyReview.date.noDue");
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return translate(locale, "weeklyReview.date.invalidDue");
  }
  return dueDate.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getReviewHeadline(
  snapshot: WeeklyReviewSnapshot,
  locale: "en" | "th",
): string {
  if (locale === "th") {
    if (snapshot.overdueCount > 0) {
      return translate(locale, "weeklyReview.headline.overdue", {
        count: snapshot.overdueCount,
      });
    }

    const backlogDelta = snapshot.completedCount - snapshot.createdCount;
    if (backlogDelta > 0) {
      return translate(locale, "weeklyReview.headline.momentum", {
        count: backlogDelta,
      });
    }
    if (backlogDelta === 0) {
      return translate(locale, "weeklyReview.headline.balanced");
    }
    const growth = Math.abs(backlogDelta);
    return translate(locale, "weeklyReview.headline.backlogGrowth", {
      count: growth,
    });
  }

  const overdueWord = getPluralLabel(
    snapshot.overdueCount,
    translate(locale, "weeklyReview.word.task"),
    translate(locale, "weeklyReview.word.tasks"),
  );
  if (snapshot.overdueCount > 0) {
    return translate(locale, "weeklyReview.headline.overdue", {
      count: snapshot.overdueCount,
      taskWord: overdueWord,
    });
  }

  const backlogDelta = snapshot.completedCount - snapshot.createdCount;
  const deltaWord = getPluralLabel(
    Math.abs(backlogDelta),
    translate(locale, "weeklyReview.word.task"),
    translate(locale, "weeklyReview.word.tasks"),
  );
  if (backlogDelta > 0) {
    return translate(locale, "weeklyReview.headline.momentum", {
      count: backlogDelta,
      taskWord: deltaWord,
    });
  }
  if (backlogDelta === 0) {
    return translate(locale, "weeklyReview.headline.balanced");
  }
  const growth = Math.abs(backlogDelta);
  return translate(locale, "weeklyReview.headline.backlogGrowth", {
    count: growth,
    taskWord: deltaWord,
  });
}

function buildStatCards(
  snapshot: WeeklyReviewSnapshot,
  locale: "en" | "th",
): StatCard[] {
  return [
    {
      id: "completed",
      label: translate(locale, "weeklyReview.stat.completed.label"),
      value: snapshot.completedCount,
      tone: "success",
      subtitle: translate(locale, "weeklyReview.stat.completed.subtitle"),
    },
    {
      id: "pending",
      label: translate(locale, "weeklyReview.stat.pending.label"),
      value: snapshot.pendingCount,
      tone: "accent",
      subtitle: translate(locale, "weeklyReview.stat.pending.subtitle"),
    },
    {
      id: "overdue",
      label: translate(locale, "weeklyReview.stat.overdue.label"),
      value: snapshot.overdueCount,
      tone: "danger",
      subtitle: translate(locale, "weeklyReview.stat.overdue.subtitle"),
    },
    {
      id: "created",
      label: translate(locale, "weeklyReview.stat.created.label"),
      value: snapshot.createdCount,
      tone: "warning",
      subtitle: translate(locale, "weeklyReview.stat.created.subtitle"),
    },
  ];
}

function getPriorityLabel(task: Task, locale: "en" | "th"): string {
  if (task.priority === "URGENT")
    return translate(locale, "taskForm.priority.urgent");
  if (task.priority === "LOW")
    return translate(locale, "taskForm.priority.low");
  return translate(locale, "taskForm.priority.normal");
}

function getTaskTone(task: Task): "urgent" | "normal" | "low" {
  if (task.priority === "URGENT") return "urgent";
  if (task.priority === "LOW") return "low";
  return "normal";
}

function TaskItemRow({
  task,
  projectNameById,
  rightMeta,
  actions,
  onEdit,
  locale,
}: {
  task: Task;
  projectNameById: Record<string, string>;
  rightMeta: string;
  actions?: React.ReactNode;
  onEdit: (task: Task) => void;
  locale: "en" | "th";
}) {
  const projectName = task.project_id ? projectNameById[task.project_id] : null;
  const tone = getTaskTone(task);

  return (
    <div className={`weekly-task-row weekly-task-row-${tone}`}>
      <div className="weekly-task-row-main">
        <button className="weekly-task-title-btn" onClick={() => onEdit(task)}>
          {task.title}
        </button>
        <div className="weekly-task-meta">
          {projectName && (
            <span className="weekly-badge weekly-badge-project">
              {projectName}
            </span>
          )}
          <span className="weekly-badge weekly-badge-priority">
            {getPriorityLabel(task, locale)}
          </span>
          {task.is_important ? (
            <span className="weekly-badge weekly-badge-important">
              {translate(locale, "taskForm.importance.on")}
            </span>
          ) : null}
          <span className="weekly-task-date">{rightMeta}</span>
        </div>
      </div>
      {actions ? <div className="weekly-task-actions">{actions}</div> : null}
    </div>
  );
}

export function WeeklyReviewView({
  projectNameById,
  onEdit,
  onStatusChange,
  onCreateClick,
}: WeeklyReviewViewProps) {
  const { locale, t } = useI18n();
  const {
    data: snapshot,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useWeeklyReview();

  const completionRate = useMemo(() => {
    if (!snapshot) return 0;
    const denominator =
      snapshot.completedCount + snapshot.pendingCount + snapshot.overdueCount;
    if (denominator <= 0) return 0;
    return Math.round((snapshot.completedCount / denominator) * 100);
  }, [snapshot]);

  const statCards = useMemo(
    () => (snapshot ? buildStatCards(snapshot, locale) : []),
    [locale, snapshot],
  );

  if (isLoading) {
    return (
      <div className="weekly-review-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (isError || !snapshot) {
    return (
      <div className="weekly-review">
        <div className="weekly-review-error-card">
          <h2 className="weekly-review-error-title">
            {t("weeklyReview.error.title")}
          </h2>
          <p className="weekly-review-error-description">
            {getErrorMessage(error, locale)}
          </p>
          <button
            type="button"
            className="weekly-secondary-button"
            onClick={() => void refetch()}
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  const headline = getReviewHeadline(snapshot, locale);
  const lastUpdatedLabel = formatDateTime(snapshot.periodEnd, locale);
  const weekLabel = formatWeekRange(
    snapshot.weekStart,
    snapshot.weekEnd,
    locale,
  );

  return (
    <div className="weekly-review">
      <div className="weekly-review-header">
        <div>
          <h1 className="weekly-review-title">{t("weeklyReview.title")}</h1>
          <p className="weekly-review-subtitle">
            <CalendarRange size={14} />
            <span>{weekLabel}</span>
            <span className="weekly-dot">•</span>
            <span>
              {t("weeklyReview.updatedAt", { time: lastUpdatedLabel })}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="weekly-secondary-button"
          onClick={() => void refetch()}
          disabled={isRefetching}
        >
          <RefreshCw size={14} className={isRefetching ? "is-spinning" : ""} />
          {isRefetching
            ? t("weeklyReview.action.refreshing")
            : t("weeklyReview.action.refresh")}
        </button>
      </div>

      <div className="weekly-review-headline">
        <Sparkles size={16} />
        <span>{headline}</span>
      </div>

      <div className="weekly-review-stats-grid">
        {statCards.map((card) => (
          <article
            key={card.id}
            className={`weekly-stat-card weekly-tone-${card.tone}`}
          >
            <p className="weekly-stat-label">{card.label}</p>
            <p className="weekly-stat-value">{card.value}</p>
            <p className="weekly-stat-subtitle">{card.subtitle}</p>
          </article>
        ))}
      </div>

      <section className="weekly-review-progress-card">
        <div className="weekly-review-progress-header">
          <span>{t("weeklyReview.progress.completionRatio")}</span>
          <strong>{completionRate}%</strong>
        </div>
        <div className="weekly-review-progress-track">
          <div
            className="weekly-review-progress-fill"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="weekly-review-progress-meta">
          <span>
            {t("weeklyReview.progress.carryOverOpen", {
              count: snapshot.carryOverCount,
            })}
          </span>
          <span>
            {t("weeklyReview.progress.dueThisWeekOpen", {
              count: snapshot.dueThisWeekOpenCount,
            })}
          </span>
        </div>
      </section>

      <div className="weekly-review-sections">
        <section className="weekly-section-card">
          <header className="weekly-section-header">
            <div className="weekly-section-title-wrap">
              <CheckCircle2 size={15} />
              <h2>{t("weeklyReview.section.completed.title")}</h2>
            </div>
            <span>
              {t("weeklyReview.section.completed.shown", {
                count: snapshot.completedTasks.length,
              })}
            </span>
          </header>
          <div className="weekly-section-body">
            {snapshot.completedTasks.length === 0 ? (
              <p className="weekly-empty-text">
                {t("weeklyReview.section.completed.empty")}
              </p>
            ) : (
              snapshot.completedTasks.map((entry) => (
                <TaskItemRow
                  key={`completed-${entry.task.id}`}
                  task={entry.task}
                  projectNameById={projectNameById}
                  rightMeta={t("weeklyReview.section.completed.doneAt", {
                    time: formatDateTime(entry.completedAt, locale),
                  })}
                  onEdit={onEdit}
                  locale={locale}
                />
              ))
            )}
          </div>
        </section>

        <section className="weekly-section-card">
          <header className="weekly-section-header">
            <div className="weekly-section-title-wrap">
              <AlertTriangle size={15} />
              <h2>{t("weeklyReview.section.overdue.title")}</h2>
            </div>
            <span>
              {t("weeklyReview.section.overdue.total", {
                count: snapshot.overdueCount,
              })}
            </span>
          </header>
          <div className="weekly-section-body">
            {snapshot.overdueTasks.length === 0 ? (
              <p className="weekly-empty-text">
                {t("weeklyReview.section.overdue.empty")}
              </p>
            ) : (
              snapshot.overdueTasks.map((task) => (
                <TaskItemRow
                  key={`overdue-${task.id}`}
                  task={task}
                  projectNameById={projectNameById}
                  rightMeta={t("weeklyReview.section.overdue.dueAt", {
                    time: formatDueLabel(task.due_at, locale),
                  })}
                  onEdit={onEdit}
                  locale={locale}
                  actions={
                    <>
                      {task.status !== "DOING" ? (
                        <button
                          type="button"
                          className="weekly-inline-action"
                          onClick={() => onStatusChange(task.id, "DOING")}
                        >
                          {t("weeklyReview.action.start")}
                        </button>
                      ) : null}
                      {task.status !== "DONE" ? (
                        <button
                          type="button"
                          className="weekly-inline-action weekly-inline-action-primary"
                          onClick={() => onStatusChange(task.id, "DONE")}
                        >
                          {t("taskForm.status.done")}
                        </button>
                      ) : null}
                    </>
                  }
                />
              ))
            )}
          </div>
        </section>

        <section className="weekly-section-card">
          <header className="weekly-section-header">
            <div className="weekly-section-title-wrap">
              <ClipboardList size={15} />
              <h2>{t("weeklyReview.section.pending.title")}</h2>
            </div>
            <span>
              {t("weeklyReview.section.pending.total", {
                count: snapshot.pendingCount,
              })}
            </span>
          </header>
          <div className="weekly-section-body">
            {snapshot.pendingTasks.length === 0 ? (
              <div className="weekly-empty-panel">
                <p className="weekly-empty-text">
                  {t("weeklyReview.section.pending.empty")}
                </p>
                <button
                  type="button"
                  className="weekly-primary-button"
                  onClick={onCreateClick}
                >
                  <Plus size={14} />
                  {t("weeklyReview.section.pending.createTask")}
                </button>
              </div>
            ) : (
              snapshot.pendingTasks.map((task) => (
                <TaskItemRow
                  key={`pending-${task.id}`}
                  task={task}
                  projectNameById={projectNameById}
                  rightMeta={t("weeklyReview.section.overdue.dueAt", {
                    time: formatDueLabel(task.due_at, locale),
                  })}
                  onEdit={onEdit}
                  locale={locale}
                  actions={
                    <>
                      {task.status !== "DOING" ? (
                        <button
                          type="button"
                          className="weekly-inline-action weekly-inline-action-primary"
                          onClick={() => onStatusChange(task.id, "DOING")}
                        >
                          {t("weeklyReview.action.start")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="weekly-inline-action"
                          onClick={() => onStatusChange(task.id, "TODO")}
                        >
                          {t("weeklyReview.action.pause")}
                        </button>
                      )}
                    </>
                  }
                />
              ))
            )}
          </div>
        </section>
      </div>

      <style>{`
        .weekly-review {
          max-width: 1080px;
          margin: 0 auto;
          padding: 24px 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .weekly-review-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 2px solid var(--bg-hover);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        .weekly-review-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .weekly-review-title {
          font-size: 21px;
          letter-spacing: -0.3px;
          color: var(--text-primary);
        }
        .weekly-review-subtitle {
          margin-top: 4px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--text-muted);
          font-size: 12px;
        }
        .weekly-dot {
          opacity: 0.6;
        }
        .weekly-review-headline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 13px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
          padding: 9px 11px;
        }
        .weekly-review-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .weekly-stat-card {
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          padding: 13px;
        }
        .weekly-stat-label {
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2px;
          text-transform: uppercase;
        }
        .weekly-stat-value {
          margin-top: 6px;
          color: var(--text-primary);
          font-size: 25px;
          line-height: 1.1;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .weekly-stat-subtitle {
          margin-top: 5px;
          color: var(--text-muted);
          font-size: 11px;
        }
        .weekly-tone-success .weekly-stat-value {
          color: var(--success);
        }
        .weekly-tone-warning .weekly-stat-value {
          color: var(--warning);
        }
        .weekly-tone-danger .weekly-stat-value {
          color: var(--danger);
        }
        .weekly-tone-accent .weekly-stat-value {
          color: var(--accent);
        }
        .weekly-review-progress-card {
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          padding: 14px;
        }
        .weekly-review-progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .weekly-review-progress-header strong {
          color: var(--text-primary);
          font-size: 16px;
          font-variant-numeric: tabular-nums;
        }
        .weekly-review-progress-track {
          margin-top: 10px;
          height: 8px;
          border-radius: var(--radius-full);
          background: var(--bg-hover);
          overflow: hidden;
        }
        .weekly-review-progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--accent), #3aa4ff);
          transition: width 220ms var(--ease);
        }
        .weekly-review-progress-meta {
          margin-top: 10px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .weekly-review-sections {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: start;
        }
        .weekly-section-card {
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          min-height: 280px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .weekly-section-header {
          border-bottom: 1px solid var(--border-default);
          padding: 11px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .weekly-section-title-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .weekly-section-title-wrap h2 {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: none;
          letter-spacing: 0;
        }
        .weekly-section-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
        }
        .weekly-task-row {
          border: 1px solid var(--border-default);
          border-radius: 10px;
          padding: 9px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          background: var(--bg-elevated);
        }
        .weekly-task-row-urgent {
          border-color: rgba(248, 113, 113, 0.4);
        }
        .weekly-task-row-normal {
          border-color: rgba(124, 105, 255, 0.35);
        }
        .weekly-task-row-low {
          border-color: var(--border-default);
        }
        .weekly-task-row-main {
          min-width: 0;
          flex: 1;
        }
        .weekly-task-title-btn {
          border: none;
          background: none;
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          font-family: inherit;
          width: 100%;
        }
        .weekly-task-title-btn:hover {
          color: var(--accent-hover);
        }
        .weekly-task-meta {
          margin-top: 6px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }
        .weekly-badge {
          display: inline-flex;
          align-items: center;
          height: 20px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-default);
          padding: 0 7px;
          font-size: 11px;
          color: var(--text-secondary);
          background: color-mix(in srgb, var(--bg-hover) 72%, #000);
        }
        .weekly-badge-project {
          color: var(--accent);
          border-color: color-mix(in srgb, var(--accent) 45%, transparent);
          background: color-mix(in srgb, var(--accent-subtle) 75%, #111);
        }
        .weekly-badge-priority {
          color: var(--text-muted);
        }
        .weekly-badge-important {
          color: var(--warning);
          border-color: color-mix(in srgb, var(--warning) 45%, transparent);
          background: color-mix(in srgb, var(--warning-subtle) 82%, #111);
        }
        .weekly-task-date {
          color: var(--text-muted);
          font-size: 11px;
        }
        .weekly-task-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .weekly-inline-action {
          height: 28px;
          padding: 0 9px;
          border-radius: 8px;
          border: 1px solid var(--border-default);
          background: var(--bg-hover);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
        }
        .weekly-inline-action:hover {
          color: var(--text-primary);
          border-color: var(--border-strong);
        }
        .weekly-inline-action-primary {
          background: color-mix(in srgb, var(--accent-subtle) 84%, #0b1224);
          color: var(--accent-hover);
          border-color: color-mix(in srgb, var(--accent) 50%, transparent);
        }
        .weekly-empty-text {
          font-size: 12px;
          color: var(--text-muted);
          padding: 8px 4px;
        }
        .weekly-empty-panel {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .weekly-secondary-button,
        .weekly-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 32px;
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
          border: 1px solid var(--border-default);
        }
        .weekly-secondary-button {
          background: var(--bg-surface);
          color: var(--text-secondary);
          padding: 0 11px;
        }
        .weekly-secondary-button:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-elevated);
        }
        .weekly-secondary-button:disabled {
          cursor: wait;
          opacity: 0.7;
        }
        .weekly-primary-button {
          background: var(--accent);
          border: none;
          color: #fff;
          padding: 0 11px;
        }
        .weekly-primary-button:hover {
          background: var(--accent-hover);
        }
        .weekly-review-error-card {
          margin-top: 20px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--danger);
          background: var(--danger-subtle);
          padding: 14px;
        }
        .weekly-review-error-title {
          font-size: 15px;
          color: var(--text-primary);
        }
        .weekly-review-error-description {
          margin-top: 4px;
          margin-bottom: 12px;
          color: var(--text-secondary);
          font-size: 12px;
        }
        .is-spinning {
          animation: spin 0.8s linear infinite;
        }
        @media (max-width: 1050px) {
          .weekly-review-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .weekly-review-sections {
            grid-template-columns: 1fr;
          }
          .weekly-section-card {
            min-height: 0;
          }
        }
        @media (max-width: 640px) {
          .weekly-review {
            padding: 18px 14px 26px;
          }
          .weekly-review-header {
            flex-direction: column;
            align-items: stretch;
          }
          .weekly-review-stats-grid {
            grid-template-columns: 1fr;
          }
          .weekly-review-progress-meta {
            flex-direction: column;
            align-items: flex-start;
          }
          .weekly-task-actions {
            width: 100%;
            justify-content: flex-end;
          }
          .weekly-task-row {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

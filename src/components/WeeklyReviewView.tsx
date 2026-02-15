import { useMemo } from "react";
import { useWeeklyReview } from "@/hooks/use-tasks";
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unable to load weekly review.";
}

function getPluralLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const startDate = new Date(weekStart);
  const endDateExclusive = new Date(weekEnd);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDateExclusive.getTime())
  ) {
    return "This week";
  }

  const endDate = new Date(endDateExclusive.getTime() - 1);
  const startLabel = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDueLabel(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return "Invalid due date";
  return dueDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getReviewHeadline(snapshot: WeeklyReviewSnapshot): string {
  if (snapshot.overdueCount > 0) {
    return `${snapshot.overdueCount} overdue ${getPluralLabel(snapshot.overdueCount, "task")} need recovery attention.`;
  }

  const backlogDelta = snapshot.completedCount - snapshot.createdCount;
  if (backlogDelta > 0) {
    return `Great momentum: you closed ${backlogDelta} more ${getPluralLabel(backlogDelta, "task")} than you created this week.`;
  }
  if (backlogDelta === 0) {
    return "Balanced week: completions and new tasks are currently in sync.";
  }
  const growth = Math.abs(backlogDelta);
  return `Backlog grew by ${growth} ${getPluralLabel(growth, "task")} this week. Focus on priority items next.`;
}

function buildStatCards(snapshot: WeeklyReviewSnapshot): StatCard[] {
  return [
    {
      id: "completed",
      label: "Completed",
      value: snapshot.completedCount,
      tone: "success",
      subtitle: "Moved to Done this week",
    },
    {
      id: "pending",
      label: "Pending",
      value: snapshot.pendingCount,
      tone: "accent",
      subtitle: "Open and not overdue",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: snapshot.overdueCount,
      tone: "danger",
      subtitle: "Need immediate recovery",
    },
    {
      id: "created",
      label: "Created",
      value: snapshot.createdCount,
      tone: "warning",
      subtitle: "New tasks added this week",
    },
  ];
}

function getPriorityLabel(task: Task): string {
  if (task.priority === "URGENT") return "Urgent";
  if (task.priority === "LOW") return "Low";
  return "Normal";
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
}: {
  task: Task;
  projectNameById: Record<string, string>;
  rightMeta: string;
  actions?: React.ReactNode;
  onEdit: (task: Task) => void;
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
            {getPriorityLabel(task)}
          </span>
          {task.is_important ? (
            <span className="weekly-badge weekly-badge-important">
              Important
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
    () => (snapshot ? buildStatCards(snapshot) : []),
    [snapshot],
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
            Failed to load weekly review
          </h2>
          <p className="weekly-review-error-description">
            {getErrorMessage(error)}
          </p>
          <button
            type="button"
            className="weekly-secondary-button"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const headline = getReviewHeadline(snapshot);
  const lastUpdatedLabel = formatDateTime(snapshot.periodEnd);
  const weekLabel = formatWeekRange(snapshot.weekStart, snapshot.weekEnd);

  return (
    <div className="weekly-review">
      <div className="weekly-review-header">
        <div>
          <h1 className="weekly-review-title">Weekly Review</h1>
          <p className="weekly-review-subtitle">
            <CalendarRange size={14} />
            <span>{weekLabel}</span>
            <span className="weekly-dot">•</span>
            <span>Updated {lastUpdatedLabel}</span>
          </p>
        </div>
        <button
          type="button"
          className="weekly-secondary-button"
          onClick={() => void refetch()}
          disabled={isRefetching}
        >
          <RefreshCw size={14} className={isRefetching ? "is-spinning" : ""} />
          {isRefetching ? "Refreshing..." : "Refresh"}
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
          <span>Completion ratio</span>
          <strong>{completionRate}%</strong>
        </div>
        <div className="weekly-review-progress-track">
          <div
            className="weekly-review-progress-fill"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="weekly-review-progress-meta">
          <span>{snapshot.carryOverCount} carry-over open</span>
          <span>
            {snapshot.dueThisWeekOpenCount} due this week and still open
          </span>
        </div>
      </section>

      <div className="weekly-review-sections">
        <section className="weekly-section-card">
          <header className="weekly-section-header">
            <div className="weekly-section-title-wrap">
              <CheckCircle2 size={15} />
              <h2>Completed This Week</h2>
            </div>
            <span>{snapshot.completedTasks.length} shown</span>
          </header>
          <div className="weekly-section-body">
            {snapshot.completedTasks.length === 0 ? (
              <p className="weekly-empty-text">
                No completed tasks yet in this week.
              </p>
            ) : (
              snapshot.completedTasks.map((entry) => (
                <TaskItemRow
                  key={`completed-${entry.task.id}`}
                  task={entry.task}
                  projectNameById={projectNameById}
                  rightMeta={`Done ${formatDateTime(entry.completedAt)}`}
                  onEdit={onEdit}
                />
              ))
            )}
          </div>
        </section>

        <section className="weekly-section-card">
          <header className="weekly-section-header">
            <div className="weekly-section-title-wrap">
              <AlertTriangle size={15} />
              <h2>Overdue</h2>
            </div>
            <span>{snapshot.overdueCount} total</span>
          </header>
          <div className="weekly-section-body">
            {snapshot.overdueTasks.length === 0 ? (
              <p className="weekly-empty-text">
                No overdue tasks. Keep this trend.
              </p>
            ) : (
              snapshot.overdueTasks.map((task) => (
                <TaskItemRow
                  key={`overdue-${task.id}`}
                  task={task}
                  projectNameById={projectNameById}
                  rightMeta={`Due ${formatDueLabel(task.due_at)}`}
                  onEdit={onEdit}
                  actions={
                    <>
                      {task.status !== "DOING" ? (
                        <button
                          type="button"
                          className="weekly-inline-action"
                          onClick={() => onStatusChange(task.id, "DOING")}
                        >
                          Start
                        </button>
                      ) : null}
                      {task.status !== "DONE" ? (
                        <button
                          type="button"
                          className="weekly-inline-action weekly-inline-action-primary"
                          onClick={() => onStatusChange(task.id, "DONE")}
                        >
                          Done
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
              <h2>Pending Focus</h2>
            </div>
            <span>{snapshot.pendingCount} total</span>
          </header>
          <div className="weekly-section-body">
            {snapshot.pendingTasks.length === 0 ? (
              <div className="weekly-empty-panel">
                <p className="weekly-empty-text">
                  No pending tasks in the queue.
                </p>
                <button
                  type="button"
                  className="weekly-primary-button"
                  onClick={onCreateClick}
                >
                  <Plus size={14} />
                  Create task
                </button>
              </div>
            ) : (
              snapshot.pendingTasks.map((task) => (
                <TaskItemRow
                  key={`pending-${task.id}`}
                  task={task}
                  projectNameById={projectNameById}
                  rightMeta={`Due ${formatDueLabel(task.due_at)}`}
                  onEdit={onEdit}
                  actions={
                    <>
                      {task.status !== "DOING" ? (
                        <button
                          type="button"
                          className="weekly-inline-action weekly-inline-action-primary"
                          onClick={() => onStatusChange(task.id, "DOING")}
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="weekly-inline-action"
                          onClick={() => onStatusChange(task.id, "TODO")}
                        >
                          Pause
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

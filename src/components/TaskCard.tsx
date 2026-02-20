import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { translate, useI18n } from "@/lib/i18n";
import {
  AlertTriangle,
  Minus,
  ArrowDown,
  Star,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Clock3,
  Square,
  Play,
  Timer,
} from "lucide-react";
import { useState } from "react";

const PRIORITY_CONFIG: Record<
  TaskPriority,
  {
    color: string;
    bg: string;
    icon: React.ReactNode;
  }
> = {
  URGENT: {
    color: "var(--danger)",
    bg: "var(--danger-subtle)",
    icon: <AlertTriangle size={11} />,
  },
  NORMAL: {
    color: "var(--accent)",
    bg: "var(--accent-subtle)",
    icon: <Minus size={11} />,
  },
  LOW: {
    color: "var(--text-muted)",
    bg: "var(--bg-hover)",
    icon: <ArrowDown size={11} />,
  },
};

interface TaskCardProps {
  task: Task;
  projectName?: string | null;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  subtaskProgress?: {
    done: number;
    total: number;
  };
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  selectable?: boolean;
  selected?: boolean;
  selectionBusy?: boolean;
  onToggleSelect?: (taskId: string, nextSelected: boolean) => void;
  activeFocusTaskId?: string | null;
  focusElapsedSeconds?: number;
  focusBusy?: boolean;
  onStartFocus?: (task: Task) => void;
  onStopFocus?: (task: Task) => void;
}

export function TaskCard({
  task,
  projectName = null,
  onEdit,
  onStatusChange,
  onDelete,
  subtaskProgress,
  onDragStart,
  onDragEnd,
  isDragging = false,
  selectable = false,
  selected = false,
  selectionBusy = false,
  onToggleSelect,
  activeFocusTaskId = null,
  focusElapsedSeconds = 0,
  focusBusy = false,
  onStartFocus,
  onStopFocus,
}: TaskCardProps) {
  const { locale, t } = useI18n();
  const [showActions, setShowActions] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const nextStatus = getNextStatus(task.status);
  const prevStatus = getPrevStatus(task.status);
  const dueBadge = getDueBadge(task, locale);
  const recurrenceLabel = getRecurrenceLabel(task.recurrence, locale);
  const checklistProgressLabel = getChecklistProgressLabel(
    subtaskProgress,
    locale,
  );
  const priorityLabel =
    task.priority === "URGENT"
      ? t("taskForm.priority.urgent")
      : task.priority === "LOW"
        ? t("taskForm.priority.low")
        : t("taskForm.priority.normal");
  const selectToggleTitle = selected
    ? t("taskCard.action.unselectTask")
    : t("taskCard.action.selectTask");
  const isFocusActive = activeFocusTaskId === task.id;
  const isFocusLockedByOtherTask = Boolean(
    activeFocusTaskId && activeFocusTaskId !== task.id,
  );
  const canShowFocusActions = Boolean(onStartFocus && onStopFocus);
  const focusButtonDisabled =
    focusBusy || (!isFocusActive && isFocusLockedByOtherTask);
  const focusButtonTitle = isFocusActive
    ? t("taskCard.focus.stop")
    : isFocusLockedByOtherTask
      ? t("taskCard.focus.runningAnotherTask")
      : t("taskCard.focus.start");
  const focusElapsedLabel = t("taskCard.focus.elapsed", {
    duration: formatFocusDuration(focusElapsedSeconds),
  });

  const relativeDate = getRelativeDate(task.created_at, locale);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData(
      "application/x-solostack-task",
      JSON.stringify({ id: task.id, status: task.status }),
    );
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.effectAllowed = "move";
    onDragStart?.(task.id);
  };

  return (
    <div
      className={`card${isDragging ? " card-dragging" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Card top row */}
      <div className="card-top">
        <div className="card-top-left">
          {selectable && (
            <label
              className={`card-select-toggle${selected ? " selected" : ""}`}
              title={selectToggleTitle}
            >
              <input
                type="checkbox"
                className="card-select-input"
                checked={selected}
                disabled={selectionBusy}
                onChange={(event) => {
                  event.stopPropagation();
                  onToggleSelect?.(task.id, event.target.checked);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                aria-label={selectToggleTitle}
              />
            </label>
          )}
          <span
            className="card-priority"
            style={{
              color: priorityConfig.color,
              background: priorityConfig.bg,
            }}
          >
            {priorityConfig.icon}
            {priorityLabel}
          </span>
        </div>
        <div className="card-top-right">
          {!!task.is_important && (
            <Star size={13} fill="var(--warning)" color="var(--warning)" />
          )}
          {showActions && (
            <button
              className="card-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              title={t("taskCard.action.delete")}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="card-title" onClick={() => onEdit(task)}>
        {task.title}
      </h3>

      {/* Description */}
      {task.description && <p className="card-desc">{task.description}</p>}

      {(projectName ||
        dueBadge ||
        recurrenceLabel ||
        checklistProgressLabel) && (
        <div className="card-meta-row">
          {projectName && (
            <span className="card-project-badge">{projectName}</span>
          )}
          {dueBadge && (
            <span className={`card-due-badge card-due-${dueBadge.tone}`}>
              <Clock3 size={11} />
              {dueBadge.label}
            </span>
          )}
          {recurrenceLabel && (
            <span className="card-recurrence-badge">{recurrenceLabel}</span>
          )}
          {checklistProgressLabel && (
            <span className="card-checklist-badge">
              {checklistProgressLabel}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="card-footer">
        <div className="card-footer-left">
          <span className="card-date">{relativeDate}</span>
          {canShowFocusActions && isFocusActive && (
            <span className="card-focus-chip" title={focusElapsedLabel}>
              <Timer size={11} />
              {focusElapsedLabel}
            </span>
          )}
        </div>
        <div className="card-status-actions">
          {canShowFocusActions && (
            <button
              className={`status-btn status-btn-focus${isFocusActive ? " status-btn-focus-active" : ""}`}
              onClick={() =>
                isFocusActive ? onStopFocus?.(task) : onStartFocus?.(task)
              }
              title={focusButtonTitle}
              disabled={focusButtonDisabled}
            >
              {isFocusActive ? <Square size={13} /> : <Play size={13} />}
            </button>
          )}
          {prevStatus && (
            <button
              className="status-btn"
              onClick={() => onStatusChange(task.id, prevStatus)}
              title={t("taskCard.action.moveTo", {
                status: getStatusLabel(prevStatus, locale),
              })}
            >
              <ChevronLeft size={14} />
            </button>
          )}
          {nextStatus && (
            <button
              className="status-btn status-btn-forward"
              onClick={() => onStatusChange(task.id, nextStatus)}
              title={t("taskCard.action.moveTo", {
                status: getStatusLabel(nextStatus, locale),
              })}
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getNextStatus(current: TaskStatus): TaskStatus | null {
  const flow: Record<string, TaskStatus> = { TODO: "DOING", DOING: "DONE" };
  return flow[current] ?? null;
}

function getPrevStatus(current: TaskStatus): TaskStatus | null {
  const flow: Record<string, TaskStatus> = { DOING: "TODO", DONE: "DOING" };
  return flow[current] ?? null;
}

function formatFocusDuration(totalSeconds: number): string {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;

  const paddedMinutes = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${paddedMinutes}:${paddedSeconds}`;
}

function getRelativeDate(dateStr: string, locale: "en" | "th"): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return translate(locale, "taskForm.relative.justNow");
  if (diffMins < 60) {
    return translate(locale, "taskForm.relative.minutesAgo", {
      count: diffMins,
    });
  }
  if (diffHours < 24) {
    return translate(locale, "taskForm.relative.hoursAgo", {
      count: diffHours,
    });
  }
  if (diffDays < 7) {
    return translate(locale, "taskForm.relative.daysAgo", { count: diffDays });
  }
  return date.toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

type DueBadgeTone = "overdue" | "today" | "upcoming" | "neutral";

interface DueBadge {
  label: string;
  tone: DueBadgeTone;
}

function getDueBadge(task: Task, locale: "en" | "th"): DueBadge | null {
  if (!task.due_at) return null;

  const dueDate = new Date(task.due_at);
  if (Number.isNaN(dueDate.getTime())) return null;

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const formatLocale = locale === "th" ? "th-TH" : "en-US";
  const formattedDate = dueDate.toLocaleDateString(formatLocale, {
    month: "short",
    day: "numeric",
  });
  const formattedTime = dueDate.toLocaleTimeString(formatLocale, {
    hour: "numeric",
    minute: "2-digit",
  });

  const isDone = task.status === "DONE";
  if (!isDone && dueDate < now) {
    return {
      label: translate(locale, "taskCard.due.overdue", {
        date: formattedDate,
        time: formattedTime,
      }),
      tone: "overdue",
    };
  }
  if (dueDate >= todayStart && dueDate < todayEnd) {
    return {
      label: translate(locale, "taskCard.due.today", {
        time: formattedTime,
      }),
      tone: "today",
    };
  }
  if (dueDate >= todayEnd) {
    return {
      label: translate(locale, "taskCard.due.default", {
        date: formattedDate,
        time: formattedTime,
      }),
      tone: "upcoming",
    };
  }
  return {
    label: translate(locale, "taskCard.due.default", {
      date: formattedDate,
      time: formattedTime,
    }),
    tone: "neutral",
  };
}

function getRecurrenceLabel(
  taskRecurrence: Task["recurrence"],
  locale: "en" | "th",
): string | null {
  if (taskRecurrence === "DAILY") {
    return translate(locale, "taskCard.recurrence.daily");
  }
  if (taskRecurrence === "WEEKLY") {
    return translate(locale, "taskCard.recurrence.weekly");
  }
  if (taskRecurrence === "MONTHLY") {
    return translate(locale, "taskCard.recurrence.monthly");
  }
  return null;
}

function getChecklistProgressLabel(
  progress: TaskCardProps["subtaskProgress"],
  locale: "en" | "th",
): string | null {
  if (!progress) return null;
  if (progress.total <= 0) return null;
  return translate(locale, "taskCard.checklist.progress", {
    done: progress.done,
    total: progress.total,
  });
}

function getStatusLabel(status: TaskStatus, locale: "en" | "th"): string {
  if (status === "TODO") return translate(locale, "taskForm.status.todo");
  if (status === "DOING") return translate(locale, "taskForm.status.doing");
  if (status === "DONE") return translate(locale, "taskForm.status.done");
  return translate(locale, "taskForm.status.archived");
}

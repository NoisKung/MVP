import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import {
  AlertTriangle,
  Minus,
  ArrowDown,
  Star,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Clock3,
} from "lucide-react";
import { useState } from "react";

const PRIORITY_CONFIG: Record<
  TaskPriority,
  {
    color: string;
    bg: string;
    label: string;
    icon: React.ReactNode;
  }
> = {
  URGENT: {
    color: "var(--danger)",
    bg: "var(--danger-subtle)",
    label: "Urgent",
    icon: <AlertTriangle size={11} />,
  },
  NORMAL: {
    color: "var(--accent)",
    bg: "var(--accent-subtle)",
    label: "Normal",
    icon: <Minus size={11} />,
  },
  LOW: {
    color: "var(--text-muted)",
    bg: "var(--bg-hover)",
    label: "Low",
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
}: TaskCardProps) {
  const [showActions, setShowActions] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const nextStatus = getNextStatus(task.status);
  const prevStatus = getPrevStatus(task.status);
  const dueBadge = getDueBadge(task);
  const recurrenceLabel = getRecurrenceLabel(task.recurrence);
  const checklistProgressLabel = getChecklistProgressLabel(subtaskProgress);

  const relativeDate = getRelativeDate(task.created_at);

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
        <span
          className="card-priority"
          style={{ color: priorityConfig.color, background: priorityConfig.bg }}
        >
          {priorityConfig.icon}
          {priorityConfig.label}
        </span>
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
              title="Delete"
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
        <span className="card-date">{relativeDate}</span>
        <div className="card-status-actions">
          {prevStatus && (
            <button
              className="status-btn"
              onClick={() => onStatusChange(task.id, prevStatus)}
              title={`Move to ${prevStatus}`}
            >
              <ChevronLeft size={14} />
            </button>
          )}
          {nextStatus && (
            <button
              className="status-btn status-btn-forward"
              onClick={() => onStatusChange(task.id, nextStatus)}
              title={`Move to ${nextStatus}`}
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

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type DueBadgeTone = "overdue" | "today" | "upcoming" | "neutral";

interface DueBadge {
  label: string;
  tone: DueBadgeTone;
}

function getDueBadge(task: Task): DueBadge | null {
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

  const formattedDate = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const formattedTime = dueDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const isDone = task.status === "DONE";
  if (!isDone && dueDate < now) {
    return {
      label: `Overdue • ${formattedDate} ${formattedTime}`,
      tone: "overdue",
    };
  }
  if (dueDate >= todayStart && dueDate < todayEnd) {
    return { label: `Due today • ${formattedTime}`, tone: "today" };
  }
  if (dueDate >= todayEnd) {
    return {
      label: `Due • ${formattedDate} ${formattedTime}`,
      tone: "upcoming",
    };
  }
  return { label: `Due • ${formattedDate} ${formattedTime}`, tone: "neutral" };
}

function getRecurrenceLabel(taskRecurrence: Task["recurrence"]): string | null {
  if (taskRecurrence === "DAILY") return "Repeats daily";
  if (taskRecurrence === "WEEKLY") return "Repeats weekly";
  if (taskRecurrence === "MONTHLY") return "Repeats monthly";
  return null;
}

function getChecklistProgressLabel(
  progress: TaskCardProps["subtaskProgress"],
): string | null {
  if (!progress) return null;
  if (progress.total <= 0) return null;
  return `Checklist ${progress.done}/${progress.total}`;
}

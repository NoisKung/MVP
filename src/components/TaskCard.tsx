import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import {
  AlertTriangle,
  Minus,
  ArrowDown,
  Star,
  ChevronRight,
  ChevronLeft,
  Trash2,
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
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  onEdit,
  onStatusChange,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging = false,
}: TaskCardProps) {
  const [showActions, setShowActions] = useState(false);
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const nextStatus = getNextStatus(task.status);
  const prevStatus = getPrevStatus(task.status);

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

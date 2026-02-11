import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
    URGENT: { color: "#ef4444", label: "Urgent" },
    NORMAL: { color: "#6c63ff", label: "Normal" },
    LOW: { color: "#9090b0", label: "Low" },
};

const STATUS_EMOJI: Record<TaskStatus, string> = {
    TODO: "📋",
    DOING: "⚡",
    DONE: "✅",
    ARCHIVED: "📦",
};

interface TaskCardProps {
    task: Task;
    onEdit: (task: Task) => void;
    onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
    onDelete: (taskId: string) => void;
}

export function TaskCard({ task, onEdit, onStatusChange, onDelete }: TaskCardProps) {
    const priorityConfig = PRIORITY_CONFIG[task.priority];
    const nextStatus = getNextStatus(task.status);
    const prevStatus = getPrevStatus(task.status);

    const createdDate = new Date(task.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });

    return (
        <div className="task-card animate-fade-in" style={{ animationDelay: "0.05s" }}>
            <div className="task-card-top">
                <span
                    className="task-priority-badge"
                    style={{
                        color: priorityConfig.color,
                        backgroundColor: `${priorityConfig.color}1a`,
                    }}
                >
                    {priorityConfig.label}
                </span>
                {!!task.is_important && <span className="task-important-star">★</span>}
            </div>

            <h3 className="task-title" onClick={() => onEdit(task)}>
                {task.title}
            </h3>

            {task.description && (
                <p className="task-description">{task.description}</p>
            )}

            <div className="task-card-bottom">
                <span className="task-date">{createdDate}</span>
                <div className="task-actions">
                    {prevStatus && (
                        <button
                            className="task-action-btn"
                            onClick={() => onStatusChange(task.id, prevStatus)}
                            title={`Move to ${prevStatus}`}
                        >
                            ←
                        </button>
                    )}
                    {nextStatus && (
                        <button
                            className="task-action-btn task-action-forward"
                            onClick={() => onStatusChange(task.id, nextStatus)}
                            title={`Move to ${nextStatus}`}
                        >
                            {STATUS_EMOJI[nextStatus]} →
                        </button>
                    )}
                    <button
                        className="task-action-btn task-action-delete"
                        onClick={() => onDelete(task.id)}
                        title="Delete task"
                    >
                        🗑
                    </button>
                </div>
            </div>

            <style>{`
        .task-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 16px;
          transition: all var(--transition);
          cursor: default;
        }
        .task-card:hover {
          background: var(--color-bg-card-hover);
          border-color: var(--color-border-focus);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }
        .task-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .task-priority-badge {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .task-important-star {
          color: var(--color-warning);
          font-size: 1.1rem;
        }
        .task-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 6px;
          cursor: pointer;
          transition: color var(--transition);
          line-height: 1.4;
        }
        .task-title:hover {
          color: var(--color-accent);
        }
        .task-description {
          font-size: 0.82rem;
          color: var(--color-text-muted);
          line-height: 1.5;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .task-card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--color-border);
        }
        .task-date {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }
        .task-actions {
          display: flex;
          gap: 4px;
        }
        .task-action-btn {
          background: none;
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.8rem;
          transition: all var(--transition);
        }
        .task-action-btn:hover {
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
          border-color: var(--color-text-muted);
        }
        .task-action-forward:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }
        .task-action-delete:hover {
          border-color: var(--color-danger);
          color: var(--color-danger);
        }
      `}</style>
        </div>
    );
}

/** Get the next logical status in the workflow */
function getNextStatus(current: TaskStatus): TaskStatus | null {
    const flow: Record<string, TaskStatus> = {
        TODO: "DOING",
        DOING: "DONE",
    };
    return flow[current] ?? null;
}

/** Get the previous logical status in the workflow */
function getPrevStatus(current: TaskStatus): TaskStatus | null {
    const flow: Record<string, TaskStatus> = {
        DOING: "TODO",
        DONE: "DOING",
    };
    return flow[current] ?? null;
}

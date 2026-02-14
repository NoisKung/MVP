import { useState, useEffect } from "react";
import type {
  Task,
  TaskChangelog,
  CreateTaskInput,
  UpdateTaskInput,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import { X, AlertTriangle, Minus, ArrowDown, Star } from "lucide-react";
import { useTaskChangelogs } from "@/hooks/use-tasks";

const PRIORITIES: {
  value: TaskPriority;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
    {
      value: "URGENT",
      label: "Urgent",
      icon: <AlertTriangle size={13} />,
      color: "var(--danger)",
    },
    {
      value: "NORMAL",
      label: "Normal",
      icon: <Minus size={13} />,
      color: "var(--accent)",
    },
    {
      value: "LOW",
      label: "Low",
      icon: <ArrowDown size={13} />,
      color: "var(--text-muted)",
    },
  ];

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  DOING: "In Progress",
  DONE: "Done",
  ARCHIVED: "Archived",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  URGENT: "Urgent",
  NORMAL: "Normal",
  LOW: "Low",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unable to load changelog.";
}

function formatChangelogValue(
  fieldName: string | null,
  value: string | null,
): string {
  if (!value) return "Empty";

  if (fieldName === "status" && value in STATUS_LABELS) {
    return STATUS_LABELS[value as TaskStatus];
  }

  if (fieldName === "priority" && value in PRIORITY_LABELS) {
    return PRIORITY_LABELS[value as TaskPriority];
  }

  if (fieldName === "is_important") {
    return value === "true" ? "Important" : "Not important";
  }

  return value;
}

function formatChangelogMessage(log: TaskChangelog): string {
  if (log.action === "CREATED") {
    return `Task created: ${formatChangelogValue(null, log.new_value)}`;
  }

  const fieldLabel =
    log.field_name === "status"
      ? "Status"
      : log.field_name === "priority"
        ? "Priority"
        : log.field_name === "title"
          ? "Title"
          : log.field_name === "description"
            ? "Description"
            : log.field_name === "is_important"
              ? "Importance"
              : "Task";

  return `${fieldLabel} changed from ${formatChangelogValue(log.field_name, log.old_value)} to ${formatChangelogValue(log.field_name, log.new_value)}`;
}

function formatRelativeDate(dateStr: string): string {
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

interface TaskFormProps {
  task?: Task | null;
  onSubmit: (input: CreateTaskInput | UpdateTaskInput) => void;
  onClose: () => void;
}

export function TaskForm({ task, onSubmit, onClose }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [isImportant, setIsImportant] = useState(false);

  const isEditing = !!task;
  const {
    data: changelogs = [],
    isLoading: isLoadingChangelog,
    isError: isChangelogError,
    error: changelogError,
  } = useTaskChangelogs(task?.id);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setIsImportant(!!task.is_important);
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("NORMAL");
    setIsImportant(false);
  }, [task]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    if (isEditing && task) {
      const input: UpdateTaskInput = {
        id: task.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        is_important: isImportant,
        status: task.status,
      };
      onSubmit(input);
    } else {
      const input: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        is_important: isImportant,
      };
      onSubmit(input);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? "Edit Task" : "New Task"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="field">
            <label className="field-label" htmlFor="task-title">
              Title
            </label>
            <input
              id="task-title"
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="field">
            <label className="field-label" htmlFor="task-desc">
              Description <span className="optional">(optional)</span>
            </label>
            <textarea
              id="task-desc"
              className="input textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
            />
          </div>

          {/* Priority & Important */}
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Priority</label>
              <div className="priority-group">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`priority-option ${priority === p.value ? "selected" : ""}`}
                    onClick={() => setPriority(p.value)}
                    style={{
                      borderColor: priority === p.value ? p.color : undefined,
                      color: priority === p.value ? p.color : undefined,
                    }}
                  >
                    {p.icon}
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label">Importance</label>
              <button
                type="button"
                className={`important-toggle ${isImportant ? "active" : ""}`}
                onClick={() => setIsImportant(!isImportant)}
              >
                <Star
                  size={14}
                  fill={isImportant ? "var(--warning)" : "none"}
                  color={isImportant ? "var(--warning)" : "var(--text-muted)"}
                />
                {isImportant ? "Important" : "Mark important"}
              </button>
            </div>
          </div>

          {isEditing && (
            <div className="changelog-section">
              <h3 className="changelog-title">Recent Changes</h3>
              {isLoadingChangelog ? (
                <p className="changelog-state">Loading changelog...</p>
              ) : isChangelogError ? (
                <p className="changelog-state changelog-state-error">
                  {getErrorMessage(changelogError)}
                </p>
              ) : changelogs.length === 0 ? (
                <p className="changelog-state">No changes recorded yet.</p>
              ) : (
                <div className="changelog-list">
                  {changelogs.map((log) => (
                    <div key={log.id} className="changelog-item">
                      <p className="changelog-message">
                        {formatChangelogMessage(log)}
                      </p>
                      <span className="changelog-date">
                        {formatRelativeDate(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={!title.trim()}
            >
              {isEditing ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl);
          width: 460px;
          max-width: 92vw;
          box-shadow: var(--shadow-lg);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px 0;
        }
        .modal-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
        }
        .modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: none;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .modal-close:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        form {
          padding: 20px 24px 24px;
        }
        .field {
          margin-bottom: 16px;
        }
        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        .optional {
          font-weight: 400;
          color: var(--text-disabled);
        }
        .input {
          width: 100%;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          padding: 9px 12px;
          font-size: 13px;
          font-family: inherit;
          line-height: 1.5;
          transition: border-color var(--duration) var(--ease);
          outline: none;
        }
        .input:focus {
          border-color: var(--border-focus);
        }
        .input::placeholder {
          color: var(--text-disabled);
        }
        .textarea {
          resize: vertical;
          min-height: 72px;
        }

        .field-row {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .priority-group {
          display: flex;
          gap: 6px;
        }
        .priority-option {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: none;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .priority-option:hover {
          background: var(--bg-hover);
          border-color: var(--border-strong);
        }
        .priority-option.selected {
          background: var(--bg-elevated);
        }

        .important-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: none;
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
          white-space: nowrap;
        }
        .important-toggle:hover {
          background: var(--bg-hover);
        }
        .important-toggle.active {
          border-color: var(--warning);
          color: var(--warning);
          background: var(--warning-subtle);
        }

        .changelog-section {
          margin: 8px 0 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-default);
        }
        .changelog-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .changelog-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 128px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .changelog-item {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          padding: 8px 10px;
        }
        .changelog-message {
          font-size: 12px;
          color: var(--text-primary);
          line-height: 1.45;
        }
        .changelog-date {
          margin-top: 4px;
          display: inline-block;
          font-size: 11px;
          color: var(--text-disabled);
        }
        .changelog-state {
          font-size: 12px;
          color: var(--text-muted);
        }
        .changelog-state-error {
          color: var(--danger);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
          padding-top: 16px;
          border-top: 1px solid var(--border-default);
        }
        .btn-cancel {
          padding: 8px 16px;
          background: none;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .btn-cancel:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .btn-submit {
          padding: 8px 20px;
          background: var(--accent);
          border: none;
          border-radius: var(--radius-md);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .btn-submit:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: var(--shadow-glow);
        }
        .btn-submit:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ===== Responsive ===== */
        @media (max-width: 640px) {
          .modal {
            width: 100%;
            max-width: 100%;
            height: 100%;
            border-radius: 0;
            border: none;
            display: flex;
            flex-direction: column;
          }
          .modal-header {
            padding: 16px 16px 0;
          }
          form {
            padding: 16px;
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
          .modal-actions {
            margin-top: auto;
            padding-top: 16px;
          }
          .field-row {
            flex-direction: column;
            gap: 0;
          }
        }

        @media (max-width: 480px) {
          .priority-group {
            flex-direction: column;
            gap: 4px;
          }
          .priority-option {
            justify-content: center;
            padding: 8px 12px;
          }
        }
      `}</style>
    </div>
  );
}

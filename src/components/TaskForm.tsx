import { useState, useEffect } from "react";
import type { Task, CreateTaskInput, UpdateTaskInput, TaskPriority } from "@/lib/types";

/* ===== Priority & Status Styling Constants ===== */
const PRIORITY_STYLES: Record<TaskPriority, { bg: string; text: string; label: string }> = {
    URGENT: { bg: "#ef44441a", text: "#ef4444", label: "Urgent" },
    NORMAL: { bg: "#6c63ff1a", text: "#6c63ff", label: "Normal" },
    LOW: { bg: "#9090b01a", text: "#9090b0", label: "Low" },
};

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

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description ?? "");
            setPriority(task.priority);
            setIsImportant(!!task.is_important);
        }
    }, [task]);

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
        <div className="task-form-overlay" onClick={onClose}>
            <div className="task-form-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <div className="task-form-header">
                    <h2>{isEditing ? "Edit Task" : "New Task"}</h2>
                    <button className="task-form-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="task-title">Title</label>
                        <input
                            id="task-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="task-desc">Description</label>
                        <textarea
                            id="task-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add details (optional)"
                            rows={3}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Priority</label>
                            <div className="priority-buttons">
                                {(Object.keys(PRIORITY_STYLES) as TaskPriority[]).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        className={`priority-btn ${priority === p ? "active" : ""}`}
                                        style={{
                                            backgroundColor: priority === p ? PRIORITY_STYLES[p].bg : "transparent",
                                            color: priority === p ? PRIORITY_STYLES[p].text : "var(--color-text-muted)",
                                            borderColor: priority === p ? PRIORITY_STYLES[p].text : "var(--color-border)",
                                        }}
                                        onClick={() => setPriority(p)}
                                    >
                                        {PRIORITY_STYLES[p].label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="important-label">
                                <input
                                    type="checkbox"
                                    checked={isImportant}
                                    onChange={(e) => setIsImportant(e.target.checked)}
                                />
                                <span className="checkmark">★</span>
                                Important
                            </label>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary">
                            {isEditing ? "Save Changes" : "Create Task"}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
        .task-form-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .task-form-modal {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          width: 480px;
          max-width: 90vw;
          padding: 28px;
        }
        .task-form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .task-form-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
          background: linear-gradient(135deg, var(--color-text-primary), var(--color-accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .task-form-close {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          font-size: 1.1rem;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all var(--transition);
        }
        .task-form-close:hover {
          background: var(--color-bg-card);
          color: var(--color-text-primary);
        }
        .form-group {
          margin-bottom: 18px;
        }
        .form-group label {
          display: block;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-group input[type="text"],
        .form-group textarea {
          width: 100%;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-text-primary);
          padding: 10px 14px;
          font-size: 0.95rem;
          font-family: inherit;
          transition: border-color var(--transition);
          outline: none;
          resize: vertical;
        }
        .form-group input[type="text"]:focus,
        .form-group textarea:focus {
          border-color: var(--color-border-focus);
        }
        .form-row {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .priority-buttons {
          display: flex;
          gap: 8px;
        }
        .priority-btn {
          padding: 6px 14px;
          border: 1px solid;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 500;
          transition: all var(--transition);
          font-family: inherit;
        }
        .priority-btn:hover {
          opacity: 0.85;
        }
        .important-label {
          display: flex !important;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          margin-top: 6px;
        }
        .important-label input[type="checkbox"] {
          display: none;
        }
        .checkmark {
          font-size: 1.2rem;
          color: var(--color-text-muted);
          transition: color var(--transition);
        }
        .important-label input:checked + .checkmark {
          color: var(--color-warning);
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }
        .btn-secondary {
          padding: 10px 20px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          cursor: pointer;
          font-size: 0.9rem;
          font-family: inherit;
          transition: all var(--transition);
        }
        .btn-secondary:hover {
          background: var(--color-bg-card-hover);
          color: var(--color-text-primary);
        }
        .btn-primary {
          padding: 10px 24px;
          background: var(--color-accent);
          border: none;
          border-radius: var(--radius-sm);
          color: #fff;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          font-family: inherit;
          transition: all var(--transition);
        }
        .btn-primary:hover {
          background: var(--color-accent-hover);
          box-shadow: 0 0 16px var(--color-accent-glow);
        }
      `}</style>
        </div>
    );
}

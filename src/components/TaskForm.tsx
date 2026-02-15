import { useState, useEffect } from "react";
import type {
  Task,
  TaskTemplate,
  TaskChangelog,
  CreateTaskInput,
  UpdateTaskInput,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from "@/lib/types";
import {
  X,
  AlertTriangle,
  Minus,
  ArrowDown,
  Star,
  CalendarClock,
  Bell,
  Repeat2,
  BookmarkPlus,
  Trash2,
} from "lucide-react";
import {
  useDeleteTaskTemplate,
  useTaskChangelogs,
  useTaskTemplates,
  useUpsertTaskTemplate,
} from "@/hooks/use-tasks";

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

const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  NONE: "Does not repeat",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unable to complete the request.";
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

  if (
    (fieldName === "due_at" || fieldName === "remind_at") &&
    !Number.isNaN(new Date(value).getTime())
  ) {
    return formatDateTimeForDisplay(value);
  }

  if (fieldName === "recurrence" && value in RECURRENCE_LABELS) {
    return RECURRENCE_LABELS[value as TaskRecurrence];
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
              : log.field_name === "due_at"
                ? "Due date"
                : log.field_name === "remind_at"
                  ? "Reminder"
                  : log.field_name === "recurrence"
                    ? "Repeat"
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

function formatDateTimeForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toInputDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  const localDateTime = new Date(date.getTime() - timezoneOffsetMs);
  return localDateTime.toISOString().slice(0, 16);
}

function toIsoDateTime(dateTimeInput: string): string | null {
  if (!dateTimeInput) return null;
  const parsedDate = new Date(dateTimeInput);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.toISOString();
}

function getOffsetMinutesFromIsoDateTime(
  isoDateTime: string | null,
  referenceDate: Date,
): number | null {
  if (!isoDateTime) return null;
  const parsedDate = new Date(isoDateTime);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return Math.max(
    0,
    Math.round((parsedDate.getTime() - referenceDate.getTime()) / 60000),
  );
}

function toInputDateTimeFromOffset(
  offsetMinutes: number | null,
  referenceDate: Date,
): string {
  if (offsetMinutes === null) return "";
  const offsetDate = new Date(referenceDate.getTime() + offsetMinutes * 60000);
  return toInputDateTime(offsetDate.toISOString());
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
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrence>("NONE");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  const isEditing = !!task;
  const { data: taskTemplates = [], isLoading: isLoadingTaskTemplates } =
    useTaskTemplates(!isEditing);
  const upsertTaskTemplate = useUpsertTaskTemplate();
  const deleteTaskTemplate = useDeleteTaskTemplate();
  const {
    data: changelogs = [],
    isLoading: isLoadingChangelog,
    isError: isChangelogError,
    error: changelogError,
  } = useTaskChangelogs(task?.id);
  const selectedTemplate =
    taskTemplates.find((template) => template.id === selectedTemplateId) ??
    null;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setIsImportant(!!task.is_important);
      setDueAt(toInputDateTime(task.due_at));
      setRemindAt(toInputDateTime(task.remind_at));
      setRecurrence(task.recurrence ?? "NONE");
      setSelectedTemplateId("");
      setTemplateError(null);
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("NORMAL");
    setIsImportant(false);
    setDueAt("");
    setRemindAt("");
    setRecurrence("NONE");
    setSelectedTemplateId("");
    setTimeError(null);
    setTemplateError(null);
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

    const dueAtIso = toIsoDateTime(dueAt);
    const remindAtIso = toIsoDateTime(remindAt);

    if (dueAt && !dueAtIso) {
      setTimeError("Due date format is invalid.");
      return;
    }
    if (remindAt && !remindAtIso) {
      setTimeError("Reminder format is invalid.");
      return;
    }
    if (dueAtIso && remindAtIso && remindAtIso > dueAtIso) {
      setTimeError("Reminder must be set before the due date.");
      return;
    }
    if (recurrence !== "NONE" && !dueAtIso) {
      setTimeError("Recurring tasks require a due date.");
      return;
    }
    setTimeError(null);

    if (isEditing && task) {
      const input: UpdateTaskInput = {
        id: task.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        is_important: isImportant,
        status: task.status,
        due_at: dueAtIso,
        remind_at: remindAtIso,
        recurrence,
      };
      onSubmit(input);
    } else {
      const input: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        is_important: isImportant,
        due_at: dueAtIso,
        remind_at: remindAtIso,
        recurrence,
      };
      onSubmit(input);
    }
  };

  const applyTaskTemplate = (template: TaskTemplate) => {
    const now = new Date();
    setTitle(template.title_template ?? "");
    setDescription(template.description ?? "");
    setPriority(template.priority);
    setIsImportant(Boolean(template.is_important));
    setDueAt(toInputDateTimeFromOffset(template.due_offset_minutes, now));
    setRemindAt(toInputDateTimeFromOffset(template.remind_offset_minutes, now));
    setRecurrence(template.recurrence ?? "NONE");
    setTimeError(null);
    setTemplateError(null);
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return;
    applyTaskTemplate(selectedTemplate);
  };

  const handleSaveTemplate = async () => {
    if (isEditing) return;

    const suggestedName =
      selectedTemplate?.name ??
      (title.trim() ? `${title.trim().slice(0, 40)} Template` : "My Template");
    const inputName = window.prompt("Template name", suggestedName);
    if (!inputName) return;

    const normalizedName = inputName.trim();
    if (!normalizedName) return;

    const dueAtIso = toIsoDateTime(dueAt);
    const remindAtIso = toIsoDateTime(remindAt);

    if (dueAt && !dueAtIso) {
      setTemplateError("Due date format is invalid.");
      return;
    }
    if (remindAt && !remindAtIso) {
      setTemplateError("Reminder format is invalid.");
      return;
    }
    if (dueAtIso && remindAtIso && remindAtIso > dueAtIso) {
      setTemplateError("Reminder must be set before the due date.");
      return;
    }
    if (recurrence !== "NONE" && !dueAtIso) {
      setTemplateError("Recurring templates require a due date.");
      return;
    }

    const now = new Date();
    const dueOffsetMinutes = getOffsetMinutesFromIsoDateTime(dueAtIso, now);
    let remindOffsetMinutes = getOffsetMinutesFromIsoDateTime(remindAtIso, now);
    if (
      dueOffsetMinutes !== null &&
      remindOffsetMinutes !== null &&
      remindOffsetMinutes > dueOffsetMinutes
    ) {
      remindOffsetMinutes = dueOffsetMinutes;
    }

    try {
      const savedTemplate = await upsertTaskTemplate.mutateAsync({
        id: selectedTemplateId || undefined,
        name: normalizedName,
        title_template: title.trim() || null,
        description: description.trim() || null,
        priority,
        is_important: isImportant,
        due_offset_minutes: dueOffsetMinutes,
        remind_offset_minutes: remindOffsetMinutes,
        recurrence,
      });
      setSelectedTemplateId(savedTemplate.id);
      setTemplateError(null);
    } catch (error) {
      setTemplateError(getErrorMessage(error));
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (
      !window.confirm(`Delete template "${selectedTemplate.name}" permanently?`)
    ) {
      return;
    }

    try {
      await deleteTaskTemplate.mutateAsync(selectedTemplate.id);
      setSelectedTemplateId("");
      setTemplateError(null);
    } catch (error) {
      setTemplateError(getErrorMessage(error));
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

          {!isEditing && (
            <div className="template-section">
              <label className="field-label" htmlFor="task-template">
                Template
              </label>
              <div className="template-row">
                <select
                  id="task-template"
                  className="input"
                  value={selectedTemplateId}
                  onChange={(event) =>
                    setSelectedTemplateId(event.target.value)
                  }
                >
                  <option value="">Select a template...</option>
                  {taskTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="template-btn"
                  onClick={handleApplyTemplate}
                  disabled={!selectedTemplate || isLoadingTaskTemplates}
                >
                  Apply
                </button>
              </div>
              <div className="template-actions">
                <button
                  type="button"
                  className="template-btn"
                  onClick={() => void handleSaveTemplate()}
                  disabled={upsertTaskTemplate.isPending}
                >
                  <BookmarkPlus size={12} />
                  {upsertTaskTemplate.isPending ? "Saving..." : "Save Template"}
                </button>
                <button
                  type="button"
                  className="template-btn template-btn-danger"
                  onClick={() => void handleDeleteTemplate()}
                  disabled={!selectedTemplate || deleteTaskTemplate.isPending}
                >
                  <Trash2 size={12} />
                  {deleteTaskTemplate.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}

          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label" htmlFor="task-due-at">
                <CalendarClock size={12} />
                Due date & time
              </label>
              <input
                id="task-due-at"
                type="datetime-local"
                className="input"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>

            <div className="field" style={{ flex: 1 }}>
              <label className="field-label" htmlFor="task-remind-at">
                <Bell size={12} />
                Reminder
              </label>
              <input
                id="task-remind-at"
                type="datetime-local"
                className="input"
                value={remindAt}
                onChange={(event) => setRemindAt(event.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="task-recurrence">
              <Repeat2 size={12} />
              Repeat
            </label>
            <select
              id="task-recurrence"
              className="input"
              value={recurrence}
              onChange={(event) =>
                setRecurrence(event.target.value as TaskRecurrence)
              }
            >
              <option value="NONE">Does not repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
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

          {timeError && <p className="form-error">{timeError}</p>}
          {templateError && <p className="form-error">{templateError}</p>}

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
          display: inline-flex;
          align-items: center;
          gap: 6px;
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
        select.input {
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
            linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
          background-position:
            calc(100% - 14px) calc(50% - 2px),
            calc(100% - 9px) calc(50% - 2px);
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
          padding-right: 28px;
        }
        .textarea {
          resize: vertical;
          min-height: 72px;
        }

        .template-section {
          margin-bottom: 16px;
          padding: 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
        }
        .template-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .template-actions {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .template-btn {
          height: 30px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 0 10px;
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .template-btn:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .template-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .template-btn-danger:hover:not(:disabled) {
          color: var(--danger);
          border-color: var(--danger);
          background: var(--danger-subtle);
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
        .form-error {
          margin-top: -4px;
          margin-bottom: 10px;
          font-size: 12px;
          color: var(--danger);
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
          .template-row {
            flex-direction: column;
            align-items: stretch;
          }
          .template-actions {
            flex-direction: column;
          }
          .template-btn {
            width: 100%;
            justify-content: center;
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

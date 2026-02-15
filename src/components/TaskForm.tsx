import { useState, useEffect, useMemo } from "react";
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
  Plus,
  Check,
} from "lucide-react";
import {
  useCreateTaskSubtask,
  useCreateProject,
  useDeleteTaskTemplate,
  useDeleteTaskSubtask,
  useProjects,
  useTaskSubtasks,
  useTaskChangelogs,
  useTaskTemplates,
  useUpdateTaskSubtask,
  useUpsertTaskTemplate,
} from "@/hooks/use-tasks";
import { parseNaturalDueDate } from "@/lib/natural-date";
import { renderMarkdownToHtml } from "@/lib/markdown";

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
  if (fieldName === "project_id") {
    return value ? `Project (${value.slice(0, 8)})` : "No project";
  }

  if (!value) return "Empty";

  if (fieldName === "notes_markdown") {
    const collapsedValue = value.replace(/\s+/g, " ").trim();
    if (!collapsedValue) return "Empty";
    if (collapsedValue.length <= 56) return collapsedValue;
    return `${collapsedValue.slice(0, 53)}...`;
  }

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
            : log.field_name === "notes_markdown"
              ? "Notes"
              : log.field_name === "is_important"
                ? "Importance"
                : log.field_name === "due_at"
                  ? "Due date"
                  : log.field_name === "remind_at"
                    ? "Reminder"
                    : log.field_name === "recurrence"
                      ? "Repeat"
                      : log.field_name === "project_id"
                        ? "Project"
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

function normalizeNotesMarkdownInput(notesMarkdown: string): string | null {
  const normalizedNotes = notesMarkdown.replace(/\r\n/g, "\n");
  if (!normalizedNotes.trim()) return null;
  return normalizedNotes;
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

interface DraftSubtask {
  id: string;
  title: string;
  is_done: boolean;
}

function createDraftSubtaskId(): string {
  return `draft-subtask-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

interface TaskFormProps {
  task?: Task | null;
  initialProjectId?: string | null;
  onSubmit: (input: CreateTaskInput | UpdateTaskInput) => void;
  onClose: () => void;
}

export function TaskForm({
  task,
  initialProjectId = null,
  onSubmit,
  onClose,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notesMarkdown, setNotesMarkdown] = useState("");
  const [notesMode, setNotesMode] = useState<"edit" | "preview">("edit");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [isImportant, setIsImportant] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrence>("NONE");
  const [projectId, setProjectId] = useState("");
  const [naturalDueText, setNaturalDueText] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [draftSubtasks, setDraftSubtasks] = useState<DraftSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [subtaskError, setSubtaskError] = useState<string | null>(null);

  const isEditing = !!task;
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const { data: taskTemplates = [], isLoading: isLoadingTaskTemplates } =
    useTaskTemplates(!isEditing);
  const { data: persistedSubtasks = [], isLoading: isLoadingSubtasks } =
    useTaskSubtasks(task?.id, isEditing);
  const upsertTaskTemplate = useUpsertTaskTemplate();
  const deleteTaskTemplate = useDeleteTaskTemplate();
  const createProject = useCreateProject();
  const createTaskSubtask = useCreateTaskSubtask();
  const updateTaskSubtask = useUpdateTaskSubtask();
  const deleteTaskSubtask = useDeleteTaskSubtask();
  const {
    data: changelogs = [],
    isLoading: isLoadingChangelog,
    isError: isChangelogError,
    error: changelogError,
  } = useTaskChangelogs(task?.id);
  const selectedTemplate =
    taskTemplates.find((template) => template.id === selectedTemplateId) ??
    null;
  const checklistItems = isEditing
    ? persistedSubtasks.map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        is_done: Boolean(subtask.is_done),
      }))
    : draftSubtasks;
  const completedSubtaskCount = checklistItems.filter(
    (subtask) => subtask.is_done,
  ).length;
  const isSubtaskMutating =
    createTaskSubtask.isPending ||
    updateTaskSubtask.isPending ||
    deleteTaskSubtask.isPending;
  const notesPreviewHtml = useMemo(
    () => renderMarkdownToHtml(notesMarkdown),
    [notesMarkdown],
  );

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setNotesMarkdown(task.notes_markdown ?? "");
      setNotesMode("edit");
      setPriority(task.priority);
      setIsImportant(!!task.is_important);
      setDueAt(toInputDateTime(task.due_at));
      setRemindAt(toInputDateTime(task.remind_at));
      setRecurrence(task.recurrence ?? "NONE");
      setProjectId(task.project_id ?? "");
      setTimeError(null);
      setProjectError(null);
      setSelectedTemplateId("");
      setTemplateError(null);
      setDraftSubtasks([]);
      setNewSubtaskTitle("");
      setSubtaskError(null);
      setNaturalDueText("");
      return;
    }

    setTitle("");
    setDescription("");
    setNotesMarkdown("");
    setNotesMode("edit");
    setPriority("NORMAL");
    setIsImportant(false);
    setDueAt("");
    setRemindAt("");
    setRecurrence("NONE");
    setProjectId(initialProjectId ?? "");
    setSelectedTemplateId("");
    setTimeError(null);
    setProjectError(null);
    setTemplateError(null);
    setDraftSubtasks([]);
    setNewSubtaskTitle("");
    setSubtaskError(null);
    setNaturalDueText("");
  }, [task, initialProjectId]);

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
    const normalizedNotesMarkdown = normalizeNotesMarkdownInput(notesMarkdown);

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
        notes_markdown: normalizedNotesMarkdown,
        project_id: projectId || null,
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
        notes_markdown: normalizedNotesMarkdown ?? undefined,
        project_id: projectId || null,
        priority,
        is_important: isImportant,
        due_at: dueAtIso,
        remind_at: remindAtIso,
        recurrence,
        subtasks: draftSubtasks
          .map((subtask) => ({
            title: subtask.title.trim(),
            is_done: subtask.is_done,
          }))
          .filter((subtask) => subtask.title.length > 0),
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

  const handleCreateProject = async () => {
    const suggestedName =
      title.trim().length > 0 ? `${title.trim().slice(0, 40)} Project` : "";
    const inputName = window.prompt("Project name", suggestedName);
    if (!inputName) return;

    const normalizedName = inputName.trim();
    if (!normalizedName) return;

    try {
      const project = await createProject.mutateAsync({
        name: normalizedName,
      });
      setProjectId(project.id);
      setProjectError(null);
    } catch (error) {
      setProjectError(getErrorMessage(error));
    }
  };

  const handleAddSubtask = async () => {
    const normalizedTitle = newSubtaskTitle.trim();
    if (!normalizedTitle) return;

    if (isEditing && task) {
      try {
        await createTaskSubtask.mutateAsync({
          task_id: task.id,
          title: normalizedTitle,
          is_done: false,
        });
        setNewSubtaskTitle("");
        setSubtaskError(null);
      } catch (error) {
        setSubtaskError(getErrorMessage(error));
      }
      return;
    }

    setDraftSubtasks((prevSubtasks) => [
      ...prevSubtasks,
      {
        id: createDraftSubtaskId(),
        title: normalizedTitle,
        is_done: false,
      },
    ]);
    setNewSubtaskTitle("");
    setSubtaskError(null);
  };

  const handleToggleSubtask = async (subtaskId: string, isDone: boolean) => {
    if (isEditing) {
      try {
        await updateTaskSubtask.mutateAsync({
          id: subtaskId,
          is_done: !isDone,
        });
        setSubtaskError(null);
      } catch (error) {
        setSubtaskError(getErrorMessage(error));
      }
      return;
    }

    setDraftSubtasks((prevSubtasks) =>
      prevSubtasks.map((subtask) =>
        subtask.id === subtaskId
          ? { ...subtask, is_done: !subtask.is_done }
          : subtask,
      ),
    );
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (isEditing && task) {
      try {
        await deleteTaskSubtask.mutateAsync({ id: subtaskId, taskId: task.id });
        setSubtaskError(null);
      } catch (error) {
        setSubtaskError(getErrorMessage(error));
      }
      return;
    }

    setDraftSubtasks((prevSubtasks) =>
      prevSubtasks.filter((subtask) => subtask.id !== subtaskId),
    );
  };

  const handleApplyNaturalDueDate = () => {
    const normalizedInput = naturalDueText.trim();
    if (!normalizedInput) return;

    const parsedDueDate = parseNaturalDueDate(normalizedInput, new Date());
    if (!parsedDueDate) {
      setTimeError(
        "Could not parse due date. Try phrases like 'tomorrow 9am' or 'next monday'.",
      );
      return;
    }

    setDueAt(toInputDateTime(parsedDueDate.toISOString()));
    setNaturalDueText("");
    setTimeError(null);
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

          <div className="field notes-section">
            <div className="notes-header">
              <label className="field-label" htmlFor="task-notes-markdown">
                Notes <span className="optional">(Markdown)</span>
              </label>
              <div className="notes-mode-row">
                <button
                  type="button"
                  className={`notes-mode-btn${notesMode === "edit" ? " active" : ""}`}
                  onClick={() => setNotesMode("edit")}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`notes-mode-btn${notesMode === "preview" ? " active" : ""}`}
                  onClick={() => setNotesMode("preview")}
                >
                  Preview
                </button>
              </div>
            </div>

            {notesMode === "edit" ? (
              <textarea
                id="task-notes-markdown"
                className="input textarea notes-textarea"
                value={notesMarkdown}
                onChange={(event) => setNotesMarkdown(event.target.value)}
                placeholder="Use markdown: # heading, - list, **bold**, [link](https://...)"
                rows={8}
              />
            ) : notesPreviewHtml ? (
              <div
                className="notes-preview markdown-preview"
                dangerouslySetInnerHTML={{ __html: notesPreviewHtml }}
              />
            ) : (
              <p className="notes-preview-empty">
                Nothing to preview yet. Add markdown in Edit mode.
              </p>
            )}
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

          <div className="field">
            <label className="field-label" htmlFor="task-project">
              Project <span className="optional">(optional)</span>
            </label>
            <div className="project-row">
              <select
                id="task-project"
                className="input"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  if (projectError) setProjectError(null);
                }}
                disabled={isLoadingProjects}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="template-btn"
                onClick={() => void handleCreateProject()}
                disabled={createProject.isPending}
              >
                <Plus size={12} />
                {createProject.isPending ? "Creating..." : "New"}
              </button>
            </div>
          </div>

          <div className="checklist-section">
            <div className="checklist-header">
              <label
                className="field-label checklist-label"
                htmlFor="new-subtask"
              >
                Checklist
              </label>
              <span className="checklist-progress">
                {completedSubtaskCount} / {checklistItems.length} done
              </span>
            </div>

            <div className="checklist-create-row">
              <input
                id="new-subtask"
                className="input"
                value={newSubtaskTitle}
                onChange={(event) => {
                  setNewSubtaskTitle(event.target.value);
                  if (subtaskError) setSubtaskError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void handleAddSubtask();
                }}
                placeholder="Add checklist item..."
                disabled={isSubtaskMutating}
              />
              <button
                type="button"
                className="checklist-add-btn"
                onClick={() => void handleAddSubtask()}
                disabled={!newSubtaskTitle.trim() || isSubtaskMutating}
              >
                <Plus size={12} />
                Add
              </button>
            </div>

            {isEditing && isLoadingSubtasks ? (
              <p className="checklist-empty">Loading checklist...</p>
            ) : checklistItems.length === 0 ? (
              <p className="checklist-empty">No checklist items yet.</p>
            ) : (
              <div className="checklist-list">
                {checklistItems.map((subtask) => (
                  <div key={subtask.id} className="checklist-item">
                    <button
                      type="button"
                      className={`checklist-toggle${subtask.is_done ? " done" : ""}`}
                      onClick={() =>
                        void handleToggleSubtask(subtask.id, subtask.is_done)
                      }
                      disabled={isSubtaskMutating}
                    >
                      {subtask.is_done && <Check size={11} />}
                    </button>
                    <span
                      className={`checklist-title${subtask.is_done ? " done" : ""}`}
                    >
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      className="checklist-delete"
                      onClick={() => void handleDeleteSubtask(subtask.id)}
                      disabled={isSubtaskMutating}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                onChange={(event) => {
                  setDueAt(event.target.value);
                  if (timeError) setTimeError(null);
                }}
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
                onChange={(event) => {
                  setRemindAt(event.target.value);
                  if (timeError) setTimeError(null);
                }}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="task-natural-due">
              Smart due input <span className="optional">(beta)</span>
            </label>
            <div className="natural-due-row">
              <input
                id="task-natural-due"
                type="text"
                className="input"
                value={naturalDueText}
                onChange={(event) => {
                  setNaturalDueText(event.target.value);
                  if (timeError) setTimeError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  handleApplyNaturalDueDate();
                }}
                placeholder="tomorrow 9am, next monday, in 3 days..."
              />
              <button
                type="button"
                className="natural-due-btn"
                onClick={handleApplyNaturalDueDate}
                disabled={!naturalDueText.trim()}
              >
                Apply
              </button>
            </div>
            <p className="field-help">
              Examples: tomorrow 9am, next monday, in 3 days, 2026-03-01 14:30
            </p>
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
          {projectError && <p className="form-error">{projectError}</p>}
          {templateError && <p className="form-error">{templateError}</p>}
          {subtaskError && <p className="form-error">{subtaskError}</p>}

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
        .field-help {
          margin-top: 6px;
          font-size: 11px;
          color: var(--text-muted);
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
        .notes-section {
          margin-bottom: 16px;
        }
        .notes-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }
        .notes-mode-row {
          display: inline-flex;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          overflow: hidden;
          background: var(--bg-surface);
        }
        .notes-mode-btn {
          height: 28px;
          min-width: 58px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .notes-mode-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .notes-mode-btn.active {
          background: var(--accent-subtle);
          color: var(--accent);
        }
        .notes-textarea {
          min-height: 150px;
          font-family: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco,
            Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.55;
        }
        .notes-preview {
          min-height: 150px;
          max-height: 260px;
          overflow: auto;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          padding: 10px 12px;
        }
        .notes-preview-empty {
          margin: 0;
          border: 1px dashed var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          min-height: 86px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 12px;
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
        }
        .markdown-preview h1,
        .markdown-preview h2,
        .markdown-preview h3,
        .markdown-preview h4,
        .markdown-preview h5,
        .markdown-preview h6 {
          margin: 0 0 8px;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .markdown-preview h1 {
          font-size: 18px;
        }
        .markdown-preview h2 {
          font-size: 16px;
        }
        .markdown-preview h3 {
          font-size: 14px;
        }
        .markdown-preview p {
          margin: 0 0 8px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.6;
          word-break: break-word;
        }
        .markdown-preview ul,
        .markdown-preview ol {
          margin: 0 0 8px;
          padding-left: 20px;
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.6;
        }
        .markdown-preview li {
          margin-bottom: 4px;
        }
        .markdown-preview blockquote {
          margin: 0 0 8px;
          padding: 0 0 0 10px;
          border-left: 2px solid var(--border-strong);
        }
        .markdown-preview blockquote p {
          margin: 0;
          color: var(--text-muted);
        }
        .markdown-preview pre {
          margin: 0 0 8px;
          padding: 10px 12px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          overflow-x: auto;
        }
        .markdown-preview code {
          font-family: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco,
            Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          background: var(--bg-surface);
          border-radius: 4px;
          padding: 1px 4px;
          color: var(--text-primary);
        }
        .markdown-preview pre code {
          padding: 0;
          background: transparent;
        }
        .markdown-preview a {
          color: var(--accent);
          text-decoration: none;
          border-bottom: 1px solid var(--accent);
        }
        .markdown-preview a:hover {
          color: var(--accent-hover);
          border-bottom-color: var(--accent-hover);
        }
        .markdown-preview hr {
          border: none;
          border-top: 1px solid var(--border-default);
          margin: 10px 0;
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
        .project-row {
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

        .natural-due-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .natural-due-btn {
          height: 34px;
          padding: 0 12px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .natural-due-btn:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .natural-due-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .checklist-section {
          margin-bottom: 16px;
          padding: 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
        }
        .checklist-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .checklist-label {
          margin-bottom: 0;
        }
        .checklist-progress {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .checklist-create-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .checklist-add-btn {
          height: 34px;
          padding: 0 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
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
        .checklist-add-btn:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .checklist-add-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .checklist-empty {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .checklist-list {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 136px;
          overflow-y: auto;
          padding-right: 2px;
        }
        .checklist-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 8px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
        }
        .checklist-toggle {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          border: 1px solid var(--border-strong);
          border-radius: 5px;
          background: transparent;
          color: transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .checklist-toggle.done {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .checklist-title {
          flex: 1;
          font-size: 12px;
          color: var(--text-primary);
          line-height: 1.4;
          word-break: break-word;
        }
        .checklist-title.done {
          color: var(--text-muted);
          text-decoration: line-through;
        }
        .checklist-delete {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .checklist-delete:hover:not(:disabled) {
          color: var(--danger);
          background: var(--danger-subtle);
          border-color: var(--danger);
        }
        .checklist-delete:disabled,
        .checklist-toggle:disabled {
          opacity: 0.55;
          cursor: not-allowed;
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
          .project-row {
            flex-direction: column;
            align-items: stretch;
          }
          .notes-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .notes-mode-row {
            width: 100%;
          }
          .notes-mode-btn {
            flex: 1;
          }
          .template-actions {
            flex-direction: column;
          }
          .template-btn {
            width: 100%;
            justify-content: center;
          }
          .checklist-create-row {
            flex-direction: column;
            align-items: stretch;
          }
          .checklist-add-btn {
            width: 100%;
            justify-content: center;
          }
          .natural-due-row {
            flex-direction: column;
            align-items: stretch;
          }
          .natural-due-btn {
            width: 100%;
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

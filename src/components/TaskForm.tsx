import { useState, useEffect, useMemo } from "react";
import { translate, useI18n } from "@/lib/i18n";
import { localizeErrorMessage } from "@/lib/error-message";
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

const PRIORITY_OPTIONS: {
  value: TaskPriority;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: "URGENT",
    icon: <AlertTriangle size={13} />,
    color: "var(--danger)",
  },
  {
    value: "NORMAL",
    icon: <Minus size={13} />,
    color: "var(--accent)",
  },
  {
    value: "LOW",
    icon: <ArrowDown size={13} />,
    color: "var(--text-muted)",
  },
];

const RECURRENCE_OPTIONS: TaskRecurrence[] = [
  "NONE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
];

function getPriorityLabel(priority: TaskPriority, locale: "en" | "th"): string {
  if (priority === "URGENT")
    return translate(locale, "taskForm.priority.urgent");
  if (priority === "LOW") return translate(locale, "taskForm.priority.low");
  return translate(locale, "taskForm.priority.normal");
}

function getStatusLabel(status: TaskStatus, locale: "en" | "th"): string {
  if (status === "TODO") return translate(locale, "taskForm.status.todo");
  if (status === "DOING") return translate(locale, "taskForm.status.doing");
  if (status === "ARCHIVED")
    return translate(locale, "taskForm.status.archived");
  return translate(locale, "taskForm.status.done");
}

function getRecurrenceLabel(
  recurrence: TaskRecurrence,
  locale: "en" | "th",
): string {
  if (recurrence === "DAILY")
    return translate(locale, "taskForm.recurrence.daily");
  if (recurrence === "WEEKLY")
    return translate(locale, "taskForm.recurrence.weekly");
  if (recurrence === "MONTHLY")
    return translate(locale, "taskForm.recurrence.monthly");
  return translate(locale, "taskForm.recurrence.none");
}

function getErrorMessage(error: unknown, locale: "en" | "th"): string {
  return localizeErrorMessage(error, locale, "common.error.unableRequest");
}

function getChangelogFieldLabel(
  fieldName: string | null,
  locale: "en" | "th",
): string {
  if (fieldName === "status")
    return translate(locale, "taskForm.changelog.field.status");
  if (fieldName === "priority")
    return translate(locale, "taskForm.changelog.field.priority");
  if (fieldName === "title")
    return translate(locale, "taskForm.changelog.field.title");
  if (fieldName === "description")
    return translate(locale, "taskForm.changelog.field.description");
  if (fieldName === "notes_markdown")
    return translate(locale, "taskForm.changelog.field.notes");
  if (fieldName === "is_important")
    return translate(locale, "taskForm.changelog.field.importance");
  if (fieldName === "due_at")
    return translate(locale, "taskForm.changelog.field.dueAt");
  if (fieldName === "remind_at")
    return translate(locale, "taskForm.changelog.field.reminder");
  if (fieldName === "recurrence")
    return translate(locale, "taskForm.changelog.field.recurrence");
  if (fieldName === "project_id")
    return translate(locale, "taskForm.changelog.field.project");
  return translate(locale, "taskForm.changelog.field.task");
}

function formatChangelogValue(
  fieldName: string | null,
  value: string | null,
  locale: "en" | "th",
): string {
  if (fieldName === "project_id") {
    if (value) {
      return translate(locale, "taskForm.changelog.projectShort", {
        id: value.slice(0, 8),
      });
    }
    return translate(locale, "taskForm.changelog.noProject");
  }

  if (!value) return translate(locale, "taskForm.changelog.emptyValue");

  if (fieldName === "notes_markdown") {
    const collapsedValue = value.replace(/\s+/g, " ").trim();
    if (!collapsedValue)
      return translate(locale, "taskForm.changelog.emptyValue");
    if (collapsedValue.length <= 56) return collapsedValue;
    return `${collapsedValue.slice(0, 53)}...`;
  }

  if (
    fieldName === "status" &&
    (value === "TODO" ||
      value === "DOING" ||
      value === "DONE" ||
      value === "ARCHIVED")
  ) {
    return getStatusLabel(value as TaskStatus, locale);
  }

  if (
    fieldName === "priority" &&
    (value === "URGENT" || value === "NORMAL" || value === "LOW")
  ) {
    return getPriorityLabel(value as TaskPriority, locale);
  }

  if (fieldName === "is_important") {
    if (value === "true")
      return translate(locale, "taskForm.changelog.important");
    return translate(locale, "taskForm.changelog.notImportant");
  }

  if (
    (fieldName === "due_at" || fieldName === "remind_at") &&
    !Number.isNaN(new Date(value).getTime())
  ) {
    return formatDateTimeForDisplay(value, locale);
  }

  if (
    fieldName === "recurrence" &&
    (value === "NONE" ||
      value === "DAILY" ||
      value === "WEEKLY" ||
      value === "MONTHLY")
  ) {
    return getRecurrenceLabel(value as TaskRecurrence, locale);
  }

  return value;
}

function formatChangelogMessage(
  log: TaskChangelog,
  locale: "en" | "th",
): string {
  if (log.action === "CREATED") {
    return translate(locale, "taskForm.changelog.created", {
      value: formatChangelogValue(null, log.new_value, locale),
    });
  }

  const fieldLabel = getChangelogFieldLabel(log.field_name, locale);
  const oldValue = formatChangelogValue(log.field_name, log.old_value, locale);
  const newValue = formatChangelogValue(log.field_name, log.new_value, locale);
  return translate(locale, "taskForm.changelog.changed", {
    field: fieldLabel,
    from: oldValue,
    to: newValue,
  });
}

function formatRelativeDate(dateStr: string, locale: "en" | "th"): string {
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

function formatDateTimeForDisplay(
  dateStr: string,
  locale: "en" | "th",
): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(locale === "th" ? "th-TH" : "en-US", {
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
  const { locale, t } = useI18n();
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
      setTimeError(t("taskForm.error.invalidDueFormat"));
      return;
    }
    if (remindAt && !remindAtIso) {
      setTimeError(t("taskForm.error.invalidReminderFormat"));
      return;
    }
    if (dueAtIso && remindAtIso && remindAtIso > dueAtIso) {
      setTimeError(t("taskForm.error.reminderAfterDue"));
      return;
    }
    if (recurrence !== "NONE" && !dueAtIso) {
      setTimeError(t("taskForm.error.recurringNeedsDue"));
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
      (title.trim()
        ? `${title.trim().slice(0, 40)} ${t("taskForm.template.word")}`
        : t("taskForm.template.defaultName"));
    const inputName = window.prompt(
      t("taskForm.template.promptName"),
      suggestedName,
    );
    if (!inputName) return;

    const normalizedName = inputName.trim();
    if (!normalizedName) return;

    const dueAtIso = toIsoDateTime(dueAt);
    const remindAtIso = toIsoDateTime(remindAt);

    if (dueAt && !dueAtIso) {
      setTemplateError(t("taskForm.error.invalidDueFormat"));
      return;
    }
    if (remindAt && !remindAtIso) {
      setTemplateError(t("taskForm.error.invalidReminderFormat"));
      return;
    }
    if (dueAtIso && remindAtIso && remindAtIso > dueAtIso) {
      setTemplateError(t("taskForm.error.reminderAfterDue"));
      return;
    }
    if (recurrence !== "NONE" && !dueAtIso) {
      setTemplateError(t("taskForm.error.recurringTemplateNeedsDue"));
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
      setTemplateError(getErrorMessage(error, locale));
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    if (
      !window.confirm(
        t("taskForm.template.deleteConfirm", { name: selectedTemplate.name }),
      )
    ) {
      return;
    }

    try {
      await deleteTaskTemplate.mutateAsync(selectedTemplate.id);
      setSelectedTemplateId("");
      setTemplateError(null);
    } catch (error) {
      setTemplateError(getErrorMessage(error, locale));
    }
  };

  const handleCreateProject = async () => {
    const suggestedName =
      title.trim().length > 0
        ? `${title.trim().slice(0, 40)} ${t("taskForm.project.word")}`
        : "";
    const inputName = window.prompt(
      t("taskForm.project.promptName"),
      suggestedName,
    );
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
      setProjectError(getErrorMessage(error, locale));
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
        setSubtaskError(getErrorMessage(error, locale));
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
        setSubtaskError(getErrorMessage(error, locale));
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
        setSubtaskError(getErrorMessage(error, locale));
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
      setTimeError(t("taskForm.error.naturalParseFailed"));
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
            {isEditing ? t("taskForm.title.edit") : t("taskForm.title.new")}
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label={t("taskForm.closeAria")}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="field">
            <label className="field-label" htmlFor="task-title">
              {t("taskForm.field.title")}
            </label>
            <input
              id="task-title"
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("taskForm.placeholder.title")}
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="field">
            <label className="field-label" htmlFor="task-desc">
              {t("taskForm.field.description")}{" "}
              <span className="optional">({t("taskForm.optional")})</span>
            </label>
            <textarea
              id="task-desc"
              className="input textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("taskForm.placeholder.description")}
              rows={3}
            />
          </div>

          <div className="field notes-section">
            <div className="notes-header">
              <label className="field-label" htmlFor="task-notes-markdown">
                {t("taskForm.field.notes")}{" "}
                <span className="optional">
                  ({t("taskForm.badge.markdown")})
                </span>
              </label>
              <div className="notes-mode-row">
                <button
                  type="button"
                  className={`notes-mode-btn${notesMode === "edit" ? " active" : ""}`}
                  onClick={() => setNotesMode("edit")}
                >
                  {t("taskForm.mode.edit")}
                </button>
                <button
                  type="button"
                  className={`notes-mode-btn${notesMode === "preview" ? " active" : ""}`}
                  onClick={() => setNotesMode("preview")}
                >
                  {t("taskForm.mode.preview")}
                </button>
              </div>
            </div>

            {notesMode === "edit" ? (
              <textarea
                id="task-notes-markdown"
                className="input textarea notes-textarea"
                value={notesMarkdown}
                onChange={(event) => setNotesMarkdown(event.target.value)}
                placeholder={t("taskForm.placeholder.notesMarkdown")}
                rows={8}
              />
            ) : notesPreviewHtml ? (
              <div
                className="notes-preview markdown-preview"
                dangerouslySetInnerHTML={{ __html: notesPreviewHtml }}
              />
            ) : (
              <p className="notes-preview-empty">
                {t("taskForm.preview.empty")}
              </p>
            )}
          </div>

          {!isEditing && (
            <div className="template-section">
              <label className="field-label" htmlFor="task-template">
                {t("taskForm.field.template")}
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
                  <option value="">{t("taskForm.template.select")}</option>
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
                  {t("taskForm.template.apply")}
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
                  {upsertTaskTemplate.isPending
                    ? t("taskForm.template.saving")
                    : t("taskForm.template.save")}
                </button>
                <button
                  type="button"
                  className="template-btn template-btn-danger"
                  onClick={() => void handleDeleteTemplate()}
                  disabled={!selectedTemplate || deleteTaskTemplate.isPending}
                >
                  <Trash2 size={12} />
                  {deleteTaskTemplate.isPending
                    ? t("taskForm.template.deleting")
                    : t("taskForm.template.delete")}
                </button>
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="task-project">
              {t("taskForm.field.project")}{" "}
              <span className="optional">({t("taskForm.optional")})</span>
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
                <option value="">{t("taskForm.project.none")}</option>
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
                {createProject.isPending
                  ? t("taskForm.project.creating")
                  : t("taskForm.project.new")}
              </button>
            </div>
          </div>

          <div className="checklist-section">
            <div className="checklist-header">
              <label
                className="field-label checklist-label"
                htmlFor="new-subtask"
              >
                {t("taskForm.field.checklist")}
              </label>
              <span className="checklist-progress">
                {completedSubtaskCount} / {checklistItems.length}{" "}
                {t("taskForm.checklist.doneSuffix")}
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
                placeholder={t("taskForm.checklist.placeholder")}
                disabled={isSubtaskMutating}
              />
              <button
                type="button"
                className="checklist-add-btn"
                onClick={() => void handleAddSubtask()}
                disabled={!newSubtaskTitle.trim() || isSubtaskMutating}
              >
                <Plus size={12} />
                {t("taskForm.checklist.add")}
              </button>
            </div>

            {isEditing && isLoadingSubtasks ? (
              <p className="checklist-empty">
                {t("taskForm.checklist.loading")}
              </p>
            ) : checklistItems.length === 0 ? (
              <p className="checklist-empty">{t("taskForm.checklist.empty")}</p>
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
                {t("taskForm.field.dueAt")}
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
                {t("taskForm.field.reminder")}
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
              {t("taskForm.field.smartDue")}{" "}
              <span className="optional">({t("taskForm.badge.beta")})</span>
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
                placeholder={t("taskForm.smartDue.placeholder")}
              />
              <button
                type="button"
                className="natural-due-btn"
                onClick={handleApplyNaturalDueDate}
                disabled={!naturalDueText.trim()}
              >
                {t("taskForm.smartDue.apply")}
              </button>
            </div>
            <p className="field-help">{t("taskForm.smartDue.examples")}</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="task-recurrence">
              <Repeat2 size={12} />
              {t("taskForm.field.repeat")}
            </label>
            <select
              id="task-recurrence"
              className="input"
              value={recurrence}
              onChange={(event) =>
                setRecurrence(event.target.value as TaskRecurrence)
              }
            >
              {RECURRENCE_OPTIONS.map((optionValue) => (
                <option key={optionValue} value={optionValue}>
                  {getRecurrenceLabel(optionValue, locale)}
                </option>
              ))}
            </select>
          </div>

          {/* Priority & Important */}
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">
                {t("taskForm.field.priority")}
              </label>
              <div className="priority-group">
                {PRIORITY_OPTIONS.map((p) => (
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
                    {getPriorityLabel(p.value, locale)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="field-label">
                {t("taskForm.field.importance")}
              </label>
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
                {isImportant
                  ? t("taskForm.importance.on")
                  : t("taskForm.importance.mark")}
              </button>
            </div>
          </div>

          {timeError && <p className="form-error">{timeError}</p>}
          {projectError && <p className="form-error">{projectError}</p>}
          {templateError && <p className="form-error">{templateError}</p>}
          {subtaskError && <p className="form-error">{subtaskError}</p>}

          {isEditing && (
            <div className="changelog-section">
              <h3 className="changelog-title">
                {t("taskForm.changelog.title")}
              </h3>
              {isLoadingChangelog ? (
                <p className="changelog-state">
                  {t("taskForm.changelog.loading")}
                </p>
              ) : isChangelogError ? (
                <p className="changelog-state changelog-state-error">
                  {getErrorMessage(changelogError, locale)}
                </p>
              ) : changelogs.length === 0 ? (
                <p className="changelog-state">
                  {t("taskForm.changelog.empty")}
                </p>
              ) : (
                <div className="changelog-list">
                  {changelogs.map((log) => (
                    <div key={log.id} className="changelog-item">
                      <p className="changelog-message">
                        {formatChangelogMessage(log, locale)}
                      </p>
                      <span className="changelog-date">
                        {formatRelativeDate(log.created_at, locale)}
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
              {t("taskForm.action.cancel")}
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={!title.trim()}
            >
              {isEditing
                ? t("taskForm.action.saveChanges")
                : t("taskForm.action.createTask")}
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
          padding: 14px;
          z-index: 100;
        }
        .modal {
          background: var(--bg-surface);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl);
          width: min(560px, 96vw);
          max-height: min(92vh, 940px);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-default);
          background: var(--bg-surface);
          flex-shrink: 0;
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
          padding: 16px 20px 18px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        form::-webkit-scrollbar {
          width: 8px;
        }
        form::-webkit-scrollbar-thumb {
          background: var(--border-strong);
          border-radius: 9999px;
        }
        form::-webkit-scrollbar-track {
          background: transparent;
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
          min-height: 122px;
          font-family: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco,
            Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          line-height: 1.55;
        }
        .notes-preview {
          min-height: 122px;
          max-height: 220px;
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
          margin-top: 10px;
          position: sticky;
          bottom: 0;
          z-index: 2;
          background: linear-gradient(
            180deg,
            rgba(12, 14, 20, 0),
            var(--bg-surface) 26%
          );
          padding-bottom: 2px;
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
            max-height: 100%;
            border-radius: 0;
            border: none;
            display: flex;
            flex-direction: column;
          }
          .modal-header {
            padding: 12px 14px;
          }
          form {
            padding: 14px 14px 16px;
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
          .modal-actions {
            margin-top: auto;
            padding-top: 14px;
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

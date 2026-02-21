import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus, ViewMode } from "@/lib/types";
import { Search } from "lucide-react";
import { translate, useI18n } from "@/lib/i18n";

interface CommandPaletteProps {
  isOpen: boolean;
  activeView: ViewMode;
  tasks: Task[];
  syncNowDisabled: boolean;
  exportBackupDisabled: boolean;
  onClose: () => void;
  onOpenCreate: () => void;
  onOpenQuickCapture: () => void;
  onSyncNow: () => void;
  onExportBackup: () => void;
  onOpenSyncDiagnostics: () => void;
  onOpenRestorePreflight: () => void;
  onEditTask: (task: Task) => void;
  onChangeTaskStatus: (taskId: string, status: TaskStatus) => void;
  onChangeView: (view: ViewMode) => void;
}

interface PaletteCommand {
  id: string;
  group: string;
  label: string;
  meta?: string;
  shortcut?: string;
  disabled?: boolean;
  keywords: string;
  onSelect: () => void;
}

const VIEW_COMMANDS: Array<{ view: ViewMode }> = [
  { view: "board" },
  { view: "projects" },
  { view: "calendar" },
  { view: "today" },
  { view: "upcoming" },
  { view: "conflicts" },
  { view: "review" },
  { view: "dashboard" },
  { view: "settings" },
];

const MAX_MATCHED_TASKS = 6;

function normalizeSearch(inputValue: string): string {
  return inputValue.trim().toLowerCase();
}

function includesAllTerms(haystack: string, searchValue: string): boolean {
  const normalizedHaystack = haystack.toLowerCase();
  const searchTerms = searchValue.split(/\s+/).filter(Boolean);
  if (searchTerms.length === 0) return true;
  return searchTerms.every((term) => normalizedHaystack.includes(term));
}

function truncateText(value: string, maxLength = 54): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function getTaskStatusLabel(status: TaskStatus, locale: "en" | "th"): string {
  if (status === "TODO") return translate(locale, "taskForm.status.todo");
  if (status === "DOING") return translate(locale, "taskForm.status.doing");
  if (status === "DONE") return translate(locale, "taskForm.status.done");
  return translate(locale, "taskForm.status.archived");
}

function isTaskSearchMatch(
  task: Task,
  searchValue: string,
  locale: "en" | "th",
): boolean {
  const haystack = [
    task.title,
    task.description ?? "",
    task.priority,
    getTaskStatusLabel(task.status, locale),
  ].join(" ");
  return includesAllTerms(haystack, searchValue);
}

export function CommandPalette({
  isOpen,
  activeView,
  tasks,
  syncNowDisabled,
  exportBackupDisabled,
  onClose,
  onOpenCreate,
  onOpenQuickCapture,
  onSyncNow,
  onExportBackup,
  onOpenSyncDiagnostics,
  onOpenRestorePreflight,
  onEditTask,
  onChangeTaskStatus,
  onChangeView,
}: CommandPaletteProps) {
  const { locale, t } = useI18n();
  const isTh = locale === "th";
  const groupActionsLabel = t("commandPalette.group.actions");
  const groupNavigationLabel = t("commandPalette.group.navigation");
  const groupTasksLabel = t("commandPalette.group.tasks");
  const viewLabelById: Record<ViewMode, string> = {
    board: t("shell.nav.board"),
    projects: t("shell.nav.projects"),
    calendar: t("shell.nav.calendar"),
    today: t("shell.nav.today"),
    upcoming: t("shell.nav.upcoming"),
    conflicts: t("shell.nav.conflicts"),
    review: t("shell.nav.review"),
    dashboard: t("shell.nav.dashboard"),
    settings: t("shell.nav.settings"),
  };
  const commandInputPlaceholder = t("commandPalette.input.placeholder");
  const emptyCommandsLabel = t("commandPalette.empty");
  const footerHint = t("commandPalette.footerHint");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const commands = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    const staticCommands: PaletteCommand[] = [
      {
        id: "action-new-task",
        group: groupActionsLabel,
        label: t("commandPalette.action.createTask"),
        shortcut: t("shell.createTask.shortcut"),
        keywords: isTh ? "งาน สร้าง เพิ่ม ใหม่" : "new task create add",
        onSelect: onOpenCreate,
      },
      {
        id: "action-quick-capture",
        group: groupActionsLabel,
        label: t("commandPalette.action.quickCapture"),
        shortcut: t("commandPalette.shortcut.quickCapture"),
        keywords: isTh
          ? "บันทึก ด่วน quick capture inbox"
          : "quick capture capture inbox",
        onSelect: onOpenQuickCapture,
      },
      {
        id: "action-sync-now",
        group: groupActionsLabel,
        label: t("commandPalette.action.syncNow"),
        keywords: isTh ? "ซิงก์ sync ตอนนี้ ทันที" : "sync now run sync",
        disabled: syncNowDisabled,
        onSelect: onSyncNow,
      },
      {
        id: "action-export-backup",
        group: groupActionsLabel,
        label: t("commandPalette.action.exportBackup"),
        keywords: isTh
          ? "สำรองข้อมูล backup export json"
          : "backup export json",
        disabled: exportBackupDisabled,
        onSelect: onExportBackup,
      },
      {
        id: "action-open-sync-diagnostics",
        group: groupActionsLabel,
        label: t("commandPalette.action.openSyncDiagnostics"),
        keywords: isTh
          ? "ซิงก์ diagnostics สุขภาพ สถิติ"
          : "sync diagnostics health metrics",
        onSelect: onOpenSyncDiagnostics,
      },
      {
        id: "action-open-restore-preflight",
        group: groupActionsLabel,
        label: t("commandPalette.action.openRestorePreflight"),
        keywords: isTh
          ? "กู้คืน preflight backup restore"
          : "restore preflight backup restore",
        onSelect: onOpenRestorePreflight,
      },
      ...VIEW_COMMANDS.map((viewCommand) => ({
        id: `view-${viewCommand.view}`,
        group: groupNavigationLabel,
        label: t("commandPalette.nav.goTo", {
          view: viewLabelById[viewCommand.view],
        }),
        meta:
          activeView === viewCommand.view
            ? t("commandPalette.meta.current")
            : undefined,
        keywords: isTh
          ? `ไป หน้า มุมมอง ${viewLabelById[viewCommand.view]}`
          : `go view page ${viewLabelById[viewCommand.view]}`,
        onSelect: () => onChangeView(viewCommand.view),
      })),
    ];

    const filteredStaticCommands = normalizedQuery
      ? staticCommands.filter((command) =>
          includesAllTerms(
            `${command.group} ${command.label} ${command.keywords} ${command.meta ?? ""}`,
            normalizedQuery,
          ),
        )
      : staticCommands;

    const taskCommands: PaletteCommand[] = [];
    if (normalizedQuery.length > 0) {
      const matchedTasks = tasks
        .filter((task) => task.status !== "ARCHIVED")
        .filter((task) => isTaskSearchMatch(task, normalizedQuery, locale))
        .sort(
          (leftTask, rightTask) =>
            new Date(rightTask.updated_at).getTime() -
            new Date(leftTask.updated_at).getTime(),
        )
        .slice(0, MAX_MATCHED_TASKS);

      for (const task of matchedTasks) {
        taskCommands.push({
          id: `task-edit-${task.id}`,
          group: groupTasksLabel,
          label: t("commandPalette.task.edit", {
            title: truncateText(task.title),
          }),
          meta: getTaskStatusLabel(task.status, locale),
          keywords: isTh
            ? `แก้ไข งาน เปิด ${task.title}`
            : `edit task open ${task.title}`,
          onSelect: () => onEditTask(task),
        });

        if (task.status !== "TODO") {
          taskCommands.push({
            id: `task-status-todo-${task.id}`,
            group: groupTasksLabel,
            label: t("commandPalette.task.setTodo", {
              title: truncateText(task.title, 44),
            }),
            keywords: isTh
              ? `สถานะ ต้องทำ ${task.title}`
              : `status todo ${task.title}`,
            onSelect: () => onChangeTaskStatus(task.id, "TODO"),
          });
        }
        if (task.status !== "DOING") {
          taskCommands.push({
            id: `task-status-doing-${task.id}`,
            group: groupTasksLabel,
            label: t("commandPalette.task.setDoing", {
              title: truncateText(task.title, 40),
            }),
            keywords: isTh
              ? `สถานะ กำลังทำ ${task.title}`
              : `status doing in progress ${task.title}`,
            onSelect: () => onChangeTaskStatus(task.id, "DOING"),
          });
        }
        if (task.status !== "DONE") {
          taskCommands.push({
            id: `task-status-done-${task.id}`,
            group: groupTasksLabel,
            label: t("commandPalette.task.setDone", {
              title: truncateText(task.title, 46),
            }),
            keywords: isTh
              ? `สถานะ เสร็จแล้ว ${task.title}`
              : `status done complete ${task.title}`,
            onSelect: () => onChangeTaskStatus(task.id, "DONE"),
          });
        }
      }
    }

    return [...filteredStaticCommands, ...taskCommands];
  }, [
    query,
    activeView,
    tasks,
    onChangeTaskStatus,
    onChangeView,
    onEditTask,
    onExportBackup,
    onOpenCreate,
    onOpenRestorePreflight,
    onOpenSyncDiagnostics,
    onOpenQuickCapture,
    onSyncNow,
    locale,
    exportBackupDisabled,
    groupActionsLabel,
    groupNavigationLabel,
    groupTasksLabel,
    isTh,
    syncNowDisabled,
    t,
    viewLabelById,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    setQuery("");
    setSelectedIndex(0);
    const animationFrameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex((previousIndex) => {
      if (commands.length === 0) return 0;
      return Math.min(previousIndex, commands.length - 1);
    });
  }, [commands]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (commands.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((previousIndex) =>
          previousIndex >= commands.length - 1 ? 0 : previousIndex + 1,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((previousIndex) =>
          previousIndex <= 0 ? commands.length - 1 : previousIndex - 1,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selectedCommand = commands[selectedIndex];
        if (!selectedCommand || selectedCommand.disabled) return;
        onClose();
        selectedCommand.onSelect();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commands, isOpen, onClose, selectedIndex]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="command-overlay"
      onMouseDown={(event) => {
        if (event.currentTarget !== event.target) return;
        onClose();
      }}
    >
      <div
        className="command-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-input-wrap">
          <Search size={15} />
          <input
            ref={inputRef}
            className="command-input"
            placeholder={commandInputPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="command-list">
          {commands.length === 0 ? (
            <div className="command-empty">{emptyCommandsLabel}</div>
          ) : (
            commands.map((command, index) => {
              const previousCommand = commands[index - 1];
              const showGroupLabel =
                index === 0 || previousCommand.group !== command.group;
              const isSelected = selectedIndex === index;

              return (
                <Fragment key={command.id}>
                  {showGroupLabel && (
                    <p className="command-group-label">{command.group}</p>
                  )}
                  <button
                    type="button"
                    className={`command-item${isSelected ? " selected" : ""}`}
                    disabled={command.disabled}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      if (command.disabled) return;
                      onClose();
                      command.onSelect();
                    }}
                  >
                    <div className="command-main">
                      <span className="command-label">{command.label}</span>
                      {command.meta && (
                        <span className="command-meta">{command.meta}</span>
                      )}
                    </div>
                    {command.shortcut && (
                      <kbd className="command-shortcut">{command.shortcut}</kbd>
                    )}
                  </button>
                </Fragment>
              );
            })
          )}
        </div>

        <p className="command-footer">{footerHint}</p>
      </div>

      <style>{`
        .command-overlay {
          position: fixed;
          inset: 0;
          z-index: 220;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 70px 14px 20px;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }
        .command-panel {
          width: min(680px, 100%);
          border: 1px solid var(--border-strong);
          border-radius: 14px;
          background: color-mix(in srgb, var(--bg-surface) 94%, #000);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: min(78vh, 680px);
        }
        .command-input-wrap {
          height: 48px;
          padding: 0 14px;
          border-bottom: 1px solid var(--border-default);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
          background: color-mix(in srgb, var(--bg-surface) 92%, #000);
          flex-shrink: 0;
        }
        .command-input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 14px;
          font-family: inherit;
        }
        .command-input::placeholder {
          color: var(--text-disabled);
        }
        .command-list {
          min-height: 120px;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .command-group-label {
          margin: 6px 6px 2px;
          color: var(--text-disabled);
          font-size: 11px;
          letter-spacing: 0.3px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .command-item {
          width: 100%;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 10px;
          padding: 8px 10px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          text-align: left;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .command-item:hover {
          background: var(--bg-hover);
          border-color: var(--border-default);
          color: var(--text-primary);
        }
        .command-item.selected {
          background: color-mix(in srgb, var(--accent-subtle) 80%, #0b1224);
          border-color: color-mix(in srgb, var(--accent) 55%, transparent);
          color: var(--text-primary);
        }
        .command-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .command-main {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .command-label {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .command-meta {
          font-size: 11px;
          color: var(--text-muted);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          padding: 1px 6px;
          flex-shrink: 0;
        }
        .command-shortcut {
          border: 1px solid var(--border-default);
          border-radius: 6px;
          padding: 2px 6px;
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        }
        .command-empty {
          border: 1px dashed var(--border-default);
          border-radius: 10px;
          background: var(--bg-elevated);
          color: var(--text-muted);
          font-size: 12px;
          padding: 22px 12px;
          text-align: center;
          margin: 8px 4px;
        }
        .command-footer {
          margin: 0;
          padding: 8px 12px 10px;
          border-top: 1px solid var(--border-default);
          color: var(--text-disabled);
          font-size: 11px;
          background: color-mix(in srgb, var(--bg-surface) 92%, #000);
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .command-overlay {
            padding-top: 58px;
          }
          .command-panel {
            max-height: 82vh;
          }
          .command-input-wrap {
            height: 44px;
            padding: 0 12px;
          }
          .command-item {
            padding: 9px 8px;
          }
        }
      `}</style>
    </div>
  );
}

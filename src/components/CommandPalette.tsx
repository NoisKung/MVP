import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus, ViewMode } from "@/lib/types";
import { Search } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  activeView: ViewMode;
  tasks: Task[];
  onClose: () => void;
  onOpenCreate: () => void;
  onOpenQuickCapture: () => void;
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
  keywords: string;
  onSelect: () => void;
}

const VIEW_COMMANDS: Array<{ view: ViewMode; label: string }> = [
  { view: "board", label: "Board" },
  { view: "projects", label: "Projects" },
  { view: "calendar", label: "Calendar" },
  { view: "today", label: "Today" },
  { view: "upcoming", label: "Upcoming" },
  { view: "review", label: "Weekly Review" },
  { view: "dashboard", label: "Dashboard" },
  { view: "settings", label: "Settings" },
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

function getTaskStatusLabel(status: TaskStatus): string {
  if (status === "TODO") return "To Do";
  if (status === "DOING") return "In Progress";
  if (status === "DONE") return "Done";
  return "Archived";
}

function isTaskSearchMatch(task: Task, searchValue: string): boolean {
  const haystack = [
    task.title,
    task.description ?? "",
    task.priority,
    getTaskStatusLabel(task.status),
  ].join(" ");
  return includesAllTerms(haystack, searchValue);
}

export function CommandPalette({
  isOpen,
  activeView,
  tasks,
  onClose,
  onOpenCreate,
  onOpenQuickCapture,
  onEditTask,
  onChangeTaskStatus,
  onChangeView,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const commands = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    const staticCommands: PaletteCommand[] = [
      {
        id: "action-new-task",
        group: "Actions",
        label: "Create new task",
        shortcut: "Cmd/Ctrl + N",
        keywords: "new task create add",
        onSelect: onOpenCreate,
      },
      {
        id: "action-quick-capture",
        group: "Actions",
        label: "Open quick capture",
        shortcut: "Cmd/Ctrl + Shift + N",
        keywords: "quick capture capture inbox",
        onSelect: onOpenQuickCapture,
      },
      ...VIEW_COMMANDS.map((viewCommand) => ({
        id: `view-${viewCommand.view}`,
        group: "Navigation",
        label: `Go to ${viewCommand.label}`,
        meta: activeView === viewCommand.view ? "Current" : undefined,
        keywords: `go view page ${viewCommand.label}`,
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
        .filter((task) => isTaskSearchMatch(task, normalizedQuery))
        .sort(
          (leftTask, rightTask) =>
            new Date(rightTask.updated_at).getTime() -
            new Date(leftTask.updated_at).getTime(),
        )
        .slice(0, MAX_MATCHED_TASKS);

      for (const task of matchedTasks) {
        taskCommands.push({
          id: `task-edit-${task.id}`,
          group: "Tasks",
          label: `Edit task: ${truncateText(task.title)}`,
          meta: getTaskStatusLabel(task.status),
          keywords: `edit task open ${task.title}`,
          onSelect: () => onEditTask(task),
        });

        if (task.status !== "TODO") {
          taskCommands.push({
            id: `task-status-todo-${task.id}`,
            group: "Tasks",
            label: `Set To Do: ${truncateText(task.title, 44)}`,
            keywords: `status todo ${task.title}`,
            onSelect: () => onChangeTaskStatus(task.id, "TODO"),
          });
        }
        if (task.status !== "DOING") {
          taskCommands.push({
            id: `task-status-doing-${task.id}`,
            group: "Tasks",
            label: `Set In Progress: ${truncateText(task.title, 40)}`,
            keywords: `status doing in progress ${task.title}`,
            onSelect: () => onChangeTaskStatus(task.id, "DOING"),
          });
        }
        if (task.status !== "DONE") {
          taskCommands.push({
            id: `task-status-done-${task.id}`,
            group: "Tasks",
            label: `Set Done: ${truncateText(task.title, 46)}`,
            keywords: `status done complete ${task.title}`,
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
    onOpenCreate,
    onOpenQuickCapture,
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
        if (!selectedCommand) return;
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
            placeholder="Type a command..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="command-list">
          {commands.length === 0 ? (
            <div className="command-empty">No matching commands.</div>
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
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
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

        <p className="command-footer">
          Enter to run • Arrow keys to navigate • Esc to close
        </p>
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

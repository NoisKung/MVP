import type { Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { Circle, Loader, CheckCircle2, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTaskSubtaskStats } from "@/hooks/use-tasks";

interface KanbanColumnDef {
  status: TaskStatus;
  label: string;
  icon: React.ReactNode;
  accentColor: string;
  dotColor: string;
}

const COLUMNS: KanbanColumnDef[] = [
  {
    status: "TODO",
    label: "To Do",
    icon: <Circle size={14} />,
    accentColor: "var(--status-todo)",
    dotColor: "var(--status-todo)",
  },
  {
    status: "DOING",
    label: "In Progress",
    icon: <Loader size={14} />,
    accentColor: "var(--status-doing)",
    dotColor: "var(--status-doing)",
  },
  {
    status: "DONE",
    label: "Done",
    icon: <CheckCircle2 size={14} />,
    accentColor: "var(--status-done)",
    dotColor: "var(--status-done)",
  },
];

interface TaskBoardProps {
  tasks: Task[];
  projectNameById: Record<string, string>;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onCreateClick: () => void;
}

export function TaskBoard({
  tasks,
  projectNameById,
  onEdit,
  onStatusChange,
  onDelete,
  onCreateClick,
}: TaskBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<TaskStatus | null>(
    null,
  );
  const draggedTaskIdRef = useRef<string | null>(null);
  const dragEndTimerRef = useRef<number | null>(null);

  const taskById = useMemo(() => {
    return new Map(tasks.map((task) => [task.id, task]));
  }, [tasks]);
  const visibleTaskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const { data: subtaskStats = [] } = useTaskSubtaskStats(visibleTaskIds);
  const subtaskProgressByTaskId = useMemo(() => {
    const progressMap = new Map<string, { done: number; total: number }>();
    for (const stats of subtaskStats) {
      progressMap.set(stats.task_id, {
        done: Number(stats.done_count ?? 0),
        total: Number(stats.total_count ?? 0),
      });
    }
    return progressMap;
  }, [subtaskStats]);

  const draggedTask = draggedTaskId
    ? (taskById.get(draggedTaskId) ?? null)
    : null;

  const clearDragState = () => {
    if (dragEndTimerRef.current !== null) {
      window.clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }
    setDraggedTaskId(null);
    setDropTargetStatus(null);
    draggedTaskIdRef.current = null;
  };

  const handleTaskDragStart = (taskId: string) => {
    if (dragEndTimerRef.current !== null) {
      window.clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }
    setDraggedTaskId(taskId);
    draggedTaskIdRef.current = taskId;
  };

  const handleTaskDragEnd = () => {
    // WebKit-based views can emit dragend before drop; keep drag payload briefly.
    dragEndTimerRef.current = window.setTimeout(() => {
      clearDragState();
    }, 240);
  };

  const getDraggedTaskId = (
    event: React.DragEvent<HTMLElement>,
  ): string | null => {
    if (draggedTaskIdRef.current) {
      return draggedTaskIdRef.current;
    }

    const serialized = event.dataTransfer.getData(
      "application/x-solostack-task",
    );
    if (serialized) {
      try {
        const parsed = JSON.parse(serialized) as { id?: string };
        if (parsed.id) return parsed.id;
      } catch {
        // Ignore malformed drag payload and fallback to text/plain.
      }
    }

    const plainTextId = event.dataTransfer.getData("text/plain");
    if (plainTextId) return plainTextId;
    return draggedTaskId;
  };

  const handleColumnDragOver = (
    event: React.DragEvent<HTMLElement>,
    status: TaskStatus,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetStatus(status);
  };

  const handleColumnDragEnter = (
    event: React.DragEvent<HTMLElement>,
    status: TaskStatus,
  ) => {
    event.preventDefault();
    setDropTargetStatus(status);
  };

  const handleColumnDrop = (
    event: React.DragEvent<HTMLElement>,
    status: TaskStatus,
  ) => {
    event.preventDefault();
    const taskId = getDraggedTaskId(event);
    clearDragState();

    if (!taskId) return;
    const task = taskById.get(taskId);
    if (!task || task.status === status) return;

    onStatusChange(taskId, status);
  };

  return (
    <div className="board-container">
      {/* Header */}
      <div className="board-header">
        <div>
          <h1 className="board-title">Board</h1>
          <p className="board-subtitle">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} across{" "}
            {COLUMNS.length} columns
          </p>
        </div>
      </div>

      {/* Columns */}
      <div className="board-columns">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.status);
          const isDropTarget =
            dropTargetStatus === column.status &&
            draggedTask?.status !== column.status;

          return (
            <div
              key={column.status}
              className={`column${isDropTarget ? " drop-target" : ""}`}
              onDragEnter={(event) =>
                handleColumnDragEnter(event, column.status)
              }
              onDragOver={(event) => handleColumnDragOver(event, column.status)}
              onDrop={(event) => handleColumnDrop(event, column.status)}
            >
              {/* Column Header */}
              <div className="column-header">
                <div className="column-header-left">
                  <span
                    className="column-dot"
                    style={{ color: column.dotColor }}
                  >
                    {column.icon}
                  </span>
                  <span className="column-label">{column.label}</span>
                  <span className="column-count">{columnTasks.length}</span>
                </div>
                {column.status === "TODO" && (
                  <button
                    className="column-add-btn"
                    onClick={onCreateClick}
                    title="Add task"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {/* Cards */}
              <div
                className={`column-cards${isDropTarget ? " drop-active" : ""}`}
                onDragEnter={(event) =>
                  handleColumnDragEnter(event, column.status)
                }
                onDragOver={(event) =>
                  handleColumnDragOver(event, column.status)
                }
                onDrop={(event) => handleColumnDrop(event, column.status)}
              >
                {columnTasks.length === 0 ? (
                  <div className="column-empty">
                    <span className="column-empty-text">No tasks</span>
                  </div>
                ) : (
                  columnTasks.map((task, index) => (
                    <div
                      key={task.id}
                      style={{ animationDelay: `${index * 0.04}s` }}
                      className="animate-fade-in"
                    >
                      <TaskCard
                        task={task}
                        projectName={
                          task.project_id
                            ? projectNameById[task.project_id]
                            : null
                        }
                        onEdit={onEdit}
                        onStatusChange={onStatusChange}
                        onDelete={onDelete}
                        subtaskProgress={subtaskProgressByTaskId.get(task.id)}
                        onDragStart={handleTaskDragStart}
                        onDragEnd={handleTaskDragEnd}
                        isDragging={draggedTaskId === task.id}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .board-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 24px 28px;
        }

        .board-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-shrink: 0;
        }
        .board-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }
        .board-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .board-columns {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          flex: 1;
          min-height: 0;
        }

        .column {
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          overflow: hidden;
          min-height: 0;
        }
        .column.drop-target {
          border-color: var(--accent);
          box-shadow: inset 0 0 0 1px var(--accent-subtle);
        }

        .column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
          flex-shrink: 0;
        }
        .column-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .column-dot {
          display: flex;
          align-items: center;
        }
        .column-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .column-count {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-hover);
          padding: 1px 7px;
          border-radius: var(--radius-full);
          font-variant-numeric: tabular-nums;
        }
        .column-add-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          background: none;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .column-add-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-strong);
        }

        .column-cards {
          flex: 1;
          overflow-y: auto;
          padding: 4px 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: background var(--duration) var(--ease);
        }
        .column-cards.drop-active {
          background: var(--accent-subtle);
        }

        .column-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
        }
        .column-empty-text {
          font-size: 12px;
          color: var(--text-disabled);
        }

        /* ===== Responsive ===== */
        @media (max-width: 768px) {
          .board-container {
            padding: 20px 16px;
          }
          .board-columns {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
        }

        @media (max-width: 640px) {
          .board-container {
            padding: 8px 10px;
          }
          .board-header {
            margin-bottom: 16px;
          }
          .board-title {
            font-size: 18px;
          }
          .board-columns {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .column {
            max-height: 300px;
          }
          .column-cards {
            padding: 4px 8px 10px;
          }
        }
      `}</style>
    </div>
  );
}

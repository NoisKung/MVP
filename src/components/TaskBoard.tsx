import type { Task, TaskStatus } from "@/lib/types";
import { TaskCard } from "./TaskCard";

interface KanbanColumnDef {
    status: TaskStatus;
    label: string;
    emoji: string;
    accentColor: string;
}

const COLUMNS: KanbanColumnDef[] = [
    { status: "TODO", label: "To Do", emoji: "📋", accentColor: "var(--color-todo)" },
    { status: "DOING", label: "In Progress", emoji: "⚡", accentColor: "var(--color-doing)" },
    { status: "DONE", label: "Done", emoji: "✅", accentColor: "var(--color-done)" },
];

interface TaskBoardProps {
    tasks: Task[];
    onEdit: (task: Task) => void;
    onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
    onDelete: (taskId: string) => void;
}

export function TaskBoard({ tasks, onEdit, onStatusChange, onDelete }: TaskBoardProps) {
    return (
        <div className="task-board">
            {COLUMNS.map((column) => {
                const columnTasks = tasks.filter((t) => t.status === column.status);

                return (
                    <div key={column.status} className="kanban-column">
                        <div className="column-header">
                            <div className="column-header-left">
                                <span className="column-emoji">{column.emoji}</span>
                                <h2 className="column-title">{column.label}</h2>
                                <span
                                    className="column-count"
                                    style={{ backgroundColor: `${column.accentColor}22`, color: column.accentColor }}
                                >
                                    {columnTasks.length}
                                </span>
                            </div>
                            <div
                                className="column-accent-bar"
                                style={{ backgroundColor: column.accentColor }}
                            />
                        </div>

                        <div className="column-body">
                            {columnTasks.length === 0 ? (
                                <div className="column-empty">
                                    <span className="column-empty-icon">{column.status === "DONE" ? "🎉" : "✨"}</span>
                                    <span className="column-empty-text">
                                        {column.status === "DONE" ? "Complete tasks to see them here" : "No tasks yet"}
                                    </span>
                                </div>
                            ) : (
                                columnTasks.map((task) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onEdit={onEdit}
                                        onStatusChange={onStatusChange}
                                        onDelete={onDelete}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                );
            })}

            <style>{`
        .task-board {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          height: 100%;
          padding: 0 4px;
        }
        .kanban-column {
          display: flex;
          flex-direction: column;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .column-header {
          padding: 16px 18px 12px;
          position: relative;
        }
        .column-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-radius: 0 0 4px 4px;
        }
        .column-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .column-emoji {
          font-size: 1.1rem;
        }
        .column-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--color-text-primary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .column-count {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
        }
        .column-body {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .column-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 8px;
        }
        .column-empty-icon {
          font-size: 2rem;
          opacity: 0.5;
        }
        .column-empty-text {
          font-size: 0.82rem;
          color: var(--color-text-muted);
          text-align: center;
        }
      `}</style>
        </div>
    );
}

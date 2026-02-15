import { useEffect, useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useTaskSubtaskStats,
  useUpdateProject,
} from "@/hooks/use-tasks";
import { TaskCard } from "./TaskCard";
import { FolderKanban, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";

interface ProjectViewProps {
  tasks: Task[];
  projectNameById: Record<string, string>;
  isLoadingTasks: boolean;
  isTasksError: boolean;
  tasksError: unknown;
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDelete: (taskId: string) => void;
  onCreateClick: (projectId: string | null) => void;
}

interface ProjectMetrics {
  total: number;
  done: number;
  open: number;
  overdue: number;
  progressPercent: number;
}

const STATUS_SECTIONS: Array<{ status: TaskStatus; label: string }> = [
  { status: "TODO", label: "To Do" },
  { status: "DOING", label: "In Progress" },
  { status: "DONE", label: "Done" },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "Unable to complete the request.";
}

function getProjectMetrics(tasks: Task[], now = new Date()): ProjectMetrics {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "DONE").length;
  const open = tasks.filter(
    (task) => task.status !== "DONE" && task.status !== "ARCHIVED",
  ).length;
  const overdue = tasks.filter((task) => {
    if (task.status === "DONE" || task.status === "ARCHIVED" || !task.due_at) {
      return false;
    }
    const dueDate = new Date(task.due_at);
    if (Number.isNaN(dueDate.getTime())) return false;
    return dueDate.getTime() < now.getTime();
  }).length;
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, done, open, overdue, progressPercent };
}

function sortProjectTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((leftTask, rightTask) => {
    const leftDue = leftTask.due_at
      ? new Date(leftTask.due_at).getTime()
      : null;
    const rightDue = rightTask.due_at
      ? new Date(rightTask.due_at).getTime()
      : null;

    if (leftDue !== null && rightDue !== null) {
      return leftDue - rightDue;
    }
    if (leftDue !== null) return -1;
    if (rightDue !== null) return 1;

    return (
      new Date(rightTask.updated_at).getTime() -
      new Date(leftTask.updated_at).getTime()
    );
  });
}

export function ProjectView({
  tasks,
  projectNameById,
  isLoadingTasks,
  isTasksError,
  tasksError,
  onEdit,
  onStatusChange,
  onDelete,
  onCreateClick,
}: ProjectViewProps) {
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    isError: isProjectsError,
    error: projectsError,
  } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    const hasSelectedProject = projects.some(
      (project) => project.id === selectedProjectId,
    );
    if (!hasSelectedProject) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const taskMetricsByProjectId = useMemo(() => {
    const taskMap = new Map<string, Task[]>();
    for (const project of projects) {
      taskMap.set(project.id, []);
    }

    for (const task of tasks) {
      if (!task.project_id) continue;
      const existingTasks = taskMap.get(task.project_id);
      if (!existingTasks) continue;
      existingTasks.push(task);
    }

    const metricsMap = new Map<string, ProjectMetrics>();
    for (const [projectId, projectTasks] of taskMap.entries()) {
      metricsMap.set(projectId, getProjectMetrics(projectTasks));
    }
    return metricsMap;
  }, [projects, tasks]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedProjectTasks = useMemo(() => {
    if (!selectedProject) return [] as Task[];
    return sortProjectTasks(
      tasks.filter((task) => task.project_id === selectedProject.id),
    );
  }, [selectedProject, tasks]);

  const selectedTaskIds = useMemo(
    () => selectedProjectTasks.map((task) => task.id),
    [selectedProjectTasks],
  );
  const { data: subtaskStats = [] } = useTaskSubtaskStats(
    selectedTaskIds,
    selectedTaskIds.length > 0,
  );
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

  const selectedProjectMetrics = selectedProject
    ? (taskMetricsByProjectId.get(selectedProject.id) ?? getProjectMetrics([]))
    : getProjectMetrics([]);

  const handleCreateProject = async () => {
    const inputName = window.prompt("Project name");
    if (!inputName) return;

    const normalizedName = inputName.trim();
    if (!normalizedName) return;

    setActionError(null);
    try {
      const project = await createProject.mutateAsync({ name: normalizedName });
      setSelectedProjectId(project.id);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleRenameSelectedProject = async () => {
    if (!selectedProject) return;
    const inputName = window.prompt("Rename project", selectedProject.name);
    if (!inputName) return;

    const normalizedName = inputName.trim();
    if (!normalizedName) return;

    setActionError(null);
    try {
      await updateProject.mutateAsync({
        id: selectedProject.id,
        name: normalizedName,
      });
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleToggleProjectCompleted = async () => {
    if (!selectedProject) return;
    const nextStatus =
      selectedProject.status === "COMPLETED" ? "ACTIVE" : "COMPLETED";

    setActionError(null);
    try {
      await updateProject.mutateAsync({
        id: selectedProject.id,
        status: nextStatus,
      });
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleDeleteSelectedProject = async () => {
    if (!selectedProject) return;
    if (
      !window.confirm(
        `Delete project "${selectedProject.name}"? Tasks will be unassigned.`,
      )
    ) {
      return;
    }

    setActionError(null);
    try {
      await deleteProject.mutateAsync(selectedProject.id);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  if (isLoadingProjects) {
    return (
      <div className="project-view-state">
        <p>Loading projects...</p>
      </div>
    );
  }

  if (isProjectsError) {
    return (
      <div className="project-view-state project-view-state-error">
        <p>{getErrorMessage(projectsError)}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="project-view-empty">
        <FolderKanban size={30} />
        <h2>No projects yet</h2>
        <p>Create your first project to group tasks and track progress.</p>
        <button
          className="project-primary-btn"
          onClick={() => void handleCreateProject()}
          disabled={createProject.isPending}
        >
          <Plus size={14} />
          {createProject.isPending ? "Creating..." : "Create Project"}
        </button>
      </div>
    );
  }

  return (
    <div className="project-view-root">
      <div className="project-view-header">
        <div>
          <h1 className="project-view-title">Projects</h1>
          <p className="project-view-subtitle">
            {projects.length} project{projects.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <button
          className="project-primary-btn"
          onClick={() => void handleCreateProject()}
          disabled={createProject.isPending}
        >
          <Plus size={14} />
          {createProject.isPending ? "Creating..." : "New Project"}
        </button>
      </div>

      {actionError && <p className="project-action-error">{actionError}</p>}

      <div className="project-view-layout">
        <aside className="project-list-panel">
          <div className="project-list">
            {projects.map((project) => {
              const metrics =
                taskMetricsByProjectId.get(project.id) ?? getProjectMetrics([]);
              const isSelected = project.id === selectedProjectId;

              return (
                <button
                  key={project.id}
                  className={`project-list-item${isSelected ? " selected" : ""}`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <div className="project-list-top">
                    <span className="project-list-name">{project.name}</span>
                    <span
                      className={`project-status-badge${project.status === "COMPLETED" ? " completed" : ""}`}
                    >
                      {project.status === "COMPLETED" ? "Completed" : "Active"}
                    </span>
                  </div>
                  <div className="project-progress-track">
                    <div
                      className="project-progress-fill"
                      style={{ width: `${metrics.progressPercent}%` }}
                    />
                  </div>
                  <div className="project-list-metrics">
                    <span>
                      {metrics.done}/{metrics.total} done
                    </span>
                    <span>{metrics.overdue} overdue</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="project-detail-panel">
          {selectedProject ? (
            <>
              <div className="project-detail-header">
                <div>
                  <h2>{selectedProject.name}</h2>
                  <p>{selectedProjectTasks.length} task(s) in this project</p>
                </div>
                <div className="project-detail-actions">
                  <button
                    type="button"
                    className="project-ghost-btn"
                    onClick={() => void handleRenameSelectedProject()}
                    disabled={updateProject.isPending}
                  >
                    <Pencil size={12} />
                    Rename
                  </button>
                  <button
                    type="button"
                    className="project-ghost-btn"
                    onClick={() => void handleToggleProjectCompleted()}
                    disabled={updateProject.isPending}
                  >
                    <CheckCircle2 size={12} />
                    {selectedProject.status === "COMPLETED"
                      ? "Mark Active"
                      : "Mark Completed"}
                  </button>
                  <button
                    type="button"
                    className="project-ghost-btn danger"
                    onClick={() => void handleDeleteSelectedProject()}
                    disabled={deleteProject.isPending}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                  <button
                    className="project-primary-btn"
                    onClick={() => onCreateClick(selectedProject.id)}
                  >
                    <Plus size={14} />
                    New Task
                  </button>
                </div>
              </div>

              <div className="project-kpis">
                <div className="project-kpi-card">
                  <span>Progress</span>
                  <strong>{selectedProjectMetrics.progressPercent}%</strong>
                </div>
                <div className="project-kpi-card">
                  <span>Total</span>
                  <strong>{selectedProjectMetrics.total}</strong>
                </div>
                <div className="project-kpi-card">
                  <span>Open</span>
                  <strong>{selectedProjectMetrics.open}</strong>
                </div>
                <div className="project-kpi-card">
                  <span>Overdue</span>
                  <strong>{selectedProjectMetrics.overdue}</strong>
                </div>
              </div>

              {isLoadingTasks ? (
                <p className="project-view-inline-state">Loading tasks...</p>
              ) : isTasksError ? (
                <p className="project-view-inline-state project-view-inline-state-error">
                  {getErrorMessage(tasksError)}
                </p>
              ) : selectedProjectTasks.length === 0 ? (
                <div className="project-view-inline-empty">
                  <p>No tasks in this project yet.</p>
                  <button
                    className="project-primary-btn"
                    onClick={() => onCreateClick(selectedProject.id)}
                  >
                    <Plus size={14} />
                    Add First Task
                  </button>
                </div>
              ) : (
                <div className="project-task-sections">
                  {STATUS_SECTIONS.map((section) => {
                    const sectionTasks = selectedProjectTasks.filter(
                      (task) => task.status === section.status,
                    );
                    return (
                      <div
                        key={section.status}
                        className="project-task-section"
                      >
                        <div className="project-task-section-header">
                          <h3>{section.label}</h3>
                          <span>{sectionTasks.length}</span>
                        </div>
                        {sectionTasks.length === 0 ? (
                          <p className="project-task-empty">No tasks</p>
                        ) : (
                          <div className="project-task-cards">
                            {sectionTasks.map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                projectName={
                                  task.project_id
                                    ? projectNameById[task.project_id]
                                    : null
                                }
                                onEdit={onEdit}
                                onStatusChange={onStatusChange}
                                onDelete={onDelete}
                                subtaskProgress={subtaskProgressByTaskId.get(
                                  task.id,
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p className="project-view-inline-state">
              Select a project to see details.
            </p>
          )}
        </section>
      </div>

      <style>{`
        .project-view-root {
          padding: 20px 24px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .project-view-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .project-view-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.4px;
        }
        .project-view-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .project-action-error {
          border: 1px solid var(--danger);
          background: var(--danger-subtle);
          border-radius: var(--radius-sm);
          color: var(--danger);
          font-size: 12px;
          padding: 8px 10px;
        }
        .project-view-layout {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 12px;
        }
        .project-list-panel,
        .project-detail-panel {
          min-height: 0;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--bg-surface);
        }
        .project-list-panel {
          overflow: hidden;
        }
        .project-list {
          height: 100%;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .project-list-item {
          text-align: left;
          width: 100%;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          padding: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: all var(--duration) var(--ease);
        }
        .project-list-item:hover {
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .project-list-item.selected {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent-subtle) inset;
        }
        .project-list-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .project-list-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .project-status-badge {
          font-size: 10px;
          font-weight: 600;
          color: var(--accent);
          background: var(--accent-subtle);
          padding: 2px 6px;
          border-radius: var(--radius-full);
        }
        .project-status-badge.completed {
          color: var(--status-done);
          background: rgba(74, 222, 128, 0.12);
        }
        .project-progress-track {
          width: 100%;
          height: 6px;
          border-radius: var(--radius-full);
          background: var(--bg-hover);
          overflow: hidden;
        }
        .project-progress-fill {
          height: 100%;
          background: var(--accent);
        }
        .project-list-metrics {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
        }
        .project-detail-panel {
          padding: 12px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .project-detail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .project-detail-header h2 {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .project-detail-header p {
          margin-top: 2px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .project-detail-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .project-primary-btn {
          height: 32px;
          border: none;
          border-radius: var(--radius-md);
          padding: 0 12px;
          background: var(--accent);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .project-primary-btn:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: var(--shadow-glow);
        }
        .project-primary-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .project-ghost-btn {
          height: 30px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 0 10px;
          background: var(--bg-elevated);
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
        .project-ghost-btn:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: var(--border-strong);
          background: var(--bg-hover);
        }
        .project-ghost-btn.danger:hover:not(:disabled) {
          border-color: var(--danger);
          color: var(--danger);
          background: var(--danger-subtle);
        }
        .project-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .project-kpi-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .project-kpi-card span {
          font-size: 11px;
          color: var(--text-muted);
        }
        .project-kpi-card strong {
          font-size: 15px;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
        .project-task-sections {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .project-task-section {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          overflow: hidden;
        }
        .project-task-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 10px;
          border-bottom: 1px solid var(--border-default);
        }
        .project-task-section-header h3 {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .project-task-section-header span {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .project-task-cards {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .project-task-empty {
          padding: 10px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .project-view-state,
        .project-view-empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 8px;
          color: var(--text-muted);
        }
        .project-view-empty h2 {
          color: var(--text-primary);
          font-size: 18px;
        }
        .project-view-empty p {
          max-width: 360px;
          font-size: 13px;
        }
        .project-view-state-error,
        .project-view-inline-state-error {
          color: var(--danger);
        }
        .project-view-inline-state {
          font-size: 12px;
          color: var(--text-muted);
        }
        .project-view-inline-empty {
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-md);
          padding: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .project-view-root {
            padding: 12px;
          }
          .project-view-layout {
            grid-template-columns: 1fr;
          }
          .project-list {
            max-height: 200px;
          }
        }
        @media (max-width: 640px) {
          .project-view-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .project-detail-header {
            flex-direction: column;
          }
          .project-detail-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .project-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import {
  useCreateProject,
  useProjects,
  useTaskSubtaskStats,
  useUpdateProject,
} from "@/hooks/use-tasks";
import { TaskCard } from "./TaskCard";
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Check,
  X,
  Search,
} from "lucide-react";

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
  onDeleteProject: (input: { projectId: string; projectName: string }) => void;
  isDeleteProjectPending: boolean;
}

interface ProjectMetrics {
  total: number;
  done: number;
  open: number;
  overdue: number;
  progressPercent: number;
}

type ProjectStatusFilter = "ALL" | "ACTIVE" | "COMPLETED";
type TaskSectionFilter = "ALL" | TaskStatus;

const STATUS_SECTIONS: Array<{ status: TaskStatus; label: string }> = [
  { status: "TODO", label: "To Do" },
  { status: "DOING", label: "In Progress" },
  { status: "DONE", label: "Done" },
];
const PROJECT_STATUS_FILTERS: Array<{
  value: ProjectStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
];
const DEFAULT_PROJECT_COLOR = "#3B82F6";

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

function normalizeProjectColor(colorValue: string): string | null {
  const trimmedColor = colorValue.trim();
  if (!trimmedColor) return null;
  return /^#[0-9a-fA-F]{6}$/.test(trimmedColor) ? trimmedColor : null;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toUpperCase();
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
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
  onDeleteProject,
  isDeleteProjectPending,
}: ProjectViewProps) {
  const {
    data: projects = [],
    isLoading: isLoadingProjects,
    isError: isProjectsError,
    error: projectsError,
  } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] =
    useState<ProjectStatusFilter>("ALL");
  const [taskSectionFilter, setTaskSectionFilter] =
    useState<TaskSectionFilter>("ALL");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createColor, setCreateColor] = useState(DEFAULT_PROJECT_COLOR);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_PROJECT_COLOR);
  const projectSearchInputRef = useRef<HTMLInputElement | null>(null);

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

  const normalizedProjectSearch = projectSearch.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (
        projectStatusFilter !== "ALL" &&
        project.status !== projectStatusFilter
      ) {
        return false;
      }

      if (!normalizedProjectSearch) return true;
      const searchableText =
        `${project.name} ${project.description ?? ""}`.toLowerCase();
      return searchableText.includes(normalizedProjectSearch);
    });
  }, [projects, projectStatusFilter, normalizedProjectSearch]);

  const projectStatusCounts = useMemo(
    () => ({
      ALL: projects.length,
      ACTIVE: projects.filter((project) => project.status === "ACTIVE").length,
      COMPLETED: projects.filter((project) => project.status === "COMPLETED")
        .length,
    }),
    [projects],
  );

  useEffect(() => {
    if (filteredProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    const hasSelectedProject = filteredProjects.some(
      (project) => project.id === selectedProjectId,
    );
    if (!hasSelectedProject) {
      setSelectedProjectId(filteredProjects[0].id);
    }
  }, [filteredProjects, selectedProjectId]);

  const selectedProject =
    filteredProjects.find((project) => project.id === selectedProjectId) ??
    null;

  useEffect(() => {
    if (!selectedProject) {
      setIsEditingDetails(false);
      return;
    }

    setEditName(selectedProject.name);
    setEditDescription(selectedProject.description ?? "");
    setEditColor(selectedProject.color ?? DEFAULT_PROJECT_COLOR);
    setTaskSectionFilter("ALL");
    setIsEditingDetails(false);
  }, [selectedProject]);

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableEventTarget(event.target)) return;

      event.preventDefault();
      const inputElement = projectSearchInputRef.current;
      if (!inputElement) return;
      inputElement.focus();
      inputElement.select();
    };

    window.addEventListener("keydown", handleGlobalSearchShortcut);
    return () =>
      window.removeEventListener("keydown", handleGlobalSearchShortcut);
  }, []);

  const selectedProjectTasks = useMemo(() => {
    if (!selectedProject) return [] as Task[];
    return sortProjectTasks(
      tasks.filter((task) => task.project_id === selectedProject.id),
    );
  }, [selectedProject, tasks]);
  const selectedProjectTaskCounts = useMemo(() => {
    const counts: Record<TaskSectionFilter, number> = {
      ALL: selectedProjectTasks.length,
      TODO: 0,
      DOING: 0,
      DONE: 0,
      ARCHIVED: 0,
    };
    for (const task of selectedProjectTasks) {
      counts[task.status] += 1;
    }
    return counts;
  }, [selectedProjectTasks]);
  const visibleTaskSections = useMemo(() => {
    if (taskSectionFilter === "ALL") return STATUS_SECTIONS;
    return STATUS_SECTIONS.filter(
      (section) => section.status === taskSectionFilter,
    );
  }, [taskSectionFilter]);

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
  const isProjectFilterActive =
    projectStatusFilter !== "ALL" || normalizedProjectSearch.length > 0;

  const handleCreateProject = async () => {
    const normalizedName = createName.trim();
    if (!normalizedName) {
      setActionError("Project name is required.");
      return;
    }
    const normalizedDescription = createDescription.trim() || null;
    const normalizedColor = normalizeProjectColor(createColor);

    setActionError(null);
    try {
      const project = await createProject.mutateAsync({
        name: normalizedName,
        description: normalizedDescription,
        color: normalizedColor,
      });
      setProjectStatusFilter("ALL");
      setProjectSearch("");
      setSelectedProjectId(project.id);
      setIsCreateFormOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateColor(DEFAULT_PROJECT_COLOR);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleStartEditingSelectedProject = () => {
    if (!selectedProject) return;
    setEditName(selectedProject.name);
    setEditDescription(selectedProject.description ?? "");
    setEditColor(selectedProject.color ?? DEFAULT_PROJECT_COLOR);
    setIsEditingDetails(true);
    setActionError(null);
  };

  const handleCancelEditingSelectedProject = () => {
    if (selectedProject) {
      setEditName(selectedProject.name);
      setEditDescription(selectedProject.description ?? "");
      setEditColor(selectedProject.color ?? DEFAULT_PROJECT_COLOR);
    }
    setIsEditingDetails(false);
    setActionError(null);
  };

  const handleSaveSelectedProjectDetails = async () => {
    if (!selectedProject) return;
    const normalizedName = editName.trim();
    if (!normalizedName) {
      setActionError("Project name is required.");
      return;
    }
    const normalizedDescription = editDescription.trim() || null;
    const normalizedColor = normalizeProjectColor(editColor);

    setActionError(null);
    try {
      await updateProject.mutateAsync({
        id: selectedProject.id,
        name: normalizedName,
        description: normalizedDescription,
        color: normalizedColor,
      });
      setIsEditingDetails(false);
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
      onDeleteProject({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
      });
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
      <>
        <div className="project-view-empty">
          <FolderKanban size={30} />
          <h2>No projects yet</h2>
          <p>Create your first project to group tasks and track progress.</p>
          <div className="project-editor-card project-empty-editor">
            <div className="project-editor-grid">
              <label className="project-editor-field">
                <span>Name</span>
                <input
                  className="project-editor-input"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
              </label>
              <label className="project-editor-field">
                <span>Color</span>
                <div className="project-color-input-row">
                  <input
                    type="color"
                    className="project-color-input"
                    value={createColor}
                    onChange={(event) => setCreateColor(event.target.value)}
                  />
                  <input
                    className="project-editor-input"
                    value={createColor}
                    onChange={(event) => setCreateColor(event.target.value)}
                    placeholder="#3B82F6"
                  />
                </div>
              </label>
            </div>
            <label className="project-editor-field">
              <span>Description</span>
              <textarea
                className="project-editor-textarea"
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                placeholder="What is this project for?"
                rows={2}
              />
            </label>
            <div className="project-editor-actions">
              <button
                className="project-primary-btn"
                onClick={() => void handleCreateProject()}
                disabled={!createName.trim() || createProject.isPending}
              >
                <Plus size={14} />
                {createProject.isPending ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>

        <style>{`
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
            max-width: 420px;
            font-size: 13px;
          }
          .project-editor-card {
            border: 1px solid var(--border-default);
            border-radius: var(--radius-md);
            background: var(--bg-surface);
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .project-empty-editor {
            width: min(560px, 100%);
            margin-top: 8px;
            text-align: left;
          }
          .project-editor-grid {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 8px;
          }
          .project-editor-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .project-editor-field span {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-muted);
          }
          .project-editor-input,
          .project-editor-textarea {
            width: 100%;
            border: 1px solid var(--border-default);
            border-radius: var(--radius-sm);
            background: var(--bg-elevated);
            color: var(--text-primary);
            font-size: 12px;
            font-family: inherit;
            outline: none;
            transition: border-color var(--duration) var(--ease);
          }
          .project-editor-input {
            height: 32px;
            padding: 0 10px;
          }
          .project-editor-textarea {
            padding: 8px 10px;
            min-height: 64px;
            resize: vertical;
            line-height: 1.45;
          }
          .project-editor-input:focus,
          .project-editor-textarea:focus {
            border-color: var(--border-focus);
          }
          .project-color-input-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .project-color-input {
            width: 34px;
            height: 32px;
            border: 1px solid var(--border-default);
            border-radius: var(--radius-sm);
            background: var(--bg-elevated);
            cursor: pointer;
            padding: 2px;
          }
          .project-editor-actions {
            display: flex;
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
          @media (max-width: 900px) {
            .project-editor-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </>
    );
  }

  return (
    <div className="project-view-root">
      <div className="project-view-header">
        <div>
          <h1 className="project-view-title">Projects</h1>
          <p className="project-view-subtitle">
            {isProjectFilterActive
              ? `${filteredProjects.length} of ${projects.length} project${projects.length !== 1 ? "s" : ""} shown`
              : `${projects.length} project${projects.length !== 1 ? "s" : ""} tracked`}
          </p>
        </div>
        <div className="project-view-header-actions">
          {isProjectFilterActive && (
            <button
              type="button"
              className="project-ghost-btn"
              onClick={() => {
                setProjectSearch("");
                setProjectStatusFilter("ALL");
                setActionError(null);
              }}
              disabled={createProject.isPending || updateProject.isPending}
            >
              <X size={12} />
              Clear Filters
            </button>
          )}
          <button
            className="project-primary-btn"
            onClick={() => {
              setIsCreateFormOpen((prevState) => {
                const nextState = !prevState;
                if (nextState) {
                  setCreateName("");
                  setCreateDescription("");
                  setCreateColor(DEFAULT_PROJECT_COLOR);
                }
                return nextState;
              });
              setActionError(null);
            }}
            disabled={createProject.isPending || updateProject.isPending}
          >
            <Plus size={14} />
            {isCreateFormOpen ? "Close" : "New Project"}
          </button>
        </div>
      </div>

      {actionError && <p className="project-action-error">{actionError}</p>}

      {isCreateFormOpen && (
        <div className="project-editor-card">
          <div className="project-editor-grid">
            <label className="project-editor-field">
              <span>Name</span>
              <input
                className="project-editor-input"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Project name"
                autoFocus
              />
            </label>
            <label className="project-editor-field">
              <span>Color</span>
              <div className="project-color-input-row">
                <input
                  type="color"
                  className="project-color-input"
                  value={createColor}
                  onChange={(event) => setCreateColor(event.target.value)}
                />
                <input
                  className="project-editor-input"
                  value={createColor}
                  onChange={(event) => setCreateColor(event.target.value)}
                  placeholder="#3B82F6"
                />
              </div>
            </label>
          </div>
          <label className="project-editor-field">
            <span>Description</span>
            <textarea
              className="project-editor-textarea"
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              placeholder="What is this project for?"
              rows={2}
            />
          </label>
          <div className="project-editor-actions">
            <button
              type="button"
              className="project-ghost-btn"
              onClick={() => {
                setIsCreateFormOpen(false);
                setActionError(null);
              }}
              disabled={createProject.isPending}
            >
              <X size={12} />
              Cancel
            </button>
            <button
              type="button"
              className="project-primary-btn"
              onClick={() => void handleCreateProject()}
              disabled={!createName.trim() || createProject.isPending}
            >
              <Check size={12} />
              {createProject.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      <div className="project-view-layout">
        <aside className="project-list-panel">
          <div className="project-list-controls">
            <label
              className="project-search-box"
              htmlFor="project-search-input"
            >
              <Search size={13} />
              <input
                ref={projectSearchInputRef}
                id="project-search-input"
                className="project-search-input"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  if (projectSearch.trim()) {
                    setProjectSearch("");
                  } else {
                    projectSearchInputRef.current?.blur();
                  }
                }}
                placeholder="Search project..."
              />
              {projectSearch ? (
                <button
                  type="button"
                  className="project-search-clear-btn"
                  onClick={() => {
                    setProjectSearch("");
                    projectSearchInputRef.current?.focus();
                  }}
                  aria-label="Clear project search"
                  title="Clear project search"
                >
                  <X size={11} />
                </button>
              ) : (
                <kbd className="project-search-shortcut">/</kbd>
              )}
            </label>
            <div className="project-status-filter-row">
              {PROJECT_STATUS_FILTERS.map((filterOption) => {
                const count = projectStatusCounts[filterOption.value];
                const isActive = projectStatusFilter === filterOption.value;
                return (
                  <button
                    key={filterOption.value}
                    type="button"
                    className={`project-status-filter-chip${isActive ? " active" : ""}`}
                    onClick={() => setProjectStatusFilter(filterOption.value)}
                  >
                    <span>{filterOption.label}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="project-list">
            {filteredProjects.length === 0 ? (
              <p className="project-list-empty">
                No projects match current filters.
              </p>
            ) : (
              filteredProjects.map((project) => {
                const metrics =
                  taskMetricsByProjectId.get(project.id) ??
                  getProjectMetrics([]);
                const isSelected = project.id === selectedProjectId;

                return (
                  <button
                    key={project.id}
                    className={`project-list-item${isSelected ? " selected" : ""}`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="project-list-top">
                      <span className="project-list-name-wrap">
                        <span
                          className="project-color-dot"
                          style={{
                            background: project.color ?? DEFAULT_PROJECT_COLOR,
                          }}
                        />
                        <span className="project-list-name">
                          {project.name}
                        </span>
                      </span>
                      <span
                        className={`project-status-badge${project.status === "COMPLETED" ? " completed" : ""}`}
                      >
                        {project.status === "COMPLETED"
                          ? "Completed"
                          : "Active"}
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
              })
            )}
          </div>
        </aside>

        <section className="project-detail-panel">
          {selectedProject ? (
            <>
              <div className="project-detail-header">
                <div className="project-detail-title-wrap">
                  {isEditingDetails ? (
                    <div className="project-editor-card">
                      <div className="project-editor-grid">
                        <label className="project-editor-field">
                          <span>Name</span>
                          <input
                            className="project-editor-input"
                            value={editName}
                            onChange={(event) =>
                              setEditName(event.target.value)
                            }
                            placeholder="Project name"
                          />
                        </label>
                        <label className="project-editor-field">
                          <span>Color</span>
                          <div className="project-color-input-row">
                            <input
                              type="color"
                              className="project-color-input"
                              value={editColor}
                              onChange={(event) =>
                                setEditColor(event.target.value)
                              }
                            />
                            <input
                              className="project-editor-input"
                              value={editColor}
                              onChange={(event) =>
                                setEditColor(event.target.value)
                              }
                              placeholder="#3B82F6"
                            />
                          </div>
                        </label>
                      </div>
                      <label className="project-editor-field">
                        <span>Description</span>
                        <textarea
                          className="project-editor-textarea"
                          value={editDescription}
                          onChange={(event) =>
                            setEditDescription(event.target.value)
                          }
                          placeholder="What is this project for?"
                          rows={2}
                        />
                      </label>
                      <div className="project-editor-actions">
                        <button
                          type="button"
                          className="project-ghost-btn"
                          onClick={handleCancelEditingSelectedProject}
                          disabled={updateProject.isPending}
                        >
                          <X size={12} />
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="project-primary-btn"
                          onClick={() =>
                            void handleSaveSelectedProjectDetails()
                          }
                          disabled={!editName.trim() || updateProject.isPending}
                        >
                          <Check size={12} />
                          {updateProject.isPending ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="project-detail-meta-row">
                        <span
                          className="project-detail-color-chip"
                          style={{
                            background:
                              selectedProject.color ?? DEFAULT_PROJECT_COLOR,
                          }}
                        />
                        <span
                          className={`project-status-badge project-status-badge-detail${selectedProject.status === "COMPLETED" ? " completed" : ""}`}
                        >
                          {selectedProject.status === "COMPLETED"
                            ? "Completed"
                            : "Active"}
                        </span>
                      </div>
                      <h2>{selectedProject.name}</h2>
                      <p>
                        {selectedProjectTasks.length} task(s) in this project
                      </p>
                      {selectedProject.description && (
                        <p className="project-detail-description">
                          {selectedProject.description}
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="project-detail-actions">
                  <button
                    type="button"
                    className="project-ghost-btn"
                    onClick={handleStartEditingSelectedProject}
                    disabled={updateProject.isPending || isEditingDetails}
                  >
                    <Pencil size={12} />
                    {isEditingDetails ? "Editing..." : "Edit"}
                  </button>
                  <button
                    type="button"
                    className="project-ghost-btn"
                    onClick={() => void handleToggleProjectCompleted()}
                    disabled={updateProject.isPending || isEditingDetails}
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
                    disabled={isDeleteProjectPending || isEditingDetails}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                  <button
                    className="project-primary-btn"
                    onClick={() => onCreateClick(selectedProject.id)}
                    disabled={isEditingDetails}
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

              <div className="project-progress-hero">
                <div className="project-progress-hero-top">
                  <span>Delivery Progress</span>
                  <strong>{selectedProjectMetrics.progressPercent}%</strong>
                </div>
                <div className="project-progress-hero-track">
                  <div
                    className="project-progress-hero-fill"
                    style={{
                      width: `${selectedProjectMetrics.progressPercent}%`,
                    }}
                  />
                </div>
                <p>
                  {selectedProjectMetrics.done} done •{" "}
                  {selectedProjectMetrics.open} open •{" "}
                  {selectedProjectMetrics.overdue} overdue
                </p>
              </div>

              {selectedProjectTaskCounts.ALL > 0 && (
                <div className="project-task-filter-row">
                  <button
                    type="button"
                    className={`project-task-filter-chip${taskSectionFilter === "ALL" ? " active" : ""}`}
                    onClick={() => setTaskSectionFilter("ALL")}
                  >
                    All <strong>{selectedProjectTaskCounts.ALL}</strong>
                  </button>
                  {STATUS_SECTIONS.map((section) => (
                    <button
                      key={section.status}
                      type="button"
                      className={`project-task-filter-chip${taskSectionFilter === section.status ? " active" : ""}`}
                      onClick={() => setTaskSectionFilter(section.status)}
                    >
                      {section.label}{" "}
                      <strong>
                        {selectedProjectTaskCounts[section.status]}
                      </strong>
                    </button>
                  ))}
                </div>
              )}

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
                  {visibleTaskSections.map((section) => {
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
          ) : filteredProjects.length === 0 ? (
            <p className="project-view-inline-state">
              No projects match current filters.
            </p>
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
        .project-view-header-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
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
        .project-editor-card {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .project-empty-editor {
          width: min(560px, 100%);
          margin-top: 8px;
          text-align: left;
        }
        .project-editor-grid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
        }
        .project-editor-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .project-editor-field span {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .project-editor-input,
        .project-editor-textarea {
          width: 100%;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 12px;
          font-family: inherit;
          outline: none;
          transition: border-color var(--duration) var(--ease);
        }
        .project-editor-input {
          height: 32px;
          padding: 0 10px;
        }
        .project-editor-textarea {
          padding: 8px 10px;
          min-height: 64px;
          resize: vertical;
          line-height: 1.45;
        }
        .project-editor-input:focus,
        .project-editor-textarea:focus {
          border-color: var(--border-focus);
        }
        .project-color-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .project-color-input {
          width: 34px;
          height: 32px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          cursor: pointer;
          padding: 2px;
        }
        .project-editor-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
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
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .project-list-controls {
          padding: 10px;
          border-bottom: 1px solid var(--border-default);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.02),
            transparent
          );
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .project-search-box {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          padding: 0 10px;
          height: 34px;
          background: var(--bg-elevated);
          color: var(--text-muted);
          transition: border-color var(--duration) var(--ease),
            background var(--duration) var(--ease);
        }
        .project-search-box:focus-within {
          border-color: var(--border-focus);
          background: var(--bg-hover);
        }
        .project-search-input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 12px;
          font-family: inherit;
        }
        .project-search-input::placeholder {
          color: var(--text-disabled);
        }
        .project-search-shortcut {
          border: 1px solid var(--border-default);
          border-radius: 6px;
          background: transparent;
          color: var(--text-disabled);
          font-size: 10px;
          font-family: inherit;
          font-weight: 600;
          padding: 1px 5px;
          line-height: 1.4;
          user-select: none;
        }
        .project-search-clear-btn {
          width: 18px;
          height: 18px;
          border: 1px solid var(--border-default);
          border-radius: 999px;
          background: transparent;
          color: var(--text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .project-search-clear-btn:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .project-status-filter-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .project-status-filter-chip {
          height: 26px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          background: var(--bg-elevated);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          padding: 0 8px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .project-status-filter-chip strong {
          font-size: 10px;
          font-weight: 700;
          color: inherit;
        }
        .project-status-filter-chip:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .project-status-filter-chip.active {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-subtle);
        }
        .project-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .project-list-empty {
          margin: 4px 2px;
          border: 1px dashed var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          padding: 12px;
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
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
        .project-list-name-wrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .project-color-dot {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.24);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.22) inset;
        }
        .project-list-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
        .project-status-badge.project-status-badge-detail {
          font-size: 11px;
          padding: 3px 8px;
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
        .project-detail-meta-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .project-detail-color-chip {
          width: 16px;
          height: 16px;
          border-radius: 5px;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
        }
        .project-detail-title-wrap {
          flex: 1;
          min-width: 0;
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
        .project-detail-description {
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
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
        .project-progress-hero {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: linear-gradient(
            180deg,
            rgba(59, 130, 246, 0.08),
            rgba(59, 130, 246, 0.02)
          );
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .project-progress-hero-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .project-progress-hero-top span {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .project-progress-hero-top strong {
          font-size: 15px;
          color: var(--text-primary);
        }
        .project-progress-hero-track {
          width: 100%;
          height: 8px;
          border-radius: var(--radius-full);
          background: rgba(148, 163, 184, 0.24);
          overflow: hidden;
        }
        .project-progress-hero-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), #60a5fa);
        }
        .project-progress-hero p {
          margin: 0;
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .project-task-filter-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .project-task-filter-chip {
          height: 28px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          padding: 0 10px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .project-task-filter-chip strong {
          font-size: 10px;
          font-weight: 700;
          color: inherit;
        }
        .project-task-filter-chip:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .project-task-filter-chip.active {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-subtle);
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
          .project-editor-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .project-view-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .project-view-header-actions {
            width: 100%;
          }
          .project-view-header-actions .project-primary-btn,
          .project-view-header-actions .project-ghost-btn {
            flex: 1;
            justify-content: center;
          }
          .project-detail-header {
            flex-direction: column;
          }
          .project-detail-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .project-status-filter-row,
          .project-task-filter-row {
            width: 100%;
          }
          .project-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .project-search-shortcut {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

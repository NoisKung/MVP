import { useTaskStats } from "@/hooks/use-tasks";
import {
  BarChart3,
  Circle,
  Loader,
  CheckCircle2,
  Rocket,
  TrendingUp,
} from "lucide-react";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

export function Dashboard() {
  const { data: stats, isLoading, isError, error, refetch } = useTaskStats();

  const totalTasks: number = stats
    ? Object.values(stats).reduce((a: number, b: number) => a + b, 0)
    : 0;
  const completionRate: number =
    totalTasks > 0 && stats
      ? Math.round(((stats.DONE ?? 0) / totalTasks) * 100)
      : 0;

  const statCards = [
    {
      label: "Total Tasks",
      value: totalTasks,
      color: "var(--accent)",
      bg: "var(--accent-subtle)",
      icon: <BarChart3 size={20} />,
    },
    {
      label: "To Do",
      value: stats?.TODO ?? 0,
      color: "var(--status-todo)",
      bg: "var(--status-todo-subtle)",
      icon: <Circle size={20} />,
    },
    {
      label: "In Progress",
      value: stats?.DOING ?? 0,
      color: "var(--status-doing)",
      bg: "var(--status-doing-subtle)",
      icon: <Loader size={20} />,
    },
    {
      label: "Completed",
      value: stats?.DONE ?? 0,
      color: "var(--status-done)",
      bg: "var(--status-done-subtle)",
      icon: <CheckCircle2 size={20} />,
    },
  ];

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard" style={{ paddingTop: 24 }}>
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 10,
            border: "1px solid var(--danger)",
            background: "var(--danger-subtle)",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            Failed to load dashboard
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginBottom: 12,
            }}
          >
            {getErrorMessage(error)}
          </p>
          <button
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-strong)",
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              fontSize: 12,
              cursor: "pointer",
            }}
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Your productivity overview</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div
            key={card.label}
            className="stat-card animate-fade-in"
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            <div
              className="stat-icon-wrapper"
              style={{ background: card.bg, color: card.color }}
            >
              {card.icon}
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: card.color }}>
                {card.value}
              </div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div
        className="progress-card animate-fade-in"
        style={{ animationDelay: "0.28s" }}
      >
        <div className="progress-header">
          <div className="progress-header-left">
            <TrendingUp size={16} color="var(--status-done)" />
            <span className="progress-label">Overall Completion</span>
          </div>
          <span className="progress-pct">{completionRate}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <div className="progress-legend">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Empty state */}
      {totalTasks === 0 && (
        <div
          className="empty-state animate-fade-in"
          style={{ animationDelay: "0.35s" }}
        >
          <div className="empty-icon-wrapper">
            <Rocket size={28} />
          </div>
          <h3 className="empty-title">Ready to get productive?</h3>
          <p className="empty-desc">
            Create your first task using the sidebar button or press{" "}
            <kbd>Cmd/Ctrl+N</kbd>
          </p>
        </div>
      )}

      <style>{`
        .dashboard {
          max-width: 780px;
          margin: 0 auto;
          padding: 24px 28px;
        }
        .dashboard-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 2px solid var(--bg-hover);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .dashboard-header {
          margin-bottom: 24px;
        }
        .dashboard-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.5px;
        }
        .dashboard-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        .stat-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all var(--duration) var(--ease);
        }
        .stat-card:hover {
          border-color: var(--border-strong);
          background: var(--bg-elevated);
        }
        .stat-icon-wrapper {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }
        .stat-info {
          min-width: 0;
        }
        .stat-value {
          font-size: 22px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1.1;
        }
        .stat-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 500;
          margin-top: 2px;
          white-space: nowrap;
        }

        /* Progress */
        .progress-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: 18px 20px;
          margin-bottom: 16px;
        }
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .progress-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .progress-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .progress-pct {
          font-size: 18px;
          font-weight: 700;
          color: var(--status-done);
          font-variant-numeric: tabular-nums;
        }
        .progress-track {
          height: 6px;
          background: var(--bg-hover);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--status-done));
          border-radius: var(--radius-full);
          transition: width 0.6s var(--ease);
        }
        .progress-legend {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 10px;
          color: var(--text-disabled);
          font-variant-numeric: tabular-nums;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          background: var(--bg-surface);
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-lg);
        }
        .empty-icon-wrapper {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-lg);
          margin: 0 auto 16px;
        }
        .empty-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .empty-desc {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .empty-desc kbd {
          display: inline-block;
          font-size: 11px;
          font-family: inherit;
          background: var(--bg-hover);
          border: 1px solid var(--border-strong);
          padding: 1px 5px;
          border-radius: 4px;
          color: var(--text-secondary);
        }

        /* ===== Responsive ===== */
        @media (max-width: 768px) {
          .dashboard {
            padding: 20px 16px;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }

        @media (max-width: 640px) {
          .dashboard {
            padding: 12px 10px;
          }
          .dashboard-title {
            font-size: 18px;
          }
          .stats-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .stat-card {
            padding: 12px;
          }
          .progress-card {
            padding: 14px 16px;
          }
          .empty-state {
            padding: 32px 16px;
          }
        }
      `}</style>
    </div>
  );
}

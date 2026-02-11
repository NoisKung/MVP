import { useTaskStats } from "@/hooks/use-tasks";

export function Dashboard() {
    const { data: stats, isLoading } = useTaskStats();

    const totalTasks: number = stats ? Object.values(stats).reduce((a: number, b: number) => a + b, 0) : 0;
    const completionRate: number = totalTasks > 0 && stats ? Math.round(((stats.DONE ?? 0) / totalTasks) * 100) : 0;

    const statCards = [
        { label: "Total Tasks", value: totalTasks, color: "var(--color-accent)", icon: "📊" },
        { label: "To Do", value: stats?.TODO ?? 0, color: "var(--color-todo)", icon: "📋" },
        { label: "In Progress", value: stats?.DOING ?? 0, color: "var(--color-doing)", icon: "⚡" },
        { label: "Completed", value: stats?.DONE ?? 0, color: "var(--color-done)", icon: "✅" },
    ];

    if (isLoading) {
        return (
            <div className="dashboard-loading">
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h2 className="dashboard-title">Dashboard</h2>
                <p className="dashboard-subtitle">Your productivity at a glance</p>
            </div>

            <div className="stats-grid">
                {statCards.map((card, index) => (
                    <div
                        key={card.label}
                        className="stat-card animate-fade-in"
                        style={{ animationDelay: `${index * 0.08}s` }}
                    >
                        <div className="stat-icon">{card.icon}</div>
                        <div className="stat-value" style={{ color: card.color }}>
                            {card.value}
                        </div>
                        <div className="stat-label">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Completion Progress */}
            <div className="progress-section animate-fade-in" style={{ animationDelay: "0.35s" }}>
                <div className="progress-header">
                    <span className="progress-label">Overall Completion</span>
                    <span className="progress-pct" style={{ color: "var(--color-done)" }}>
                        {completionRate}%
                    </span>
                </div>
                <div className="progress-track">
                    <div
                        className="progress-fill"
                        style={{ width: `${completionRate}%` }}
                    />
                </div>
            </div>

            {totalTasks === 0 && (
                <div className="dashboard-empty animate-fade-in" style={{ animationDelay: "0.4s" }}>
                    <span className="empty-icon">🚀</span>
                    <h3>Ready to get productive?</h3>
                    <p>Create your first task to start tracking your progress.</p>
                </div>
            )}

            <style>{`
        .dashboard {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .dashboard-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .dashboard-header {
          margin-bottom: 28px;
        }
        .dashboard-title {
          font-size: 1.6rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--color-text-primary), var(--color-accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 4px;
        }
        .dashboard-subtitle {
          font-size: 0.9rem;
          color: var(--color-text-muted);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }
        .stat-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 20px;
          text-align: center;
          transition: all var(--transition);
        }
        .stat-card:hover {
          background: var(--color-bg-card-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .stat-icon {
          font-size: 1.8rem;
          margin-bottom: 8px;
        }
        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 0.78rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .progress-section {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 20px 24px;
          margin-bottom: 24px;
        }
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .progress-label {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--color-text-secondary);
        }
        .progress-pct {
          font-size: 1.1rem;
          font-weight: 700;
        }
        .progress-track {
          height: 8px;
          background: var(--color-bg-elevated);
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-accent), var(--color-done));
          border-radius: 4px;
          transition: width 0.6s ease-out;
        }
        .dashboard-empty {
          text-align: center;
          padding: 48px 20px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
        }
        .empty-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 12px;
        }
        .dashboard-empty h3 {
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 4px;
        }
        .dashboard-empty p {
          font-size: 0.88rem;
          color: var(--color-text-muted);
        }
      `}</style>
        </div>
    );
}

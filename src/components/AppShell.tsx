import type { ReactNode } from "react";
import { useAppStore } from "@/store/app-store";
import type { ViewMode } from "@/lib/types";

interface NavItem {
    view: ViewMode;
    label: string;
    icon: string;
}

const NAV_ITEMS: NavItem[] = [
    { view: "board", label: "Board", icon: "📋" },
    { view: "dashboard", label: "Dashboard", icon: "📊" },
];

interface AppShellProps {
    children: ReactNode;
    onCreateClick: () => void;
}

export function AppShell({ children, onCreateClick }: AppShellProps) {
    const { activeView, setActiveView } = useAppStore();

    return (
        <div className="app-shell">
            {/* Sidebar */}
            <aside className="sidebar">
                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="logo-icon">⚡</div>
                    <span className="logo-text">SoloStack</span>
                </div>

                {/* New Task Button */}
                <button className="btn-new-task" onClick={onCreateClick}>
                    <span className="btn-plus">+</span>
                    New Task
                </button>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.view}
                            className={`nav-item ${activeView === item.view ? "active" : ""}`}
                            onClick={() => setActiveView(item.view)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <div className="footer-badge">Local-First</div>
                    <span className="footer-version">v0.1.0</span>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {children}
            </main>

            <style>{`
        .app-shell {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }

        /* ===== Sidebar ===== */
        .sidebar {
          width: 240px;
          min-width: 240px;
          background: var(--color-bg-secondary);
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          padding: 20px 14px;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          margin-bottom: 24px;
        }
        .logo-icon {
          font-size: 1.6rem;
          line-height: 1;
        }
        .logo-text {
          font-size: 1.18rem;
          font-weight: 700;
          background: linear-gradient(135deg, #f0f0f5, #6c63ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.3px;
        }

        /* New Task Button */
        .btn-new-task {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 11px 16px;
          background: var(--color-accent);
          border: none;
          border-radius: var(--radius-sm);
          color: #fff;
          font-size: 0.9rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition);
          margin-bottom: 24px;
        }
        .btn-new-task:hover {
          background: var(--color-accent-hover);
          box-shadow: 0 0 20px var(--color-accent-glow);
          transform: translateY(-1px);
        }
        .btn-plus {
          font-size: 1.2rem;
          font-weight: 300;
          line-height: 1;
        }

        /* Navigation */
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          font-size: 0.88rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition);
          text-align: left;
        }
        .nav-item:hover {
          background: var(--color-bg-card);
          color: var(--color-text-primary);
        }
        .nav-item.active {
          background: var(--color-bg-card);
          color: var(--color-accent);
        }
        .nav-icon {
          font-size: 1.1rem;
        }

        /* Footer */
        .sidebar-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 10px 0;
          border-top: 1px solid var(--color-border);
        }
        .footer-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--color-done);
          background: rgba(34, 197, 94, 0.1);
          padding: 3px 8px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .footer-version {
          font-size: 0.72rem;
          color: var(--color-text-muted);
        }

        /* ===== Main Content ===== */
        .main-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: var(--color-bg-primary);
        }
      `}</style>
        </div>
    );
}

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useAppStore } from "@/store/app-store";
import type { ViewMode } from "@/lib/types";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  LayoutDashboard,
  KanbanSquare,
  CalendarCheck2,
  CalendarDays,
  Settings2,
  Plus,
  Zap,
  HardDrive,
  Menu,
  X,
  Heart,
} from "lucide-react";

interface NavItem {
  view: ViewMode;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { view: "board", label: "Board", icon: <KanbanSquare size={18} /> },
  { view: "today", label: "Today", icon: <CalendarCheck2 size={18} /> },
  { view: "upcoming", label: "Upcoming", icon: <CalendarDays size={18} /> },
  {
    view: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={18} />,
  },
  {
    view: "settings",
    label: "Settings",
    icon: <Settings2 size={18} />,
  },
];

interface AppShellProps {
  children: ReactNode;
  onCreateClick: () => void;
}

export function AppShell({ children, onCreateClick }: AppShellProps) {
  const { activeView, setActiveView } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track viewport width
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = (e: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setSidebarOpen(false);
    };
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleNavClick = (view: ViewMode) => {
    setActiveView(view);
    if (isMobile) closeSidebar();
  };

  const handleCreateClick = () => {
    onCreateClick();
    if (isMobile) closeSidebar();
  };

  return (
    <div className="app-shell">
      {/* Mobile hamburger */}
      {isMobile && (
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Overlay backdrop for mobile */}
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} />
      )}

      <aside
        className={`sidebar${isMobile ? " sidebar-mobile" : ""}${sidebarOpen ? " sidebar-open" : ""}`}
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Zap size={18} strokeWidth={2.5} />
          </div>
          <span className="brand-text">SoloStack</span>
          {isMobile && (
            <button
              className="sidebar-close-btn"
              onClick={closeSidebar}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Create button */}
        <button className="btn-create" onClick={handleCreateClick}>
          <Plus size={16} strokeWidth={2.5} />
          <span>New Task</span>
          <kbd className="shortcut">⌘N</kbd>
        </button>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${activeView === item.view ? "active" : ""}`}
              onClick={() => handleNavClick(item.view)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="footer-status">
            <HardDrive size={13} />
            <span>Local Storage</span>
          </div>
          <span className="footer-version">v0.1.0</span>
        </div>
      </aside>

      <main className="main-content">
        {/* Ko-fi support button */}
        <button
          className="kofi-btn"
          onClick={() => openUrl("https://ko-fi.com/Y8Y71U8RJO")}
          title="Support me on Ko-fi"
        >
          <Heart size={14} />
          <span>Support</span>
        </button>
        {children}
      </main>

      <style>{`
        .app-shell {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          position: relative;
        }

        /* ===== Hamburger ===== */
        .hamburger-btn {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }
        .hamburger-btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-strong);
        }

        /* ===== Sidebar ===== */
        .sidebar {
          width: 220px;
          min-width: 220px;
          background: var(--bg-surface);
          border-right: 1px solid var(--border-default);
          display: flex;
          flex-direction: column;
          padding: 16px 12px;
          gap: 4px;
        }

        /* Mobile sidebar */
        .sidebar-mobile {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          min-width: 260px;
          z-index: 200;
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: none;
        }
        .sidebar-mobile.sidebar-open {
          transform: translateX(0);
          box-shadow: 8px 0 32px rgba(0, 0, 0, 0.5);
        }

        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          z-index: 150;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(2px);
          animation: fadeIn 200ms var(--ease) forwards;
        }

        .sidebar-close-btn {
          margin-left: auto;
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
        .sidebar-close-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 8px;
          margin-bottom: 16px;
        }
        .brand-icon {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-subtle);
          color: var(--accent);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }
        .brand-text {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
        }

        /* Create Button */
        .btn-create {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          background: var(--accent);
          border: none;
          border-radius: var(--radius-md);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
          margin-bottom: 20px;
        }
        .btn-create:hover {
          background: var(--accent-hover);
          box-shadow: var(--shadow-glow);
        }
        .btn-create:active {
          transform: scale(0.98);
        }
        .shortcut {
          margin-left: auto;
          font-size: 10px;
          font-family: inherit;
          color: rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.1);
          padding: 2px 5px;
          border-radius: 4px;
          border: none;
          font-weight: 500;
        }

        /* Navigation */
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .nav-section-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-disabled);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 8px 10px 6px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 7px 10px;
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
          text-align: left;
        }
        .nav-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .nav-item.active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .nav-item.active .nav-icon {
          color: var(--accent);
        }
        .nav-icon {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          transition: color var(--duration) var(--ease);
        }

        /* Footer */
        .sidebar-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 8px 4px;
          border-top: 1px solid var(--border-default);
        }
        .footer-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .footer-version {
          font-size: 11px;
          color: var(--text-disabled);
          font-variant-numeric: tabular-nums;
        }

        /* ===== Main Content ===== */
        .main-content {
          flex: 1;
          overflow-y: auto;
          padding: 0;
          background: var(--bg-base);
          position: relative;
        }

        /* ===== Ko-fi Button ===== */
        .kofi-btn {
          position: absolute;
          top: 16px;
          right: 20px;
          z-index: 40;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px 6px 10px;
          background: linear-gradient(135deg, #ff5e5b 0%, #ff7eb3 100%);
          border: none;
          border-radius: var(--radius-full);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.25s var(--ease);
          box-shadow: 0 2px 8px rgba(255, 94, 91, 0.25);
          letter-spacing: 0.2px;
        }
        .kofi-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(255, 94, 91, 0.4);
          background: linear-gradient(135deg, #ff4744 0%, #ff6ba3 100%);
        }
        .kofi-btn:hover svg {
          animation: kofi-pulse 0.8s ease infinite;
        }
        .kofi-btn:active {
          transform: translateY(0) scale(0.97);
        }

        @keyframes kofi-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }

        /* Mobile: offset for hamburger */
        @media (max-width: 640px) {
          .main-content {
            padding-top: 52px;
          }
          .shortcut {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

import { useEffect } from "react";

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  combo: string;
  description: string;
}

const SHORTCUT_ROWS: ShortcutRow[] = [
  { combo: "Cmd/Ctrl + N", description: "Create a new task" },
  { combo: "Cmd/Ctrl + K", description: "Open command palette" },
  { combo: "Cmd/Ctrl + ,", description: "Open Settings" },
  { combo: "Cmd/Ctrl + Shift + C", description: "Open Conflict Center" },
  { combo: "Cmd/Ctrl + Shift + S", description: "Run Sync now" },
  { combo: "?", description: "Open keyboard shortcut help" },
  { combo: "Esc", description: "Close modal/palette/form" },
];

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="shortcut-help-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget !== event.target) return;
        onClose();
      }}
    >
      <div
        className="shortcut-help-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="shortcut-help-head">
          <h2>Keyboard Shortcuts</h2>
          <button
            type="button"
            className="shortcut-help-close"
            onClick={onClose}
            aria-label="Close shortcut help"
          >
            Close
          </button>
        </div>
        <p className="shortcut-help-subtitle">
          Power actions for faster daily workflow.
        </p>
        <div className="shortcut-help-list">
          {SHORTCUT_ROWS.map((row) => (
            <div className="shortcut-help-row" key={row.combo}>
              <kbd>{row.combo}</kbd>
              <span>{row.description}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .shortcut-help-overlay {
          position: fixed;
          inset: 0;
          z-index: 310;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .shortcut-help-panel {
          width: min(640px, 100%);
          border-radius: 14px;
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .shortcut-help-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .shortcut-help-head h2 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary);
        }
        .shortcut-help-close {
          border: 1px solid var(--border-default);
          border-radius: 8px;
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .shortcut-help-close:hover {
          border-color: var(--border-strong);
          color: var(--text-primary);
        }
        .shortcut-help-subtitle {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .shortcut-help-list {
          display: grid;
          gap: 8px;
        }
        .shortcut-help-row {
          display: grid;
          grid-template-columns: minmax(130px, 220px) 1fr;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--border-default);
          border-radius: 10px;
          padding: 8px 10px;
          background: var(--bg-elevated);
        }
        .shortcut-help-row kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          padding: 6px 8px;
          white-space: nowrap;
        }
        .shortcut-help-row span {
          color: var(--text-secondary);
          font-size: 12px;
        }

        @media (max-width: 640px) {
          .shortcut-help-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }
        }
      `}</style>
    </div>
  );
}

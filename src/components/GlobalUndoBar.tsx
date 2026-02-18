import { RotateCcw } from "lucide-react";

interface GlobalUndoBarProps {
  actionLabel: string;
  pendingCount: number;
  undoWindowMs: number;
  onUndo: () => void;
}

function formatUndoWindowLabel(undoWindowMs: number): string {
  const seconds = Math.max(1, Math.round(undoWindowMs / 1000));
  return `${seconds}s`;
}

export function GlobalUndoBar({
  actionLabel,
  pendingCount,
  undoWindowMs,
  onUndo,
}: GlobalUndoBarProps) {
  return (
    <>
      <div className="global-undo-bar" role="status" aria-live="polite">
        <div className="global-undo-copy">
          <strong>Pending action:</strong>
          <span>{actionLabel}</span>
          {pendingCount > 1 && (
            <span className="global-undo-more">+{pendingCount - 1} more</span>
          )}
        </div>
        <button type="button" className="global-undo-btn" onClick={onUndo}>
          <RotateCcw size={13} />
          Undo ({formatUndoWindowLabel(undoWindowMs)})
        </button>
      </div>
      <style>{`
        .global-undo-bar {
          position: fixed;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          z-index: 300;
          width: min(560px, calc(100vw - 24px));
          border: 1px solid var(--border-strong);
          border-radius: 12px;
          background: var(--bg-elevated);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .global-undo-copy {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .global-undo-copy strong {
          color: var(--text-primary);
          font-weight: 600;
          flex-shrink: 0;
        }
        .global-undo-copy span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .global-undo-more {
          color: var(--text-muted);
          font-size: 11px;
          flex-shrink: 0;
        }
        .global-undo-btn {
          border: 1px solid var(--border-default);
          border-radius: 9px;
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 12px;
          font-family: inherit;
          font-weight: 600;
          padding: 6px 10px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          transition: all var(--duration) var(--ease);
        }
        .global-undo-btn:hover {
          border-color: var(--border-focus);
          color: var(--accent);
          background: var(--bg-hover);
        }
        @media (max-width: 640px) {
          .global-undo-bar {
            bottom: 12px;
            padding: 9px 10px;
          }
          .global-undo-copy {
            font-size: 11px;
          }
          .global-undo-btn {
            font-size: 11px;
            padding: 5px 8px;
          }
        }
      `}</style>
    </>
  );
}

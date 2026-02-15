import { useEffect, useState } from "react";
import { Bolt, X } from "lucide-react";

interface QuickCaptureProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (title: string) => Promise<void>;
  onClose: () => void;
}

export function QuickCapture({
  isSubmitting,
  error,
  onSubmit,
  onClose,
}: QuickCaptureProps) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || isSubmitting) return;
    void onSubmit(normalizedTitle);
  };

  return (
    <div className="quick-capture-overlay" onClick={onClose}>
      <div
        className="quick-capture-panel animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="quick-capture-header">
          <div className="quick-capture-title">
            <Bolt size={14} />
            Quick Capture
          </div>
          <button
            type="button"
            className="quick-capture-close"
            onClick={onClose}
            aria-label="Close quick capture"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="quick-capture-form">
          <input
            className="quick-capture-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Type a task and press Enter..."
            autoFocus
            maxLength={200}
            disabled={isSubmitting}
          />

          {error && <div className="quick-capture-error">{error}</div>}

          <div className="quick-capture-actions">
            <span className="quick-capture-hint">Esc to close</span>
            <button
              type="submit"
              className="quick-capture-submit"
              disabled={isSubmitting || title.trim().length === 0}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .quick-capture-overlay {
          position: fixed;
          inset: 0;
          z-index: 500;
          background: rgba(3, 6, 14, 0.5);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 72px 20px 20px;
        }

        .quick-capture-panel {
          width: min(520px, 100%);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg);
          background: linear-gradient(
            180deg,
            rgba(23, 28, 41, 0.96) 0%,
            rgba(14, 17, 27, 0.98) 100%
          );
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
          overflow: hidden;
        }

        .quick-capture-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border-default);
        }

        .quick-capture-title {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .quick-capture-title svg {
          color: var(--accent);
        }

        .quick-capture-close {
          width: 26px;
          height: 26px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-elevated);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }

        .quick-capture-close:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
          border-color: var(--border-strong);
        }

        .quick-capture-form {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .quick-capture-input {
          width: 100%;
          height: 40px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 14px;
          padding: 0 12px;
          outline: none;
          font-family: inherit;
          transition: all var(--duration) var(--ease);
        }

        .quick-capture-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-subtle);
        }

        .quick-capture-input:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .quick-capture-error {
          border: 1px solid var(--danger);
          background: var(--danger-subtle);
          color: var(--danger);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          font-size: 12px;
          line-height: 1.35;
        }

        .quick-capture-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .quick-capture-hint {
          color: var(--text-muted);
          font-size: 11px;
          letter-spacing: 0.2px;
        }

        .quick-capture-submit {
          height: 32px;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          padding: 0 12px;
          background: var(--accent);
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--duration) var(--ease);
        }

        .quick-capture-submit:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: var(--shadow-glow);
        }

        .quick-capture-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .quick-capture-overlay {
            padding: 64px 12px 12px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}

import { useMemo } from "react";
import {
  buildManualMergeDiffRowsFromConflict,
  getManualMergeTextSources,
} from "@/lib/manual-merge";
import type { SyncConflictRecord } from "@/lib/types";

interface ManualMergeEditorProps {
  conflict: SyncConflictRecord;
  draft: string;
  isSaving: boolean;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function appendText(baseText: string, nextText: string): string {
  const normalizedBase = baseText.trimEnd();
  const normalizedNext = nextText.trim();
  if (!normalizedNext) return baseText;
  if (!normalizedBase) return normalizedNext;
  return `${normalizedBase}\n\n${normalizedNext}`;
}

export function ManualMergeEditor({
  conflict,
  draft,
  isSaving,
  onDraftChange,
  onCancel,
  onSubmit,
}: ManualMergeEditorProps) {
  const mergeSources = useMemo(
    () => getManualMergeTextSources(conflict),
    [conflict],
  );
  const diffRows = useMemo(
    () => buildManualMergeDiffRowsFromConflict(conflict),
    [conflict],
  );
  const localOnlyText = useMemo(
    () =>
      diffRows
        .filter((row) => row.kind === "local_only")
        .map((row) => row.local_text)
        .join("\n"),
    [diffRows],
  );
  const remoteOnlyText = useMemo(
    () =>
      diffRows
        .filter((row) => row.kind === "remote_only")
        .map((row) => row.remote_text)
        .join("\n"),
    [diffRows],
  );

  const visibleRows = diffRows.slice(0, 300);
  const isDiffTruncated = diffRows.length > visibleRows.length;

  return (
    <div className="manual-merge-editor">
      <p className="manual-merge-title">Manual Merge Editor</p>
      <p className="manual-merge-subtitle">
        {conflict.entity_type}:{conflict.entity_id}
      </p>

      <div className="manual-merge-quick-actions">
        <button
          type="button"
          className="manual-merge-btn"
          onClick={() => onDraftChange(mergeSources.localText)}
          disabled={isSaving || !mergeSources.localText}
        >
          Use Local
        </button>
        <button
          type="button"
          className="manual-merge-btn"
          onClick={() => onDraftChange(mergeSources.remoteText)}
          disabled={isSaving || !mergeSources.remoteText}
        >
          Use Remote
        </button>
        <button
          type="button"
          className="manual-merge-btn"
          onClick={() =>
            onDraftChange(
              [mergeSources.localText, mergeSources.remoteText]
                .filter(Boolean)
                .join("\n\n"),
            )
          }
          disabled={
            isSaving || (!mergeSources.localText && !mergeSources.remoteText)
          }
        >
          Use Combined
        </button>
        <button
          type="button"
          className="manual-merge-btn"
          onClick={() => onDraftChange(appendText(draft, localOnlyText))}
          disabled={isSaving || !localOnlyText}
        >
          Append Local-only
        </button>
        <button
          type="button"
          className="manual-merge-btn"
          onClick={() => onDraftChange(appendText(draft, remoteOnlyText))}
          disabled={isSaving || !remoteOnlyText}
        >
          Append Remote-only
        </button>
      </div>

      <div className="manual-merge-diff">
        <div className="manual-merge-diff-head">
          <span>Local</span>
          <span>Remote</span>
        </div>
        {visibleRows.length === 0 ? (
          <div className="manual-merge-empty">No diff content available.</div>
        ) : (
          <div className="manual-merge-diff-body">
            {visibleRows.map((row, index) => (
              <div
                key={`${conflict.id}-diff-${index}`}
                className={`manual-merge-diff-row manual-merge-diff-row-${row.kind}`}
              >
                <div className="manual-merge-diff-cell">
                  <span className="manual-merge-line-number">
                    {row.local_line_number ?? "·"}
                  </span>
                  <pre className="manual-merge-line-text">{row.local_text}</pre>
                </div>
                <div className="manual-merge-diff-cell">
                  <span className="manual-merge-line-number">
                    {row.remote_line_number ?? "·"}
                  </span>
                  <pre className="manual-merge-line-text">
                    {row.remote_text}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {isDiffTruncated && (
        <p className="manual-merge-meta">
          Diff is truncated to first {visibleRows.length} rows for readability.
        </p>
      )}

      <label className="manual-merge-label" htmlFor={`manual-merge-${conflict.id}`}>
        Merged content
      </label>
      <textarea
        id={`manual-merge-${conflict.id}`}
        className="manual-merge-textarea"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        disabled={isSaving}
      />

      <div className="manual-merge-actions">
        <button
          type="button"
          className="manual-merge-btn"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="manual-merge-btn manual-merge-btn-primary"
          onClick={onSubmit}
          disabled={isSaving}
        >
          {isSaving ? "Applying..." : "Apply Merge"}
        </button>
      </div>

      <style>{`
        .manual-merge-editor {
          margin-top: 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          padding: 10px;
        }
        .manual-merge-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.25px;
        }
        .manual-merge-subtitle {
          margin: 0 0 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .manual-merge-quick-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .manual-merge-diff {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          overflow: hidden;
          margin-bottom: 8px;
        }
        .manual-merge-diff-head {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          background: var(--bg-elevated);
          border-bottom: 1px solid var(--border-default);
        }
        .manual-merge-diff-head span {
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .manual-merge-diff-body {
          max-height: 180px;
          overflow: auto;
        }
        .manual-merge-diff-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-bottom: 1px solid var(--border-default);
        }
        .manual-merge-diff-row:last-child {
          border-bottom: none;
        }
        .manual-merge-diff-row-local_only .manual-merge-diff-cell:first-child {
          background: rgba(248, 113, 113, 0.12);
        }
        .manual-merge-diff-row-remote_only .manual-merge-diff-cell:last-child {
          background: rgba(34, 197, 94, 0.12);
        }
        .manual-merge-diff-row-changed .manual-merge-diff-cell {
          background: rgba(245, 158, 11, 0.12);
        }
        .manual-merge-diff-cell {
          display: grid;
          grid-template-columns: 30px 1fr;
          gap: 6px;
          align-items: start;
          padding: 4px 8px;
          min-height: 24px;
        }
        .manual-merge-line-number {
          font-size: 10px;
          color: var(--text-muted);
          text-align: right;
          padding-top: 1px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }
        .manual-merge-line-text {
          margin: 0;
          font-size: 11px;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--text-secondary);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }
        .manual-merge-empty {
          padding: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .manual-merge-meta {
          margin: 0 0 8px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .manual-merge-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.2px;
          margin-bottom: 4px;
        }
        .manual-merge-textarea {
          width: 100%;
          min-height: 120px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 12px;
          line-height: 1.45;
          padding: 8px 10px;
          resize: vertical;
          margin-bottom: 8px;
          font-family: inherit;
        }
        .manual-merge-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }
        .manual-merge-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          padding: 0 10px;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--bg-elevated);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .manual-merge-btn:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .manual-merge-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .manual-merge-btn-primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .manual-merge-btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          border-color: var(--accent-hover);
          color: #fff;
        }
        @media (max-width: 900px) {
          .manual-merge-diff-head,
          .manual-merge-diff-row {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

import type { SyncConflictRecord } from "./types";

const MERGE_TEXT_KEYS = [
  "notes_markdown",
  "notes",
  "description",
  "title",
] as const;

interface ManualMergeDiffOp {
  kind: "unchanged" | "local_only" | "remote_only";
  text: string;
  localLineNumber: number | null;
  remoteLineNumber: number | null;
}

export type ManualMergeDiffRowKind =
  | "unchanged"
  | "changed"
  | "local_only"
  | "remote_only";

export interface ManualMergeTextSources {
  localText: string;
  remoteText: string;
}

export interface ManualMergeDiffRow {
  kind: ManualMergeDiffRowKind;
  local_line_number: number | null;
  remote_line_number: number | null;
  local_text: string;
  remote_text: string;
}

function parsePayloadObject(
  payloadJson: string | null,
): Record<string, unknown> | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getPrimaryTextFromPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null;

  for (const key of MERGE_TEXT_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function stringifyPayload(payloadJson: string | null): string {
  if (!payloadJson) return "";

  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return payloadJson;
  }
}

function toLines(text: string): string[] {
  if (!text) return [];
  return text.split(/\r?\n/u);
}

function createLcsMatrix(localLines: string[], remoteLines: string[]): number[][] {
  const rows = localLines.length + 1;
  const cols = remoteLines.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0),
  );

  for (let localIndex = 1; localIndex < rows; localIndex += 1) {
    for (let remoteIndex = 1; remoteIndex < cols; remoteIndex += 1) {
      if (localLines[localIndex - 1] === remoteLines[remoteIndex - 1]) {
        matrix[localIndex][remoteIndex] =
          matrix[localIndex - 1][remoteIndex - 1] + 1;
        continue;
      }

      matrix[localIndex][remoteIndex] = Math.max(
        matrix[localIndex - 1][remoteIndex],
        matrix[localIndex][remoteIndex - 1],
      );
    }
  }

  return matrix;
}

function buildDiffOps(localText: string, remoteText: string): ManualMergeDiffOp[] {
  const localLines = toLines(localText);
  const remoteLines = toLines(remoteText);
  const lcsMatrix = createLcsMatrix(localLines, remoteLines);

  let localIndex = localLines.length;
  let remoteIndex = remoteLines.length;
  const reversedOps: ManualMergeDiffOp[] = [];

  while (localIndex > 0 || remoteIndex > 0) {
    if (
      localIndex > 0 &&
      remoteIndex > 0 &&
      localLines[localIndex - 1] === remoteLines[remoteIndex - 1]
    ) {
      reversedOps.push({
        kind: "unchanged",
        text: localLines[localIndex - 1],
        localLineNumber: localIndex,
        remoteLineNumber: remoteIndex,
      });
      localIndex -= 1;
      remoteIndex -= 1;
      continue;
    }

    const localScore =
      localIndex > 0 ? lcsMatrix[localIndex - 1][remoteIndex] : -1;
    const remoteScore =
      remoteIndex > 0 ? lcsMatrix[localIndex][remoteIndex - 1] : -1;

    if (localScore >= remoteScore && localIndex > 0) {
      reversedOps.push({
        kind: "local_only",
        text: localLines[localIndex - 1],
        localLineNumber: localIndex,
        remoteLineNumber: null,
      });
      localIndex -= 1;
      continue;
    }

    if (remoteIndex > 0) {
      reversedOps.push({
        kind: "remote_only",
        text: remoteLines[remoteIndex - 1],
        localLineNumber: null,
        remoteLineNumber: remoteIndex,
      });
      remoteIndex -= 1;
    }
  }

  return reversedOps.reverse();
}

function flushPendingDiffRows(input: {
  localPending: ManualMergeDiffOp[];
  remotePending: ManualMergeDiffOp[];
  target: ManualMergeDiffRow[];
}): void {
  const maxCount = Math.max(input.localPending.length, input.remotePending.length);
  for (let index = 0; index < maxCount; index += 1) {
    const localEntry = input.localPending[index] ?? null;
    const remoteEntry = input.remotePending[index] ?? null;

    const hasLocal = Boolean(localEntry);
    const hasRemote = Boolean(remoteEntry);
    let rowKind: ManualMergeDiffRowKind = "unchanged";
    if (hasLocal && hasRemote) {
      rowKind = "changed";
    } else if (hasLocal) {
      rowKind = "local_only";
    } else if (hasRemote) {
      rowKind = "remote_only";
    }

    input.target.push({
      kind: rowKind,
      local_line_number: localEntry?.localLineNumber ?? null,
      remote_line_number: remoteEntry?.remoteLineNumber ?? null,
      local_text: localEntry?.text ?? "",
      remote_text: remoteEntry?.text ?? "",
    });
  }

  input.localPending.length = 0;
  input.remotePending.length = 0;
}

export function getManualMergeTextSources(
  conflict: SyncConflictRecord,
): ManualMergeTextSources {
  const localPayload = parsePayloadObject(conflict.local_payload_json);
  const remotePayload = parsePayloadObject(conflict.remote_payload_json);

  const localPrimaryText = getPrimaryTextFromPayload(localPayload);
  const remotePrimaryText = getPrimaryTextFromPayload(remotePayload);

  const localText = localPrimaryText ?? stringifyPayload(conflict.local_payload_json);
  const remoteText =
    remotePrimaryText ?? stringifyPayload(conflict.remote_payload_json);

  return {
    localText,
    remoteText,
  };
}

export function buildManualMergeDiffRows(input: {
  localText: string;
  remoteText: string;
}): ManualMergeDiffRow[] {
  const diffOps = buildDiffOps(input.localText, input.remoteText);
  const rows: ManualMergeDiffRow[] = [];
  const localPending: ManualMergeDiffOp[] = [];
  const remotePending: ManualMergeDiffOp[] = [];

  for (const op of diffOps) {
    if (op.kind === "unchanged") {
      flushPendingDiffRows({
        localPending,
        remotePending,
        target: rows,
      });
      rows.push({
        kind: "unchanged",
        local_line_number: op.localLineNumber,
        remote_line_number: op.remoteLineNumber,
        local_text: op.text,
        remote_text: op.text,
      });
      continue;
    }

    if (op.kind === "local_only") {
      localPending.push(op);
      continue;
    }

    remotePending.push(op);
  }

  flushPendingDiffRows({
    localPending,
    remotePending,
    target: rows,
  });

  return rows;
}

export function buildManualMergeDiffRowsFromConflict(
  conflict: SyncConflictRecord,
): ManualMergeDiffRow[] {
  const sources = getManualMergeTextSources(conflict);
  return buildManualMergeDiffRows({
    localText: sources.localText,
    remoteText: sources.remoteText,
  });
}

export function normalizeManualMergeText(value: string): string {
  return value.trim();
}

export function buildManualMergeInitialText(conflict: SyncConflictRecord): string {
  const sources = getManualMergeTextSources(conflict);
  if (
    sources.localText &&
    sources.remoteText &&
    sources.localText !== sources.remoteText
  ) {
    return `LOCAL\n${sources.localText}\n\nREMOTE\n${sources.remoteText}`;
  }
  if (sources.localText) return sources.localText;
  return sources.remoteText;
}

export function buildManualMergeResolutionPayload(input: {
  conflict: SyncConflictRecord;
  mergedText: string;
  source: string;
}): Record<string, unknown> {
  return {
    merged_text: normalizeManualMergeText(input.mergedText),
    conflict_type: input.conflict.conflict_type,
    source: input.source,
  };
}

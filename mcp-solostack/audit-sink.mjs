import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";

const AUDIT_FILE_PREFIX = "mcp-tool-call-";
const AUDIT_FILE_SUFFIX = ".log";

function normalizeDirectoryPath(value) {
  if (typeof value !== "string") return "mcp-solostack/audit";
  const normalized = value.trim();
  return normalized || "mcp-solostack/audit";
}

function normalizeRetentionDays(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 30;
  const normalized = Math.floor(value);
  if (normalized < 1) return 1;
  if (normalized > 3650) return 3650;
  return normalized;
}

function formatIsoDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function parseDayFromAuditFilename(filename) {
  const match = filename.match(
    /^mcp-tool-call-(\d{4}-\d{2}-\d{2})\.log$/u,
  );
  if (!match) return null;
  return match[1] ?? null;
}

function parseDayStartMs(day) {
  const parsed = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createFileAuditSink(input = {}) {
  const directoryPath = normalizeDirectoryPath(input.directory_path);
  const retentionDays = normalizeRetentionDays(input.retention_days);
  const now = typeof input.now === "function" ? input.now : () => Date.now();

  mkdirSync(directoryPath, { recursive: true });

  function prune(referenceMs = now()) {
    if (!existsSync(directoryPath)) return;

    const cutoffMs = referenceMs - retentionDays * 24 * 60 * 60 * 1000;
    const entries = readdirSync(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const day = parseDayFromAuditFilename(entry.name);
      if (!day) continue;
      const dayMs = parseDayStartMs(day);
      if (dayMs === null) continue;
      if (dayMs >= cutoffMs) continue;
      rmSync(path.join(directoryPath, entry.name), { force: true });
    }
  }

  function write(eventPayload) {
    const eventObject =
      eventPayload && typeof eventPayload === "object" && !Array.isArray(eventPayload)
        ? eventPayload
        : {};
    const nowMs = now();
    const day = formatIsoDay(nowMs);
    const filePath = path.join(
      directoryPath,
      `${AUDIT_FILE_PREFIX}${day}${AUDIT_FILE_SUFFIX}`,
    );
    const payload = {
      timestamp_iso: new Date(nowMs).toISOString(),
      ...eventObject,
    };
    appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
  }

  prune();

  return {
    mode: "file",
    directory_path: directoryPath,
    retention_days: retentionDays,
    write,
    prune,
  };
}

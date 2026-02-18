import { Worker } from "node:worker_threads";
import { ToolExecutionError, executeReadTool } from "./tools.mjs";

const DEFAULT_WORKER_MODULE_URL = new URL("./tool-worker.mjs", import.meta.url);

function asOptionalPlainObject(value) {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value;
}

function fromWorkerError(payload) {
  const normalized = asOptionalPlainObject(payload);
  if (normalized?.type === "tool") {
    return new ToolExecutionError({
      code: normalized.code ?? "INTERNAL_ERROR",
      status: Number.isFinite(normalized.status) ? normalized.status : 500,
      message: normalized.message ?? "Worker tool execution failed.",
      retry_after_ms: normalized.retry_after_ms ?? null,
      details: asOptionalPlainObject(normalized.details),
    });
  }

  return new ToolExecutionError({
    code: "INTERNAL_ERROR",
    status: 500,
    message: normalized?.message ?? "Worker execution failed.",
  });
}

function timeoutError(timeoutMs) {
  return new ToolExecutionError({
    code: "TIMEOUT",
    status: 504,
    message: `Tool execution timed out after ${timeoutMs}ms.`,
    retry_after_ms: 250,
    details: {
      timeout_limit_ms: timeoutMs,
      timeout_strategy: "worker_hard",
    },
  });
}

async function executeInWorker(payload, timeoutMs, workerModuleUrl) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerModuleUrl, { type: "module" });
    let settled = false;

    const finish = (handler) => (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      worker.removeAllListeners();
      handler(value);
    };

    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);

    const timeoutHandle = setTimeout(() => {
      void worker.terminate().catch(() => {});
      rejectOnce(timeoutError(timeoutMs));
    }, timeoutMs);

    worker.once("message", (message) => {
      const normalized = asOptionalPlainObject(message);
      if (normalized?.ok === true) {
        resolveOnce(normalized.result);
        return;
      }
      rejectOnce(fromWorkerError(normalized?.error));
    });
    worker.once("error", (error) => {
      rejectOnce(
        new ToolExecutionError({
          code: "INTERNAL_ERROR",
          status: 500,
          message:
            error instanceof Error && error.message
              ? error.message
              : "Worker execution failed.",
        }),
      );
    });
    worker.once("exit", (code) => {
      if (settled || code === 0) return;
      rejectOnce(
        new ToolExecutionError({
          code: "INTERNAL_ERROR",
          status: 500,
          message: `Worker exited unexpectedly with code ${code}.`,
        }),
      );
    });

    worker.postMessage(payload);
  });
}

export function createToolExecutor(config, dependencies = {}) {
  const timeoutEnabled = config.timeout_guard_enabled === true;
  const timeoutStrategy = config.timeout_strategy ?? "soft";
  const timeoutMs = config.tool_timeout_ms;
  const directExecute = dependencies.execute_read_tool ?? executeReadTool;
  const workerModuleUrl =
    dependencies.worker_module_url ?? DEFAULT_WORKER_MODULE_URL;

  if (!timeoutEnabled || timeoutStrategy === "soft") {
    return {
      mode: "direct",
      async execute(payload) {
        return directExecute(payload);
      },
    };
  }

  if (timeoutStrategy === "worker_hard") {
    return {
      mode: "worker_hard",
      async execute(payload) {
        return executeInWorker(payload, timeoutMs, workerModuleUrl);
      },
    };
  }

  throw new Error(
    `Unsupported timeout strategy "${timeoutStrategy}" for tool executor.`,
  );
}

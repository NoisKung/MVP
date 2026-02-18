import { parentPort } from "node:worker_threads";
import { ToolExecutionError, executeReadTool } from "./tools.mjs";

if (!parentPort) {
  throw new Error("Worker runtime requires parentPort.");
}

parentPort.on("message", (payload) => {
  try {
    const result = executeReadTool(payload);
    parentPort.postMessage({
      ok: true,
      result,
    });
  } catch (error) {
    if (error instanceof ToolExecutionError) {
      parentPort.postMessage({
        ok: false,
        error: {
          type: "tool",
          code: error.code,
          status: error.status,
          message: error.message,
          retry_after_ms: error.retry_after_ms,
          details: error.details,
        },
      });
      return;
    }

    parentPort.postMessage({
      ok: false,
      error: {
        type: "internal",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Worker execution failed.",
      },
    });
  }
});

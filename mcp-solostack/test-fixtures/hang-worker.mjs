import { parentPort } from "node:worker_threads";

if (!parentPort) {
  throw new Error("hang-worker requires parentPort.");
}

parentPort.on("message", () => {
  // Intentionally no-op to simulate a stuck query worker.
});

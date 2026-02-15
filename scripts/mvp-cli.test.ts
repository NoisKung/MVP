// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = path.resolve(process.cwd(), "scripts/mvp-cli.mjs");

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], env?: NodeJS.ProcessEnv): CliResult {
  const result = spawnSync("node", ["--no-warnings", CLI_ENTRY, ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });

  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

describe("mvp-cli", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "solostack-cli-test-"));
  const dbPath = path.join(tempDir, "test.db");

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("prints help", () => {
    const result = runCli(["help"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SoloStack MVP CLI");
  });

  it("prints resolved db path", () => {
    const result = runCli(["--db", dbPath, "db-path"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(dbPath);
  });

  it("supports project and task lifecycle with recurrence", () => {
    const createProject = runCli([
      "--db",
      dbPath,
      "project",
      "create",
      "--name",
      "CLI Project",
      "--color",
      "#3B82F6",
      "--json",
    ]);
    expect(createProject.status).toBe(0);
    const project = JSON.parse(createProject.stdout) as { id: string; name: string };
    expect(project.name).toBe("CLI Project");

    const createTask = runCli([
      "--db",
      dbPath,
      "task",
      "create",
      "--title",
      "Write release changelog",
      "--project",
      "CLI Project",
      "--priority",
      "URGENT",
      "--due",
      "2026-02-20",
      "--recurrence",
      "WEEKLY",
      "--important=true",
      "--json",
    ]);
    expect(createTask.status).toBe(0);
    const task = JSON.parse(createTask.stdout) as { id: string; status: string };
    expect(task.status).toBe("TODO");

    const listTasks = runCli(["--db", dbPath, "task", "list", "--json"]);
    expect(listTasks.status).toBe(0);
    const listedTasks = JSON.parse(listTasks.stdout) as Array<{ id: string }>;
    expect(listedTasks.some((item) => item.id === task.id)).toBe(true);

    const markDone = runCli([
      "--db",
      dbPath,
      "task",
      "done",
      "--id",
      task.id,
      "--json",
    ]);
    expect(markDone.status).toBe(0);
    const donePayload = JSON.parse(markDone.stdout) as {
      task: { status: string };
      changed: boolean;
    };
    expect(donePayload.changed).toBe(true);
    expect(donePayload.task.status).toBe("DONE");

    const listAfterDone = runCli(["--db", dbPath, "task", "list", "--json"]);
    const listPayload = JSON.parse(listAfterDone.stdout) as Array<{
      id: string;
      status: string;
    }>;
    const todoCount = listPayload.filter((item) => item.status === "TODO").length;
    const doneCount = listPayload.filter((item) => item.status === "DONE").length;
    expect(todoCount).toBeGreaterThanOrEqual(1);
    expect(doneCount).toBeGreaterThanOrEqual(1);
  });

  it("supports task update and quick capture", () => {
    const quickCapture = runCli([
      "--db",
      dbPath,
      "quick-capture",
      "Inbox note from terminal",
      "--json",
    ]);
    expect(quickCapture.status).toBe(0);
    const quickTask = JSON.parse(quickCapture.stdout) as { id: string; title: string };
    expect(quickTask.title).toBe("Inbox note from terminal");

    const updateTask = runCli([
      "--db",
      dbPath,
      "task",
      "update",
      "--id",
      quickTask.id,
      "--status",
      "DOING",
      "--priority",
      "LOW",
      "--json",
    ]);
    expect(updateTask.status).toBe(0);
    const updated = JSON.parse(updateTask.stdout) as {
      task: { status: string; priority: string };
      changedFields: string[];
    };
    expect(updated.task.status).toBe("DOING");
    expect(updated.task.priority).toBe("LOW");
    expect(updated.changedFields).toEqual(expect.arrayContaining(["status", "priority"]));
  });

  it("returns non-zero for invalid command", () => {
    const result = runCli(["--db", dbPath, "unknown-command"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown command");
  });
});

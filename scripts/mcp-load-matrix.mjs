import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { executeReadTool } from "../mcp-solostack/tools.mjs";

const DEFAULT_WEEK_START = "2025-01-06T00:00:00.000Z";

function parseArgs(argv) {
  const args = {
    out: "docs/mcp-load-matrix-v0.1.md",
    iterations: 30,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
      continue;
    }
    if (token === "--iterations") {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed >= 5) {
        args.iterations = Math.floor(parsed);
      }
      index += 1;
    }
  }

  return args;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[index];
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function summarizeDurations(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    avg_ms: roundMs(sum / values.length),
    p50_ms: roundMs(percentile(values, 50)),
    p95_ms: roundMs(percentile(values, 95)),
    max_ms: roundMs(Math.max(...values)),
  };
}

function createFixtureDb(profile) {
  const dir = mkdtempSync(path.join(tmpdir(), "solostack-mcp-load-matrix-"));
  const dbPath = path.join(dir, `${profile.name}.db`);
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      notes_markdown TEXT,
      project_id TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      is_important INTEGER NOT NULL,
      due_at TEXT,
      remind_at TEXT,
      recurrence TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE task_changelogs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const now = Date.now();
  const statuses = ["TODO", "DOING", "DONE", "ARCHIVED"];
  const priorities = ["URGENT", "NORMAL", "LOW"];
  const projectIds = [];

  const insertProject = db.prepare(
    `INSERT INTO projects (id, name, description, color, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (let index = 0; index < profile.projects; index += 1) {
    const projectId = `project-${randomUUID()}`;
    projectIds.push(projectId);
    const createdAt = new Date(now - (profile.tasks + index) * 60_000).toISOString();
    insertProject.run(
      projectId,
      `Project ${index + 1}`,
      `Fixture profile ${profile.name}`,
      `#${(index * 7919 + 0xabcdef).toString(16).slice(0, 6)}`,
      index % 7 === 0 ? "COMPLETED" : "ACTIVE",
      createdAt,
      createdAt,
    );
  }

  const doneTaskIds = [];
  const insertTask = db.prepare(
    `INSERT INTO tasks (
      id, title, description, notes_markdown, project_id, status, priority,
      is_important, due_at, remind_at, recurrence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (let index = 0; index < profile.tasks; index += 1) {
    const taskId = `task-${randomUUID()}`;
    const status = statuses[index % statuses.length];
    const priority = priorities[index % priorities.length];
    const createdAt = new Date(now - (profile.tasks - index) * 3_600_000).toISOString();
    const updatedAt = new Date(now - (profile.tasks - index) * 2_700_000).toISOString();
    const dueOffsetHours = (index % 60) - 30;
    const dueAt = new Date(now + dueOffsetHours * 3_600_000).toISOString();
    const projectId = projectIds[index % projectIds.length];

    insertTask.run(
      taskId,
      `Task ${index + 1} release planning`,
      `fixture ${profile.name} task ${index + 1}`,
      index % 3 === 0 ? `notes block ${index + 1}` : null,
      projectId,
      status,
      priority,
      index % 2,
      status === "ARCHIVED" ? null : dueAt,
      null,
      "NONE",
      createdAt,
      updatedAt,
    );

    if (status === "DONE") {
      doneTaskIds.push(taskId);
    }
  }

  const insertChangelog = db.prepare(
    `INSERT INTO task_changelogs (
      id, task_id, action, field_name, old_value, new_value, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const changelogCount = Math.min(profile.changelogs, doneTaskIds.length);
  for (let index = 0; index < changelogCount; index += 1) {
    const taskId = doneTaskIds[index];
    const createdAt = new Date(now - index * 120_000).toISOString();
    insertChangelog.run(
      `log-${randomUUID()}`,
      taskId,
      "STATUS_CHANGED",
      "status",
      "DOING",
      "DONE",
      createdAt,
    );
  }

  db.close();

  return {
    dbPath,
    sampleTaskId: doneTaskIds[0] ?? null,
    rowSummary: {
      projects: profile.projects,
      tasks: profile.tasks,
      task_changelogs: changelogCount,
    },
  };
}

function runScenario(profileName, dbPath, sampleTaskId, iterations) {
  const scenarios = [
    {
      tool: "get_tasks",
      args: { limit: 50 },
    },
    {
      tool: "get_projects",
      args: { limit: 50 },
    },
    {
      tool: "search_tasks",
      args: { query: "release", limit: 50 },
    },
    {
      tool: "get_task_changelogs",
      args: { task_id: sampleTaskId, limit: 50 },
      skip: !sampleTaskId,
    },
    {
      tool: "get_weekly_review",
      args: { week_start_iso: DEFAULT_WEEK_START, item_limit: 20 },
    },
  ];

  return scenarios
    .filter((scenario) => !scenario.skip)
    .map((scenario) => {
      const durations = [];
      for (let index = 0; index < iterations; index += 1) {
        const startedAt = performance.now();
        const result = executeReadTool({
          tool: scenario.tool,
          args: scenario.args,
          db_path: dbPath,
        });
        const wallDuration = performance.now() - startedAt;
        durations.push(Math.max(result.duration_ms, wallDuration));
      }

      return {
        profile: profileName,
        tool: scenario.tool,
        ...summarizeDurations(durations),
      };
    });
}

function buildMarkdownReport(input) {
  const lines = [
    "# MCP Load Matrix v0.1",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Iterations per tool: ${input.iterations}`,
    "",
    "## Fixture Profiles",
    "",
    "| Profile | Projects | Tasks | Task Changelogs |",
    "| --- | ---: | ---: | ---: |",
  ];

  for (const fixture of input.fixtures) {
    lines.push(
      `| ${fixture.name} | ${fixture.rows.projects} | ${fixture.rows.tasks} | ${fixture.rows.task_changelogs} |`,
    );
  }

  lines.push("");
  lines.push("## Result Matrix (ms)");
  lines.push("");
  lines.push("| Profile | Tool | Avg | P50 | P95 | Max |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: |");

  for (const row of input.rows) {
    lines.push(
      `| ${row.profile} | ${row.tool} | ${row.avg_ms} | ${row.p50_ms} | ${row.p95_ms} | ${row.max_ms} |`,
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- วัดจาก local execution path (`executeReadTool`) บน fixture SQLite ที่สร้างอัตโนมัติ",
  );
  lines.push(
    "- ค่าที่รายงานเป็น baseline สำหรับ regression check ระหว่างปรับ query/guardrails",
  );
  lines.push(
    "- สำหรับ hosted mode ให้รันซ้ำใน environment จริงและเปรียบเทียบกับ baseline นี้",
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const profiles = [
    { name: "small", projects: 15, tasks: 400, changelogs: 120 },
    { name: "medium", projects: 40, tasks: 4000, changelogs: 1400 },
  ];

  const fixtureRows = [];
  const resultRows = [];
  for (const profile of profiles) {
    const fixture = createFixtureDb(profile);
    fixtureRows.push({
      name: profile.name,
      rows: fixture.rowSummary,
    });
    const rows = runScenario(
      profile.name,
      fixture.dbPath,
      fixture.sampleTaskId,
      args.iterations,
    );
    resultRows.push(...rows);
  }

  const markdown = buildMarkdownReport({
    iterations: args.iterations,
    fixtures: fixtureRows,
    rows: resultRows,
  });
  writeFileSync(path.resolve(args.out), markdown, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Load matrix report written to ${path.resolve(args.out)}`);
}

main();

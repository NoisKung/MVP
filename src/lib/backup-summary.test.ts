import { describe, expect, it } from "vitest";
import {
  summarizeBackupPayload,
  summarizeUnknownBackupPayload,
} from "@/lib/backup-summary";
import type { BackupPayload } from "@/lib/types";

describe("backup summary helpers", () => {
  it("summarizes normalized backup payload counts", () => {
    const payload: BackupPayload = {
      version: 1,
      exported_at: "2026-02-20T00:00:00.000Z",
      data: {
        settings: [{ key: "a", value: "1" }],
        projects: [
          {
            id: "p-1",
            name: "Project 1",
            description: null,
            color: null,
            status: "ACTIVE",
            created_at: "2026-02-20T00:00:00.000Z",
            updated_at: "2026-02-20T00:00:00.000Z",
          },
        ],
        tasks: [
          {
            id: "t-1",
            title: "Task 1",
            description: null,
            notes_markdown: null,
            project_id: null,
            status: "TODO",
            priority: "NORMAL",
            is_important: 0,
            due_at: null,
            remind_at: null,
            recurrence: "NONE",
            created_at: "2026-02-20T00:00:00.000Z",
            updated_at: "2026-02-20T00:00:00.000Z",
          },
        ],
        sessions: [],
        task_subtasks: [
          {
            id: "s-1",
            task_id: "t-1",
            title: "S1",
            is_done: 0,
            created_at: "2026-02-20T00:00:00.000Z",
            updated_at: "2026-02-20T00:00:00.000Z",
          },
        ],
        task_changelogs: [],
        task_templates: [
          {
            id: "tpl-1",
            name: "Template 1",
            title_template: null,
            description: null,
            priority: "NORMAL",
            is_important: 0,
            due_offset_minutes: null,
            remind_offset_minutes: null,
            recurrence: "NONE",
            created_at: "2026-02-20T00:00:00.000Z",
            updated_at: "2026-02-20T00:00:00.000Z",
          },
        ],
      },
    };

    expect(summarizeBackupPayload(payload)).toEqual({
      settings: 1,
      projects: 1,
      tasks: 1,
      sessions: 0,
      task_subtasks: 1,
      task_changelogs: 0,
      task_templates: 1,
    });
  });

  it("summarizes raw payload data arrays without normalization", () => {
    const rawPayload = {
      data: {
        settings: [1, 2],
        projects: [{}, {}],
        tasks: [{}, {}, {}],
        sessions: [],
        task_subtasks: [{}],
        task_changelogs: [{}],
        task_templates: [{}],
      },
    };

    expect(summarizeUnknownBackupPayload(rawPayload)).toEqual({
      settings: 2,
      projects: 2,
      tasks: 3,
      sessions: 0,
      task_subtasks: 1,
      task_changelogs: 1,
      task_templates: 1,
    });
  });

  it("returns null when payload has no data object", () => {
    expect(summarizeUnknownBackupPayload(null)).toBeNull();
    expect(summarizeUnknownBackupPayload({})).toBeNull();
    expect(summarizeUnknownBackupPayload({ data: "bad" })).toBeNull();
  });
});

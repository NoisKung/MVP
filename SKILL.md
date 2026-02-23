---
name: solostack-roadmap-workflow
description: Roadmap-aware implementation workflow for SoloStack (Tauri 2 + React 19 + TypeScript + SQLite + MVP CLI). Use when building, refactoring, or validating features in this repo, especially scope decisions from IDEA.md, local database changes, UI flow updates, CLI behavior, and P3 sync foundation work.
---

# SoloStack Roadmap Workflow

## Source of Truth

- Read `IDEA.md` first for product priority and scope boundaries.
- Read `README.md`, `AGENT.md`, and `package.json` before implementation.
- Treat this priority order as default:
  1. Keep existing P0-P2 behavior stable.
  2. Deliver P3 sync foundation safely.
  3. Improve speed of capture and task completion without adding unnecessary complexity.

## Current Product Baseline (From IDEA.md)

- P0 complete: Quick Capture, Task Templates, Subtasks.
- P1 complete: Natural language due date, Calendar View, Markdown Notes, Projects.
- P2 complete: Backup/Restore, Command Palette, Weekly Review, MVP CLI.
- P3 active direction: cross-platform sync with offline-first behavior and deterministic conflict handling.

## Code Surface Mapping

- `src/components` and `src/hooks`: UI behavior, view flow, interactions.
- `src/lib/database.ts`: SQLite schema, migrations, and CRUD behavior.
- `src/lib/types.ts`: domain types and enum contracts.
- `src/lib/sync-contract.ts`: sync payload/contracts.
- `scripts/mvp-cli.mjs`: CLI schema, command behavior, DB bootstrap.
- `src-tauri/src`: Rust-side integration and native behavior.
- `src/**/*.test.ts*` and `e2e/*.spec.ts`: unit/integration/E2E coverage.

## Delivery Modes

### Mode A: Existing feature maintenance (P0-P2)

- Preserve current behavior before adding enhancements.
- Avoid introducing heavy architecture for minor UX changes.
- Keep fast paths responsive (Quick Capture, Command Palette, filters, board updates).

### Mode B: P3 sync foundation delivery

- Keep local-first/offline-first behavior as non-negotiable.
- Route all write mutations through a consistent path that can enqueue sync events.
- Keep sync state explicit and recoverable (`sync_outbox`, `sync_checkpoints`, `deleted_records`).
- Keep conflict handling deterministic and auditable.

## Data Contract Rules

- Update data model in all required layers when changing entities:
  1. `src/lib/database.ts`
  2. `src/lib/types.ts`
  3. `scripts/mvp-cli.mjs`
  4. Relevant UI forms/hooks/components
- Keep enum constraints aligned across frontend, DB, and CLI:
  - Task status: `TODO`, `DOING`, `DONE`, `ARCHIVED`
  - Task priority: `URGENT`, `NORMAL`, `LOW`
  - Task recurrence: `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`
  - Project status: `ACTIVE`, `COMPLETED`, `ARCHIVED`

## Implementation Process

1. Identify the request type:
- Maintenance of completed roadmap items (P0-P2), or
- New sync-related work (P3).

2. Map the exact files affected before editing.

3. Implement with strict typing and low-complexity structure:
- TypeScript: no `any`.
- Rust: no `.unwrap()` in production paths.
- Prefer guard clauses and explicit constants.

4. Add/update tests in the same change set:
- Unit/integration tests for logic or data changes.
- Playwright coverage for new page/view or flow changes.

5. Run validation gates in required order:
  1. `npm run test`
  2. `npm run test:e2e`
  3. `npm run build`

## High-Risk Areas (Handle Carefully)

- Schema evolution and migration compatibility.
- Sync replay/idempotency and retry behavior.
- Delete propagation (tombstone behavior) across devices.
- Time/date behavior for due/reminder/calendar and natural language parsing.

## Working Commands

```bash
npm install
npm run tauri dev
npm run test
npm run test:e2e
npm run build
npm run mvp-cli -- help
npm run mvp-cli -- --json
```

## Completion Checklist

- Verify changed behavior in UI or CLI flow.
- Verify automated tests for new behavior and regression path.
- Verify build passes after test gates.
- If a gate cannot run, record why and what remains unverified.

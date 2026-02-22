# SoloStack User Manual (English)

Last updated: 2026-02-22

## 1) Overview

SoloStack is a local-first task management app for solo use, built with Tauri + React + TypeScript.

Current core capabilities:
- Board / Projects / Calendar / Today / Upcoming / Weekly Review / Dashboard
- Task + Subtask + Template + Saved Views
- Reminder notifications
- UI-configurable sync (Provider + Runtime)
- Conflict Center + Backup/Restore
- Global Undo Bar
- MVP CLI
- Local MCP skeleton

Current bundle identifier:
- `com.solutionsstudio.solostack`

## 2) Getting Started (Dev)

Prerequisites:
- Node.js 18+
- Rust (stable)
- Tauri prerequisites

Core commands:

```bash
npm install
npm run tauri dev
npm run test
npm run test:e2e
npm run build
```

Quality gates used in this project:
1. `npm run test`
2. `npm run test:e2e`
3. `npm run build`

## 3) Main Screens

Sidebar views:
- `Board`: status-based task board
- `Projects`: group tasks by project
- `Calendar`: calendar layout
- `Today`: overdue + due-today focus
- `Upcoming`: next 7 days
- `Conflicts`: full-page sync conflict handling
- `Weekly Review`: weekly summary
- `Dashboard`: productivity overview
- `Settings`: all system configuration

## 4) Task Workflow

Tasks:
- Create from `New Task` or keyboard shortcuts
- Set `status`, `priority`, `due date`, `reminder`, `recurrence`
- Natural language date parsing is supported (for example: `tomorrow 9am`, `next monday`)

Subtasks:
- Break work into checklist items
- Progress is computed automatically

Templates:
- Save recurring task structures and apply instantly

Saved Views:
- Save filter/sort combinations per view and reuse later

## 5) Keyboard Shortcuts

- `Cmd/Ctrl + N`: create task
- `Cmd/Ctrl + K`: open command palette
- `Cmd/Ctrl + ,`: open Settings
- `Cmd/Ctrl + Shift + C`: open Conflict Center
- `Cmd/Ctrl + Shift + S`: sync now (when transport is configured)
- `/`: focus Search in the current view
- `Esc` inside Search: clear text or blur focus
- `?`: open shortcut help

## 6) Autosave and Global Undo Bar

Autosave:
- Status appears in sidebar footer (`Autosaving...`, `Autosave ready`, `Saved ...`, `Autosave failed`)

Global Undo Bar:
- Risky actions are queued for about 5 seconds to allow undo
- Current coverage:
  - Delete task
  - Delete project
  - Resolve/retry conflict
  - Restore latest backup
  - Restore from file

## 7) Sync (Configured from UI)

Go to `Settings > Sync`.

### 7.1 Provider

Providers selectable from UI:
- `Provider Neutral`
- `Google AppData`
- `Microsoft OneDrive AppRoot`
- `Apple iCloud CloudKit`
- `SoloStack Cloud (AWS)`

Each provider card shows:
- auth requirement
- endpoint mode (`custom` / `managed`)
- provider-specific warnings

Notes:
- Current build primarily runs through custom endpoint transport
- Managed connectors are prepared in contract/roadmap with guardrails

### 7.2 Endpoints

Both fields are required:
- `Push URL`
- `Pull URL`

Rules:
- Must be `http://` or `https://`
- Partial pair is rejected
- Clearing both fields switches to local-only mode

Example URLs:
- `https://sync.yourdomain.com/v1/sync/push`
- `https://sync.yourdomain.com/v1/sync/pull`

### 7.3 Runtime Profile

Configurable from UI:
- Foreground interval
- Background interval
- Push limit
- Pull limit
- Max pull pages

Presets:
- `Desktop Preset`
- `Mobile Beta Preset`
- `Reset Recommended`

Guardrails:
- Inline validation
- Battery/network impact hints
- Runtime bounds normalized before entering sync loop

### 7.4 Sync Engine Behavior

Key behavior:
- Provider resolver runs before transport creation
- If config is invalid:
  - falls back to `last-known-good transport` when available
  - warning is surfaced in diagnostics
- If provider is unavailable:
  - enters offline-safe mode
  - avoids crash loops

## 8) Sync Status and Diagnostics

Statuses:
- `Synced`
- `Syncing`
- `Offline`
- `Conflict`
- `Local only`

In `Settings > Sync > Diagnostics`, you can see:
- success rate
- cycle duration
- failure streak
- conflict cycles
- diagnostics history (latest 5 snapshots)
- full history view with search, source/date filters, and row limit
- `Export Filtered JSON` action from full history view (exports only currently filtered snapshots with filter metadata)
- selected provider (for current sync loop)
- provider selected events
- runtime profile changed events
- validation rejected events
- last warning

## 9) Conflict Center

Available in `Conflicts` page and also in Settings.

Supported actions:
- view open conflicts
- inspect local/remote payloads
- inspect conflict timeline events
- resolve with:
  - Keep Local
  - Keep Remote
  - Retry
  - Manual Merge
- export report to JSON
  - includes `session_diagnostics` snapshot (including `runtime_preset_source`)
  - includes `session_diagnostics_history` (recent rolling snapshots across sessions)
  - includes metadata: `report_type`, `export_source`, `app_locale`

## 10) Backup / Restore

Location:
- `Settings > Data Backup & Restore`

Supported operations:
- Export backup to JSON file
- Restore latest backup
- Restore from file

Restore guardrails:
- Preflight checks (`pending outbox`, `open conflicts`, `latest backup`) run before restore
- If risk is detected, force flow + explicit confirmation is required

Internal backup snapshot keys:
- `local.backup.latest_payload_v1`
- `local.backup.latest_exported_at`

## 11) Data Location

Primary database:
- filename `solostack.db` (via Tauri SQL: `sqlite:solostack.db`)
- stored in each OS app-data directory managed by Tauri runtime

Exported backup files:
- user chooses destination path through export dialog

## 12) MVP CLI

Examples:

```bash
npm run mvp-cli -- help
npm run mvp-cli -- project create --name "Client A" --color "#3B82F6"
npm run mvp-cli -- task create --title "Draft release note" --project "Client A"
npm run mvp-cli -- task done --id <task-id>
```

Common options:
- `--json`
- `--db <path>`

## 13) MCP Local Skeleton

Run:

```bash
npm run mcp:dev
```

Defaults:
- bind: `127.0.0.1:8799`
- health: `/`, `/health`, `/healthz`
- tools: `/tools/get_tasks`, `/tools/get_projects`, `/tools/get_weekly_review`, `/tools/search_tasks`, `/tools/get_task_changelogs`, `/tools`

More details:
- `mcp-solostack/README.md`
- documents under `docs/`

## 14) Troubleshooting

Sync does not run:
- verify both Push/Pull URL are present and valid
- check `last warning` in Diagnostics
- click `Sync now` and inspect status pill

Frequent conflicts:
- open `Conflicts` and resolve pending conflicts first
- export report to investigate root cause

Restore fails:
- read preflight/force restore message carefully
- confirm you understand local overwrite impact

## 15) Related Documents

- Product roadmap: `IDEA.md`
- Delivery plan: `PLANNING.md`
- Technical usage: `usage.md`
- Thai manual: `docs/MANUAL.th.md`

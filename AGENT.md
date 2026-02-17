# Antigravity Engineering Agent Protocol
# Project: SoloStack (Local-First Productivity Tool)

## 1. Role & Context
You are a Senior Full-Stack Engineer at **Antigravity**, a premier cloud consulting and software house.
Your current mission is to build **SoloStack**, a high-performance, local-first productivity desktop application for solopreneurs.

**Core Philosophy:**
- **Local-First:** All data lives in the user's machine (SQLite). No cloud dependencies for core functionality.
- **Speed is a Feature:** Interactions must feel instantaneous (< 100ms).
- **Simplicity:** We fight feature bloat. Build only what is necessary and high-impact.
- **Readable Code:** Code is read more often than it is written. Optimize for maintainability.

---

## 2. Tech Stack Architecture

### **Core (The Shell)**
- **Framework:** Tauri v2 (Rust)
- **Language:** Rust (Backend logic), TypeScript (Frontend logic)
- **Package Manager:** pnpm or npm

### **Frontend (The UI)**
- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (Radix UI based) + Lucide React (Icons)
- **State Management:** TanStack Query (React Query) for async operations, Zustand for global UI state.
- **Routing:** React Router (if needed, prefer single-view for MVP).

### **Backend & Data (The Brain)**
- **Database:** SQLite (via `tauri-plugin-sql`)
- **ORM/Query Builder:** SQLx (Rust side) or raw SQL with strict typing.
- **Validation:** Zod (Frontend), Serde (Backend).

---

## 3. Coding Standards (Antigravity Standard)

### **General Rules**
1.  **Readable Code:** Variable and function names must be explicit. Avoid single-letter variables (e.g., use `userIndex` instead of `i`).
2.  **No Magic Numbers:** Define constants for all hardcoded values.
3.  **Comments:** Explain *WHY*, not *HOW*. The code should explain *HOW*.
4.  **Early Returns:** Use guard clauses to reduce nesting depth.
5.  **Best-Practice First (Mandatory):** Before writing or changing code, define the applicable best-practice approach (architecture, typing, error handling, security, test strategy, and maintainability) and implement against that plan every time.

### **Rust (Backend)**
- **Safety First:** NEVER use `.unwrap()` in production code. Always handle errors using `Result<T, E>` or `Option<T>` with `match` or `?` operator.
- **Async:** Use `tokio` for async runtime.
- **Command Pattern:** Expose logic via `#[tauri::command]` annotated functions.
- **Structs:** Use `#[derive(Serialize, Deserialize)]` from `serde` for frontend communication.

### **TypeScript/React (Frontend)**
- **Strict Typing:** No `any`. Define interfaces for all props and data structures.
- **Functional Components:** Use React Hooks exclusively.
- **Separation of Concerns:** Keep logic out of JSX. Use custom hooks for complex logic.
- **File Structure:**
    - `src/components/ui`: Generic UI components (buttons, inputs).
    - `src/features`: Feature-specific components (e.g., `tasks`, `dashboard`).
    - `src-tauri/src`: Rust backend code.

---

## 4. Database Schema (SQLite)

We use a simple, normalized schema optimized for read performance.

```sql
-- Users (Local profile settings)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tasks (The core entity)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,           -- UUID v4
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('TODO', 'DOING', 'DONE', 'ARCHIVED')),
    priority TEXT NOT NULL CHECK(priority IN ('URGENT', 'NORMAL', 'LOW')),
    is_important BOOLEAN DEFAULT 0, -- For Eisenhower Matrix
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pomodoro Sessions (Future feature prep)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    duration_minutes INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id)
);
```

---

## 5. Testing & Release Gates (Mandatory)

- **Feature Test Requirement:** Every new feature or behavior change MUST include automated tests (unit/integration) in the same change set.
- **New Page Requirement:** Every new page/view/screen MUST include Playwright E2E coverage for that page, and existing Playwright specs MUST be updated when navigation/UI flow changes.
- **Pre-Build Gate:** Before every build, tests MUST run first and pass. Build is not allowed if tests fail.
- **Pre-Release Gate:** Before every release, run the full test suite (including Playwright) and release only when all tests pass.

### Required execution order
1. `npm run test`
2. `npm run test:e2e`
3. `npm run build`

---

## 6. Sync Implementation Guardrails

- Sync implementation must remain **provider-neutral** at core layer.
- All local mutations for syncable entities (`project`, `task`, `task_subtask`, `task_template`) must:
  - update `sync_version`
  - update `updated_by_device`
  - enqueue `sync_outbox` event (`UPSERT` or `DELETE`)
- Incoming sync changes must be applied through deterministic rules:
  - Last-Write-Wins by `updated_at`
  - tie-break by `updated_by_device`
- Use shared sync modules in `src/lib`:
  - `sync-contract.ts` for payload parsing/validation
  - `sync-engine.ts` for batch prep/apply/ack/cursor helpers
  - `sync-runner.ts` for full cycle orchestration
  - `sync-service.ts` for local storage wiring

---

## 7. Documentation Contract

- `usage.md` is the operational reference for developers and agents.
- If `AGENT.md` is modified in a way that affects workflow, commands, sync design, or validation gates, `usage.md` **must** be updated in the same change set.
- If implementation behavior changes (especially sync flow or DB mutation path), update `usage.md` examples and flow diagrams/checklists immediately.

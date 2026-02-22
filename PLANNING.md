# SoloStack Execution Planning

อัปเดตล่าสุด: 2026-02-22
แหล่งข้อมูลหลัก: `IDEA.md`

## 1) Planning Intent

เอกสารนี้ใช้ขมวดแผนจาก roadmap ให้เป็น execution plan ที่ลงมือทำได้ทันที โดยคงหลักการ:
- Local-first / Offline-first
- เพิ่มความเร็วในการ capture และปิดงาน
- คุมความซับซ้อนของระบบ

## 2) Current Baseline

### ฟีเจอร์ที่เสร็จแล้ว
- P0: Quick Capture, Task Template, Subtasks
- P1: Natural Language Due Date, Calendar View, Markdown Notes, Projects
- P2: Backup/Restore, Command Palette, Weekly Review, MVP CLI

### โฟกัสปัจจุบัน
- P3-1: Sync Foundation + Desktop Beta
- P3-2: Mobile Sync Beta (shared-core readiness)
- P3-3: Conflict Center + Recovery (baseline implementation started)
- P3-8: i18n TH/EN foundation

## 3) Strategic Goals (Q1-Q2 2026)

1. ส่งมอบ desktop sync ที่เสถียรและไม่ทำข้อมูลหาย
2. เตรียมฐานสำหรับ mobile sync โดยใช้ contract กลางเดียวกัน
3. วางทางเลือก cloud connector (Google/Microsoft/iCloud) โดยไม่ล็อกระบบกับ provider เดียว
4. เปิดช่องทางให้ Agent ดึงข้อมูล SoloStack ไปวิเคราะห์และสรุปงานผ่าน MCP อย่างปลอดภัย
5. ประเมิน AWS เป็น managed platform option สำหรับ sync backend และ MCP server

## 4) Phase Plan

## Phase A: P3-1 Sync Foundation + Desktop Beta

ช่วงเป้าหมาย: 2026-02-17 ถึง 2026-03-13

### Deliverables
- Schema sync พร้อม migration:
  - `sync_outbox`
  - `sync_checkpoints`
  - `deleted_records`
  - `sync_version`, `updated_by_device`
- Sync engine หลัก:
  - `preparePushBatch`
  - `applyPullBatch`
  - `advanceCursor`
- Settings UX:
  - ปุ่ม `Sync now`
  - สถานะ `Synced/Syncing/Offline/Conflict`
  - แสดงเวลาซิงก์ล่าสุดและ error ล่าสุด

### Exit Criteria
- Offline edit ไม่หายเมื่อกลับมา online
- Create/Update/Delete `project/task/subtask/template` sync ข้าม desktop ได้
- ผ่าน gate: `npm run test` -> `npm run test:e2e` -> `npm run build`

## Phase B: P3-2 Mobile Sync Beta

ช่วงเป้าหมาย: 2026-03-16 ถึง 2026-04-17

### Deliverables
- Mobile client beta ต่อกับ sync contract เดียวกับ desktop
- End-to-end sync flow desktop <-> mobile
- Sync SLA ระดับ beta สำหรับใช้งานจริงภายในทีม

### Current Implementation Snapshot (2026-02-17)
- เสร็จแล้ว:
  - เพิ่ม `Sync Runtime Profile` ใน Settings เพื่อปรับ foreground/background interval และ push/pull limits ผ่าน UI
  - เพิ่ม preset `Desktop` และ `Mobile Beta` สำหรับ tuning เร็ว
  - sync loop รองรับ adaptive interval ตาม foreground/background visibility
  - เพิ่ม mobile-aware runtime seed สำหรับ first launch บน iOS/Android
  - harden runtime preset detection สำหรับ mobile:
    - รองรับ `userAgentData.mobile`
    - รองรับ iPadOS desktop-style UA (`Macintosh`) + touch points
  - เพิ่ม `Sync Diagnostics (Session)` บน Settings เพื่อดู success rate/latency/failure streak ระหว่าง tuning
  - เพิ่ม diagnostics ของ runtime preset source (`user_agent_data_mobile`, `user_agent_pattern`, `platform_pattern`, `ipad_touch_heuristic`, `fallback_desktop`)
  - ผูก diagnostics snapshot เข้า conflict report export เพื่อวิเคราะห์ support ข้าม session ได้
  - persist diagnostics history แบบ rolling ใน local DB และแนบเข้า support report payload
  - เพิ่ม Settings UI แสดง diagnostics history ล่าสุด 5 รายการ (cross-session)
  - เพิ่ม full-history controls (search + source/date filters + row limit) สำหรับ diagnostics triage
  - เพิ่ม export แบบ filtered (`Export Filtered JSON`) จาก full-history view พร้อมแนบ filter metadata ในไฟล์
  - เพิ่ม Playwright coverage สำหรับ diagnostics full-history export flow (filters + date-range validation + JSON payload)
  - เติม test coverage ของ runtime profile แล้ว (unit + Playwright)
- คงเหลือ:
  - เตรียม mobile beta client ให้ใช้ contract + runtime profile ชุดเดียวกับ desktop
  - ยืนยัน desktop<->mobile flow กับ dedicated mobile client builds

### Exit Criteria
- data model ไม่ drift ระหว่าง client
- conflict กรณีหลักถูกจัดการได้ deterministic
- ไม่มี critical data-loss case ใน test matrix

## Phase C: P3-3 Conflict Center + Recovery

ช่วงเป้าหมาย: 2026-04-20 ถึง 2026-05-08

### Deliverables
- Conflict data model + migration:
  - `sync_conflicts`
  - `sync_conflict_events`
- Conflict Center UI:
  - รายการ conflict + filter/sort
  - detail panel เทียบ `local/remote/base`
  - actions: `Keep Local`, `Keep Remote`, `Manual Merge`
- Recovery tools:
  - `Retry last failed sync`
  - `Restore from latest backup` พร้อม confirmation/preflight
  - `Export conflict report`
- Timeline/audit log สำหรับ conflict lifecycle
- playbook สำหรับแก้ conflict แบบ user-facing

### Current Implementation Snapshot (2026-02-17)
- เสร็จแล้ว:
  - schema + index สำหรับ conflict/event tables
  - conflict persistence จาก incoming sync apply path
  - Settings Conflict Center baseline (list/detail/actions/timeline/export)
  - dedicated conflict view + deep-link จาก status badge
  - diff-based manual merge editor (replace prompt flow)
  - restore preflight/force flow + `Restore Latest Backup`
  - retry confirmation UX สำหรับ conflict actions
  - Playwright coverage สำหรับ restore preflight/force flow
  - Playwright coverage สำหรับ conflict retry confirmation + re-resolve matrix
  - Playwright coverage สำหรับ retry failed sync (transport failure -> retry success)
- คงเหลือ:
  - integration coverage สำหรับ resolve replay + idempotent retry

### Exit Criteria
- ผู้ใช้แก้ conflict หลัก (`field_conflict`, `delete_vs_update`, `notes_collision`) ได้จาก UI โดยไม่แตะ DB
- ทุก resolution บันทึกใน event timeline พร้อม timestamp และ device context
- recovery actions ใช้งานได้จริงและมี guardrails
- ผ่าน gate: `npm run test` -> `npm run test:e2e` -> `npm run build`

## Phase D: P3-4 Security Hardening

ช่วงเป้าหมาย: 2026-05-11 ถึง 2026-05-29

### Deliverables
- auth/session hardening
- secure token storage + refresh policy
- security checklist ก่อนขยายผู้ใช้ beta

## Phase E: P3-5 Cloud Provider Connectors (Discovery -> Pilot)

ช่วงเป้าหมาย: 2026-06-01 ถึง 2026-06-26

### Deliverables
- Technical spike: Google Drive `appDataFolder`
- Technical spike: OneDrive `approot`
- Feasibility note: iCloud/CloudKit (Apple-first mode)
- AWS reference architecture spike:
  - API layer (`API Gateway` / service runtime)
  - compute (`Lambda`/container)
  - data store (`DynamoDB` หรือ `RDS`)
  - auth (`Cognito`) และ observability baseline (`CloudWatch`)
- ข้อเสนอ UX สำหรับ user-selected provider พร้อม default recommendation และ guardrails

### Comparative Spike Snapshot (2026-02-18)

Google Drive (`appDataFolder`) vs OneDrive (`approot`) ในมุม SoloStack sync connector:

1. Integration complexity (MVP speed)
- Google `appDataFolder`: API surface แคบกว่า, โฟลเดอร์ private ต่อแอปโดยตรง, path model ตรงไปตรงมา
- OneDrive `approot`: ทำได้ดีแต่ต้องเผื่อความหลากหลายของ tenant/org policy และ Graph edge cases มากกว่า

2. Data safety + connector semantics
- ทั้งสองฝั่งเหมาะกับ app-private storage และรองรับไฟล์ metadata/payload ได้
- ทั้งสองฝั่งยังต้องพึ่ง SoloStack sync core สำหรับ conflict/idempotency/domain merge logic อยู่ดี

3. Ecosystem fit
- Google: เหมาะกับ personal/workspace mix ที่ไม่ต้องเจอ org restriction หนัก
- OneDrive: แข็งแรงมากในองค์กรที่ใช้ Microsoft 365 เป็นหลัก (โอกาสเจอ policy governance สูงกว่า)

4. Operational risk (desktop beta)
- ตั้ง Google เป็นค่าแนะนำเริ่มต้นช่วยลด unknowns ในรอบ pilot แรก
- ผู้ใช้ยังต้องสลับไป provider อื่นได้เองจาก UI พร้อมแสดงข้อจำกัด/ความเสี่ยงแต่ละ provider
- OneDrive ควรมี test matrix เพิ่มสำหรับ tenant policy / throttling / token refresh edge cases

### Recommendation (for P3-5 Pilot)

ใช้ `Google appDataFolder` เป็น default recommendation ใน pilot แต่เปิดให้ผู้ใช้เลือก provider เองจาก UI ภายใต้ provider-neutral contract เดิม เพื่อให้ต่อ `OneDrive approot`/`iCloud`/`AWS-backed mode` ได้โดยไม่เปลี่ยน sync core.

### Exit Conditions Before Connector Build

- Freeze connector adapter contract (upload/download/list/delete + cursor metadata)
- แยก secret/token storage policy ให้ชัดเจน (desktop secure store)
- เพิ่ม integration fixture สำหรับ provider error mapping (`rate_limit`, `unauthorized`, `unavailable`)
- เพิ่ม observability fields ต่อ connector (`provider`, `latency_ms`, `http_status`, `retry_after_ms`)

### Current Progress (2026-02-18)

- เสร็จแล้ว:
  - comparative spike snapshot (Google vs OneDrive) พร้อม recommendation สำหรับ pilot
  - connector adapter contract v0.1 ใน `src/lib/sync-connector-contract.ts`
- คงเหลือ:
  - provider implementation stubs (Google/OneDrive)
  - token storage + refresh flow integration
  - connector integration tests กับ fixture responses

## Phase F: P3-6 MCP Server for SoloStack

ช่วงเป้าหมาย: 2026-06-29 ถึง 2026-07-24

### Deliverables
- `mcp-solostack` server (local runtime ก่อน)
- Read-first tools:
  - `get_tasks`
  - `get_projects`
  - `get_weekly_review`
  - `search_tasks`
  - `get_task_changelogs`
- Tool schema + validation contract (request/response)
- Audit log ขั้นต่ำของการเรียก tool
- Integration tests กับ fixture DB จริง

### Exit Criteria
- Agent เรียก weekly summary ได้ภายใน <= 2 วินาทีใน local machine
- ไม่มี direct DB corruption case จาก MCP read path
- Query ที่หนักมี guardrails (limit/timeout/rate-limit) และไม่ทำให้ UI lag

### Current Progress (2026-02-18)

- เสร็จแล้ว:
  - local MCP skeleton + health/config loader (`mcp-solostack/server.mjs`, `mcp-solostack/config.mjs`)
  - read tools ครบ wave-1 และ wave-2 (`get_tasks`, `get_projects`, `get_weekly_review`, `search_tasks`, `get_task_changelogs`)
  - รองรับทั้ง route mode (`/tools/<tool>`) และ generic mode (`/tools`)
  - integration tests สำหรับ app/tool routes พร้อม fixture DB (`mcp-solostack/app.test.ts`, `mcp-solostack/tools.test.ts`)
  - audit log baseline ต่อ 1 tool call (`event = mcp.tool_call`)
  - เพิ่ม rate limiter (`RATE_LIMITED`) และ timeout guard (`TIMEOUT`) สำหรับ `/tools*`
  - เพิ่ม hosted timeout strategy แบบ `worker_hard` (terminate worker เมื่อ timeout เกิน)
  - เพิ่ม load/perf matrix baseline สำหรับ small/medium fixture (`docs/mcp-load-matrix-v0.1.md`)
  - เอกสาร agent playbook และ AWS hosted profile baseline
  - hardening snapshot v0.1 (`docs/mcp-hardening-report-v0.1.md`)
- คงเหลือ:
  - ทำซ้ำ load/perf matrix ใน hosted staging เพื่อเทียบกับ local baseline
  - ตัดสินใจ sink/retention สำหรับ audit log ใน hosted profile

## 5) Workstream Breakdown (P3-1 Priority)

1. Data Layer & Migration
- ออกแบบ migration แบบ backward-compatible
- เพิ่ม preflight backup ก่อนเปิด sync ครั้งแรก

2. Sync Engine
- queue drain + retry/backoff + idempotency
- ป้องกัน sync ซ้อนและ crash-safe recovery

3. API Contract
- freeze schema ของ push/pull/bootstrap + error shape
- รองรับ cursor-based incremental sync

4. UX & Status
- เพิ่ม sync state surfaces ใน Settings และระดับแอป
- ออกแบบข้อความ error/retry ให้เข้าใจง่าย

5. QA & Observability
- unit/integration สำหรับ merge rules, cursor, retry
- Playwright flow สำหรับ status + sync now + retry
- telemetry ขั้นต่ำ: success rate, latency, conflict count

6. Cloud Platform Evaluation
- เปรียบเทียบ AWS managed stack กับทางเลือก non-AWS
- ประเมิน cost/latency/ops complexity ภายใต้ sync polling workload
- นิยาม security baseline (IAM, secret management, logging)

## 5B) Workstream Breakdown (P3-6 Priority)

1. MCP Contract & Tool Design
- กำหนด tool contract ชุดแรก (read-first)
- นิยาม error shape เดียวกันทั้ง server/client agents

2. Data Access Layer
- แยก query adapter จาก app UI logic
- รองรับ filter/search/pagination แบบ bounded

3. Security & Governance
- read-only default
- write tools ต้องผ่าน allowlist + explicit flag
- audit log ต่อ session/tool call

4. Runtime & Integration
- local-only sidecar mode สำหรับ rollout แรก
- สคริปต์รัน MCP server สำหรับ dev/test

5. QA
- integration tests กับ fixture DB
- load test เบื้องต้นสำหรับ query ที่มีโอกาสหนัก

## 5C) Workstream Breakdown (P3-3 Priority)

1. Conflict Schema & Migration
- สร้างตาราง `sync_conflicts` และ `sync_conflict_events`
- ออกแบบ index หลัก (`status`, `entity_type`, `detected_at`)
- migration แบบ backward-compatible + rollback guidance

2. Sync Engine Conflict Envelope
- ให้ `applyPullBatch` คืนค่า conflict envelope แบบ deterministic
- persist conflict records ทุกเคสที่ user ต้อง resolve
- resolution flow ต้องสร้าง idempotency key ก่อน enqueue outbox

3. Conflict Center UX
- เพิ่ม entry point จาก status badge/notification
- หน้า list/detail/resolve actions พร้อม state ชัดเจน
- ทำ manual merge UX สำหรับ notes/text ที่ชนกัน

4. Recovery Tools
- เพิ่ม `Retry last failed sync` ที่ปลอดภัยจากการยิงซ้ำ
- เพิ่ม `Restore from latest backup` พร้อม preflight checks
- เพิ่ม export report สำหรับ support/debug

5. QA & Observability
- unit tests สำหรับ detect/merge rules
- integration tests สำหรับ conflict persistence + resolution replay
- Playwright coverage สำหรับ resolve/retry/restore flows
- telemetry ขั้นต่ำ: conflict opened/resolved rate, median time-to-resolve

## 6) Two-Week Action Plan (Starting 2026-02-17)

## Week 1 (2026-02-17 ถึง 2026-02-21)
- Freeze sync contract (`src/lib/sync-contract.ts`)
- Implement schema + migration ที่จำเป็น
- ปรับ write path ให้ทุก mutation enqueue outbox
- เพิ่ม unit tests สำหรับ outbox/idempotency

## Week 2 (2026-02-24 ถึง 2026-02-28)
- Implement pull/apply flow + cursor advance
- เพิ่ม sync status card ใน Settings + `Sync now`
- เพิ่ม retry/backoff และ error handling พื้นฐาน
- เพิ่ม Playwright scenario สำหรับ sync status/retry

## 6B) Four-Week Action Plan for P3-6 (Starting 2026-06-29)

## Week 1 (2026-06-29 ถึง 2026-07-03)
- Freeze MCP read tool list และ schema draft
- ออกแบบ adapter จาก SQLite -> MCP response model
- ตัดสินใจ runtime mode (local sidecar baseline)

## Week 2 (2026-07-06 ถึง 2026-07-10)
- Implement tools: `get_tasks`, `get_projects`, `search_tasks`
- เพิ่ม query bounds (`limit`, `cursor`, `timeout`)
- เพิ่ม integration tests ชุดแรก

## Week 3 (2026-07-13 ถึง 2026-07-17)
- Implement tools: `get_weekly_review`, `get_task_changelogs`
- เพิ่ม audit logging และ structured errors
- ทดสอบกับ agent workflow จริง (summary/planning prompt)

## Week 4 (2026-07-20 ถึง 2026-07-24)
- Hardening: performance tuning + failure handling
- เขียน usage/setup docs สำหรับ agent runtime
- รัน full quality gates และ prepare internal rollout

## 6C) Three-Week Action Plan for P3-3 (Starting 2026-04-20)

## Week 1 (2026-04-20 ถึง 2026-04-24)
- Freeze schema `sync_conflicts`/`sync_conflict_events` และ envelope contract (done early)
- Implement detect + persist flow ใน incoming apply path (done early)
- เพิ่ม integration tests สำหรับ conflict detect matrix (done: persist field/delete conflicts + replay/retry paths)

## Week 2 (2026-04-27 ถึง 2026-05-01)
- Build `Conflict Center` list + detail + resolve actions (done early in Settings view)
- เพิ่ม deep-link จาก status `Conflict` ไปยัง `Conflict Center` (done)
- เพิ่ม Playwright tests สำหรับ user resolve flow (done: open conflict center -> resolve -> sync success)

## Week 3 (2026-05-04 ถึง 2026-05-08)
- เพิ่ม recovery tools (`retry`, `restore`, `export report`) (done: มี preflight/force + restore latest backup)
- เพิ่ม conflict timeline event log + observability counters (done: event log + aggregate counters + median resolve time)
- hardening + bugfix + ผ่าน quality gates ก่อนประกาศ internal beta
- done hardening snapshot: force restore ถูกบังคับทั้งเคส `pending outbox` และ `open conflicts` พร้อม unit coverage

## 6D) P3-3 Implementation Checklist (Dev Team)

## Schema / Migration
- [x] เพิ่มตาราง `sync_conflicts` พร้อมคอลัมน์ payload (`local_payload`, `remote_payload`, `base_payload`)
- [x] เพิ่มตาราง `sync_conflict_events` สำหรับ timeline (`detected`, `resolved`, `retried`, `exported`)
- [x] เพิ่ม index สำหรับ query หน้าจอ (`status`, `detected_at`, `entity_type`, `entity_id`)
- [x] เพิ่ม migration tests สำหรับ create/upgrade path และ backward compatibility
- [x] กำหนด retention policy ของ conflict event logs

## API / Sync Engine
- [x] นิยาม type/model สำหรับ conflict records/events ใน contract กลาง
- [x] ให้ `applyPullBatch` ส่ง conflict envelope กลับแบบ deterministic
- [x] เพิ่ม service methods: `listConflicts`, `getConflictDetail`, `resolveConflict`
- [x] ทุก `resolveConflict` ต้องสร้าง idempotency key และ enqueue outbox change
- [x] เพิ่ม `retryLastFailedSync` แบบกันยิงซ้ำและ safe re-entry
- [x] เพิ่ม `exportConflictReport` เป็น structured JSON
- [x] เพิ่ม `getSyncConflictObservabilityCounters` (total/open/resolved, retried/exported events, median resolve time)

## UI / UX
- [x] เพิ่ม global status entry point เมื่อสถานะเป็น `Conflict`
- [x] สร้างหน้า `Conflict Center` baseline (list + empty state) ใน Settings
- [x] เพิ่ม dedicated `Conflict Center` view + navigation entry
- [x] สร้าง detail panel พร้อม payload compare (`local` vs `remote`)
- [x] เพิ่ม actions: `Keep Local`, `Keep Remote`, `Manual Merge`
- [x] เปลี่ยน `Manual Merge` จาก prompt เป็น diff-based side-by-side editor
- [x] เพิ่ม confirmation UX สำหรับ restore/retry และแสดงผลลัพธ์หลังทำงาน
- [x] เพิ่ม timeline view ระดับ conflict item

## Tests / Quality
- [x] Unit tests: field conflict, notes collision, delete-vs-update
- [x] Integration tests: persist conflicts + resolve replay + idempotent retries
- [x] E2E tests: open conflict center -> resolve -> sync success
- [x] E2E tests: restore flow พร้อม preflight/force guardrails
- [x] E2E tests: conflict retry confirmation และ conflict re-resolve matrix
- [x] E2E tests: retry failed sync (transport/network failure path)
- [x] Non-functional checks: performance ของ list/detail และ large conflict sets
- [x] ผ่าน gate: `npm run test`, `npm run test:e2e`, `npm run build`

## 7) Quality Gates and Release Rules

- ทุก behavior change ต้องมี automated tests
- ถ้ามีหน้าใหม่หรือ flow ใหม่ ต้องมี Playwright coverage
- ลำดับ gate ก่อน build/release:
  1. `npm run test`
  2. `npm run test:e2e`
  3. `npm run build`

## 8) KPI / Success Metrics

- Sync success rate >= 99% (non-network-failure class)
- Median sync latency <= 3s (desktop-to-desktop, normal network)
- Data-loss incidents = 0
- Conflict auto-resolve rate >= 90% ของกรณีทั่วไป

## 9) Risk Register

1. Conflict complexity สูง
- Mitigation: deterministic rules + conflict copy + timeline log

2. Migration เสี่ยงข้อมูลผิดรูป
- Mitigation: preflight validation + backup + rollback guidance

3. API throttling/token issues (provider connectors)
- Mitigation: backoff, refresh strategy, quota-aware batching

4. Cloud cost/ops complexity (AWS or others)
- Mitigation: spike ด้วย realistic traffic model + budget guardrails + phased rollout

## 10) Open Decisions

Resolved in current cycle:
- UX decision: ผู้ใช้เลือก provider connector เองได้จาก UI (แทน fixed provider strategy)
- UX decision: ผู้ใช้ปรับ sync runtime profile เองได้จาก UI ภายใต้ guardrails เดียวกันทุก platform

Remaining open:
- เลือก backend stack สำหรับ sync service
- Auth/session model สำหรับ multi-device
- ขอบเขต telemetry ขั้นต่ำที่ต้องมีใน desktop beta
- AWS stack decision: Lambda-first หรือ service-first และการเลือก data store หลัก
- MCP deployment mode: local sidecar vs hosted service
- MCP auth model ระหว่าง agent runtime กับ server
- จะเปิด write tools ใน phase ไหน และเงื่อนไขความปลอดภัยขั้นต่ำ

## 11) Immediate Next Actions

1. [done] comparative spike: Google `appDataFolder` vs OneDrive `approot`
2. [done] ทำ connector adapter contract v0.1 ให้รองรับทั้ง Google/OneDrive ด้วย interface เดียว
3. [done] เริ่ม AWS architecture spike พร้อม cost baseline สำหรับ sync + MCP (`docs/aws-spike-v0.1.md`)
4. [done] สรุป telemetry baseline ที่ต้องส่งออกนอกแอป (`docs/telemetry-spec-v0.1.md`)
5. [done] แตกงาน P3-6 อ่านข้อมูลผ่าน MCP tool set ตาม contract v0.1 (`docs/p3-6-execution-backlog-v0.1.md`)

## 12) Immediate Next Actions (P3-6 Kickoff)

1. [done] สรุป MCP read-tool contract v0.1 (`docs/mcp-read-tools-contract-v0.1.md`)
2. [done] สร้าง `mcp-solostack` skeleton + health check + config loader (`mcp-solostack/server.mjs`)
3. [done] ต่อ `get_tasks` และ `get_projects` ให้ใช้งานได้ end-to-end (`POST /tools/get_tasks`, `POST /tools/get_projects`)
4. [done] เพิ่ม integration tests กับ fixture DB ขนาดเล็กและกลาง (`mcp-solostack/app.test.ts`, `mcp-solostack/tools.test.ts`)
5. [done] เขียน agent usage playbook สำหรับเคส weekly summary รุ่นแรก (`docs/agent-usage-playbook-v0.1.md`)
6. [done] นิยาม hosted MCP deployment profile บน AWS (ถ้าเลือก cloud mode) (`docs/mcp-aws-hosted-profile-v0.1.md`)

## 13) Next Sprint Plan (2026-02-19 ถึง 2026-03-04)

เป้าหมาย sprint นี้: ปิด 3 งานค้างจาก Immediate Next Actions ให้ได้ output ที่ใช้งานตัดสินใจและเริ่มลงมือพัฒนา P3-6 ได้ทันที

### Stream A: AWS Architecture Spike (Sync + MCP)

ช่วงทำงาน: 2026-02-19 ถึง 2026-02-24

งานหลัก:
- ออกแบบ 2 profile เพื่อเทียบ:
  - `lambda-first`: API Gateway + Lambda + DynamoDB + Cognito + CloudWatch
  - `service-first`: ALB/ECS Fargate + RDS Postgres + Cognito + CloudWatch
- ประเมิน workload baseline:
  - desktop sync polling
  - conflict/retry burst
  - MCP read traffic baseline
- สรุป cost baseline แบบ low/medium/high traffic

ผลลัพธ์ที่ต้องได้:
- decision memo 1 หน้า (เลือก profile แนะนำ + trade-offs)
- cost table baseline สำหรับ dev/staging/prod
- security baseline checklist (IAM, secrets, logging, encryption at rest/in transit)

Definition of Done:
- มี recommendation เดียวที่เชื่อมกับ Open Decisions ข้อ AWS stack
- มี assumptions และ risk ที่ตรวจสอบได้

### Stream B: Telemetry Baseline (Desktop + Cloud)

ช่วงทำงาน: 2026-02-23 ถึง 2026-02-27

งานหลัก:
- นิยาม metrics กลาง 3 กลุ่ม:
  - sync health
  - conflict lifecycle
  - connector reliability
- กำหนด schema/log envelope กลางสำหรับ local session และ cloud ingestion
- นิยาม threshold alert เบื้องต้นสำหรับ beta

ผลลัพธ์ที่ต้องได้:
- telemetry spec v0.1 (field list + units + sampling + retention)
- mapping table ระหว่าง local diagnostics กับ cloud metrics
- alert baseline สำหรับ critical failures/data safety

Definition of Done:
- เชื่อมกับ Open Decisions ข้อ telemetry scope ได้ชัดเจน
- พร้อมใช้อ้างอิงตอนทำ implementation โดยไม่แก้ contract ใหญ่ซ้ำ

### Stream C: P3-6 Breakdown to Execution

ช่วงทำงาน: 2026-02-26 ถึง 2026-03-04

งานหลัก:
- แตก P3-6 เป็น milestone ย่อย:
  - contract/spec
  - server skeleton
  - read tools wave-1
  - test + hardening
- define acceptance criteria ราย milestone
- define dependency matrix กับ Stream A/B

ผลลัพธ์ที่ต้องได้:
- execution backlog สำหรับ P3-6 (order + estimate + risk)
- first implementation ticket set (เริ่ม `get_tasks`, `get_projects`)
- quality gates ต่อ milestone (test/build/performance bounds)

Definition of Done:
- เริ่ม implementation P3-6 ได้ทันทีโดยไม่ต้องกลับมา re-plan ใหญ่
- ลด ambiguity ใน Open Decisions ข้อ MCP deployment/auth

### Sprint Artifacts (2026-02-18)

- AWS spike memo: `docs/aws-spike-v0.1.md`
- Telemetry spec: `docs/telemetry-spec-v0.1.md`
- P3-6 execution backlog: `docs/p3-6-execution-backlog-v0.1.md`
- MCP read-tool contract: `docs/mcp-read-tools-contract-v0.1.md`
- Agent usage playbook: `docs/agent-usage-playbook-v0.1.md`
- MCP AWS hosted profile: `docs/mcp-aws-hosted-profile-v0.1.md`
- MCP hardening report: `docs/mcp-hardening-report-v0.1.md`
- MCP load matrix: `docs/mcp-load-matrix-v0.1.md`

## 14) Implementation Kickoff: User-Configurable Sync (UI-first)

ช่วงเป้าหมาย: 2026-02-19 ถึง 2026-03-07

Objective:
- ทำให้ user ปรับ provider และ runtime profile ได้เองจาก UI โดยไม่ทำให้ sync core แตก contract

### 14A) Data / Contract

- เพิ่ม settings model สำหรับ `sync.provider` และ `sync.provider_config`
- เพิ่ม settings model สำหรับ `sync.runtime_profile` พร้อม bounds ที่ enforce ได้ทั้ง desktop/mobile
- ทำ migration ที่ backward-compatible สำหรับผู้ใช้เดิม
- lock default values:
  - `provider`: `provider-neutral`
  - `runtime_profile`: `desktop` หรือ `mobile_beta` ตาม platform seed logic ปัจจุบัน

Definition of Done:
- อ่าน/เขียนค่าผ่าน settings API เดิมได้ครบ
- ไม่มี migration regression ใน DB tests

### 14B) Settings UI / UX

- เพิ่ม `Provider` selector ใน `Settings > Sync`
- แสดง capability card ต่อ provider:
  - auth requirement
  - endpoint mode (managed/custom)
  - known limits/warnings
- เพิ่ม runtime controls ที่ user แก้ได้เอง:
  - foreground interval
  - background interval
  - push/pull/max-pages limits
- เพิ่ม UX guardrails:
  - validation inline
  - battery/network impact hint
  - reset-to-recommended button

Definition of Done:
- flow เปลี่ยน provider/runtime ทำได้ครบจาก UI
- state ใน UI sync ตรงกับ settings ที่ persist จริง

### 14C) Sync Engine Integration

- สร้าง provider resolver จาก `sync.provider` -> transport config
- enforce runtime bounds ในชั้นเดียวก่อนเริ่ม loop
- fallback behavior:
  - config invalid -> ใช้ last-known-good + แจ้ง warning
  - provider unavailable -> switch เป็น offline-safe mode
- เก็บ event ที่จำเป็นใน diagnostics:
  - provider selected
  - runtime profile changed
  - validation rejected

Definition of Done:
- sync loop ยัง deterministic หลังสลับ provider/runtime
- ไม่มี crash path เมื่อ config ไม่สมบูรณ์

### 14D) QA / Release

- Unit tests:
  - provider settings normalization
  - runtime bounds normalization
  - fallback/invalid config behavior
- Integration tests:
  - settings persist -> restart -> sync loop ใช้ค่าที่ตั้งไว้
  - provider switch ไม่ทำ outbox/cursor เสีย
- Playwright:
  - เปลี่ยน provider จาก UI แล้วเห็นผลใน diagnostics
  - เปลี่ยน runtime profile + reset/reject invalid values

Quality Gates:
1. `npm run test`
2. `npm run test:e2e`
3. `npm run build`

### 14E) Execution Order (Start now)

1. Freeze schema ของ `sync.provider`/`sync.provider_config`/`sync.runtime_profile` (1 วัน)
2. Implement settings persistence + normalization (1 วัน)
3. Implement Settings UI provider selector + capability card (1-2 วัน)
4. Implement runtime controls + guardrails + reset (1-2 วัน)
5. Wire sync engine resolver/fallback + diagnostics events (1-2 วัน)
6. เพิ่ม unit/integration/e2e coverage และปิด quality gates (1-2 วัน)

Acceptance Targets:
- ผู้ใช้เปลี่ยน provider/runtime จาก UI แล้วมีผลทันทีโดยไม่ restart แอป
- ค่า invalid ไม่ทำให้ sync พัง และมี feedback ชัดเจน
- ไม่มี data-loss regression ใน offline/online transition matrix

### 14 Status Update (2026-02-19)

Completed:
- 14A Data/Contract
  - เพิ่ม `sync.provider`, `sync.provider_config`, `sync.runtime_profile`
  - seed/backfill แบบ backward-compatible และ lock default ตาม platform preset
- 14B Settings UI/UX
  - เพิ่ม Provider selector + capability card + guardrails ใน `Settings > Sync`
  - เพิ่ม runtime profile selector + reset recommended + inline validation/impact hint
- 14C Sync Engine Integration
  - เพิ่ม provider resolver และ transport status (`ready`, `invalid_config`, `provider_unavailable`, `disabled`)
  - เพิ่ม fallback `last-known-good` และ offline-safe mode
  - เพิ่ม diagnostics events: provider selected / runtime profile changed / validation rejected
- 14D QA/Release verification
  - เพิ่ม unit/integration/e2e coverage ตาม DoD

Validation Evidence:
1. `npm run test -- src/lib/database.migration.test.ts src/lib/sync-transport.test.ts src/hooks/use-sync.test.ts` passed (28 tests)
2. `npm run test:e2e -- e2e/sync-runtime-profile.spec.ts` passed (2 tests)
3. `npm run build` passed

## 15) Top-3 Closure Update (2026-02-20)

1) Migration Hardening (Old -> New) [closed]
- เพิ่ม startup migration orchestration ฝั่ง Tauri:
  - legacy path detection (`com.antigravity.solostack` -> `com.solutionsstudio.solostack`)
  - copy-then-verify + marker (`startup-migration-v1.json`)
  - command รายงานผล `get_startup_migration_report`
- ผูก diagnostics key ฝั่ง DB/settings:
  - `migration.last_status`
  - `migration.last_error`
  - `migration.legacy_path_detected`
  - `migration.sync_write_blocked`
- บังคับ sync write guard ผ่าน `useSync` เมื่อ migration fail

2) i18n Foundation + Key Governance [closed]
- เพิ่ม catalog governance tests (`src/lib/i18n.catalog.test.ts`)
- enforce parity ระหว่าง key `en` และ `th`
- validate locale normalization + non-empty translations สำหรับทุก key

3) P3-2 Shared-Core Readiness [closed in this repo scope]
- ปิด checklist readiness ฝั่ง shared-core/runtime contract
- เพิ่ม source tracking ของ runtime preset detection ใน diagnostics เพื่อช่วย debug mobile auto-seed
- สรุป artifact ที่ `docs/p3-2-mobile-beta-core-readiness-v0.1.md`
- งานคงเหลือย้ายไป dedicated mobile client execution (นอก shared-core scope)

Validation Evidence:
1. `cargo check` (src-tauri) passed
2. `npm run test -- --run src/lib/i18n.catalog.test.ts src/lib/database.migration.test.ts src/hooks/use-sync.test.ts` passed
3. `npm run build` passed

## 16) Pending Pull-through Update (2026-02-20)

Completed in this pass:
- ปิดงานค้างจาก QoL snapshot: เพิ่ม `restore dry-run summary` ก่อน queue ทั้ง
  - `Restore Latest Backup`
  - `Restore from File`
- เพิ่ม preflight contract `latest_backup_summary` เพื่อแสดงจำนวนข้อมูลใน latest backup ได้ล่วงหน้า
- ปรับ confirmation message ให้แสดง:
  - source ของ restore
  - summary (`projects/tasks/templates`)
  - impact (`pending outbox` และ `open conflicts` ที่จะถูกเคลียร์)
- ดึงงานค้างตัวถัดไป: `Resume Last Context` baseline
  - persist `activeView` ผ่าน local storage
  - rehydrate view ล่าสุดเมื่อเปิดแอปใหม่
- ดึงงานค้างต่อทันที: `Bulk Edit / Multi-select Tasks` baseline
  - card-level multi-select สำหรับ `Board/Today/Upcoming`
  - `Select shown` / `Clear selected`
  - bulk apply: `status`, `priority`, `project`, `important`
- ปิด `Resume Last Context` extension:
  - persist `Projects` context (`selected project`, `search`, `status filter`, `task section filter`)
  - persist active saved-view id แยกต่อ `Board/Today/Upcoming`
- ปิด `Bulk Edit / Multi-select Tasks` extension:
  - เพิ่ม bulk fields: `due_at`, `remind_at`, `recurrence`
  - เพิ่ม confirmation summary ก่อน apply bulk edit (แสดง field ที่จะเปลี่ยน + จำนวนงาน)
  - เพิ่ม helper/tests สำหรับ bulk patch validation + confirmation message
- ปิด `Resume Last Context` extension (detail focus state):
  - persist task form focus (`CREATE`/`EDIT`) พร้อม `taskId/projectId`
  - rehydrate/reopen form เดิมอัตโนมัติเมื่อเปิดแอปใหม่ (ถ้า task ยังมีอยู่)
  - clear persisted focus เมื่อปิด/submit form สำเร็จ
- ปิด `Snooze Reminder from Notification`:
  - register notification action type (`15m`, `1h`, `Tomorrow`)
  - parse action payload จาก `onAction` แล้ว map เป็น snooze preset
  - update `remind_at` อัตโนมัติผ่าน existing `updateTask` mutation
  - ยังคง behavior เดิม: tap notification -> เปิด task detail
- ปิด `Personal Conflict Strategy Defaults`:
  - persist ค่า default strategy ต่อ conflict type ใน `settings` (`local.sync.conflict_strategy_defaults`)
  - เพิ่ม Settings UI ให้ผู้ใช้ตั้ง/บันทึก default strategy ได้เอง
  - เพิ่มปุ่ม `Apply Default` ใน conflict list (Conflict Center + Settings)
  - ถ้า default strategy เป็น `manual_merge` จะเปิด Manual Merge Editor แทน resolve ตรง
  - ยังมี per-item override เหมือนเดิม (`Keep Local`, `Keep Remote`, `Manual Merge`, `Retry`)
- ปิด `Command Palette Workflow Actions`:
  - เพิ่ม actions ใน command palette: `Run Sync now`, `Export backup`, `Open Sync diagnostics`, `Open Restore preflight`
  - เพิ่ม disabled state สำหรับ action ที่ยังไม่พร้อม (เช่น sync กำลังรัน/ไม่มี transport)
  - เชื่อม action นำทางให้เปิด Settings และ scroll ไป section เป้าหมาย (`sync diagnostics` / `backup preflight`)
  - ใช้ callback กลางจาก `App` เพื่อ export backup จาก command palette ได้ทันที
- ปิด `Lightweight Focus Mode`:
  - เพิ่ม focus controls บน `TaskCard` ใน view หลัก (`Board/Today/Upcoming/Projects/Calendar`)
  - รองรับ active focus ได้ทีละหนึ่งงาน และแสดง elapsed timer บนการ์ด
  - เพิ่ม sidebar focus indicator + stop control สำหรับหยุด session ได้จากทุกหน้า
  - บันทึก focus session ลง `sessions` เมื่อ stop
  - ปรับ `deleteTask` ให้ clear `sessions.task_id` เป็น `NULL` ก่อน delete task เพื่อไม่ให้ติด FK constraint

Validation Evidence:
1. `npm run test -- --run src/lib/task-filters.test.ts src/hooks/use-task-filters.test.tsx src/store/app-store.test.ts src/lib/task-bulk.test.ts` passed
2. `npm run build` passed
3. `npm run test -- --run src/lib/task-bulk.test.ts src/lib/i18n.catalog.test.ts src/hooks/use-task-filters.test.tsx src/store/app-store.test.ts` passed
4. `npm run test -- --run src/hooks/use-reminder-notifications.test.tsx src/lib/i18n.catalog.test.ts src/store/app-store.test.ts` passed
5. `npm run build` passed
6. `npm run test -- --run src/lib/database.sync-conflicts.test.ts src/lib/i18n.catalog.test.ts src/hooks/use-reminder-notifications.test.tsx` passed
7. `npm run build` passed
8. `npm run test -- --run src/lib/i18n.catalog.test.ts` passed
9. `npm run build` passed
10. `npm run test -- --run src/components/TaskCard.test.tsx src/components/AppShell.test.tsx src/lib/database.sessions.test.ts` passed
11. `npm run build` passed

Next pending item to pull:
- QoL Sprint C closed; pull next from P3-8 i18n expansion / rollout backlog

## 17) P3-8 Incremental Update (2026-02-21)

Completed in this pass:
- เพิ่ม conflict reason localization ให้หน้า `Conflict Center` และ `Settings > Sync`:
  - map `reason_code` จาก sync conflict เป็น i18n keys (TH/EN)
  - ลดการแสดง raw English message ที่มาจาก backend/DB บนหน้า UI
- เพิ่ม entity-type localization สำหรับ conflict label:
  - map `entity_type` (`PROJECT/TASK/TASK_SUBTASK/TASK_TEMPLATE/SETTING`) เป็น label แปลตาม locale
- เพิ่ม helper กลาง `src/lib/sync-conflict-message.ts` เพื่อใช้ร่วมกันทั้งสองหน้า
- ปรับ timestamp formatter ใน `Settings > Sync` conflict UI ให้ใช้ app locale โดยตรง (TH/EN) แทน system locale เพื่อให้ตรงกับ `Conflict Center`
- แปล copy ภาษาไทยใน `Settings > Sync Diagnostics` และ `Conflict Observability` เพื่อปิดจุดที่ยังเป็นอังกฤษใน flow sync/conflict
- แปล copy ภาษาไทยเพิ่มใน `Settings > Sync Runtime/Provider` (profile labels, runtime limit labels, duration N/A, push/pull URL labels)
- เก็บ copy ภาษาไทยเพิ่มใน `Settings > Sync` และ `Backup guardrails` (endpoint/provider hints, preflight/force-restore/dry-run wording)
- ปรับศัพท์เทคนิคไทยให้สอดคล้องกันใน Sync (`URL ส่งข้อมูลขึ้น/ดึงข้อมูลลง`, `ขีดจำกัดการส่งขึ้น/ดึงลง`, หน่วยเวลาเป็นไทย)
- sweep ภาษาไทยเพิ่มนอก Settings:
  - `Conflict Center` labels (`Keep Local/Remote`, payload labels)
  - `Command Palette` / `Shortcut Help` copy
  - `Backup` คำว่า outbox ให้เป็นคิวขาออกที่อ่านง่ายขึ้น
- ปรับ micro-copy ไทยที่ยังปนอังกฤษ (`Device ID`, `conflict_id`, `Markdown`, `Undo`, `E2E transport`)
- ปรับคำสะกดไทยให้สม่ำเสมอ (`โปรเจกต์`) และแปล `diff` ในข้อความ manual merge
- เก็บศัพท์ผสมอังกฤษในไทยเพิ่ม (`transport/outbox/push-pull`) ให้เป็นคำไทยที่สม่ำเสมอ
- เพิ่ม governance test กันคำสะกด `โปรเจค` กลับมาใน locale ไทย
- เพิ่ม unit tests สำหรับ helper:
  - known reason code -> localized message
  - unknown reason code -> raw message fallback
  - empty reason/message -> `common.unknown` fallback
  - known entity type -> localized label
  - unknown entity type -> raw type fallback

Validation Evidence:
1. `npm run test -- --run src/lib/sync-conflict-message.test.ts src/lib/i18n.catalog.test.ts` passed
2. `npm run test -- --run src/components/AppShell.test.tsx src/components/TaskCard.test.tsx src/lib/database.sessions.test.ts` passed
3. `npm run build` passed

# P3-2A iOS Native Swift Design v0.1

Updated: 2026-02-25
Status: Design baseline (implementation kickoff)

## 1) Goal

- กำหนด baseline สำหรับ `P3-2A` ว่า iOS client จะพัฒนาแบบ native ด้วย `Swift`
- คงพฤติกรรม `local-first/offline-first` และใช้ sync contract เดียวกับ desktop/shared-core
- ลด contract drift ระหว่าง desktop, iOS, และ Android

## 2) Scope (v1 Beta)

- Views หลัก: `Today`, `Upcoming`, `Board`
- Quick capture + CRUD สำหรับ `task` และ `subtask`
- Sync state UI: `Synced`, `Syncing`, `Offline`, `Conflict` + `Sync now`
- Offline queue + retry/backoff + conflict-aware status

Out of scope:
- Dashboard/Weekly Review parity เต็มรูปแบบ
- full manual merge UX บน mobile
- advanced backup/recovery flows บน iOS

## 3) Tech Stack (Locked for P3-2A)

- Language: `Swift` (Swift 5.10+)
- UI: `SwiftUI`
- Concurrency: `Swift Concurrency` (`async/await`, `Task`)
- Local storage: `SQLite` (ผ่าน Swift data-access layer)
- Networking: `URLSession`
- Secure storage: `Keychain` (token/secret)
- Testing:
  - unit tests: `XCTest`
  - UI tests: `XCUITest`
  - sync contract tests: fixture-based integration tests

## 4) Architecture

- App layer: SwiftUI + navigation + screen state
- Feature layer:
  - `TodayFeature`
  - `UpcomingFeature`
  - `BoardFeature`
  - `QuickCaptureFeature`
  - `SyncStatusFeature`
- Domain layer:
  - entities/use-cases (`Task`, `Project`, `Subtask`, `Template`)
  - sync orchestration use-cases (`preparePushBatch`, `applyPullBatch`, `advanceCursor`)
- Data layer:
  - repository protocols
  - SQLite adapters
  - sync API client
  - local outbox/checkpoint store
- Infrastructure:
  - Keychain service
  - app lifecycle hooks (foreground/background)
  - logging/diagnostics sink

## 5) Data and Contract Compatibility

- ใช้ entity model เดียวกับ shared-core:
  - `projects`, `tasks`, `task_subtasks`, `task_templates`, `settings`
  - `sync_outbox`, `sync_checkpoints`, `deleted_records`
- Sync API contract:
  - `POST /v1/sync/push`
  - `POST /v1/sync/pull`
  - `GET /v1/sync/bootstrap`
- Error mapping ใช้ code เดียวกับ shared-core (`RATE_LIMITED`, `INVALID_CURSOR`, `UNAVAILABLE`, ...)

## 6) Sync Runtime Design (iOS-Specific)

- Foreground: interval สั้นกว่าเพื่อ feedback เร็ว
- Background: ลด polling ตาม iOS lifecycle constraints
- Manual trigger: ปุ่ม `Sync now`
- Guardrails:
  - กัน sync ซ้อน
  - timeout + retry/backoff
  - idempotency key ต่อ batch

## 7) Security Baseline

- token/secret เก็บใน Keychain เท่านั้น
- redact sensitive config ก่อน persist ลง SQLite
- แยก logging ระหว่าง debug กับ production และไม่ log token/raw payload ที่อ่อนไหว

## 8) Quality Gates (P3-2A)

- Unit coverage สำหรับ repository/sync use-cases/error mapping
- XCUITest สำหรับ critical flows:
  - quick capture
  - task update
  - sync status change + manual retry
- Cross-device validation:
  - desktop <-> iOS sync median <= 10s (normal network)
  - no critical data-loss case ใน offline/online matrix

## 9) Execution Plan

1. Sprint iOS-A (Design + Skeleton)
- สร้าง app/module skeleton และ dependency graph
- วาง repository protocol + SQLite schema mapping
- วาง sync client interface + error mapping baseline

2. Sprint iOS-B (Core Flow)
- implement Today/Upcoming/Board + quick capture CRUD
- implement sync loop + outbox + checkpoint flow
- integrate Keychain + runtime profile behavior

3. Sprint iOS-C (Hardening + Beta)
- เพิ่ม telemetry/diagnostics
- เพิ่ม XCUITest + fixture integration tests
- internal TestFlight -> external beta ตาม readiness gate

## 10) Open Decisions

- เลือก SQLite library ใน Swift layer (native wrapper option A/B) ก่อนเริ่ม Sprint iOS-A
- strategy สำหรับ contract artifact sharing จาก shared-core (JSON schema/codegen/manual typed adapter)
- release branching policy ระหว่าง iOS native repo กับ core contract changes

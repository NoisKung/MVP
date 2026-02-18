# P3-6 Execution Backlog v0.1

Date: 2026-02-18  
Scope: MCP Server for SoloStack (read-first)

## 1) Milestones

## M0: Contract Freeze

Target: 2026-02-26 ถึง 2026-02-27

Outputs:
- read-tool contract v0.1 (`get_tasks`, `get_projects`, `get_weekly_review`, `search_tasks`, `get_task_changelogs`)
- unified error shape
- query bounds (`limit`, `cursor`, `timeout`)

Acceptance:
- contract doc review ผ่าน
- fixture response examples ครบทุก tool

## M1: Server Skeleton

Target: 2026-02-27 ถึง 2026-03-01

Outputs:
- `mcp-solostack` skeleton
- health check endpoint
- config loader + env validation
- basic structured logging

Acceptance:
- run local server ได้ด้วย command เดียว
- health check ผ่านบน local

## M2: Wave-1 Tools (Execution Start)

Target: 2026-03-01 ถึง 2026-03-04

Outputs:
- `get_tasks`
- `get_projects`
- pagination + filter + timeout guardrails

Acceptance:
- integration tests ผ่านกับ small/medium fixture DB
- p95 latency บน local fixture <= 2s

## M3: Wave-2 Tools

Target: 2026-03-05 ถึง 2026-03-10

Outputs:
- `get_weekly_review`
- `search_tasks`
- `get_task_changelogs`

Acceptance:
- tool behavior deterministic ตาม contract
- query bounds ทำงานจริงทุก tool

## M4: Hardening + Rollout Prep

Target: 2026-03-11 ถึง 2026-03-14

Outputs:
- audit log baseline
- error mapping + retry policy
- performance and failure test report

Acceptance:
- quality gates ผ่าน (`test`/`build` + integration matrix)
- rollout checklist พร้อม

## 2) First Ticket Set (Ready to Implement)

- `P36-001` Create `mcp-solostack` package skeleton + health check
- `P36-002` Implement config loader with strict env validation
- `P36-003` Add shared tool contract types + error schema
- `P36-004` Implement SQLite adapter for read-only query path
- `P36-005` Implement `get_tasks` with bounds + tests
- `P36-006` Implement `get_projects` with bounds + tests
- `P36-007` Add integration fixture DB (small/medium)
- `P36-008` Add tool-call audit log baseline

## 3) Dependency Matrix

- Depends on AWS spike:
  - deployment profile decision (local-only vs cloud)
- Depends on telemetry spec:
  - event schema + metric names for MCP runtime
- Independent from connector provider implementation:
  - read tools ใช้ local SQLite adapter เป็น baseline ได้ก่อน

## 4) Risks and Guardrails

- Risk: heavy query ทำให้ UI lag
  - Guardrail: bounded query + timeout + limit defaults
- Risk: auth ambiguity เมื่อเปิด hosted mode
  - Guardrail: local sidecar default, hosted mode gated by explicit auth design
- Risk: scope creep ไป write tools เร็วเกิน
  - Guardrail: read-only default จนกว่าจะผ่าน criteria ด้าน audit + safety

## 5) Definition of Ready (Start Coding)

- contract v0.1 freeze
- fixture DB เตรียมพร้อม
- owner ต่อ milestone ชัดเจน
- acceptance criteria ต่อ ticket ระบุครบ

## 6) Definition of Done (P3-6 Initial)

- wave-1 + wave-2 tools ครบตาม contract
- integration tests + performance baseline ผ่าน
- agent usage playbook ฉบับแรกพร้อมใช้งานใน repo

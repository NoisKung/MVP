# SoloStack Usage Guide

อัปเดตล่าสุด: 2026-02-18

## 1) Development Commands

```bash
npm install
npm run tauri dev
npm run test
npm run test:e2e
npm run build
```

Validation gate ที่ต้องรันตามลำดับ:
1. `npm run test`
2. `npm run test:e2e`
3. `npm run build`

## 2) MVP CLI Quick Usage

```bash
npm run mvp-cli -- help
npm run mvp-cli -- project create --name "Client A" --color "#3B82F6"
npm run mvp-cli -- task create --title "Draft release note" --project "Client A"
npm run mvp-cli -- task done --id <task-id>
```

Options ที่ใช้บ่อย:
- `--json` สำหรับ machine-readable output
- `--db <path>` เพื่อระบุไฟล์ SQLite

## 3) Sync Architecture (Current)

Core files:
- `src/lib/sync-contract.ts`: validate/normalize sync payloads
- `src/lib/sync-engine.ts`: prepare/ack/apply/advance helpers
- `src/lib/sync-runner.ts`: orchestration หนึ่งรอบของ sync cycle
- `src/lib/sync-service.ts`: wiring เข้ากับ local DB functions
- `src/lib/sync-connector-contract.ts`: provider-neutral connector contract v0.1 (Google/OneDrive baseline)
- `src/lib/database.ts`: mutation path + outbox + incoming apply + conflict persistence/report
- `src/hooks/use-tasks.ts`: hooks สำหรับ conflict list/events/resolve/report export/observability

Syncable entities:
- `PROJECT`
- `TASK`
- `TASK_SUBTASK`
- `TASK_TEMPLATE`
- `SETTING`

Mutation rules (local write path):
- update `sync_version`
- update `updated_by_device`
- enqueue `sync_outbox` (`UPSERT`/`DELETE`)

Incoming apply rules:
- Last-Write-Wins by `updated_at`
- tie-break by `updated_by_device`
- keep local `sync.device_id` stable (ไม่ overwrite จาก remote)
- เมื่อ payload/reference ไม่ถูกต้อง ระบบจะ persist conflict ลง:
  - `sync_conflicts`
  - `sync_conflict_events`
- กัน conflict ซ้ำด้วย `incoming_idempotency_key`

## 4) Sync Transport Configuration (UI)

ตั้งค่าในแอปที่หน้า `Settings > Sync`:
1. กรอก `Push URL` (เช่น `/v1/sync/push`)
2. กรอก `Pull URL` (เช่น `/v1/sync/pull`)
3. กด `Save Endpoints`

ข้อกำหนด:
- ต้องตั้ง `push` และ `pull` ครบทั้งคู่ หรือปล่อยว่างทั้งคู่
- รองรับเฉพาะ `http://` และ `https://`
- ถ้าล้างทั้งคู่ แอปจะกลับเป็น local-only mode

พฤติกรรมหลังตั้งค่า:
- app จะ auto-sync ตอนเปิดแอป + ทุก 60 วินาที
- ผู้ใช้กด `Sync now` ได้จากหน้า Settings ตลอด
- auto-sync failure จะทำ exponential backoff (เริ่ม ~5s และ cap ที่ 5 นาที)
- เมื่อ `pull` ตอบ `has_more=true` ระบบจะดึงหน้าถัดไปอัตโนมัติ (default สูงสุด 5 หน้า/รอบ)

P3-2 runtime tuning (Settings > Sync > `Sync Runtime Profile`):
- ปรับ foreground/background auto-sync interval ได้จาก UI
- ปรับ `push limit`, `pull limit`, `max pull pages` ได้จาก UI
- มี preset:
  - `Desktop Preset` (สมดุล responsiveness)
  - `Mobile Beta Preset` (ลด network/battery overhead)
- first launch บน iOS/Android (ถ้ายังไม่เคยตั้งค่า runtime มาก่อน) จะ seed ค่าเริ่มต้นเป็น `Mobile Beta Preset` อัตโนมัติ
- background interval ต้องมากกว่าหรือเท่ากับ foreground interval
- มี `Sync Diagnostics (Session)` ในหน้า Settings แสดง success rate, cycle latency, failure streak และ conflict cycles เพื่อช่วย tune mobile beta
- มี `Conflict Observability` ในหน้าเดียวกัน แสดง total/open/resolved conflicts, resolution rate, median resolve time, และ retried/exported event counters

ต้องมี server ไหม:
- ไม่ต้องมี ถ้าใช้งานเครื่องเดียว (สถานะ `LOCAL_ONLY`)
- ต้องมี ถ้าต้องการ sync ข้ามหลายเครื่อง เพราะ client ต้องมี backend กลางสำหรับ push/pull/cursor
- ถ้าอยากลดภาระการทำ backend เอง สามารถทำ connector ไปบริการ cloud (Google/Microsoft/iCloud) แต่ก็ยังต้องมี sync service logic รองรับ conflict/idempotency

เอา Sync URL มาจากไหน:
1. กรณีรัน backend บนเครื่องตัวเอง (local dev)
- ใช้ URL ตาม port ที่ backend เปิดจริง
- ตัวอย่าง:
  - `Push URL`: `http://127.0.0.1:8787/v1/sync/push`
  - `Pull URL`: `http://127.0.0.1:8787/v1/sync/pull`

2. กรณี deploy แล้ว (staging/production)
- ใช้โดเมนของ sync service ที่ deploy แล้ว
- ตัวอย่าง:
  - `Push URL`: `https://sync.yourdomain.com/v1/sync/push`
  - `Pull URL`: `https://sync.yourdomain.com/v1/sync/pull`

3. กรณีทดสอบข้ามเครื่องจาก local server
- ถ้าอีกเครื่องเข้าถึง `localhost` ไม่ได้ ให้เปิด tunnel (เช่น ngrok/cloudflared) หรือใช้ IP ที่เข้าถึงได้ใน LAN
- ใช้ public/accessible URL จาก tunnel เป็น base URL แล้วต่อท้าย `/v1/sync/push` และ `/v1/sync/pull`

Checklist ก่อนกรอกใน UI:
- เปิด endpoint จริงครบทั้ง `push` และ `pull`
- ต้องเป็น `http(s)` เท่านั้น
- หลีกเลี่ยง trailing slash ซ้ำ เช่น `.../sync//push`
- ถ้ากรอกผิด ให้กด `Save Endpoints` ใหม่ แล้วลอง `Sync now`

## 5) Running a Sync Cycle (Code)

ตัวอย่างการเรียกใช้งานด้วย transport ของ backend:

```ts
import { runLocalSyncCycle } from "@/lib/sync-service";

const summary = await runLocalSyncCycle(
  {
    push: async (payload) => {
      const response = await fetch("/v1/sync/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return response.json();
    },
    pull: async (payload) => {
      const response = await fetch("/v1/sync/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return response.json();
    },
  },
  {
    pushLimit: 200,
    pullLimit: 200,
  },
);

console.log(summary);
```

`summary` จะสรุป:
- checkpoint ก่อน/หลัง
- จำนวน outbox ที่ส่งสำเร็จ/ล้มเหลว/ค้าง
- ผล apply pull (`applied`, `skipped`, `conflicts`, `failed`)

## 5B) Connector Contract Baseline (P3-5)

- มี interface กลาง `SyncConnectorAdapter` ใน `src/lib/sync-connector-contract.ts`
- ครอบคลุม operation พื้นฐาน:
  - `list`
  - `read`
  - `write`
  - `remove`
- มี capability map ต่อ provider (`google_appdata`, `onedrive_approot`) และ helper สำหรับ normalize request bounds + error shape
- ไฟล์นี้เป็น contract layer (ยังไม่ใช่ provider implementation จริง)

## 6) Sync Status Semantics

- `Synced`: sync cycle ล่าสุดสำเร็จและไม่มี conflict/failure
- `Syncing`: กำลัง push/pull อยู่
- `Offline`: network offline หรือ sync transport ยังไม่ถูกตั้งค่า
- `Conflict`: มี rejected/failed/merge conflict ที่ต้องตรวจ
- `Local only`: ไม่ได้ตั้ง endpoint และใช้งานแบบ local machine เดียว

ตำแหน่งแสดงผล:
- Sidebar footer: status badge ระดับแอป (เมื่อสถานะเป็น `Conflict` กดเพื่อเปิด `Conflict Center` ได้)
- Settings > Sync card: ปุ่ม `Sync now`, เวลาซิงก์ล่าสุด, error ล่าสุด
- Settings > Sync > `Conflict Center`: ดูรายการ conflict ที่เปิดอยู่และกด resolve
- Sidebar > `Conflicts`: dedicated view สำหรับจัดการ conflict แบบเต็มหน้า

## 6B) Conflict Center (P3-3 Baseline)

ในหน้า `Settings > Sync` และหน้า dedicated `Conflicts`:
- แสดง open conflicts (ชนิด, entity, message, detected time)
- action ต่อรายการ:
  - `Keep Local`
  - `Keep Remote`
  - `Retry`
  - `Manual Merge` (เปิด side-by-side diff editor + merge actions + ช่อง merged content)
- กด `Details` เพื่อดู payload (`local`/`remote`) และ timeline events ของ conflict นั้น
- กด `Export Report` เพื่อดาวน์โหลด conflict report เป็น JSON (รวม events)
- ทุกครั้งที่ export report ระบบจะเพิ่ม timeline event ประเภท `exported`
- มี aggregate counters สำหรับ conflict lifecycle เพื่อช่วย monitor แนวโน้ม (resolution rate + median time-to-resolve)

พฤติกรรมปัจจุบัน:
- เมื่อกด resolve ระบบจะบันทึก resolution/event ลง DB ทันที
- หลัง resolve จะ trigger `Sync now` อัตโนมัติ 1 รอบ
- ถ้า incoming change เดิมถูก apply สำเร็จภายหลัง conflict จะถูก mark เป็น resolved อัตโนมัติ (strategy = `retry`)
- action `Retry` มี confirmation ก่อน re-queue conflict เพื่อกันกดพลาด

Recovery (Backup & Restore):
- ก่อน restore ระบบจะทำ preflight (`pending outbox`, `open conflicts`, `latest backup`)
- ถ้ามี `pending outbox` หรือ `open conflicts` ระบบจะบังคับเป็น force restore flow พร้อม confirmation ชัดเจน
- มีปุ่ม `Restore Latest Backup` (snapshot ล่าสุดที่ export ภายในเครื่อง)
- หลัง restore ระบบจะ clear stale sync state (`sync_outbox`, `sync_conflicts`, checkpoint) และ trigger sync รอบใหม่อัตโนมัติเมื่อมี transport

ข้อจำกัดปัจจุบัน (Known Limitations):
- `Keep Local`/`Keep Remote` ตอนนี้เป็น metadata resolution flow
- `Manual Merge` เป็น diff-based editor แล้ว แต่ยังไม่มี inline 3-way merge automation

## 7) Contributor Checklist (Sync Changes)

เมื่อแก้ระบบ sync:
1. อัปเดต contract/types (`sync-contract.ts`, `types.ts`) ถ้า schema เปลี่ยน
2. อัปเดต DB write path (`database.ts`) ให้คงกติกา outbox + sync metadata
3. เพิ่ม/แก้ tests (`sync-contract.test.ts`, `sync-engine.test.ts`, `sync-runner.test.ts`)
4. รัน gate ครบ (`test` -> `test:e2e` -> `build`)
5. อัปเดตเอกสารที่เกี่ยวข้อง (`AGENT.md`, `usage.md`, และ roadmap docs)
6. สำหรับ deterministic E2E fixtures ใช้หน้า app ด้วย query `?e2e=1`

## 8) Documentation Sync Rule

- ถ้า `AGENT.md` เปลี่ยนในส่วน workflow, sync design, หรือ validation gate:
  - ต้องอัปเดต `usage.md` ใน change set เดียวกัน
- ถ้า behavior ของ implementation เปลี่ยน:
  - ต้องอัปเดตตัวอย่างการใช้งานใน `usage.md` ให้ตรง behavior ล่าสุด

## 9) MCP Local Skeleton (P3-6 Kickoff)

รัน MCP server skeleton:

```bash
npm run mcp:dev
```

default bind:
- `127.0.0.1:8799`

health endpoints:
- `GET /`
- `GET /health`
- `GET /healthz`

read tool endpoints:
- `POST /tools/get_tasks`
- `POST /tools/get_projects`
- `POST /tools/get_weekly_review`
- `POST /tools/search_tasks`
- `POST /tools/get_task_changelogs`
- `POST /tools` (generic route, ส่ง `tool` ผ่าน body)

audit log baseline:
- MCP จะเขียน structured log ต่อ 1 tool call ลง stdout (event `mcp.tool_call`)
- payload หลัก: `request_id`, `tool`, `ok`, `status_code`, `error_code`, `duration_ms`

config env vars:
- `SOLOSTACK_MCP_HOST`
- `SOLOSTACK_MCP_PORT`
- `SOLOSTACK_MCP_DB_PATH`
- `SOLOSTACK_MCP_LOG_LEVEL`
- `SOLOSTACK_MCP_READ_ONLY`
- `SOLOSTACK_MCP_ENABLE_CORS`
- `SOLOSTACK_MCP_RATE_LIMIT_ENABLED`
- `SOLOSTACK_MCP_RATE_LIMIT_WINDOW_MS`
- `SOLOSTACK_MCP_RATE_LIMIT_MAX_REQUESTS`
- `SOLOSTACK_MCP_TIMEOUT_GUARD_ENABLED`
- `SOLOSTACK_MCP_TIMEOUT_STRATEGY`
- `SOLOSTACK_MCP_TOOL_TIMEOUT_MS`

load/perf matrix baseline:
- รัน `npm run mcp:load-matrix`
- output ที่ `docs/mcp-load-matrix-v0.1.md`

รายละเอียดเพิ่มเติม: `mcp-solostack/README.md`

## 10) Planning Artifacts (P3-5 / P3-6)

- AWS spike memo: `docs/aws-spike-v0.1.md`
- Telemetry spec baseline: `docs/telemetry-spec-v0.1.md`
- MCP execution backlog: `docs/p3-6-execution-backlog-v0.1.md`
- MCP read-tool contract: `docs/mcp-read-tools-contract-v0.1.md`
- Agent usage playbook: `docs/agent-usage-playbook-v0.1.md`
- MCP AWS hosted profile: `docs/mcp-aws-hosted-profile-v0.1.md`
- MCP hardening report: `docs/mcp-hardening-report-v0.1.md`
- MCP load matrix: `docs/mcp-load-matrix-v0.1.md`

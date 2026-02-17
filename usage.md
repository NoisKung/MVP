# SoloStack Usage Guide

อัปเดตล่าสุด: 2026-02-17

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
- `src/lib/database.ts`: mutation path + outbox + incoming apply

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

## 6) Sync Status Semantics

- `Synced`: sync cycle ล่าสุดสำเร็จและไม่มี conflict/failure
- `Syncing`: กำลัง push/pull อยู่
- `Offline`: network offline หรือ sync transport ยังไม่ถูกตั้งค่า
- `Conflict`: มี rejected/failed/merge conflict ที่ต้องตรวจ
- `Local only`: ไม่ได้ตั้ง endpoint และใช้งานแบบ local machine เดียว

ตำแหน่งแสดงผล:
- Sidebar footer: status badge ระดับแอป
- Settings > Sync card: ปุ่ม `Sync now`, เวลาซิงก์ล่าสุด, error ล่าสุด

## 7) Contributor Checklist (Sync Changes)

เมื่อแก้ระบบ sync:
1. อัปเดต contract/types (`sync-contract.ts`, `types.ts`) ถ้า schema เปลี่ยน
2. อัปเดต DB write path (`database.ts`) ให้คงกติกา outbox + sync metadata
3. เพิ่ม/แก้ tests (`sync-contract.test.ts`, `sync-engine.test.ts`, `sync-runner.test.ts`)
4. รัน gate ครบ (`test` -> `test:e2e` -> `build`)
5. อัปเดตเอกสารที่เกี่ยวข้อง (`AGENT.md`, `usage.md`, และ roadmap docs)

## 8) Documentation Sync Rule

- ถ้า `AGENT.md` เปลี่ยนในส่วน workflow, sync design, หรือ validation gate:
  - ต้องอัปเดต `usage.md` ใน change set เดียวกัน
- ถ้า behavior ของ implementation เปลี่ยน:
  - ต้องอัปเดตตัวอย่างการใช้งานใน `usage.md` ให้ตรง behavior ล่าสุด

# SoloStack คู่มือการใช้งาน (ภาษาไทย)

อัปเดตล่าสุด: 2026-02-22

## 1) ภาพรวม

SoloStack คือแอปจัดการงานแบบ local-first สำหรับใช้งานคนเดียว พัฒนาด้วย Tauri + React + TypeScript

สิ่งที่รองรับหลัก:
- Board / Projects / Calendar / Today / Upcoming / Weekly Review / Dashboard
- Task + Subtask + Template + Saved Views
- Reminder notification
- Sync แบบกำหนดค่าได้จาก UI (Provider + Runtime)
- Conflict Center + Backup/Restore
- Global Undo Bar
- MVP CLI
- MCP local skeleton

Bundle identifier ปัจจุบัน:
- `com.solutionsstudio.solostack`

## 2) เริ่มต้นใช้งาน (Dev)

Prerequisites:
- Node.js 18+
- Rust (stable)
- Tauri prerequisites

คำสั่งพื้นฐาน:

```bash
npm install
npm run tauri dev
npm run test
npm run test:e2e
npm run build
```

Quality gates ที่ใช้ในโปรเจคนี้:
1. `npm run test`
2. `npm run test:e2e`
3. `npm run build`

## 3) โครงสร้างหน้าจอหลัก

เมนู Sidebar:
- `Board`: ดูงานตามสถานะ
- `Projects`: จัดกลุ่มงานตามโปรเจค
- `Calendar`: มุมมองปฏิทิน
- `Today`: งานค้าง/ครบกำหนดวันนี้
- `Upcoming`: งาน 7 วันถัดไป
- `Conflicts`: จัดการ sync conflict แบบเต็มหน้า
- `Weekly Review`: สรุปประจำสัปดาห์
- `Dashboard`: ภาพรวม productivity
- `Settings`: ตั้งค่าระบบทั้งหมด

## 4) Task Workflow

งาน (Task):
- สร้างงานใหม่จากปุ่ม `New Task` หรือคีย์ลัด
- กำหนด `status`, `priority`, `due date`, `reminder`, `recurrence`
- ใช้ natural language date ได้ เช่น `tomorrow 9am`, `next monday`

Subtasks:
- แตกงานย่อยเป็น checklist
- ระบบคำนวณ progress ให้อัตโนมัติ

Templates:
- สร้าง template งานซ้ำๆ แล้วเรียกใช้ได้ทันที

Saved Views:
- บันทึกชุด filter/sort ของแต่ละ view แล้วเรียกใช้ภายหลัง

## 5) Keyboard Shortcuts

- `Cmd/Ctrl + N`: สร้างงาน
- `Cmd/Ctrl + K`: เปิด Command Palette
- `Cmd/Ctrl + ,`: เปิด Settings
- `Cmd/Ctrl + Shift + C`: เปิด Conflict Center
- `Cmd/Ctrl + Shift + S`: Sync now (เมื่อมี transport)
- `/`: โฟกัส Search ของ view ปัจจุบัน
- `Esc` ในช่อง Search: ล้างข้อความหรือออกจาก focus
- `?`: เปิด Shortcut Help

## 6) Autosave และ Global Undo Bar

Autosave:
- แสดงสถานะใน Sidebar footer (`Autosaving...`, `Autosave ready`, `Saved ...`, `Autosave failed`)

Global Undo Bar:
- action สำคัญจะถูก queue ไว้ประมาณ 5 วินาทีเพื่อ Undo ได้
- ครอบคลุม:
  - Delete task
  - Delete project
  - Resolve/Retry conflict
  - Restore latest backup
  - Restore from file

## 7) Sync (ตั้งค่าจาก UI)

ไปที่ `Settings > Sync`

### 7.1 Provider

เลือก provider ได้จาก UI:
- `Provider Neutral`
- `Google AppData`
- `Microsoft OneDrive AppRoot`
- `Apple iCloud CloudKit`
- `SoloStack Cloud (AWS)`

ในหน้าเดียวกันมี capability card:
- auth requirement
- endpoint mode (`custom` / `managed`)
- warnings ต่อ provider

หมายเหตุ:
- build ปัจจุบันยังใช้ custom endpoint transport เป็นหลัก
- managed connectors ถูกวางไว้ใน contract/roadmap และ guardrails แล้ว

### 7.2 Endpoints

ต้องกรอกทั้งสองค่า:
- `Push URL`
- `Pull URL`

กติกา:
- ต้องเป็น `http://` หรือ `https://`
- กรอกไม่ครบคู่จะถูกปฏิเสธ
- ล้างทั้งคู่ = local-only mode

ตัวอย่าง URL:
- `https://sync.yourdomain.com/v1/sync/push`
- `https://sync.yourdomain.com/v1/sync/pull`

### 7.3 Runtime Profile

ปรับได้จาก UI:
- Foreground interval
- Background interval
- Push limit
- Pull limit
- Max pull pages

Preset:
- `Desktop Preset`
- `Mobile Beta Preset`
- `Reset Recommended`

Guardrails:
- มี inline validation
- มี battery/network impact hint
- ระบบ normalize bounds ก่อนเข้า sync loop

### 7.4 Sync Engine Behavior

พฤติกรรมสำคัญ:
- มี provider resolver ก่อนสร้าง transport
- ถ้า config invalid:
  - จะ fallback ไป `last-known-good transport` ถ้ามี
  - แจ้ง warning ใน diagnostics
- ถ้า provider unavailable:
  - เข้า offline-safe mode
  - ไม่ crash loop

## 8) Sync Status และ Diagnostics

สถานะ:
- `Synced`
- `Syncing`
- `Offline`
- `Conflict`
- `Local only`

ใน Settings > Sync > Diagnostics จะแสดง:
- success rate
- cycle duration
- failure streak
- conflict cycles
- ประวัติการวิเคราะห์ย้อนหลัง (ล่าสุด 5 รายการ)
- มุมมองประวัติแบบเต็ม พร้อมค้นหา/กรองที่มา/กรองช่วงวันที่ และจำนวนแถว
- ปุ่ม `Export Filtered JSON` ในมุมมองประวัติแบบเต็ม (ส่งออกเฉพาะ snapshot ที่ตรงกับตัวกรองปัจจุบัน พร้อม metadata ของตัวกรอง)
- selected provider (ใน sync loop)
- provider selected events
- runtime profile changed events
- validation rejected events
- last warning

## 9) Conflict Center

มีทั้งหน้า `Conflicts` และ section ใน Settings

ทำได้:
- ดู open conflicts
- ดู payload local/remote
- ดู timeline events
- Resolve ด้วย:
  - Keep Local
  - Keep Remote
  - Retry
  - Manual Merge
- Export report เป็น JSON
  - แนบ snapshot `session_diagnostics` (รวม `runtime_preset_source`)
  - แนบ `session_diagnostics_history` (snapshot ย้อนหลังแบบ rolling ข้าม session)
  - แนบ metadata: `report_type`, `export_source`, `app_locale`

## 10) Backup / Restore

ตำแหน่ง:
- อยู่ใน `Settings > Data Backup & Restore`

รองรับ:
- Export backup เป็นไฟล์ JSON
- Restore latest backup
- Restore from file

Restore guardrails:
- ระบบตรวจ preflight (`pending outbox`, `open conflicts`, `latest backup`) ก่อน restore
- ถ้ามีความเสี่ยงจะบังคับ flow แบบ force + confirmation

ข้อมูล backup ภายใน:
- snapshot ล่าสุดถูกเก็บใน settings key ภายใน DB:
  - `local.backup.latest_payload_v1`
  - `local.backup.latest_exported_at`

## 11) Data Location

ฐานข้อมูลหลัก:
- ชื่อไฟล์ `solostack.db` (ผ่าน Tauri SQL: `sqlite:solostack.db`)
- เก็บใน app data directory ของแต่ละ OS ตาม runtime ของ Tauri

ไฟล์ backup ที่ export:
- ผู้ใช้เลือก path ปลายทางเองผ่าน dialog ตอน export

## 12) MVP CLI

ตัวอย่าง:

```bash
npm run mvp-cli -- help
npm run mvp-cli -- project create --name "Client A" --color "#3B82F6"
npm run mvp-cli -- task create --title "Draft release note" --project "Client A"
npm run mvp-cli -- task done --id <task-id>
```

option สำคัญ:
- `--json`
- `--db <path>`

## 13) MCP Local Skeleton

รัน:

```bash
npm run mcp:dev
```

default:
- bind: `127.0.0.1:8799`
- health: `/`, `/health`, `/healthz`
- tools: `/tools/get_tasks`, `/tools/get_projects`, `/tools/get_weekly_review`, `/tools/search_tasks`, `/tools/get_task_changelogs`, `/tools`

รายละเอียด env และ contract:
- ดู `mcp-solostack/README.md`
- ดู docs ในโฟลเดอร์ `docs/`

## 14) Troubleshooting

ปัญหา sync ไม่วิ่ง:
- ตรวจว่า Push/Pull URL กรอกครบและถูกต้อง
- ดู `last warning` ใน Diagnostics
- กด `Sync now` และเช็ก status pill

เจอ conflict บ่อย:
- เปิด `Conflicts` แล้ว resolve ที่ pending ก่อน
- export report เพื่อวิเคราะห์ root cause เพิ่ม

restore ไม่ผ่าน:
- อ่านข้อความ preflight/force restore
- ตรวจว่าเข้าใจผลของการทับข้อมูล local แล้ว

## 15) เอกสารที่เกี่ยวข้อง

- Product roadmap: `IDEA.md`
- Delivery plan: `PLANNING.md`
- Technical usage: `usage.md`
- English manual: `docs/MANUAL.en.md`

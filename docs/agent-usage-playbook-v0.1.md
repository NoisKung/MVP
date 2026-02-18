# Agent Usage Playbook v0.1 (SoloStack MCP)

Date: 2026-02-18  
Audience: Agent runtime ที่เรียก MCP read tools ของ SoloStack

## 1) Goal

ให้ agent ดึงข้อมูลจาก SoloStack ได้อย่างคงเส้นคงวา, อธิบายงานได้เร็ว, และไม่ทำให้ query หนักเกินจำเป็น

## 2) Preconditions

- MCP server ต้องรันอยู่ (`npm run mcp:dev`)
- ตั้ง `SOLOSTACK_MCP_DB_PATH` ชี้ SQLite file จริง
- เรียกผ่าน `POST /tools/<tool>` หรือ `POST /tools`

## 3) Tool Selection

1. ใช้ `get_weekly_review` เมื่อต้องการ summary ภาพรวมสัปดาห์
2. ใช้ `search_tasks` เมื่อต้องการหา task ตาม keyword
3. ใช้ `get_tasks` เมื่อต้องการ list/filter ตาม `status` หรือ `project_id`
4. ใช้ `get_task_changelogs` เมื่อต้องการ timeline ของ task เดียว
5. ใช้ `get_projects` เมื่อจะ map task ไป project context

## 4) Query Pattern

- เริ่มจาก `limit` เล็กก่อน (`20` หรือ `30`)
- ถ้า `next_cursor` ไม่เป็น `null` แล้วต้องการข้อมูลเพิ่ม ค่อยยิงหน้าถัดไป
- หลีกเลี่ยงดึงทุกอย่างใน call เดียว

## 5) Recommended Sequences

## Weekly recap

1. `get_weekly_review` (`week_start_iso`, `item_limit`)
2. ถ้าต้องลงรายละเอียด task ที่ค้าง ให้เรียก `get_task_changelogs` เพิ่มเฉพาะ task สำคัญ

## Search and explain task status

1. `search_tasks` (`query`, `limit`)
2. สำหรับ task ที่ต้องวิเคราะห์ root cause ให้เรียก `get_task_changelogs`
3. เสริม project label ด้วย `get_projects` เมื่อจำเป็น

## 6) Minimal Request Examples

```json
{
  "request_id": "req-weekly-1",
  "tool": "get_weekly_review",
  "args": {
    "week_start_iso": "2025-01-06T00:00:00.000Z",
    "item_limit": 20
  }
}
```

```json
{
  "request_id": "req-search-1",
  "tool": "search_tasks",
  "args": {
    "query": "release",
    "status": "TODO",
    "limit": 30
  }
}
```

## 7) Response Handling

- ถ้า `ok=true`: ใช้ `data` ตรงตาม tool contract
- ถ้า `ok=false`: branch ตาม `error.code`
- ใช้ `meta.duration_ms` เพื่อ monitor call latency

## 8) Error Handling Policy

- `INVALID_ARGUMENT`: แก้ request shape แล้ว retry 1 ครั้ง
- `NOT_FOUND`: แจ้งว่า db/config อาจผิด path
- `INTERNAL_ERROR`: retry แบบ jitter 1-2 ครั้ง แล้วรายงาน error code/message

## 9) Safety Rules

- ห้าม assume ว่าข้อมูลครบถ้าไม่เช็ก `next_cursor`
- ห้ามสรุปเชิง causal จาก title อย่างเดียว ถ้ามี changelog ให้ดู changelog ก่อน
- ห้ามสร้าง mutation flow ผ่าน MCP ชุดนี้ (read-only only)

# MCP Load Matrix v0.1

Date: 2026-02-18
Iterations per tool: 30

## Fixture Profiles

| Profile | Projects | Tasks | Task Changelogs |
| --- | ---: | ---: | ---: |
| small | 15 | 400 | 100 |
| medium | 40 | 4000 | 1000 |

## Result Matrix (ms)

| Profile | Tool | Avg | P50 | P95 | Max |
| --- | --- | ---: | ---: | ---: | ---: |
| small | get_tasks | 0.68 | 0.45 | 1 | 1 |
| small | get_projects | 0.19 | 0.1 | 1 | 1 |
| small | search_tasks | 0.74 | 0.54 | 1 | 1 |
| small | get_task_changelogs | 0.2 | 0.1 | 1 | 1 |
| small | get_weekly_review | 0.64 | 0.41 | 1 | 1 |
| medium | get_tasks | 3.51 | 3.34 | 4 | 4 |
| medium | get_projects | 0.24 | 0.11 | 1 | 1 |
| medium | search_tasks | 4.18 | 4 | 5 | 5 |
| medium | get_task_changelogs | 0.26 | 0.14 | 1 | 1 |
| medium | get_weekly_review | 2.54 | 2.36 | 3 | 3 |

## Notes

- วัดจาก local execution path (`executeReadTool`) บน fixture SQLite ที่สร้างอัตโนมัติ
- ค่าที่รายงานเป็น baseline สำหรับ regression check ระหว่างปรับ query/guardrails
- สำหรับ hosted mode ให้รันซ้ำใน environment จริงและเปรียบเทียบกับ baseline นี้


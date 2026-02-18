# AWS Architecture Spike v0.1 (Sync + MCP)

Date: 2026-02-18  
Status: Draft recommendation for implementation planning

## 1) Scope

ระบบที่ประเมิน:
- Sync API (`push` / `pull` / `bootstrap`)
- MCP read endpoints (สำหรับ `get_tasks`, `get_projects`, `get_weekly_review`, `search_tasks`, `get_task_changelogs`)
- Auth/session สำหรับ multi-device
- Observability baseline (metrics, logs, alerts)

ไม่นับในรอบนี้:
- detailed vendor pricing commitment
- DR multi-region active-active

## 2) Workload Assumptions (Baseline)

| Profile | Active Devices | Sync Cycles / Device / Day | MCP Read Calls / Day | Notes |
| --- | ---: | ---: | ---: | --- |
| Low | 500 | 60 | 5,000 | internal beta |
| Medium | 5,000 | 72 | 60,000 | expanded beta |
| High | 25,000 | 96 | 400,000 | public rollout |

Notes:
- 1 sync cycle = 1 push + 1 pull request
- มี burst จาก retry/conflict ในบางช่วงเวลา

## 3) Option A: Lambda-First

## Topology
- API Gateway (HTTP API)
- Lambda (sync handlers + MCP handlers)
- DynamoDB (cursor/outbox/conflict/session state) หรือ RDS สำหรับ relational-heavy paths
- Cognito (user + device auth)
- CloudWatch (metrics/logs/alarms)

## Strengths
- เริ่มเร็ว, ต้นทุนต่ำในช่วง low-to-medium
- scale ตาม usage อัตโนมัติ
- เหมาะกับ workload ที่เป็น burst + idle

## Risks
- cold start/p95 latency ต้อง monitor ใกล้ชิด
- query/report ที่ซับซ้อนอาจดันต้นทุน/latency

## 4) Option B: Service-First (ECS Fargate)

## Topology
- ALB + ECS Fargate service (sync + MCP API)
- RDS Postgres (transactional + relational query)
- Cognito
- CloudWatch

## Strengths
- latency/predictability ควบคุมง่ายกว่าในโหลดต่อเนื่อง
- เหมาะกับ query ที่มี join/aggregation หนัก

## Risks
- fixed cost สูงกว่าในช่วง early beta
- ops complexity สูงกว่า (capacity/scaling tuning)

## 5) Cost Baseline (Directional Monthly Estimate, USD)

ช่วงตัวเลขนี้ใช้เพื่อเทียบทางเลือก ไม่ใช่ราคาผูกมัด:

| Environment | Lambda-First | Service-First |
| --- | ---: | ---: |
| Dev | 40 - 120 | 140 - 320 |
| Staging | 80 - 220 | 220 - 520 |
| Prod (Low) | 250 - 700 | 650 - 1,400 |
| Prod (Medium) | 900 - 2,400 | 1,700 - 3,800 |
| Prod (High) | 3,500 - 9,500 | 5,500 - 12,000 |

## 6) Security Baseline Checklist

- IAM แยก role ต่อ service ชัดเจน (least privilege)
- secrets ผ่าน AWS Secrets Manager / SSM Parameter Store
- TLS in transit และ encryption at rest ครบทุก storage
- audit log สำหรับ auth event, sync mutation, MCP tool call
- WAF/rate-limit baseline สำหรับ public endpoints
- backup + restore playbook สำหรับ data store หลัก

## 7) Recommendation

แนะนำ `Lambda-First` เป็น baseline สำหรับ dev/staging และ prod ระยะ early rollout โดยกำหนด migration trigger ไป `Service-First` เมื่อเข้าเงื่อนไขต่อไปนี้:

- sustained throughput สูงต่อเนื่อง (เช่น > 60 RPS แบบยาว)
- p95 API latency เกิน 800ms อย่างต่อเนื่อง
- workload MCP/reporting เริ่มพึ่ง relational query หนักจนต้นทุนไม่คุ้ม

## 8) Follow-up Tasks

1. ทำ infra decision memo แบบ sign-off (owner + date)
2. สร้าง Terraform/CDK skeleton สำหรับ profile ที่เลือก
3. ทำ load test baseline (Low/Medium profile) ก่อน deploy staging จริง

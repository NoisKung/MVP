# MCP AWS Hosted Profile v0.1

Date: 2026-02-23  
Status: Baseline profile for evaluation (not final production commitment)

## 1) Objective

กำหนด baseline สำหรับโฮสต์ `mcp-solostack` บน AWS ในกรณีที่ต้องการโหมด cloud (นอกเหนือจาก local sidecar)

## 2) Deployment Modes

1. Local sidecar (default)
- รันบนเครื่องเดียวกับแอป/agent
- latency ต่ำสุด, operational overhead ต่ำสุด
- เหมาะกับ single-user local workflow

2. AWS hosted
- เปิดใช้งานผ่าน public/private endpoint
- รองรับ centralized auth, observability และ multi-agent access
- มีต้นทุนและ security surface สูงขึ้น

## 3) Recommended AWS Baseline (Lambda-first)

- API: API Gateway HTTP API
- Runtime: AWS Lambda (Node.js 22+)
- Data source:
  - Option A: attach/read SQLite snapshot จาก controlled storage (เฉพาะ use case ที่ยอมรับ read-only snapshot)
  - Option B: replicate data ไป store กลางที่ query ได้ (เช่น RDS) สำหรับ hosted-first architecture
- Auth: Cognito + JWT authorizer (ขั้นต่ำ)
- Secrets/config: AWS Secrets Manager หรือ SSM Parameter Store
- Observability: CloudWatch Logs + Metrics + Alarms

## 4) Hosted API Surface

- `GET /health`
- `POST /tools/get_tasks`
- `POST /tools/get_projects`
- `POST /tools/get_weekly_review`
- `POST /tools/search_tasks`
- `POST /tools/get_task_changelogs`
- `POST /tools` (generic route)

## 5) Security Baseline

- enforce TLS ทุก endpoint
- require auth token สำหรับทุก `/tools*` route
- rate limit ต่อ principal
- บันทึก audit log ต่อ tool call (`request_id`, `tool`, `duration_ms`, `status_code`)
- Audit sink decision v0.1:
  - local/staging default: file sink รายวัน (`mcp-tool-call-YYYY-MM-DD.log`)
  - retention baseline: 30 วัน (ปรับตาม environment policy ได้)
  - hosted production: ship ต่อเข้า centralized sink (CloudWatch/S3/OpenSearch) ก่อน scale-out
- apply least-privilege IAM แยกตาม component

## 6) Operational Guardrails

- default timeout ต่อ tool call <= 2s (soft target)
- enforce `limit` bounds ตาม contract v0.1
- error envelope เดียวกับ local runtime
- alarm เมื่อ `5xx` หรือ latency เกิน threshold ต่อเนื่อง

## 7) Rollout Plan

1. Phase 0: Local-only (current)
2. Phase 1: Private hosted staging บน AWS + synthetic tests
3. Phase 2: Limited beta tenants + telemetry review
4. Phase 3: Production rollout เมื่อผ่าน latency/error/cost gate

## 8) Hosted Load/Perf Runbook (v0.1)

คำสั่งรัน matrix บน hosted endpoint:

```bash
SOLOSTACK_MCP_HOSTED_BASE_URL=https://<hosted-endpoint> \
SOLOSTACK_MCP_HOSTED_AUTH_TOKEN=<token> \
npm run mcp:load-matrix:hosted
```

คำสั่งเทียบผลกับ local baseline:

```bash
npm run mcp:load-matrix:compare
```

Artifacts:
- hosted run: `docs/mcp-load-matrix-hosted-staging-v0.1.md`
- compare report: `docs/mcp-load-matrix-hosted-compare-v0.1.md`

## 9) Open Questions

- hosted mode จะอ่านจาก source-of-truth ใด (SQLite snapshot vs replicated store)
- auth model ระหว่าง human user กับ agent principal
- tenancy isolation และ audit retention policy

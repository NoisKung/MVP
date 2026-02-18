# Telemetry Spec v0.1 (Desktop + Cloud)

Date: 2026-02-18  
Status: Baseline for beta implementation

## 1) Goals

- มองเห็นสุขภาพระบบ sync แบบใกล้ real-time
- จับสัญญาณ data safety risk ให้เร็ว
- วัดคุณภาพ connector และ MCP read path แบบเทียบข้าม provider ได้

## 2) Common Event Envelope

ทุก event/metric record ใช้ fields กลาง:

- `timestamp_iso` (ISO-8601 UTC)
- `event_name`
- `severity` (`info` | `warn` | `error`)
- `app_version`
- `build_channel` (`dev` | `staging` | `prod`)
- `platform` (`macos` | `windows` | `linux` | `ios` | `android`)
- `device_id_hash` (hash เท่านั้น)
- `session_id`
- `trace_id`
- `provider` (`local_only` | `google_appdata` | `onedrive_approot` | `aws_sync_api`)
- `attributes` (JSON object, bounded keys)

## 3) Metric Groups

## A. Sync Health

- `sync_cycle_total` (counter)
- `sync_cycle_success_total` (counter)
- `sync_cycle_failure_total` (counter)
- `sync_cycle_duration_ms` (histogram)
- `sync_push_changes_total` (counter)
- `sync_pull_applied_total` (counter)
- `sync_pull_conflicts_total` (counter)
- `sync_failure_streak` (gauge)

## B. Conflict Lifecycle

- `conflict_opened_total` (counter)
- `conflict_resolved_total` (counter)
- `conflict_ignored_total` (counter)
- `conflict_retried_total` (counter)
- `conflict_exported_total` (counter)
- `conflict_open_current` (gauge)
- `conflict_resolution_time_ms` (histogram)
- `conflict_resolution_rate_percent` (gauge)

## C. Connector Reliability

- `connector_request_total` (counter, labels: `provider`, `endpoint`, `status_class`)
- `connector_error_total` (counter, labels: `provider`, `error_code`)
- `connector_retry_after_ms` (histogram)
- `connector_latency_ms` (histogram)
- `connector_rate_limited_total` (counter)

## D. MCP Runtime

- `mcp_tool_call_total` (counter, labels: `tool`, `status`)
- `mcp_tool_latency_ms` (histogram, labels: `tool`)
- `mcp_tool_timeout_total` (counter, labels: `tool`)
- `mcp_guardrail_reject_total` (counter, labels: `reason`)

## 4) Alert Baseline (Beta)

Critical:
- `sync_cycle_failure_rate_15m > 20%` และ `sync_cycle_total_15m >= 30`
- `conflict_open_current > 100` หรือเพิ่มขึ้น > 50% ใน 24h
- `connector_error_total{error_code=unauthorized} >= 5` ใน 10m

Warning:
- `p95(sync_cycle_duration_ms) > 3000` ต่อเนื่อง 30m
- `p95(mcp_tool_latency_ms{tool=get_tasks}) > 2000` ต่อเนื่อง 30m
- `connector_rate_limited_total` พุ่งเกิน baseline 3x ภายใน 1h

## 5) Sampling and Retention

- Critical + error events: เก็บ 100%
- Normal info events: sample 20% (ยกเว้นช่วง incident ปรับเป็น 100%)
- Debug detail: sample 5%, retention สั้น

Retention:
- hot metrics/logs: 30-90 วัน
- archive: 365 วัน สำหรับ trend/compliance

## 6) Privacy and Security

- ห้ามส่ง payload เนื้อหา task เต็มขึ้น telemetry โดยตรง
- เก็บเฉพาะ ID hash / counts / timing / status code
- redact fields ที่อาจมีข้อมูลส่วนบุคคลก่อนส่งทุกครั้ง

## 7) Mapping: Existing Local -> Cloud

Local diagnostics ที่มีแล้ว:
- `success_rate_percent`
- `last_cycle_duration_ms`
- `average_cycle_duration_ms`
- `failed_cycles`
- `consecutive_failures`
- `conflict_cycles`

Conflict observability ที่มีแล้ว:
- `total_conflicts`, `open_conflicts`, `resolved_conflicts`, `ignored_conflicts`
- `retried_events`, `exported_events`
- `resolution_rate_percent`, `median_resolution_time_ms`

Mapping baseline:
- ส่งทุกค่าเข้า metrics กลุ่ม A/B โดยยึดชื่อมาตรฐานด้านบน
- เพิ่ม dimensions: `app_version`, `platform`, `provider`

## 8) Implementation Sequence

1. Freeze schema + naming
2. Add client-side telemetry emitter interface (no-op default)
3. Wire sync lifecycle metrics
4. Wire conflict lifecycle metrics
5. Wire connector + MCP metrics
6. Enable cloud export per environment flag

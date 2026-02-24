# Sync Provider Secure Store Validation Matrix v0.1

Date: 2026-02-24  
Status: Ready for real-device execution

## 1) Scope

Validate secure token storage behavior for managed sync provider auth on:
- macOS desktop (Tauri)
- iOS (Tauri mobile)
- Android (Tauri mobile)

This matrix verifies:
- secure-store backend availability
- write/read/delete roundtrip via self-test
- token redaction in SQLite/backup payload

## 2) Build Requirement

- Branch includes command `run_sync_provider_secure_store_self_test`
- UI includes `Settings > Sync > Verify Secure Store`
- Local tests/build should pass:
  - `npm run test -- --run src/lib/sync-provider-secure-store.test.ts src/lib/i18n.catalog.test.ts`
  - `npm run build`
  - `cargo check --manifest-path src-tauri/Cargo.toml`

## 3) Device Matrix

| Platform | Device/OS | Expected backend | Expected self-test result |
| --- | --- | --- | --- |
| macOS | any supported desktop | `keyring` | `roundtrip_ok = true` |
| iOS | real device (latest supported) | `keyring` | `roundtrip_ok = true` |
| Android | real device (latest supported) | `android_encrypted_shared_prefs` | `roundtrip_ok = true` |

## 4) Test Procedure (per device)

1. Open `Settings > Sync`.
2. Select managed provider (`Google AppData` or `OneDrive AppRoot`).
3. Click `Verify Secure Store`.
4. Record feedback/error shown in UI.
5. If available, capture result payload from logs/console for:
   - `backend`
   - `available`
   - `write_ok`, `read_ok`, `delete_ok`, `roundtrip_ok`
6. Enter managed auth sample in provider form and save.
7. Export backup payload.
8. Confirm sensitive fields are redacted from persisted `provider_config.managed_auth`:
   - `access_token` absent
   - `refresh_token` absent
   - `client_secret` absent
   - `managed_auth_storage_policy` present

## 5) Pass/Fail Criteria

- Pass:
  - self-test reports `roundtrip_ok = true`
  - backend matches expected platform value
  - persisted config keeps redaction guarantees
- Fail:
  - self-test unavailable on Tauri runtime
  - any of `write_ok/read_ok/delete_ok` is false
  - sensitive token fields appear in SQLite/backup payload

## 6) Evidence Template

For each device, store:
- device model + OS version
- app build identifier
- screenshot of `Verify Secure Store` result
- backup redaction proof snippet
- final verdict (`PASS`/`FAIL`)

## 7) Known Notes

- Browser runtime is expected to report secure-store unavailable (`non_tauri` / `unsupported`).
- Self-test uses an isolated secure-store key and does not overwrite managed provider tokens.

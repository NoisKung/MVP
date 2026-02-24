# Cloud Provider Setup Guide (TH) v0.1

Date: 2026-02-23  
Status: ใช้กับ implementation ปัจจุบันใน repo นี้

## 1) วัตถุประสงค์

เอกสารนี้อธิบายวิธีตั้งค่า Sync Provider ใน SoloStack พร้อมตัวอย่าง config สำหรับ:
- `provider_neutral` (custom push/pull endpoints)
- `google_appdata` (managed connector path)
- `onedrive_approot` (managed connector path)
- `icloud_cloudkit` (managed capability placeholder)
- `solostack_cloud_aws` (managed capability placeholder)

## 2) Provider Matrix (สถานะจริง)

| Provider | UI Endpoint Mode | Managed Connector Settings Form | Runtime Transport ที่ใช้งานจริง |
| --- | --- | --- | --- |
| `provider_neutral` | custom | ไม่มี | ใช้ `push_url` + `pull_url` |
| `google_appdata` | managed | มี | ใช้ managed connector ถ้าตั้ง `managed_base_url` |
| `onedrive_approot` | managed | มี | ใช้ managed connector ถ้าตั้ง `managed_base_url` |
| `icloud_cloudkit` | managed | ไม่มี (ยังไม่เปิด) | fallback ไป custom endpoints |
| `solostack_cloud_aws` | managed | ไม่มี (ยังไม่เปิด) | fallback ไป custom endpoints |

หมายเหตุ:
- ถ้า provider เป็น managed แต่ไม่มี transport พร้อม จะได้สถานะ `provider_unavailable`
- สำหรับ `icloud_cloudkit` และ `solostack_cloud_aws` ตอนนี้ต้องตั้ง `push_url`/`pull_url` เพื่อใช้งานจริง

## 3) ไปตั้งค่าที่ไหนในแอป

1. เปิด `Settings > Sync`
2. เลือกค่าใน `Sync Provider`
3. กด `Save Provider`
4. ตั้งค่า endpoint หรือ managed connector ตาม provider ที่เลือก
5. กด `Sync now` เพื่อทดสอบ

## 4) ตัวอย่างการตั้งค่าแบบ `provider_neutral`

เหมาะกับกรณีมี backend sync ของตัวเอง

ตัวอย่างใน UI:
- Provider: `provider_neutral`
- Push URL: `https://sync.example.com/v1/sync/push`
- Pull URL: `https://sync.example.com/v1/sync/pull`

ตัวอย่างค่าที่ persist:

```json
{
  "local.sync.provider": "provider_neutral",
  "local.sync.provider_config": {
    "endpoint_mode": "custom",
    "auth_requirement": "No provider account required"
  },
  "local.sync.push_url": "https://sync.example.com/v1/sync/push",
  "local.sync.pull_url": "https://sync.example.com/v1/sync/pull"
}
```

## 5) ตัวอย่างการตั้งค่าแบบ `google_appdata`

### 5.1 กรณีใช้ managed connector

ตัวอย่างใน UI:
- Provider: `google_appdata`
- Connector Base URL: `https://connector.example.com`
- Access Token: `<google-access-token>`
- Refresh Token: `<google-refresh-token>`
- Token Refresh URL: `https://oauth2.googleapis.com/token`
- Scope: `https://www.googleapis.com/auth/drive.appdata`
- Client ID: `<google-client-id>`
- Client Secret: `<google-client-secret>`
- กด `Test Connector`
- กด `Save Provider`

ตัวอย่าง `provider_config` ที่ถูก persist (redacted):

```json
{
  "endpoint_mode": "managed",
  "auth_requirement": "Google OAuth required",
  "managed_base_url": "https://connector.example.com",
  "managed_auth": {
    "token_type": "Bearer",
    "token_refresh_url": "https://oauth2.googleapis.com/token",
    "expires_at": "2026-02-24T10:00:00.000Z",
    "scope": "https://www.googleapis.com/auth/drive.appdata",
    "client_id": "<google-client-id>"
  },
  "managed_auth_storage_policy": "desktop_secure_keystore"
}
```

ตัวอย่าง runtime view (hydrated ระหว่าง session เดียวกัน):

```json
{
  "endpoint_mode": "managed",
  "managed_base_url": "https://connector.example.com",
  "managed_auth": {
    "access_token": "<google-access-token>",
    "token_type": "Bearer",
    "refresh_token": "<google-refresh-token>",
    "token_refresh_url": "https://oauth2.googleapis.com/token",
    "expires_at": "2026-02-24T10:00:00.000Z",
    "scope": "https://www.googleapis.com/auth/drive.appdata",
    "client_id": "<google-client-id>",
    "client_secret": "<google-client-secret>"
  },
  "managed_auth_storage_policy": "desktop_secure_keystore"
}
```

### 5.2 ข้อควรทราบ

- sensitive fields (`access_token`, `refresh_token`, `client_secret`) ไม่ถูกเก็บลง SQLite/backup
- บน Tauri desktop จะเก็บ managed auth ผ่าน secure keystore ของระบบปฏิบัติการ และใช้งานต่อได้หลัง restart
- runtime อื่นยังเป็น session-only และต้อง re-auth/re-input token หลัง restart

## 6) ตัวอย่างการตั้งค่าแบบ `onedrive_approot`

### 6.1 กรณีใช้ managed connector

ตัวอย่างใน UI:
- Provider: `onedrive_approot`
- Connector Base URL: `https://connector.example.com`
- Access Token: `<microsoft-access-token>`
- Refresh Token: `<microsoft-refresh-token>`
- Token Refresh URL: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- Scope: `Files.ReadWrite.AppFolder offline_access`
- Client ID: `<microsoft-client-id>`
- Client Secret: `<microsoft-client-secret>`
- กด `Test Connector`
- กด `Save Provider`

ตัวอย่าง persisted config (redacted):

```json
{
  "endpoint_mode": "managed",
  "auth_requirement": "Microsoft OAuth required",
  "managed_base_url": "https://connector.example.com",
  "managed_auth": {
    "token_type": "Bearer",
    "token_refresh_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    "scope": "Files.ReadWrite.AppFolder offline_access",
    "client_id": "<microsoft-client-id>"
  },
  "managed_auth_storage_policy": "desktop_secure_keystore"
}
```

## 7) ตัวอย่างการตั้งค่า `icloud_cloudkit`

สถานะปัจจุบัน:
- ใน UI เลือก provider ได้ แต่ยังไม่มี managed connector form
- transport managed adapter ยังไม่เปิดใช้งาน

แนวทางใช้งานตอนนี้:
- ตั้ง provider เป็น `icloud_cloudkit`
- ตั้ง `push_url` และ `pull_url` เป็น backend ที่รองรับ contract เดิม

ตัวอย่าง:

```json
{
  "local.sync.provider": "icloud_cloudkit",
  "local.sync.provider_config": {
    "endpoint_mode": "managed",
    "auth_requirement": "Apple ID + iCloud permission required"
  },
  "local.sync.push_url": "https://sync.example.com/v1/sync/push",
  "local.sync.pull_url": "https://sync.example.com/v1/sync/pull"
}
```

## 8) ตัวอย่างการตั้งค่า `solostack_cloud_aws`

สถานะปัจจุบัน:
- ใน UI เลือก provider ได้ แต่ยังไม่มี managed connector form
- runtime จะ fallback ไป custom endpoints

ตัวอย่าง:

```json
{
  "local.sync.provider": "solostack_cloud_aws",
  "local.sync.provider_config": {
    "endpoint_mode": "managed",
    "auth_requirement": "SoloStack Cloud account required",
    "managed_available": true
  },
  "local.sync.push_url": "https://sync.cloud.solostack.com/v1/sync/push",
  "local.sync.pull_url": "https://sync.cloud.solostack.com/v1/sync/pull"
}
```

## 9) Troubleshooting แบบเร็ว

1. เลือก provider แล้วขึ้น `provider_unavailable`
- ตรวจว่า provider นั้นมี transport พร้อมหรือไม่
- ถ้าเป็น `icloud_cloudkit` / `solostack_cloud_aws` ให้ตั้ง custom endpoints เพิ่ม

2. กด `Test Connector` แล้ว error
- ตรวจ `managed_base_url` ว่า reachable จริง
- ตรวจ token และ refresh URL ให้ถูก provider
- ตรวจ connector gateway ว่ารองรับ RPC key contract

3. sync หลุดหลัง restart
- ตรวจสิทธิ์/ความพร้อมของ secure keystore บน desktop
- ถ้าเป็น runtime ที่ไม่ใช่ desktop ปัจจุบันยังใช้ token แบบ session-only และต้อง re-auth/re-input ใหม่

## 10) เอกสารที่เกี่ยวข้อง

- Cloud Provider Setup (EN): `docs/cloud-provider-setup-v0.1.en.md`
- Deep dive (TH): `docs/sync-deep-dive-v0.1.th.md`
- Deep dive (EN): `docs/sync-deep-dive-v0.1.en.md`
- Backend API examples: `docs/sync-backend-api-examples-v0.1.md`

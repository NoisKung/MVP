# Cloud Provider Setup Guide (EN) v0.1

Date: 2026-02-23  
Status: Aligned with current implementation in this repository

## 1) Purpose

This guide explains how to configure Sync Providers in SoloStack, with concrete config examples for:
- `provider_neutral` (custom push/pull endpoints)
- `google_appdata` (managed connector path)
- `onedrive_approot` (managed connector path)
- `icloud_cloudkit` (managed capability placeholder)
- `solostack_cloud_aws` (managed capability placeholder)

## 2) Provider Matrix (Current Runtime Behavior)

| Provider | UI Endpoint Mode | Managed Connector Settings Form | Runtime Transport Actually Used |
| --- | --- | --- | --- |
| `provider_neutral` | custom | No | Uses `push_url` + `pull_url` |
| `google_appdata` | managed | Yes | Uses managed connector when `managed_base_url` is set |
| `onedrive_approot` | managed | Yes | Uses managed connector when `managed_base_url` is set |
| `icloud_cloudkit` | managed | No (not enabled yet) | Falls back to custom endpoints |
| `solostack_cloud_aws` | managed | No (not enabled yet) | Falls back to custom endpoints |

Notes:
- If a provider is managed but no transport is available, status can become `provider_unavailable`.
- For `icloud_cloudkit` and `solostack_cloud_aws`, you currently need custom `push_url`/`pull_url` for working sync.

## 3) Where to Configure in the App

1. Open `Settings > Sync`
2. Choose a value in `Sync Provider`
3. Click `Save Provider`
4. Configure endpoints or managed connector fields based on the selected provider
5. Click `Sync now` to validate behavior

## 4) `provider_neutral` Configuration Example

Use this when you run your own sync backend.

UI example:
- Provider: `provider_neutral`
- Push URL: `https://sync.example.com/v1/sync/push`
- Pull URL: `https://sync.example.com/v1/sync/pull`

Persisted settings example:

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

## 5) `google_appdata` Configuration Example

### 5.1 Managed connector setup

UI example:
- Provider: `google_appdata`
- Connector Base URL: `https://connector.example.com`
- Access Token: `<google-access-token>`
- Refresh Token: `<google-refresh-token>`
- Token Refresh URL: `https://oauth2.googleapis.com/token`
- Scope: `https://www.googleapis.com/auth/drive.appdata`
- Client ID: `<google-client-id>`
- Client Secret: `<google-client-secret>`
- Click `Test Connector`
- Click `Save Provider`

Persisted `provider_config` example (redacted):

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

Runtime view example (hydrated during the same app session):

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

### 5.2 Security behavior

- Sensitive fields (`access_token`, `refresh_token`, `client_secret`) are not persisted to SQLite/backup.
- On Tauri desktop, managed auth is persisted via OS secure keystore and can survive restart.
- On other runtimes, managed auth stays session-only and must be re-entered after restart.

## 6) `onedrive_approot` Configuration Example

### 6.1 Managed connector setup

UI example:
- Provider: `onedrive_approot`
- Connector Base URL: `https://connector.example.com`
- Access Token: `<microsoft-access-token>`
- Refresh Token: `<microsoft-refresh-token>`
- Token Refresh URL: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- Scope: `Files.ReadWrite.AppFolder offline_access`
- Client ID: `<microsoft-client-id>`
- Client Secret: `<microsoft-client-secret>`
- Click `Test Connector`
- Click `Save Provider`

Persisted `provider_config` example (redacted):

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

## 7) `icloud_cloudkit` Configuration Example

Current state:
- Provider can be selected in UI.
- Managed connector settings form is not enabled yet for this provider.
- Managed adapter transport is not active yet.

Current working approach:
- Select provider `icloud_cloudkit`
- Configure `push_url` and `pull_url` to your compatible sync backend

Example:

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

## 8) `solostack_cloud_aws` Configuration Example

Current state:
- Provider can be selected in UI.
- Managed connector settings form is not enabled yet for this provider.
- Runtime falls back to custom endpoints.

Example:

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

## 9) Quick Troubleshooting

1. Provider selected but status becomes `provider_unavailable`
- Verify whether runtime transport is available for that provider.
- For `icloud_cloudkit` / `solostack_cloud_aws`, configure custom endpoints for now.

2. `Test Connector` fails
- Verify `managed_base_url` is reachable.
- Verify token and token refresh URL for the selected provider.
- Verify connector gateway supports SoloStack RPC key contract.

3. Managed sync breaks after restart
- Check secure keystore availability/permissions on desktop.
- Non-desktop runtimes currently use session-only auth, so re-auth/re-enter token after restart.

## 10) Related Docs

- Cloud Provider Setup (TH): `docs/cloud-provider-setup-v0.1.th.md`
- Sync Deep Dive (TH): `docs/sync-deep-dive-v0.1.th.md`
- Sync Deep Dive (EN): `docs/sync-deep-dive-v0.1.en.md`
- Backend API examples: `docs/sync-backend-api-examples-v0.1.md`

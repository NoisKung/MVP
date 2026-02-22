# P3-2 Mobile Beta Core Readiness v0.1

Updated: 2026-02-20

## Scope

This checklist covers shared-core readiness in this repository, not the standalone mobile app UI implementation.

## Completed

- Shared sync contract is provider-neutral and reused across desktop/mobile runtime targets.
- Runtime profile system supports `desktop` and `mobile_beta` presets with bounded validation.
- Mobile-aware runtime seed is available via preset detection path.
- Mobile preset detection is hardened for modern runtime signals:
  - `userAgentData.mobile` support
  - iPadOS desktop-style UA (`Macintosh`) detection via touch-point heuristic
- Runtime preset diagnostics now record detection source:
  - `user_agent_data_mobile`, `user_agent_pattern`, `platform_pattern`, `ipad_touch_heuristic`, `fallback_desktop`
- Conflict report export attaches sync session diagnostics snapshot for support analysis.
- Settings diagnostics now include latest history snapshots for quick cross-session triage.
- Full diagnostics history view supports search, source/date filtering, and row limit controls.
- Sync diagnostics surfaces provider/profile/warning and validation counters.
- Tests covering mobile/runtime behavior are in place:
  - `src/lib/runtime-platform.test.ts`
  - `src/hooks/use-sync.test.ts`
  - `src/lib/database.migration.test.ts`
  - `e2e/sync-runtime-profile.spec.ts`

## Remaining (outside this repo’s shared-core scope)

- Build and ship dedicated iOS/Android client UI surfaces for P3-2 beta.
- Validate cross-device desktop↔mobile sync against real mobile client builds.
- Complete mobile UX parity target for `Today`, `Upcoming`, and `Board`.

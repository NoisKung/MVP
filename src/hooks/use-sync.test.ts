import {
  appendSyncSessionDiagnostics,
  calculateSyncBackoffMs,
  createInitialSyncSessionDiagnostics,
  getAutoSyncIntervalMsForVisibility,
  normalizeSyncRuntimeProfile,
} from "@/hooks/use-sync";

describe("use-sync helpers", () => {
  it("returns 0 when there are no failures", () => {
    expect(calculateSyncBackoffMs(0)).toBe(0);
    expect(calculateSyncBackoffMs(-1)).toBe(0);
  });

  it("increases delay exponentially", () => {
    expect(calculateSyncBackoffMs(1)).toBe(5_000);
    expect(calculateSyncBackoffMs(2)).toBe(10_000);
    expect(calculateSyncBackoffMs(3)).toBe(20_000);
    expect(calculateSyncBackoffMs(4)).toBe(40_000);
  });

  it("caps backoff at max delay", () => {
    expect(calculateSyncBackoffMs(9)).toBe(300_000);
    expect(calculateSyncBackoffMs(20)).toBe(300_000);
  });
});

describe("sync runtime profile", () => {
  it("uses defaults when runtime values are not provided", () => {
    expect(normalizeSyncRuntimeProfile({})).toEqual({
      autoSyncIntervalMs: 60_000,
      backgroundSyncIntervalMs: 300_000,
      pushLimit: 200,
      pullLimit: 200,
      maxPullPages: 5,
    });
  });

  it("clamps values into safe bounds", () => {
    expect(
      normalizeSyncRuntimeProfile({
        autoSyncIntervalMs: 8_000,
        backgroundSyncIntervalMs: 9_000,
        pushLimit: 10,
        pullLimit: 1_000,
        maxPullPages: 0,
      }),
    ).toEqual({
      autoSyncIntervalMs: 15_000,
      backgroundSyncIntervalMs: 30_000,
      pushLimit: 20,
      pullLimit: 500,
      maxPullPages: 1,
    });
  });

  it("forces background interval to be >= foreground interval", () => {
    expect(
      normalizeSyncRuntimeProfile({
        autoSyncIntervalMs: 120_000,
        backgroundSyncIntervalMs: 45_000,
      }),
    ).toMatchObject({
      autoSyncIntervalMs: 120_000,
      backgroundSyncIntervalMs: 120_000,
    });
  });

  it("uses foreground interval when visible and background when hidden", () => {
    const runtimeProfile = normalizeSyncRuntimeProfile({
      autoSyncIntervalMs: 45_000,
      backgroundSyncIntervalMs: 90_000,
    });

    expect(getAutoSyncIntervalMsForVisibility(true, runtimeProfile)).toBe(
      45_000,
    );
    expect(getAutoSyncIntervalMsForVisibility(false, runtimeProfile)).toBe(
      90_000,
    );
  });
});

describe("sync session diagnostics", () => {
  it("starts with empty diagnostics snapshot", () => {
    expect(createInitialSyncSessionDiagnostics()).toEqual({
      total_cycles: 0,
      successful_cycles: 0,
      failed_cycles: 0,
      conflict_cycles: 0,
      consecutive_failures: 0,
      success_rate_percent: 0,
      last_cycle_duration_ms: null,
      average_cycle_duration_ms: null,
      last_attempt_at: null,
      last_success_at: null,
    });
  });

  it("updates diagnostics on successful cycle", () => {
    const initial = createInitialSyncSessionDiagnostics();
    const updated = appendSyncSessionDiagnostics(initial, {
      outcome: "success",
      attemptedAt: "2026-02-17T12:00:00.000Z",
      durationMs: 420,
      hasConflict: false,
    });

    expect(updated).toMatchObject({
      total_cycles: 1,
      successful_cycles: 1,
      failed_cycles: 0,
      conflict_cycles: 0,
      consecutive_failures: 0,
      success_rate_percent: 100,
      last_cycle_duration_ms: 420,
      average_cycle_duration_ms: 420,
      last_attempt_at: "2026-02-17T12:00:00.000Z",
      last_success_at: "2026-02-17T12:00:00.000Z",
    });
  });

  it("increments conflict counter when success has conflicts", () => {
    const updated = appendSyncSessionDiagnostics(
      createInitialSyncSessionDiagnostics(),
      {
        outcome: "success",
        attemptedAt: "2026-02-17T12:00:00.000Z",
        durationMs: 800,
        hasConflict: true,
      },
    );

    expect(updated.conflict_cycles).toBe(1);
  });

  it("tracks failure streak and keeps last success timestamp", () => {
    const success = appendSyncSessionDiagnostics(
      createInitialSyncSessionDiagnostics(),
      {
        outcome: "success",
        attemptedAt: "2026-02-17T12:00:00.000Z",
        durationMs: 500,
      },
    );
    const failed = appendSyncSessionDiagnostics(success, {
      outcome: "failure",
      attemptedAt: "2026-02-17T12:01:00.000Z",
      durationMs: 300,
    });

    expect(failed).toMatchObject({
      total_cycles: 2,
      successful_cycles: 1,
      failed_cycles: 1,
      consecutive_failures: 1,
      success_rate_percent: 50,
      average_cycle_duration_ms: 400,
      last_attempt_at: "2026-02-17T12:01:00.000Z",
      last_success_at: "2026-02-17T12:00:00.000Z",
    });
  });
});

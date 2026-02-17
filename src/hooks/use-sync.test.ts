import { calculateSyncBackoffMs } from "@/hooks/use-sync";

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

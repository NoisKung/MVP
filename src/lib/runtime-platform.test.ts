import { detectSyncRuntimeProfilePreset } from "./runtime-platform";

describe("runtime platform profile detection", () => {
  it("detects Android user agents as mobile", () => {
    expect(
      detectSyncRuntimeProfilePreset(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36",
      ),
    ).toBe("mobile");
  });

  it("detects iOS user agents as mobile", () => {
    expect(
      detectSyncRuntimeProfilePreset(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("mobile");
  });

  it("detects desktop user agents as desktop", () => {
    expect(
      detectSyncRuntimeProfilePreset(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36",
      ),
    ).toBe("desktop");
  });

  it("defaults to desktop for empty or unknown user agents", () => {
    expect(detectSyncRuntimeProfilePreset("")).toBe("desktop");
    expect(detectSyncRuntimeProfilePreset("SomeCustomRuntime/1.0")).toBe(
      "desktop",
    );
  });
});

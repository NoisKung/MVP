import {
  detectSyncRuntimeProfilePreset,
  detectSyncRuntimeProfilePresetWithSource,
} from "./runtime-platform";

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

  it("detects userAgentData.mobile as mobile", () => {
    expect(
      detectSyncRuntimeProfilePreset({
        userAgent: "SomeCustomRuntime/2.0",
        userAgentDataMobile: true,
      }),
    ).toBe("mobile");
    expect(
      detectSyncRuntimeProfilePresetWithSource({
        userAgent: "SomeCustomRuntime/2.0",
        userAgentDataMobile: true,
      }),
    ).toEqual({
      preset: "mobile",
      source: "user_agent_data_mobile",
    });
  });

  it("detects iPadOS desktop-style UA as mobile when touch points are present", () => {
    expect(
      detectSyncRuntimeProfilePreset({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe("mobile");
    expect(
      detectSyncRuntimeProfilePresetWithSource({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toEqual({
      preset: "mobile",
      source: "ipad_touch_heuristic",
    });
  });

  it("keeps desktop preset for macintosh UA without touch points", () => {
    expect(
      detectSyncRuntimeProfilePreset({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe("desktop");
    expect(
      detectSyncRuntimeProfilePresetWithSource({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toEqual({
      preset: "desktop",
      source: "fallback_desktop",
    });
  });

  it("records user-agent pattern source", () => {
    expect(
      detectSyncRuntimeProfilePresetWithSource(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36",
      ),
    ).toEqual({
      preset: "mobile",
      source: "user_agent_pattern",
    });
  });

  it("records platform pattern source", () => {
    expect(
      detectSyncRuntimeProfilePresetWithSource({
        userAgent: "CustomRuntime/1.0",
        platform: "iPhone",
      }),
    ).toEqual({
      preset: "mobile",
      source: "platform_pattern",
    });
  });
});

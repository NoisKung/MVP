import type {
  SyncRuntimePresetDetectionSource,
  SyncRuntimeProfilePreset,
} from "./types";

const MOBILE_USER_AGENT_PATTERN = /(android|iphone|ipad|ipod)/i;
const MOBILE_PLATFORM_PATTERN = /(android|iphone|ipad|ipod)/i;

interface RuntimeProfileDetectionInput {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentDataMobile?: boolean;
}

export interface SyncRuntimeProfilePresetDetectionResult {
  preset: SyncRuntimeProfilePreset;
  source: SyncRuntimePresetDetectionSource;
}

function resolveNavigatorValue<T>(
  value: T | undefined,
  readFallback: () => T | undefined,
): T | undefined {
  if (value !== undefined) return value;
  if (typeof navigator === "undefined") return undefined;
  return readFallback();
}

export function detectSyncRuntimeProfilePreset(
  input?: string | RuntimeProfileDetectionInput,
): SyncRuntimeProfilePreset {
  return detectSyncRuntimeProfilePresetWithSource(input).preset;
}

export function detectSyncRuntimeProfilePresetWithSource(
  input?: string | RuntimeProfileDetectionInput,
): SyncRuntimeProfilePresetDetectionResult {
  const normalizedInput: RuntimeProfileDetectionInput =
    typeof input === "string" ? { userAgent: input } : (input ?? {});

  const resolvedUserAgent =
    resolveNavigatorValue(
      normalizedInput.userAgent,
      () => navigator.userAgent,
    ) ?? "";
  const resolvedPlatform =
    resolveNavigatorValue(normalizedInput.platform, () => navigator.platform) ??
    "";
  const resolvedMaxTouchPoints =
    resolveNavigatorValue(normalizedInput.maxTouchPoints, () =>
      Number.isFinite(navigator.maxTouchPoints) ? navigator.maxTouchPoints : 0,
    ) ?? 0;
  const resolvedUserAgentDataMobile =
    resolveNavigatorValue(normalizedInput.userAgentDataMobile, () => {
      const navWithUAData = navigator as Navigator & {
        userAgentData?: { mobile?: boolean };
      };
      return navWithUAData.userAgentData?.mobile;
    }) ?? false;

  if (resolvedUserAgentDataMobile) {
    return {
      preset: "mobile",
      source: "user_agent_data_mobile",
    };
  }

  if (MOBILE_USER_AGENT_PATTERN.test(resolvedUserAgent)) {
    return {
      preset: "mobile",
      source: "user_agent_pattern",
    };
  }

  if (MOBILE_PLATFORM_PATTERN.test(resolvedPlatform)) {
    return {
      preset: "mobile",
      source: "platform_pattern",
    };
  }

  // iPadOS can report desktop-class UA (Macintosh) while still being touch-first.
  if (
    /macintosh/i.test(resolvedUserAgent) &&
    /mac/i.test(resolvedPlatform) &&
    resolvedMaxTouchPoints > 1
  ) {
    return {
      preset: "mobile",
      source: "ipad_touch_heuristic",
    };
  }

  return {
    preset: "desktop",
    source: "fallback_desktop",
  };
}

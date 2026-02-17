import type { SyncRuntimeProfilePreset } from "./types";

const MOBILE_USER_AGENT_PATTERN = /(android|iphone|ipad|ipod)/i;

export function detectSyncRuntimeProfilePreset(
  userAgent?: string,
): SyncRuntimeProfilePreset {
  const resolvedUserAgent =
    typeof userAgent === "string"
      ? userAgent
      : typeof navigator === "undefined"
        ? ""
        : navigator.userAgent;

  if (MOBILE_USER_AGENT_PATTERN.test(resolvedUserAgent)) {
    return "mobile";
  }

  return "desktop";
}

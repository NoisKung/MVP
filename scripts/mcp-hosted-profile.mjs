import { existsSync, readFileSync } from "node:fs";

export const DEFAULT_HOSTED_PROFILE_CONFIG_PATH =
  "mcp-solostack/hosted-profiles.json";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asOptionalString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function parseOptionalInteger(value, fallback, minValue = 1) {
  const normalized = asOptionalString(value);
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  const intValue = Math.floor(parsed);
  if (intValue < minValue) return fallback;
  return intValue;
}

function parseProfileRecord(value) {
  if (!isObject(value)) return {};
  const parsed = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isObject(raw)) continue;
    parsed[key] = {
      base_url: asOptionalString(raw.base_url) ?? "",
      auth_token: asOptionalString(raw.auth_token) ?? "",
      auth_token_env: asOptionalString(raw.auth_token_env) ?? "",
      iterations: parseOptionalInteger(raw.iterations, 30, 3),
      skip_health_probe: raw.skip_health_probe === true,
    };
  }
  return parsed;
}

export function loadHostedProfileConfig(configPath) {
  const resolvedPath =
    asOptionalString(configPath) ?? DEFAULT_HOSTED_PROFILE_CONFIG_PATH;
  if (!existsSync(resolvedPath)) {
    return {
      config_path: resolvedPath,
      config_found: false,
      active_profile: null,
      profiles: {},
      parse_error: null,
    };
  }

  try {
    const raw = readFileSync(resolvedPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) {
      return {
        config_path: resolvedPath,
        config_found: true,
        active_profile: null,
        profiles: {},
        parse_error: "config root must be a JSON object",
      };
    }
    return {
      config_path: resolvedPath,
      config_found: true,
      active_profile: asOptionalString(parsed.active_profile),
      profiles: parseProfileRecord(parsed.profiles),
      parse_error: null,
    };
  } catch (error) {
    return {
      config_path: resolvedPath,
      config_found: true,
      active_profile: null,
      profiles: {},
      parse_error:
        error instanceof Error
          ? error.message
          : "unable to parse hosted profile config",
    };
  }
}

function hasExplicitScheme(value) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//u.test(value);
}

function isLikelyLoopbackHost(value) {
  const normalized = value.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function inferSchemeForHost(rawHostValue) {
  const hostSegment = rawHostValue.split("/")[0] ?? "";
  const hostWithoutPort = hostSegment.split(":")[0] ?? hostSegment;
  return isLikelyLoopbackHost(hostWithoutPort) ? "http" : "https";
}

export function normalizeHostedBaseUrl(value) {
  const normalized = asOptionalString(value);
  if (!normalized) {
    return {
      value: null,
      valid: false,
      reason: "missing",
      inferred_scheme: null,
    };
  }

  const withScheme = hasExplicitScheme(normalized)
    ? normalized
    : `${inferSchemeForHost(normalized)}://${normalized}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return {
      value: null,
      valid: false,
      reason: "invalid_url",
      inferred_scheme: hasExplicitScheme(normalized)
        ? null
        : inferSchemeForHost(normalized),
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      value: null,
      valid: false,
      reason: "invalid_protocol",
      inferred_scheme: null,
    };
  }
  return {
    value: parsed.toString(),
    valid: true,
    reason: null,
    inferred_scheme: hasExplicitScheme(normalized)
      ? null
      : inferSchemeForHost(normalized),
  };
}

export function isLocalhostHostedUrl(value) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return isLikelyLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function resolveHostedProfileSettings(input = {}) {
  const env = input.env ?? process.env;
  const configState = loadHostedProfileConfig(input.configPath);
  const requestedProfile = asOptionalString(input.profileName);
  const selectedProfileName = requestedProfile ?? configState.active_profile;
  const selectedProfile =
    selectedProfileName && configState.profiles[selectedProfileName]
      ? configState.profiles[selectedProfileName]
      : null;

  const baseUrl =
    asOptionalString(input.baseUrl) ??
    asOptionalString(env.SOLOSTACK_MCP_HOSTED_BASE_URL) ??
    asOptionalString(selectedProfile?.base_url) ??
    "";

  const explicitAuthToken = asOptionalString(input.authToken);
  const envAuthToken = asOptionalString(env.SOLOSTACK_MCP_HOSTED_AUTH_TOKEN);
  const profileAuthToken = asOptionalString(selectedProfile?.auth_token);
  const profileAuthTokenEnvName = asOptionalString(
    selectedProfile?.auth_token_env,
  );
  const profileAuthTokenFromEnv = profileAuthTokenEnvName
    ? asOptionalString(env[profileAuthTokenEnvName])
    : null;
  const authToken =
    explicitAuthToken ??
    envAuthToken ??
    profileAuthToken ??
    profileAuthTokenFromEnv ??
    "";

  const iterations = parseOptionalInteger(
    input.iterations,
    selectedProfile?.iterations ?? 30,
    3,
  );
  const skipHealthProbe =
    input.skipHealthProbe === true || selectedProfile?.skip_health_probe === true;

  return {
    config_path: configState.config_path,
    config_found: configState.config_found,
    config_parse_error: configState.parse_error,
    requested_profile: requestedProfile,
    selected_profile: selectedProfileName,
    selected_profile_found: Boolean(selectedProfile),
    base_url: baseUrl,
    auth_token: authToken,
    auth_token_env_name: profileAuthTokenEnvName,
    iterations,
    skip_health_probe: skipHealthProbe,
  };
}

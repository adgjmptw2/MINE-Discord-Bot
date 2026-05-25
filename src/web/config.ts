import { log } from "@/utils/logger";

export interface WebDashboardConfig {
  enabled: boolean;
  host: string;
  port: number;
  allowedOrigin: string;
  authEnabled: boolean;
  discordOAuthClientId: string | null;
  discordOAuthClientSecret: string | null;
  discordOAuthRedirectUri: string | null;
  sessionSecret: string;
  sessionCookieName: string;
  sessionTtlSeconds: number;
}

let warnedWeakSessionSecret = false;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number(raw.trim()) : fallback;
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function getWebDashboardAllowedOrigin(): string {
  const origin = process.env.WEB_DASHBOARD_ALLOWED_ORIGIN?.trim();
  return origin && origin.length > 0 ? origin : "http://localhost:3000";
}

export function isWebDashboardEnabled(): boolean {
  return process.env.WEB_DASHBOARD_ENABLED?.trim().toLowerCase() === "true";
}

export function isWebDashboardAuthEnabled(): boolean {
  return process.env.WEB_DASHBOARD_AUTH_ENABLED?.trim().toLowerCase() === "true";
}

export function getWebDashboardHost(): string {
  const host = process.env.WEB_DASHBOARD_HOST?.trim();
  return host && host.length > 0 ? host : "127.0.0.1";
}

export function getWebDashboardPort(): number {
  const raw = process.env.WEB_DASHBOARD_PORT?.trim();
  const parsed = raw ? Number(raw) : 3077;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return 3077;
  }
  return parsed;
}

export function getWebDashboardConfig(): WebDashboardConfig {
  const sessionSecret =
    process.env.WEB_DASHBOARD_SESSION_SECRET?.trim() ||
    "change-me-long-random-string";
  const sessionCookieName =
    process.env.WEB_DASHBOARD_SESSION_COOKIE_NAME?.trim() ||
    "mine_soundroom_session";

  return {
    enabled: isWebDashboardEnabled(),
    host: getWebDashboardHost(),
    port: getWebDashboardPort(),
    allowedOrigin: getWebDashboardAllowedOrigin(),
    authEnabled: isWebDashboardAuthEnabled(),
    discordOAuthClientId:
      process.env.DISCORD_OAUTH_CLIENT_ID?.trim() || null,
    discordOAuthClientSecret:
      process.env.DISCORD_OAUTH_CLIENT_SECRET?.trim() || null,
    discordOAuthRedirectUri:
      process.env.DISCORD_OAUTH_REDIRECT_URI?.trim() || null,
    sessionSecret,
    sessionCookieName,
    sessionTtlSeconds: parsePositiveInt(
      process.env.WEB_DASHBOARD_SESSION_TTL_SECONDS,
      21600,
    ),
  };
}

export function isWebDashboardOAuthConfigured(
  config: WebDashboardConfig,
): boolean {
  return Boolean(
    config.discordOAuthClientId &&
      config.discordOAuthClientSecret &&
      config.discordOAuthRedirectUri,
  );
}

export function warnIfWebDashboardSessionSecretWeak(
  config: WebDashboardConfig,
): void {
  if (warnedWeakSessionSecret) {
    return;
  }
  const weak =
    config.sessionSecret === "change-me-long-random-string" ||
    config.sessionSecret.startsWith("change-me");
  if (weak) {
    warnedWeakSessionSecret = true;
    log(
      "warn",
      "web",
      "WEB_DASHBOARD_SESSION_SECRET is still the default; set a long random value before production",
    );
  }
}

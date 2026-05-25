export function isWebDashboardEnabled(): boolean {
  return process.env.WEB_DASHBOARD_ENABLED?.trim().toLowerCase() === "true";
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

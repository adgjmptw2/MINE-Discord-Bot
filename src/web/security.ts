import type { ServerResponse } from "node:http";
import {
  getWebDashboardConfig,
  isWebDashboardSessionSecretStrong,
  type WebDashboardConfig,
} from "@/web/config";
import { sendError } from "@/web/http";

// 운영: 세션 시크릿 강도(AUTH API)
export function isWebDashboardAuthSecurityReady(
  config: WebDashboardConfig,
): boolean {
  if (!config.requireStrongSessionSecret) {
    return true;
  }
  return isWebDashboardSessionSecretStrong(config);
}

export function sendSessionSecretWeakError(res: ServerResponse): void {
  sendError(
    res,
    503,
    "SESSION_SECRET_WEAK",
    "운영용 세션 시크릿 설정이 필요합니다.",
  );
}

export function requireStrongSessionSecretIfEnabled(
  res: ServerResponse,
): boolean {
  const config = getWebDashboardConfig();
  if (isWebDashboardAuthSecurityReady(config)) {
    return true;
  }
  sendSessionSecretWeakError(res);
  return false;
}

export function isAuthApiPathRequiringStrongSecret(pathname: string): boolean {
  return pathname.startsWith("/api/auth/");
}

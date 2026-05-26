import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buildDiscordOAuthAuthorizeUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeDiscordOAuthCode,
  fetchDiscordCurrentUser,
  fetchDiscordCurrentUserGuilds,
  isOAuthReady,
} from "@/web/discordOAuth";
import {
  getWebDashboardAllowedOrigin,
  getWebDashboardConfig,
  isWebDashboardAuthEnabled,
  isWebDashboardOAuthConfigured,
} from "@/web/config";
import { requireCsrfToken } from "@/web/csrf";
import { readRequestUrl, sendError, sendJson, sendRedirect } from "@/web/http";
import { requireStrongSessionSecretIfEnabled } from "@/web/security";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionFromRequest,
  setSessionCookie,
} from "@/web/session";
import type {
  AuthCsrfResponseDto,
  AuthMeResponseDto,
  AuthOkResponseDto,
} from "@/web/types";
import { log } from "@/utils/logger";

function sendAuthDisabled(res: ServerResponse): void {
  sendError(
    res,
    503,
    "AUTH_DISABLED",
    "웹 대시보드 로그인이 비활성화되어 있습니다.",
  );
}

function sendAuthConfigMissing(res: ServerResponse): void {
  sendError(
    res,
    500,
    "AUTH_CONFIG_MISSING",
    "Discord OAuth 설정이 완료되지 않았습니다.",
  );
}

function requireAuthEnabled(res: ServerResponse): boolean {
  if (!isWebDashboardAuthEnabled()) {
    sendAuthDisabled(res);
    return false;
  }
  if (!requireStrongSessionSecretIfEnabled(res)) {
    return false;
  }
  return true;
}

function requireOAuthConfigured(res: ServerResponse): boolean {
  const cfg = getWebDashboardConfig();
  if (!isWebDashboardOAuthConfigured(cfg)) {
    sendAuthConfigMissing(res);
    return false;
  }
  return true;
}

export function handleDiscordLogin(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  if (!requireAuthEnabled(res)) {
    return;
  }
  if (!requireOAuthConfigured(res)) {
    return;
  }
  if (!isOAuthReady()) {
    sendAuthConfigMissing(res);
    return;
  }

  const state = createOAuthState();
  const url = buildDiscordOAuthAuthorizeUrl(state);
  sendRedirect(res, url);
}

export async function handleDiscordCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!requireAuthEnabled(res)) {
    return;
  }
  if (!requireOAuthConfigured(res)) {
    return;
  }

  const { searchParams } = readRequestUrl(req);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state || !consumeOAuthState(state)) {
    sendError(
      res,
      400,
      "OAUTH_CALLBACK_FAILED",
      "Discord 로그인 처리 중 오류가 발생했습니다.",
    );
    return;
  }

  try {
    const token = await exchangeDiscordOAuthCode(code);
    const accessToken = token.access_token;
    const user = await fetchDiscordCurrentUser(accessToken);
    const guilds = await fetchDiscordCurrentUserGuilds(accessToken);

    const session = createSession({ user, guilds });
    setSessionCookie(res, session);

    const origin = getWebDashboardAllowedOrigin();
    sendRedirect(res, `${origin}/dashboard`);
  } catch {
    log("warn", "web", "Discord OAuth callback failed");
    sendError(
      res,
      400,
      "OAUTH_CALLBACK_FAILED",
      "Discord 로그인 처리 중 오류가 발생했습니다.",
    );
  }
}

export function handleAuthMe(req: IncomingMessage, res: ServerResponse): void {
  if (!requireAuthEnabled(res)) {
    return;
  }

  const session = readSessionFromRequest(req);
  if (!session) {
    sendError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return;
  }

  const body: AuthMeResponseDto = {
    ok: true,
    user: session.user,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
  sendJson(res, 200, body);
}

export function handleAuthCsrf(req: IncomingMessage, res: ServerResponse): void {
  if (!requireAuthEnabled(res)) {
    return;
  }

  const session = readSessionFromRequest(req);
  if (!session) {
    sendError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return;
  }

  const body: AuthCsrfResponseDto = {
    ok: true,
    csrfToken: session.csrfToken,
  };
  sendJson(res, 200, body);
}

export function handleAuthLogout(req: IncomingMessage, res: ServerResponse): void {
  if (!requireAuthEnabled(res)) {
    return;
  }

  const session = readSessionFromRequest(req);
  if (!session) {
    sendError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return;
  }
  if (!requireCsrfToken(req, res, session)) {
    return;
  }

  deleteSession(session.id);
  clearSessionCookie(res);

  const body: AuthOkResponseDto = { ok: true };
  sendJson(res, 200, body);
}

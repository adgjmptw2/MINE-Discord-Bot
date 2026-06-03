import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendError } from "@/web/http";
import type { WebSession } from "@/web/session";

export function getCsrfTokenFromRequest(req: IncomingMessage): string | null {
  const raw = req.headers["x-csrf-token"];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  if (Array.isArray(raw) && raw[0] && raw[0].trim().length > 0) {
    return raw[0].trim();
  }
  return null;
}

export function isCsrfTokenValid(
  session: WebSession,
  token: string | null,
): boolean {
  if (!token) {
    return false;
  }
  const expected = session.csrfToken;
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// CSRF는 세션 전용(쿠키·OAuth와 분리)
export function requireCsrfToken(
  req: IncomingMessage,
  res: ServerResponse,
  session: WebSession,
): boolean {
  const token = getCsrfTokenFromRequest(req);
  if (!token) {
    sendError(
      res,
      403,
      "CSRF_TOKEN_REQUIRED",
      "요청 보안 토큰이 필요합니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    );
    return false;
  }
  if (!isCsrfTokenValid(session, token)) {
    sendError(
      res,
      403,
      "CSRF_TOKEN_INVALID",
      "요청 보안 토큰이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    );
    return false;
  }
  return true;
}

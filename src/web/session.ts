import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  getWebDashboardConfig,
  type WebDashboardConfig,
} from "@/web/config";
import { clearCookie, parseCookies, setCookie } from "@/web/http";
import type { DiscordOAuthGuildDto, DiscordOAuthUserDto } from "@/web/types";

export interface WebSession {
  id: string;
  user: DiscordOAuthUserDto;
  guilds: DiscordOAuthGuildDto[];
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, WebSession>();

function getConfig(): WebDashboardConfig {
  return getWebDashboardConfig();
}

export function signSessionId(sessionId: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(sessionId).digest("hex");
  return `${sessionId}.${sig}`;
}

export function verifySignedSessionId(
  value: string,
  secret: string,
): string | null {
  const dot = value.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const sessionId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!sessionId || !sig) {
    return null;
  }
  const expected = createHmac("sha256", secret).update(sessionId).digest("hex");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }
  return sessionId;
}

export function createSession(input: {
  user: DiscordOAuthUserDto;
  guilds: DiscordOAuthGuildDto[];
}): WebSession {
  const config = getConfig();
  const now = Date.now();
  const session: WebSession = {
    id: randomBytes(32).toString("hex"),
    user: input.user,
    guilds: input.guilds,
    createdAt: now,
    expiresAt: now + config.sessionTtlSeconds * 1000,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): WebSession | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(id);
    }
  }
}

export function readSessionFromRequest(req: IncomingMessage): WebSession | null {
  const config = getConfig();
  const cookies = parseCookies(req);
  const raw = cookies[config.sessionCookieName];
  if (!raw) {
    return null;
  }
  const sessionId = verifySignedSessionId(raw, config.sessionSecret);
  if (!sessionId) {
    return null;
  }
  return getSession(sessionId);
}

export function setSessionCookie(res: ServerResponse, session: WebSession): void {
  const config = getConfig();
  const signed = signSessionId(session.id, config.sessionSecret);
  const maxAge = Math.max(
    0,
    Math.floor((session.expiresAt - Date.now()) / 1000),
  );
  setCookie(res, config.sessionCookieName, signed, {
    maxAgeSeconds: maxAge,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: false,
  });
}

export function clearSessionCookie(res: ServerResponse): void {
  const config = getConfig();
  clearCookie(res, config.sessionCookieName);
}

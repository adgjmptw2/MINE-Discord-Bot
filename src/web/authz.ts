import type { IncomingMessage, ServerResponse } from "node:http";
import type { Guild } from "discord.js";
import type { MineClient } from "@/types";
import { requireCsrfToken } from "@/web/csrf";
import { sendError } from "@/web/http";
import { readSessionFromRequest, type WebSession } from "@/web/session";
import type { DiscordOAuthGuildDto } from "@/web/types";

export const GUILD_ID_PATTERN = /^\d{17,20}$/;

export function getAuthenticatedSession(
  req: IncomingMessage,
): WebSession | null {
  return readSessionFromRequest(req);
}

// POST 변경: 세션+CSRF(본문 파싱 전)
export function requireAuthenticatedSessionWithCsrf(
  req: IncomingMessage,
  res: ServerResponse,
): WebSession | null {
  const session = readSessionFromRequest(req);
  if (!session) {
    sendError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return null;
  }
  if (!requireCsrfToken(req, res, session)) {
    return null;
  }
  return session;
}

export function findSessionGuild(
  session: WebSession,
  guildId: string,
): DiscordOAuthGuildDto | null {
  return session.guilds.find((g) => g.id === guildId) ?? null;
}

export function canSessionAccessGuild(
  session: WebSession,
  guildId: string,
): boolean {
  return findSessionGuild(session, guildId) !== null;
}

export function isBotInGuild(client: MineClient, guildId: string): boolean {
  return client.guilds.cache.has(guildId);
}

export async function isSessionUserCurrentGuildMember(
  guild: Guild,
  userId: string,
): Promise<boolean> {
  if (guild.members.cache.has(userId)) {
    return true;
  }
  const member = await guild.members.fetch(userId).catch(() => null);
  return member !== null;
}

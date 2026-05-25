import type { IncomingMessage } from "node:http";
import type { MineClient } from "@/types";
import { readSessionFromRequest, type WebSession } from "@/web/session";
import type { DiscordOAuthGuildDto } from "@/web/types";

export const GUILD_ID_PATTERN = /^\d{17,20}$/;

export function getAuthenticatedSession(
  req: IncomingMessage,
): WebSession | null {
  return readSessionFromRequest(req);
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

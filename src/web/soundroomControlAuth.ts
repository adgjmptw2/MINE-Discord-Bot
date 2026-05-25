import type { IncomingMessage } from "node:http";
import type { Guild } from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import type { ExtendedPlayer, MineClient } from "@/types";
import { getActivePlayer, getPlayer } from "@/utils/commands";
import {
  canSessionAccessGuild,
  getAuthenticatedSession,
  GUILD_ID_PATTERN,
  isBotInGuild,
} from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import type { WebSession } from "@/web/session";

export interface WebAuthzError {
  status: number;
  code: string;
  message: string;
}

export interface WebSoundroomControlContext {
  session: WebSession;
  guildId: string;
  guild: Guild;
  player: ExtendedPlayer;
  userVoiceChannelId: string;
}

function authError(
  status: number,
  code: string,
  message: string,
): WebAuthzError {
  return { status, code, message };
}

export function getBotVoiceChannelId(
  client: MineClient,
  guildId: string,
): string | null {
  const guild = client.guilds.cache.get(guildId);
  const fromMember = guild?.members.me?.voice.channelId ?? null;
  if (fromMember) {
    return fromMember;
  }

  const player = getPlayer(client, guildId);
  if (player?.voiceChannel) {
    return String(player.voiceChannel);
  }

  return null;
}

export async function getGuildMemberVoiceChannelId(
  guild: Guild,
  userId: string,
): Promise<string | null> {
  let member = guild.members.cache.get(userId);
  if (!member) {
    const fetched = await guild.members.fetch(userId).catch(() => null);
    if (fetched) {
      member = fetched;
    }
  }
  return member?.voice.channelId ?? null;
}

export async function requireWebSoundroomControlAccess(
  client: MineClient,
  req: IncomingMessage,
  guildId: string,
): Promise<WebSoundroomControlContext | WebAuthzError> {
  if (!isWebDashboardAuthEnabled()) {
    return authError(
      503,
      "AUTH_DISABLED",
      "웹 대시보드 로그인이 비활성화되어 있습니다.",
    );
  }

  if (!GUILD_ID_PATTERN.test(guildId)) {
    return authError(400, "INVALID_GUILD_ID", "잘못된 서버 ID입니다.");
  }

  const session = getAuthenticatedSession(req);
  if (!session) {
    return authError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  if (!canSessionAccessGuild(session, guildId)) {
    return authError(
      403,
      "GUILD_ACCESS_DENIED",
      "이 서버에 접근할 권한이 없습니다.",
    );
  }

  if (!isBotInGuild(client, guildId)) {
    return authError(
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
  }

  if (!getSoundroom(guildId)) {
    return authError(
      404,
      "SOUNDROOM_NOT_CONFIGURED",
      "이 서버에는 Soundroom이 설정되어 있지 않습니다.",
    );
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return authError(
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
  }

  const userVoiceChannelId = await getGuildMemberVoiceChannelId(
    guild,
    session.user.id,
  );
  if (!userVoiceChannelId) {
    return authError(
      403,
      "USER_NOT_IN_VOICE_CHANNEL",
      "먼저 음성 채널에 들어가 주세요.",
    );
  }

  const player = getActivePlayer(client, guildId);
  if (!player) {
    return authError(
      409,
      "PLAYER_NOT_CONNECTED",
      "봇이 음성 채널에 연결되어 있지 않습니다.",
    );
  }

  const botVoiceChannelId = getBotVoiceChannelId(client, guildId);
  if (!botVoiceChannelId || userVoiceChannelId !== botVoiceChannelId) {
    return authError(
      403,
      "NOT_SAME_VOICE_CHANNEL",
      "봇과 같은 음성 채널에서만 조작할 수 있습니다.",
    );
  }

  return {
    session,
    guildId,
    guild,
    player,
    userVoiceChannelId,
  };
}

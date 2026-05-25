import type { IncomingMessage } from "node:http";
import type { Guild } from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import type { ExtendedPlayer, MineClient } from "@/types";
import {
  getActivePlayer,
  getPlayer,
  hasActivePlayerSession,
} from "@/utils/commands";
import {
  canSessionAccessGuild,
  getAuthenticatedSession,
  GUILD_ID_PATTERN,
  isBotInGuild,
} from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import type { WebSession } from "@/web/session";
import type { SoundroomControlStatusCode } from "@/web/types";

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

export interface SoundroomControlStatusResult {
  canControl: boolean;
  code: SoundroomControlStatusCode;
  message: string;
  soundroomConfigured: boolean;
  playerConnected: boolean;
  userVoiceChannelId: string | null;
  userVoiceChannelName: string | null;
  botVoiceChannelId: string | null;
  botVoiceChannelName: string | null;
}

function authError(
  status: number,
  code: string,
  message: string,
): WebAuthzError {
  return { status, code, message };
}

function getVoiceChannelName(
  guild: Guild,
  channelId: string | null,
): string | null {
  if (!channelId) {
    return null;
  }
  const ch = guild.channels.cache.get(channelId);
  if (ch?.isVoiceBased()) {
    const name = ch.name?.trim();
    return name && name.length > 0 ? name : null;
  }
  return null;
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

export async function buildSoundroomControlStatus(
  client: MineClient,
  session: WebSession,
  guildId: string,
  guild: Guild,
): Promise<SoundroomControlStatusResult> {
  const soundroomConfigured = Boolean(getSoundroom(guildId));
  const playerConnected = hasActivePlayerSession(client, guildId);
  const botVoiceChannelId = getBotVoiceChannelId(client, guildId);
  const botVoiceChannelName = getVoiceChannelName(guild, botVoiceChannelId);
  const userVoiceChannelId = await getGuildMemberVoiceChannelId(
    guild,
    session.user.id,
  );
  const userVoiceChannelName = getVoiceChannelName(guild, userVoiceChannelId);

  const base = {
    soundroomConfigured,
    playerConnected,
    userVoiceChannelId,
    userVoiceChannelName,
    botVoiceChannelId,
    botVoiceChannelName,
  };

  if (!soundroomConfigured) {
    return {
      ...base,
      canControl: false,
      code: "SOUNDROOM_NOT_CONFIGURED",
      message: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
    };
  }

  if (!userVoiceChannelId) {
    return {
      ...base,
      canControl: false,
      code: "USER_NOT_IN_VOICE_CHANNEL",
      message: "먼저 음성 채널에 들어가 주세요.",
    };
  }

  if (!playerConnected) {
    return {
      ...base,
      canControl: false,
      code: "PLAYER_NOT_CONNECTED",
      message: "봇이 음성 채널에 연결되어 있지 않습니다.",
    };
  }

  if (!botVoiceChannelId || userVoiceChannelId !== botVoiceChannelId) {
    return {
      ...base,
      canControl: false,
      code: "NOT_SAME_VOICE_CHANNEL",
      message: "봇과 같은 음성 채널에서만 조작할 수 있습니다.",
    };
  }

  return {
    ...base,
    canControl: true,
    code: "READY",
    message: "조작할 수 있습니다.",
  };
}

function statusToAuthError(
  status: SoundroomControlStatusResult,
): WebAuthzError {
  switch (status.code) {
    case "SOUNDROOM_NOT_CONFIGURED":
      return authError(404, status.code, status.message);
    case "USER_NOT_IN_VOICE_CHANNEL":
    case "NOT_SAME_VOICE_CHANNEL":
      return authError(403, status.code, status.message);
    case "PLAYER_NOT_CONNECTED":
      return authError(409, status.code, status.message);
    default:
      return authError(500, "INTERNAL_ERROR", "노래채널 조작 권한을 확인할 수 없습니다.");
  }
}

export async function getSoundroomControlStatus(
  client: MineClient,
  req: IncomingMessage,
  guildId: string,
): Promise<SoundroomControlStatusResult | WebAuthzError> {
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

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return authError(
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
  }

  return buildSoundroomControlStatus(client, session, guildId, guild);
}

export interface WebSoundroomQueueContext {
  session: WebSession;
  guildId: string;
  guild: Guild;
  userVoiceChannelId: string;
  soundroomChannelId: string;
}

/** 검색·대기열 추가: 음성 입장·같은 채널(봇 연결 시). 봇 미연결 시에도 추가 시 ensurePlayerConnection 허용. */
export async function requireWebSoundroomQueueAccess(
  client: MineClient,
  req: IncomingMessage,
  guildId: string,
): Promise<WebSoundroomQueueContext | WebAuthzError> {
  const statusOrError = await getSoundroomControlStatus(client, req, guildId);
  if ("status" in statusOrError) {
    return statusOrError;
  }

  if (!statusOrError.soundroomConfigured) {
    return statusToAuthError({
      ...statusOrError,
      canControl: false,
      code: "SOUNDROOM_NOT_CONFIGURED",
      message: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
    });
  }

  if (!statusOrError.userVoiceChannelId) {
    return statusToAuthError({
      ...statusOrError,
      canControl: false,
      code: "USER_NOT_IN_VOICE_CHANNEL",
      message: "먼저 음성 채널에 들어가 주세요.",
    });
  }

  const botVoiceChannelId = statusOrError.botVoiceChannelId;
  if (
    botVoiceChannelId &&
    botVoiceChannelId !== statusOrError.userVoiceChannelId
  ) {
    return statusToAuthError({
      ...statusOrError,
      canControl: false,
      code: "NOT_SAME_VOICE_CHANNEL",
      message: "봇과 같은 음성 채널에서만 조작할 수 있습니다.",
    });
  }

  const room = getSoundroom(guildId);
  if (!room) {
    return statusToAuthError({
      ...statusOrError,
      canControl: false,
      code: "SOUNDROOM_NOT_CONFIGURED",
      message: "이 서버에는 노래채널이 설정되어 있지 않습니다.",
    });
  }

  const session = getAuthenticatedSession(req)!;
  const guild = client.guilds.cache.get(guildId)!;

  return {
    session,
    guildId,
    guild,
    userVoiceChannelId: statusOrError.userVoiceChannelId,
    soundroomChannelId: room.channelId,
  };
}

export async function requireWebSoundroomControlAccess(
  client: MineClient,
  req: IncomingMessage,
  guildId: string,
): Promise<WebSoundroomControlContext | WebAuthzError> {
  const statusOrError = await getSoundroomControlStatus(client, req, guildId);
  if ("status" in statusOrError) {
    return statusOrError;
  }

  if (!statusOrError.canControl) {
    return statusToAuthError(statusOrError);
  }

  const session = getAuthenticatedSession(req)!;
  const guild = client.guilds.cache.get(guildId)!;
  const player = getActivePlayer(client, guildId);
  if (!player || !statusOrError.userVoiceChannelId) {
    return statusToAuthError({
      ...statusOrError,
      canControl: false,
      code: "PLAYER_NOT_CONNECTED",
      message: "봇이 음성 채널에 연결되어 있지 않습니다.",
    });
  }

  return {
    session,
    guildId,
    guild,
    player,
    userVoiceChannelId: statusOrError.userVoiceChannelId,
  };
}

import type { GuildMember } from "discord.js";
import { ensurePlayerConnection } from "@/utils/commands";
import {
  addTracksRespectingSoundroomAutoplay,
  onQueueMayHaveItems,
} from "@/utils/soundroomAutoplay";
import {
  editSoundroomIdlePanel,
  editSoundroomPlayingPanel,
} from "@/utils/soundroomPanel";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";
import {
  buildPlaylistLoadIdentifier,
  clampSoundroomPlaylistLimit,
  SoundroomLoadIdentifierError,
} from "@/web/soundroomLoadIdentifier";
import { SoundroomSearchActionError } from "@/web/soundroomSearchActions";
import type { DiscordOAuthUserDto } from "@/web/types";

export interface SoundroomPlaylistImportResult {
  addedCount: number;
  skippedCount: number;
  requestedCount: number;
  limit: number;
  truncated: boolean;
  playlist: { title: string | null; uri: string | null };
  addedTitles: string[];
}

function assertRiffyReady(client: MineClient): void {
  const riffy = client.riffy as { initiated?: boolean };
  if (!riffy?.initiated) {
    throw new SoundroomSearchActionError(
      503,
      "LAVALINK_UNAVAILABLE",
      "음악 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

function refreshSoundroomPanelBestEffort(
  client: MineClient,
  guildId: string,
  player: ExtendedPlayer,
): void {
  void (async () => {
    try {
      if (player.current || player.playing || player.paused) {
        await editSoundroomPlayingPanel(client, guildId);
      } else {
        await editSoundroomIdlePanel(client, guildId);
      }
    } catch {
    }
  })();
}

export async function importSoundroomPlaylistForMember(
  client: MineClient,
  guildId: string,
  member: GuildMember,
  soundroomChannelId: string,
  uri: string,
  limitInput: unknown,
): Promise<SoundroomPlaylistImportResult> {
  assertRiffyReady(client);

  const limit = clampSoundroomPlaylistLimit(limitInput);
  let identifier: string;
  let playlistUri: string;
  try {
    playlistUri = uri.trim();
    identifier = buildPlaylistLoadIdentifier(playlistUri);
  } catch (error) {
    if (error instanceof SoundroomLoadIdentifierError) {
      throw new SoundroomSearchActionError(400, error.code, error.message);
    }
    throw error;
  }

  let resolve: {
    loadType: string;
    tracks: ExtendedTrack[];
    playlistInfo?: { name?: string };
  };
  try {
    resolve = (await client.riffy.resolve({
      query: identifier,
      requester: member,
    })) as typeof resolve;
  } catch {
    throw new SoundroomSearchActionError(
      503,
      "LAVALINK_UNAVAILABLE",
      "음악 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const tracks = (resolve.tracks ?? []) as ExtendedTrack[];
  if (tracks.length === 0) {
    throw new SoundroomSearchActionError(
      404,
      "PLAYLIST_EMPTY",
      "가져올 수 있는 곡이 없는 재생목록입니다.",
    );
  }

  if (resolve.loadType !== "playlist") {
    if (tracks.length === 1) {
      throw new SoundroomSearchActionError(
        400,
        "INVALID_PLAYLIST_URL",
        "단일 곡은 일반 추가를 사용해 주세요.",
      );
    }
    throw new SoundroomSearchActionError(
      400,
      "PLAYLIST_NOT_SUPPORTED",
      "아직 지원하지 않는 재생목록 형식입니다.",
    );
  }

  const requestedCount = tracks.length;
  const truncated = requestedCount > limit;
  const slice = tracks.slice(0, limit);

  const player = await ensurePlayerConnection(
    client,
    guildId,
    member.voice.channelId!,
    soundroomChannelId,
  );

  const toAdd: ExtendedTrack[] = [];
  let skippedCount = 0;
  const addedTitles: string[] = [];

  for (const track of slice) {
    if (!track?.info) {
      skippedCount += 1;
      continue;
    }
    track.info.requester = member;
    toAdd.push(track);
    addedTitles.push(track.info.title?.trim() || "제목 없음");
  }

  if (toAdd.length === 0) {
    throw new SoundroomSearchActionError(
      404,
      "NO_TRACK_LOADED",
      "곡을 불러오지 못했습니다.",
    );
  }

  addTracksRespectingSoundroomAutoplay(player, guildId, toAdd);
  onQueueMayHaveItems(guildId);

  if (player.queue.length > 0 && !player.playing && !player.paused) {
    try {
      await Promise.resolve(player.play());
    } catch {
      throw new SoundroomSearchActionError(
        500,
        "INTERNAL_ERROR",
        "재생을 시작하지 못했습니다. Lavalink 연결을 확인해 주세요.",
      );
    }
  }

  refreshSoundroomPanelBestEffort(client, guildId, player);

  const playlistTitle =
    resolve.playlistInfo?.name?.trim() ||
    toAdd[0]?.info.title?.trim() ||
    null;

  return {
    addedCount: toAdd.length,
    skippedCount,
    requestedCount,
    limit,
    truncated,
    playlist: { title: playlistTitle, uri: playlistUri },
    addedTitles,
  };
}

export async function addSoundroomPlaylistFromWeb(
  client: MineClient,
  guildId: string,
  soundroomChannelId: string,
  userVoiceChannelId: string,
  _user: DiscordOAuthUserDto,
  uri: string,
  limitInput: unknown,
): Promise<SoundroomPlaylistImportResult> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new SoundroomSearchActionError(
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
  }

  let member = guild.members.cache.get(_user.id);
  if (!member) {
    const fetched = await guild.members.fetch(_user.id).catch(() => null);
    if (fetched) {
      member = fetched;
    }
  }
  if (!member) {
    throw new SoundroomSearchActionError(
      403,
      "GUILD_ACCESS_DENIED",
      "서버 멤버 정보를 확인할 수 없습니다.",
    );
  }
  if (!member.voice.channelId) {
    throw new SoundroomSearchActionError(
      403,
      "USER_NOT_IN_VOICE_CHANNEL",
      "먼저 음성 채널에 들어가 주세요.",
    );
  }
  if (member.voice.channelId !== userVoiceChannelId) {
    throw new SoundroomSearchActionError(
      403,
      "NOT_SAME_VOICE_CHANNEL",
      "봇과 같은 음성 채널에서만 조작할 수 있습니다.",
    );
  }

  return importSoundroomPlaylistForMember(
    client,
    guildId,
    member,
    soundroomChannelId,
    uri,
    limitInput,
  );
}

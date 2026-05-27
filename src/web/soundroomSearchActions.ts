import type { Guild, GuildMember } from "discord.js";
import { ensurePlayerConnection } from "@/utils/commands";
import {
  addTracksRespectingSoundroomAutoplay,
  onQueueMayHaveItems,
} from "@/utils/soundroomAutoplay";
import { resolveSoundroomPlayingImageUrl } from "@/utils/soundroomArtwork";
import {
  editSoundroomIdlePanel,
  editSoundroomPlayingPanel,
} from "@/utils/soundroomPanel";
import { isExplicitFullPlaylistIntentUrl } from "@/events/bot/client/soundroomMessages";
import type { DiscordOAuthUserDto } from "@/web/types";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";
import {
  buildSoundroomLoadIdentifier,
  SoundroomLoadIdentifierError,
  validateSoundroomQueryInput,
} from "@/web/soundroomLoadIdentifier";
import type {
  SoundroomAddedTrackDto,
  SoundroomSearchResultDto,
} from "@/web/types";
import { log } from "@/utils/logger";

const MAX_SEARCH_RESULTS = 5;

export class SoundroomSearchActionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SoundroomSearchActionError";
    this.status = status;
    this.code = code;
  }
}

function trackDurationMs(track: ExtendedTrack): number | null {
  const len = track.info.length;
  if (typeof len !== "number" || len < 0) {
    return null;
  }
  return len > 0 ? len : null;
}

function trackToSearchResultDto(
  id: string,
  track: ExtendedTrack,
): SoundroomSearchResultDto {
  return {
    id,
    title: track.info.title?.trim() || "제목 없음",
    uri: track.info.uri?.trim() || null,
    author: track.info.author?.trim() || null,
    durationMs: trackDurationMs(track),
    isStream: Boolean(track.info.isStream),
    thumbnailUrl: resolveSoundroomPlayingImageUrl(track),
  };
}

function trackToAddedDto(
  track: ExtendedTrack,
  user: DiscordOAuthUserDto,
): SoundroomAddedTrackDto {
  const requester = track.info.requester;
  const requesterId =
    requester?.user?.id ?? requester?.id ?? user.id ?? null;
  const requesterName =
    requester?.displayName?.trim() ||
    requester?.user?.username?.trim() ||
    user.globalName?.trim() ||
    user.username?.trim() ||
    null;

  return {
    title: track.info.title?.trim() || "제목 없음",
    uri: track.info.uri?.trim() || null,
    author: track.info.author?.trim() || null,
    durationMs: trackDurationMs(track),
    isStream: Boolean(track.info.isStream),
    thumbnailUrl: resolveSoundroomPlayingImageUrl(track),
    requesterId,
    requesterName,
  };
}

function refreshSoundroomPanelBestEffort(
  client: MineClient,
  guildId: string,
  player: ExtendedPlayer,
): void {
  const run = async () => {
    try {
      if (player.current || player.playing || player.paused) {
        await editSoundroomPlayingPanel(client, guildId);
      } else {
        await editSoundroomIdlePanel(client, guildId);
      }
    } catch {
      /* 패널 갱신 실패는 API 성공과 분리 */
    }
  };
  void run();
}

async function resolveSoundroomTracks(
  client: MineClient,
  rawInput: string,
  requester?: GuildMember,
): Promise<{ loadType: string; tracks: ExtendedTrack[]; rawInput: string }> {
  let identifier: string;
  try {
    identifier = buildSoundroomLoadIdentifier(rawInput);
  } catch (error) {
    if (error instanceof SoundroomLoadIdentifierError) {
      throw new SoundroomSearchActionError(400, error.code, error.message);
    }
    throw error;
  }

  let resolve: { loadType: string; tracks: ExtendedTrack[] };
  try {
    resolve = (await client.riffy.resolve({
      query: identifier,
      requester,
    })) as { loadType: string; tracks: ExtendedTrack[] };
  } catch {
    throw new SoundroomSearchActionError(
      500,
      "INTERNAL_ERROR",
      "곡을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const tracks = resolve.tracks as ExtendedTrack[];
  if (!tracks || tracks.length === 0) {
    throw new SoundroomSearchActionError(
      404,
      "NO_SEARCH_RESULTS",
      "검색 결과를 찾을 수 없습니다.",
    );
  }

  return { loadType: resolve.loadType, tracks, rawInput };
}

function assertNotExplicitPlaylist(
  loadType: string,
  tracks: ExtendedTrack[],
  rawInput: string,
): void {
  if (
    loadType === "playlist" &&
    isExplicitFullPlaylistIntentUrl(rawInput) &&
    tracks.length > 1
  ) {
    throw new SoundroomSearchActionError(
      400,
      "PLAYLIST_NOT_SUPPORTED",
      "재생목록 URL은 웹 리모컨의 재생목록 추가를 사용해 주세요.",
    );
  }
}

export async function searchSoundroomTracks(
  client: MineClient,
  _guildId: string,
  query: string,
): Promise<{ query: string; results: SoundroomSearchResultDto[] }> {
  const normalized = validateSoundroomQueryInput(query);
  const { loadType, tracks, rawInput } = await resolveSoundroomTracks(
    client,
    normalized,
  );

  assertNotExplicitPlaylist(loadType, tracks, rawInput);

  const slice = tracks.slice(0, MAX_SEARCH_RESULTS);
  const results = slice.map((track, index) =>
    trackToSearchResultDto(String(index), track),
  );

  return { query: normalized, results };
}

async function fetchRequesterMember(
  guild: Guild,
  userId: string,
): Promise<GuildMember> {
  let member = guild.members.cache.get(userId);
  if (!member) {
    const fetched = await guild.members.fetch(userId).catch(() => null);
    if (!fetched) {
      throw new SoundroomSearchActionError(
        403,
        "GUILD_ACCESS_DENIED",
        "서버 멤버 정보를 확인할 수 없습니다.",
      );
    }
    member = fetched;
  }
  return member;
}

/** Discord Soundroom 메시지 추가와 동일한 대기열·재생 정책 (채널 알림 없음). */
async function enqueueSoundroomTrackForMember(
  client: MineClient,
  guildId: string,
  member: GuildMember,
  soundroomChannelId: string,
  rawInput: string,
): Promise<ExtendedTrack> {
  const { loadType, tracks, rawInput: resolvedRaw } = await resolveSoundroomTracks(
    client,
    rawInput,
    member,
  );

  assertNotExplicitPlaylist(loadType, tracks, resolvedRaw);

  const player = await ensurePlayerConnection(
    client,
    guildId,
    member.voice.channelId!,
    soundroomChannelId,
  );

  let addedTrack: ExtendedTrack;

  if (loadType === "playlist" && tracks.length > 1) {
    const first = tracks[0]!;
    first.info.requester = member;
    addTracksRespectingSoundroomAutoplay(player, guildId, [first]);
    addedTrack = first;
  } else {
    const track = tracks[0]!;
    track.info.requester = member;
    addTracksRespectingSoundroomAutoplay(player, guildId, [track]);
    addedTrack = track;
  }

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

  return addedTrack;
}

export async function addSoundroomTrackFromWeb(
  client: MineClient,
  guildId: string,
  soundroomChannelId: string,
  userVoiceChannelId: string,
  user: DiscordOAuthUserDto,
  input: { query?: string; uri?: string },
): Promise<SoundroomAddedTrackDto> {
  const raw =
    input.query !== undefined
      ? validateSoundroomQueryInput(input.query)
      : input.uri !== undefined
        ? validateSoundroomQueryInput(input.uri)
        : null;

  if (raw === null) {
    throw new SoundroomSearchActionError(
      400,
      "INVALID_ADD_REQUEST",
      "query 또는 uri 중 하나만 보내 주세요.",
    );
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new SoundroomSearchActionError(
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
  }

  const member = await fetchRequesterMember(guild, user.id);
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

  let addedTrack: ExtendedTrack;
  try {
    addedTrack = await enqueueSoundroomTrackForMember(
      client,
      guildId,
      member,
      soundroomChannelId,
      raw,
    );
  } catch (error) {
    if (error instanceof SoundroomSearchActionError) {
      if (error.code === "NO_SEARCH_RESULTS") {
        throw new SoundroomSearchActionError(
          404,
          "NO_TRACK_LOADED",
          "곡을 불러오지 못했습니다.",
        );
      }
      throw error;
    }
    log("warn", "web", `Soundroom web add failed guild=${guildId} user=${user.id}`);
    throw new SoundroomSearchActionError(
      500,
      "INTERNAL_ERROR",
      "노래채널에 곡을 추가하지 못했습니다.",
    );
  }

  return trackToAddedDto(addedTrack, user);
}

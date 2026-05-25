import type { GuildMember } from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import { getPlayer } from "@/utils/commands";
import { getAutoplayState, userSoundroomQueueEntries } from "@/utils/soundroomAutoplay";
import { resolveSoundroomPlayingImageUrl } from "@/utils/soundroomArtwork";
import type { ExtendedTrack, MineClient } from "@/types";
import type {
  SoundroomGuildStateDto,
  SoundroomQueueItemDto,
  SoundroomTrackDto,
} from "@/web/types";

const MAX_QUEUE_ITEMS = 50;

function resolveRequesterId(requester?: GuildMember): string | null {
  const uid = requester?.user?.id ?? requester?.id;
  return uid ?? null;
}

function resolveRequesterName(requester?: GuildMember): string | null {
  if (!requester) {
    return null;
  }
  const display = requester.displayName?.trim();
  if (display) {
    return display;
  }
  const username = requester.user?.username?.trim();
  return username || null;
}

function trackDurationMs(track: ExtendedTrack): number | null {
  const len = track.info.length;
  if (typeof len !== "number" || len < 0) {
    return null;
  }
  return len > 0 ? len : null;
}

export function trackToSoundroomTrackDto(
  track: ExtendedTrack,
): SoundroomTrackDto {
  const uri = track.info.uri?.trim() || null;
  return {
    title: track.info.title?.trim() || "제목 없음",
    uri,
    author: track.info.author?.trim() || null,
    durationMs: trackDurationMs(track),
    isStream: Boolean(track.info.isStream),
    thumbnailUrl: resolveSoundroomPlayingImageUrl(track),
    requesterId: resolveRequesterId(track.info.requester),
    requesterName: resolveRequesterName(track.info.requester),
  };
}

function buildQueueItems(player: NonNullable<ReturnType<typeof getPlayer>>): SoundroomQueueItemDto[] {
  const entries = userSoundroomQueueEntries(player).slice(0, MAX_QUEUE_ITEMS);
  return entries.map(({ track }, index) => {
    const dto = trackToSoundroomTrackDto(track);
    return {
      index,
      title: dto.title,
      uri: dto.uri,
      author: dto.author,
      durationMs: dto.durationMs,
      requesterId: dto.requesterId,
      requesterName: dto.requesterName,
    };
  });
}

export function buildSoundroomGuildStateDto(
  client: MineClient,
  guildId: string,
): SoundroomGuildStateDto {
  const updatedAt = new Date().toISOString();
  const room = getSoundroom(guildId);

  if (!room) {
    return {
      guildId,
      soundroomConfigured: false,
      channelId: null,
      panelMessageId: null,
      playerConnected: false,
      playing: false,
      paused: false,
      volume: 100,
      autoplay: getAutoplayState(guildId).enabled,
      positionMs: 0,
      current: null,
      queue: [],
      updatedAt,
    };
  }

  const player = getPlayer(client, guildId);
  if (!player) {
    return {
      guildId,
      soundroomConfigured: true,
      channelId: room.channelId,
      panelMessageId: room.panelMessageId,
      playerConnected: false,
      playing: false,
      paused: false,
      volume: 100,
      autoplay: getAutoplayState(guildId).enabled,
      positionMs: 0,
      current: null,
      queue: [],
      updatedAt,
    };
  }

  const currentTrack = player.current;
  const current =
    currentTrack && (player.playing || player.paused)
      ? trackToSoundroomTrackDto(currentTrack)
      : null;

  return {
    guildId,
    soundroomConfigured: true,
    channelId: room.channelId,
    panelMessageId: room.panelMessageId,
    playerConnected: Boolean(player.connected),
    playing: Boolean(player.playing),
    paused: Boolean(player.paused),
    volume: typeof player.volume === "number" ? player.volume : 100,
    autoplay: getAutoplayState(guildId).enabled,
    positionMs:
      typeof player.position === "number" && player.position >= 0
        ? player.position
        : 0,
    current,
    queue: buildQueueItems(player),
    updatedAt,
  };
}

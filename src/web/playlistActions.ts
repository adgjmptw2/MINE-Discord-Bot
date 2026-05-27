import type { GuildMember } from "discord.js";
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
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";
import {
  isExplicitPlaylistUrlInput,
  validateSoundroomQueryInput,
} from "@/web/soundroomLoadIdentifier";
import {
  countUserPublicWebPlaylists,
  countUserWebPlaylists,
  createPlaylistReport,
  getWebPlaylistById,
  getWebPlaylistTracks,
  MAX_WEB_PLAYLIST_TRACKS,
  MAX_WEB_PLAYLISTS_PER_USER,
  MAX_WEB_PUBLIC_PLAYLISTS_PER_USER,
  resolvePlaylistReportRecord,
  type WebPlaylistRecord,
  type WebPlaylistReportReason,
  type WebPlaylistTrackRecord,
  type WebPlaylistVisibility,
} from "@/web/playlistDb";
import {
  canViewWebPlaylist,
  isPlaylistOwner,
} from "@/web/playlistAuth";
import {
  resolveSingleSoundroomTrackForWeb,
  SoundroomSearchActionError,
} from "@/web/soundroomSearchActions";
import type { DiscordOAuthUserDto } from "@/web/types";
import type { WebSession } from "@/web/session";

export class PlaylistActionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PlaylistActionError";
    this.status = status;
    this.code = code;
  }
}

const HTTP_URL_RE = /^https?:\/\//i;

export function sanitizePlaylistSnapshotName(
  user: DiscordOAuthUserDto,
): string {
  const name =
    user.globalName?.trim() ||
    user.username?.trim() ||
    "사용자";
  return name.slice(0, 80);
}

export function validatePlaylistTitle(title: unknown): string {
  if (typeof title !== "string") {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_TITLE",
      "플레이리스트 제목을 입력해 주세요.",
    );
  }
  const t = title.trim();
  if (t.length < 1 || t.length > 40) {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_TITLE",
      "플레이리스트 제목은 1~40자여야 합니다.",
    );
  }
  return t;
}

export function validatePlaylistDescription(description: unknown): string {
  if (description === undefined || description === null) {
    return "";
  }
  if (typeof description !== "string") {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_DESCRIPTION",
      "플레이리스트 설명 형식이 올바르지 않습니다.",
    );
  }
  const d = description.trim();
  if (d.length > 200) {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_DESCRIPTION",
      "플레이리스트 설명은 200자 이하로 입력해 주세요.",
    );
  }
  return d;
}

export function validatePlaylistVisibility(
  visibility: unknown,
): WebPlaylistVisibility {
  if (visibility !== "private" && visibility !== "public") {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_VISIBILITY",
      "공개 범위는 private 또는 public만 가능합니다.",
    );
  }
  return visibility;
}

export function assertPlaylistCreateLimits(
  ownerUserId: string,
  visibility: WebPlaylistVisibility,
): void {
  if (countUserWebPlaylists(ownerUserId) >= MAX_WEB_PLAYLISTS_PER_USER) {
    throw new PlaylistActionError(
      400,
      "PLAYLIST_LIMIT_EXCEEDED",
      `플레이리스트는 최대 ${MAX_WEB_PLAYLISTS_PER_USER}개까지 만들 수 있습니다.`,
    );
  }
  if (
    visibility === "public" &&
    countUserPublicWebPlaylists(ownerUserId) >=
      MAX_WEB_PUBLIC_PLAYLISTS_PER_USER
  ) {
    throw new PlaylistActionError(
      400,
      "PUBLIC_PLAYLIST_LIMIT_EXCEEDED",
      `공개 플레이리스트는 최대 ${MAX_WEB_PUBLIC_PLAYLISTS_PER_USER}개까지 가능합니다.`,
    );
  }
}

export function assertPublicVisibilityChange(
  ownerUserId: string,
  visibility: WebPlaylistVisibility,
  excludePlaylistId?: string,
): void {
  if (visibility !== "public") {
    return;
  }
  if (
    countUserPublicWebPlaylists(ownerUserId, excludePlaylistId) >=
    MAX_WEB_PUBLIC_PLAYLISTS_PER_USER
  ) {
    throw new PlaylistActionError(
      400,
      "PUBLIC_PLAYLIST_LIMIT_EXCEEDED",
      `공개 플레이리스트는 최대 ${MAX_WEB_PUBLIC_PLAYLISTS_PER_USER}개까지 가능합니다.`,
    );
  }
}

export function requireViewablePlaylist(
  session: WebSession,
  playlist: WebPlaylistRecord | null,
  client: MineClient,
): WebPlaylistRecord {
  if (!playlist) {
    throw new PlaylistActionError(
      404,
      "PLAYLIST_NOT_FOUND",
      "플레이리스트를 찾을 수 없습니다.",
    );
  }
  if (playlist.is_deleted) {
    throw new PlaylistActionError(
      404,
      "PLAYLIST_DELETED",
      "삭제된 플레이리스트입니다.",
    );
  }
  if (!canViewWebPlaylist(session, playlist, client)) {
    if (playlist.is_hidden_by_admin && playlist.visibility === "public") {
      throw new PlaylistActionError(
        403,
        "PLAYLIST_HIDDEN",
        "숨김 처리된 플레이리스트입니다.",
      );
    }
    throw new PlaylistActionError(
      403,
      "PLAYLIST_ACCESS_DENIED",
      "이 플레이리스트를 볼 수 없습니다.",
    );
  }
  return playlist;
}

export function requireManageablePlaylist(
  session: WebSession,
  playlist: WebPlaylistRecord | null,
  client: MineClient,
): WebPlaylistRecord {
  const viewable = requireViewablePlaylist(session, playlist, client);
  if (
    !isPlaylistOwner(session, viewable) &&
    !client.config.developers.includes(session.user.id)
  ) {
    throw new PlaylistActionError(
      403,
      "PLAYLIST_MANAGE_DENIED",
      "플레이리스트를 수정할 권한이 없습니다.",
    );
  }
  return viewable;
}

function detectTrackSource(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return "youtube";
  }
  if (lower.includes("spotify.com")) {
    return "spotify";
  }
  if (lower.includes("soundcloud.com")) {
    return "soundcloud";
  }
  return "unknown";
}

function trackDurationMs(track: ExtendedTrack): number {
  const len = track.info.length;
  if (typeof len !== "number" || len < 0) {
    return 0;
  }
  return len > 0 ? len : 0;
}

export function trackRecordToDto(track: WebPlaylistTrackRecord) {
  return {
    id: track.id,
    position: track.position,
    title: track.title,
    uri: track.uri,
    author: track.author,
    durationMs: track.duration_ms,
    thumbnailUrl: track.thumbnail_url,
    source: track.source,
  };
}

export async function resolveTrackForWebPlaylist(
  client: MineClient,
  input: { query?: string; uri?: string },
): Promise<{
  title: string;
  uri: string;
  author: string;
  durationMs: number;
  thumbnailUrl: string | null;
  source: string;
}> {
  const raw =
    input.query !== undefined
      ? validateSoundroomQueryInput(input.query)
      : input.uri !== undefined
        ? validateSoundroomQueryInput(input.uri)
        : null;
  if (raw === null) {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_TRACK_INPUT",
      "query 또는 uri 중 하나만 보내 주세요.",
    );
  }
  if (isExplicitPlaylistUrlInput(raw)) {
    throw new PlaylistActionError(
      400,
      "PLAYLIST_NOT_SUPPORTED",
      "재생목록 URL은 플레이리스트 곡 추가에서 사용할 수 없습니다.",
    );
  }

  let track: ExtendedTrack;
  try {
    track = await resolveSingleSoundroomTrackForWeb(client, raw);
  } catch (error) {
    if (error instanceof SoundroomSearchActionError) {
      throw new PlaylistActionError(error.status, error.code, error.message);
    }
    throw new PlaylistActionError(
      500,
      "NO_TRACK_LOADED",
      "곡을 불러오지 못했습니다.",
    );
  }

  const uri = track.info.uri?.trim();
  if (!uri || !HTTP_URL_RE.test(uri)) {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_TRACK_INPUT",
      "저장할 수 있는 곡 주소를 찾지 못했습니다.",
    );
  }

  return {
    title: (track.info.title?.trim() || "제목 없음").slice(0, 120),
    uri,
    author: (track.info.author?.trim() || "").slice(0, 120),
    durationMs: trackDurationMs(track),
    thumbnailUrl: resolveSoundroomPlayingImageUrl(track),
    source: detectTrackSource(uri),
  };
}

export function clampPlaylistQueueLimit(limit: unknown): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return MAX_WEB_PLAYLIST_TRACKS;
  }
  const n = Math.floor(limit);
  return Math.min(MAX_WEB_PLAYLIST_TRACKS, Math.max(1, n));
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
      /* 패널 갱신 실패는 API 성공과 분리 */
    }
  })();
}

async function fetchRequesterMember(
  guild: import("discord.js").Guild,
  userId: string,
): Promise<GuildMember> {
  let member = guild.members.cache.get(userId);
  if (!member) {
    const fetched = await guild.members.fetch(userId).catch(() => null);
    if (fetched) {
      member = fetched;
    }
  }
  if (!member) {
    throw new PlaylistActionError(
      403,
      "GUILD_ACCESS_DENIED",
      "서버 멤버 정보를 확인할 수 없습니다.",
    );
  }
  return member;
}

/** 대기열 추가 시 requester는 실행한 사용자(원본 owner 아님). */
export async function addWebPlaylistTracksToSoundroomQueue(
  client: MineClient,
  guildId: string,
  soundroomChannelId: string,
  userVoiceChannelId: string,
  user: DiscordOAuthUserDto,
  playlist: WebPlaylistRecord,
  limitInput: unknown,
): Promise<{
  addedCount: number;
  requestedCount: number;
  limit: number;
  truncated: boolean;
}> {
  const tracks = getWebPlaylistTracks(playlist.id);
  if (tracks.length === 0) {
    throw new PlaylistActionError(
      400,
      "PLAYLIST_EMPTY",
      "플레이리스트에 곡이 없습니다.",
    );
  }

  const limit = clampPlaylistQueueLimit(limitInput);
  const requestedCount = tracks.length;
  const truncated = requestedCount > limit;
  const slice = tracks.slice(0, limit);

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    throw new PlaylistActionError(
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
  }

  const member = await fetchRequesterMember(guild, user.id);
  if (!member.voice.channelId) {
    throw new PlaylistActionError(
      403,
      "USER_NOT_IN_VOICE_CHANNEL",
      "먼저 음성 채널에 들어가 주세요.",
    );
  }
  if (member.voice.channelId !== userVoiceChannelId) {
    throw new PlaylistActionError(
      403,
      "NOT_SAME_VOICE_CHANNEL",
      "봇과 같은 음성 채널에서만 조작할 수 있습니다.",
    );
  }

  const riffy = client.riffy as { initiated?: boolean };
  if (!riffy?.initiated) {
    throw new PlaylistActionError(
      503,
      "LAVALINK_UNAVAILABLE",
      "음악 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const player = await ensurePlayerConnection(
    client,
    guildId,
    member.voice.channelId,
    soundroomChannelId,
  );

  const extended: ExtendedTrack[] = [];
  let skippedCount = 0;

  for (const row of slice) {
    try {
      const resolved = await resolveSingleSoundroomTrackForWeb(client, row.uri);
      resolved.info.requester = member;
      extended.push(resolved);
    } catch {
      skippedCount += 1;
    }
  }

  if (extended.length === 0) {
    throw new PlaylistActionError(
      404,
      "NO_TRACK_LOADED",
      "대기열에 추가할 수 있는 곡을 찾지 못했습니다.",
    );
  }

  addTracksRespectingSoundroomAutoplay(player, guildId, extended);
  onQueueMayHaveItems(guildId);

  if (player.queue.length > 0 && !player.playing && !player.paused) {
    try {
      await Promise.resolve(player.play());
    } catch {
      throw new PlaylistActionError(
        500,
        "INTERNAL_ERROR",
        "재생을 시작하지 못했습니다.",
      );
    }
  }

  refreshSoundroomPanelBestEffort(client, guildId, player);

  return {
    addedCount: extended.length,
    requestedCount,
    limit,
    truncated: truncated || skippedCount > 0,
  };
}

const PLAYLIST_REPORT_REASONS = new Set<WebPlaylistReportReason>([
  "inappropriate",
  "spam",
  "misleading",
  "broken",
  "other",
]);

export function validatePlaylistReportReason(
  reason: unknown,
): WebPlaylistReportReason {
  if (
    typeof reason !== "string" ||
    !PLAYLIST_REPORT_REASONS.has(reason as WebPlaylistReportReason)
  ) {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_REPORT_REASON",
      "신고 사유를 선택해 주세요.",
    );
  }
  return reason as WebPlaylistReportReason;
}

export function validatePlaylistReportDetail(detail: unknown): string {
  if (detail === undefined || detail === null) {
    return "";
  }
  if (typeof detail !== "string") {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_REPORT_DETAIL",
      "신고 상세 내용 형식이 올바르지 않습니다.",
    );
  }
  const d = detail.trim();
  if (d.length > 300) {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_REPORT_DETAIL",
      "신고 상세 내용은 300자 이내로 입력해 주세요.",
    );
  }
  return d;
}

export function validatePlaylistResolutionNote(note: unknown): string {
  if (note === undefined || note === null) {
    return "";
  }
  if (typeof note !== "string") {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_REPORT_RESOLUTION",
      "처리 메모 형식이 올바르지 않습니다.",
    );
  }
  const n = note.trim();
  if (n.length > 300) {
    throw new PlaylistActionError(
      400,
      "INVALID_PLAYLIST_REPORT_RESOLUTION",
      "처리 메모는 300자 이내로 입력해 주세요.",
    );
  }
  return n;
}

/** 신고는 운영자 확인용이며 자동 제재·숨김은 하지 않는다. */
export function submitWebPlaylistReport(
  session: WebSession,
  client: MineClient,
  playlistId: string,
  body: { reason?: unknown; detail?: unknown },
): void {
  const playlist = getWebPlaylistById(playlistId);
  if (!playlist || playlist.is_deleted) {
    throw new PlaylistActionError(
      404,
      "PLAYLIST_NOT_FOUND",
      "플레이리스트를 찾을 수 없습니다.",
    );
  }
  if (playlist.visibility !== "public") {
    throw new PlaylistActionError(
      403,
      "PLAYLIST_ACCESS_DENIED",
      "공개 플레이리스트만 신고할 수 있습니다.",
    );
  }
  if (isPlaylistOwner(session, playlist)) {
    throw new PlaylistActionError(
      403,
      "PLAYLIST_REPORT_SELF_DENIED",
      "내가 만든 플레이리스트는 신고할 수 없습니다.",
    );
  }
  requireViewablePlaylist(session, playlist, client);
  const reason = validatePlaylistReportReason(body.reason);
  const detail = validatePlaylistReportDetail(body.detail);
  try {
    createPlaylistReport({
      playlistId,
      reporterUserId: session.user.id,
      reporterNameSnapshot: sanitizePlaylistSnapshotName(session.user),
      reason,
      detail,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PLAYLIST_REPORT_DUPLICATE"
    ) {
      throw new PlaylistActionError(
        409,
        "PLAYLIST_REPORT_DUPLICATE",
        "이미 신고한 플레이리스트입니다.",
      );
    }
    throw error;
  }
}

export function completeWebPlaylistReport(
  reportId: string,
  resolverUserId: string,
  resolutionNote: unknown,
): void {
  const note = validatePlaylistResolutionNote(resolutionNote);
  const updated = resolvePlaylistReportRecord(
    reportId,
    resolverUserId,
    note,
  );
  if (!updated) {
    throw new PlaylistActionError(
      404,
      "PLAYLIST_REPORT_NOT_FOUND",
      "신고 내역을 찾을 수 없습니다.",
    );
  }
}

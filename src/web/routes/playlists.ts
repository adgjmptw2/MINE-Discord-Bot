import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import {
  getAuthenticatedSession,
  GUILD_ID_PATTERN,
  requireAuthenticatedSessionWithCsrf,
} from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import { buildSoundroomGuildStateDto } from "@/web/soundroomDto";
import { readJsonBody, readRequestUrl, sendError, sendJson } from "@/web/http";
import {
  addWebPlaylistTrack,
  countWebPlaylistTracks,
  createWebPlaylist,
  getFavoriteCountsForPlaylists,
  getPlaylistFavoriteCount,
  getWebPlaylistById,
  getWebPlaylistTrackById,
  getWebPlaylistTracks,
  listAdminPlaylistReports,
  listAdminPublicWebPlaylists,
  listMyWebPlaylists,
  listPublicWebPlaylists,
  MAX_WEB_PLAYLIST_TRACKS,
  removeWebPlaylistTrack,
  reorderWebPlaylistTracks,
  setWebPlaylistHiddenByAdmin,
  softDeleteWebPlaylist,
  updateWebPlaylist,
  type WebPlaylistFavoriteListRow,
} from "@/web/playlistDb";
import {
  canManageWebPlaylist,
  isPlaylistOwner,
  isWebDashboardBotOwner,
  requirePlaylistAdminAccess,
} from "@/web/playlistAuth";
import {
  addWebPlaylistTracksToSoundroomQueue,
  assertPlaylistCreateLimits,
  assertPublicVisibilityChange,
  attachFavoriteStateToPublicPlaylists,
  completeWebPlaylistReport,
  favoritePlaylist,
  listFavoritePlaylists,
  PlaylistActionError,
  requireManageablePlaylist,
  requireViewablePlaylist,
  resolvePlaylistDetailFavoriteState,
  resolveTrackForWebPlaylist,
  sanitizePlaylistSnapshotName,
  submitWebPlaylistReport,
  trackRecordToDto,
  unfavoritePlaylist,
  validatePlaylistDescription,
  validatePlaylistTitle,
  validatePlaylistVisibility,
} from "@/web/playlistActions";
import {
  requireWebSoundroomQueueAccess,
  type WebAuthzError,
} from "@/web/soundroomControlAuth";
import { sendWebRemoteNotice } from "@/web/soundroomChannelNotice";
import { buildWebRemoteSavedPlaylistAddNotice } from "@/web/soundroomWebRemoteNotices";
import type {
  WebPlaylistAdminListHiddenFilter,
  WebPlaylistAdminReportStatusFilter,
  WebPlaylistAdminReportSummaryDto,
  WebPlaylistAdminSummaryDto,
  WebPlaylistDetailDto,
  WebPlaylistFavoriteSummaryDto,
  WebPlaylistPublicSummaryDto,
  WebPlaylistSummaryDto,
} from "@/web/types";
import type { AdminPlaylistReportRow } from "@/web/playlistDb";
import { log } from "@/utils/logger";

const PLAYLIST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AUTH_PLAYLIST_ADD_TO_QUEUE_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/playlists\/([^/]+)\/add-to-queue\/?$/;

function sendAuthzFailure(res: ServerResponse, err: WebAuthzError): void {
  sendError(res, err.status, err.code, err.message);
}

function authDisabled(res: ServerResponse): boolean {
  if (!isWebDashboardAuthEnabled()) {
    sendError(
      res,
      503,
      "AUTH_DISABLED",
      "웹 대시보드 로그인이 비활성화되어 있습니다.",
    );
    return true;
  }
  return false;
}

function requireSession(
  req: IncomingMessage,
  res: ServerResponse,
): ReturnType<typeof getAuthenticatedSession> {
  const session = getAuthenticatedSession(req);
  if (!session) {
    sendError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return null;
  }
  return session;
}

type PlaylistRowWithStats = {
  queue_add_count: number;
  last_queued_at: string | null;
};

function statsFields(
  row: PlaylistRowWithStats,
  favoriteCount: number,
): Pick<
  WebPlaylistSummaryDto,
  "queueAddCount" | "favoriteCount" | "lastQueuedAt"
> {
  return {
    queueAddCount: Math.max(0, row.queue_add_count),
    favoriteCount: Math.max(0, favoriteCount),
    lastQueuedAt: row.last_queued_at,
  };
}

function toSummaryDto(
  row: Awaited<ReturnType<typeof listMyWebPlaylists>>[number],
  favoriteCount: number,
): WebPlaylistSummaryDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    trackCount: row.track_count,
    ...statsFields(row, favoriteCount),
    isHiddenByAdmin: row.is_hidden_by_admin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAdminSummaryDto(
  row: Awaited<ReturnType<typeof listAdminPublicWebPlaylists>>[number],
  favoriteCount: number,
): WebPlaylistAdminSummaryDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ownerNameSnapshot: row.owner_name_snapshot,
    trackCount: row.track_count,
    ...statsFields(row, favoriteCount),
    isHiddenByAdmin: row.is_hidden_by_admin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAdminReportDto(row: AdminPlaylistReportRow): WebPlaylistAdminReportSummaryDto {
  const deleted = row.playlist_is_deleted === 1;
  return {
    id: row.id,
    playlist: {
      id: row.playlist_id,
      title: deleted
        ? "삭제된 플레이리스트"
        : (row.playlist_title?.trim() || "제목 없음"),
      ownerNameSnapshot:
        row.playlist_owner_name_snapshot?.trim() || "알 수 없음",
      isHiddenByAdmin: row.playlist_is_hidden_by_admin === 1,
    },
    reporterNameSnapshot: row.reporter_name_snapshot,
    reason: row.reason,
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
  };
}

function toPublicSummaryDto(
  row: Awaited<ReturnType<typeof listPublicWebPlaylists>>[number],
  favoriteCount: number,
  isFavorited?: boolean,
): WebPlaylistPublicSummaryDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ownerNameSnapshot: row.owner_name_snapshot,
    trackCount: row.track_count,
    ...statsFields(row, favoriteCount),
    isFavorited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFavoriteSummaryDto(
  row: WebPlaylistFavoriteListRow,
  favoriteCount: number,
): WebPlaylistFavoriteSummaryDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ownerNameSnapshot: row.owner_name_snapshot,
    trackCount: row.track_count,
    ...statsFields(row, favoriteCount),
    isFavorited: true,
    favoritedAt: row.favorited_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDetailDto(
  client: MineClient,
  session: NonNullable<ReturnType<typeof getAuthenticatedSession>>,
  playlist: NonNullable<ReturnType<typeof getWebPlaylistById>>,
  tracks: ReturnType<typeof getWebPlaylistTracks>,
): WebPlaylistDetailDto {
  const owner = isPlaylistOwner(session, playlist);
  const favoriteCount =
    playlist.visibility === "public" && playlist.is_deleted === 0
      ? getPlaylistFavoriteCount(playlist.id)
      : 0;
  const dto: WebPlaylistDetailDto = {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    visibility: playlist.visibility,
    ownerNameSnapshot: playlist.owner_name_snapshot,
    isOwner: owner,
    canManage: canManageWebPlaylist(session, playlist, client),
    isHiddenByAdmin: playlist.is_hidden_by_admin === 1,
    queueAddCount: Math.max(0, playlist.queue_add_count),
    favoriteCount,
    lastQueuedAt: playlist.last_queued_at,
    createdAt: playlist.created_at,
    updatedAt: playlist.updated_at,
    tracks: tracks.map(trackRecordToDto),
  };
  if (playlist.visibility === "public" && !playlist.is_deleted) {
    dto.isFavorited = resolvePlaylistDetailFavoriteState(session, playlist);
  }
  return dto;
}

function handlePlaylistActionError(
  res: ServerResponse,
  error: unknown,
): void {
  if (error instanceof PlaylistActionError) {
    sendError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof Error && error.message === "INVALID_PLAYLIST_TRACK_ORDER") {
    sendError(
      res,
      400,
      "INVALID_PLAYLIST_TRACK_ORDER",
      "곡 순서 목록이 올바르지 않습니다.",
    );
    return;
  }
  sendError(res, 500, "INTERNAL_ERROR", "요청 처리 중 오류가 발생했습니다.");
}

type PlaylistRoute =
  | { kind: "mine" }
  | { kind: "public" }
  | { kind: "favorites" }
  | { kind: "admin_public" }
  | { kind: "admin_reports" }
  | { kind: "admin_report_resolve"; reportId: string }
  | { kind: "playlist_report"; playlistId: string }
  | { kind: "playlist_favorite"; playlistId: string }
  | { kind: "root" }
  | { kind: "detail"; playlistId: string }
  | { kind: "tracks"; playlistId: string }
  | { kind: "reorder"; playlistId: string }
  | { kind: "track"; playlistId: string; trackId: string }
  | { kind: "admin_hide"; playlistId: string };

function parsePlaylistRoute(pathname: string): PlaylistRoute | null {
  const base = "/api/auth/playlists";
  if (!pathname.startsWith(base)) {
    return null;
  }
  const rest = pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
  if (!rest) {
    return { kind: "root" };
  }
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 1 && parts[0] === "mine") {
    return { kind: "mine" };
  }
  if (parts.length === 1 && parts[0] === "public") {
    return { kind: "public" };
  }
  if (parts.length === 1 && parts[0] === "favorites") {
    return { kind: "favorites" };
  }
  // admin이 playlist :id로 해석되지 않도록 선매칭
  if (parts.length === 2 && parts[0] === "admin" && parts[1] === "public") {
    return { kind: "admin_public" };
  }
  if (parts.length === 2 && parts[0] === "admin" && parts[1] === "reports") {
    return { kind: "admin_reports" };
  }
  if (
    parts.length === 4 &&
    parts[0] === "admin" &&
    parts[1] === "reports" &&
    PLAYLIST_ID_PATTERN.test(parts[2]!) &&
    parts[3] === "resolve"
  ) {
    return { kind: "admin_report_resolve", reportId: parts[2]! };
  }
  if (
    parts.length === 2 &&
    PLAYLIST_ID_PATTERN.test(parts[0]!) &&
    parts[1] === "report"
  ) {
    return { kind: "playlist_report", playlistId: parts[0]! };
  }
  if (
    parts.length === 2 &&
    PLAYLIST_ID_PATTERN.test(parts[0]!) &&
    parts[1] === "favorite"
  ) {
    return { kind: "playlist_favorite", playlistId: parts[0]! };
  }
  if (parts.length === 1 && PLAYLIST_ID_PATTERN.test(parts[0]!)) {
    return { kind: "detail", playlistId: parts[0]! };
  }
  if (
    parts.length === 2 &&
    PLAYLIST_ID_PATTERN.test(parts[0]!) &&
    parts[1] === "tracks"
  ) {
    return { kind: "tracks", playlistId: parts[0]! };
  }
  if (
    parts.length === 3 &&
    PLAYLIST_ID_PATTERN.test(parts[0]!) &&
    parts[1] === "tracks" &&
    parts[2] === "reorder"
  ) {
    return { kind: "reorder", playlistId: parts[0]! };
  }
  if (
    parts.length === 3 &&
    PLAYLIST_ID_PATTERN.test(parts[0]!) &&
    parts[1] === "tracks" &&
    PLAYLIST_ID_PATTERN.test(parts[2]!)
  ) {
    return {
      kind: "track",
      playlistId: parts[0]!,
      trackId: parts[2]!,
    };
  }
  if (
    parts.length === 3 &&
    PLAYLIST_ID_PATTERN.test(parts[0]!) &&
    parts[1] === "admin" &&
    parts[2] === "hide"
  ) {
    return { kind: "admin_hide", playlistId: parts[0]! };
  }
  return null;
}

export async function handleWebPlaylistAddToQueue(
  req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
  guildId: string,
  playlistId: string,
): Promise<void> {
  if (authDisabled(res)) {
    return;
  }
  if (!GUILD_ID_PATTERN.test(guildId) || !PLAYLIST_ID_PATTERN.test(playlistId)) {
    sendError(res, 400, "INVALID_PLAYLIST_ID", "잘못된 요청입니다.");
    return;
  }
  if (!requireAuthenticatedSessionWithCsrf(req, res)) {
    return;
  }

  const access = await requireWebSoundroomQueueAccess(client, req, guildId);
  if ("status" in access) {
    sendAuthzFailure(res, access);
    return;
  }

  const session = access.session;
  const playlist = getWebPlaylistById(playlistId);
  try {
    const viewable = requireViewablePlaylist(session, playlist, client);
    const bodyResult = await readJsonBody<{ limit?: number }>(req);
    if (!bodyResult.ok) {
      const message =
        bodyResult.code === "PAYLOAD_TOO_LARGE"
          ? "요청 본문이 너무 큽니다."
          : "요청 JSON을 읽을 수 없습니다.";
      sendError(res, bodyResult.status, bodyResult.code, message);
      return;
    }

    const result = await addWebPlaylistTracksToSoundroomQueue(
      client,
      guildId,
      access.soundroomChannelId,
      access.userVoiceChannelId,
      session.user,
      viewable,
      bodyResult.data?.limit,
    );
    const state = buildSoundroomGuildStateDto(client, guildId);
    void sendWebRemoteNotice(
      client,
      guildId,
      session.user.id,
      buildWebRemoteSavedPlaylistAddNotice(
        result.addedCount,
        result.truncated,
      ),
    );
    sendJson(res, 200, {
      ok: true,
      addedCount: result.addedCount,
      requestedCount: result.requestedCount,
      limit: result.limit,
      truncated: result.truncated,
      playlist: { id: viewable.id, title: viewable.title },
      state,
    });
  } catch (error) {
    handlePlaylistActionError(res, error);
  }
}

export async function handleWebPlaylistRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
  pathname: string,
  method: string,
): Promise<boolean> {
  const addQueueMatch = pathname.match(AUTH_PLAYLIST_ADD_TO_QUEUE_PATH);
  if (addQueueMatch) {
    if (method !== "POST") {
      sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
      return true;
    }
    await handleWebPlaylistAddToQueue(
      req,
      res,
      client,
      addQueueMatch[1]!,
      addQueueMatch[2]!,
    );
    return true;
  }

  const route = parsePlaylistRoute(pathname);
  if (!route) {
    return false;
  }

  if (authDisabled(res)) {
    return true;
  }

  if (route.kind === "mine") {
    if (method !== "GET") {
      sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
      return true;
    }
    const session = requireSession(req, res);
    if (!session) {
      return true;
    }
    const rows = listMyWebPlaylists(session.user.id);
    const favCounts = getFavoriteCountsForPlaylists(rows.map((r) => r.id));
    sendJson(res, 200, {
      ok: true,
      playlists: rows.map((row) =>
        toSummaryDto(row, favCounts.get(row.id) ?? 0),
      ),
    });
    return true;
  }

  if (route.kind === "public") {
    if (method !== "GET") {
      sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
      return true;
    }
    const session = requireSession(req, res);
    if (!session) {
      return true;
    }
    const { searchParams } = readRequestUrl(req);
    const q = searchParams.get("q") ?? undefined;
    let limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    if (!Number.isFinite(limit) || limit < 1) {
      limit = 20;
    }
    if (limit > 50) {
      limit = 50;
    }
    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }
    const rows = listPublicWebPlaylists({ q, limit, offset });
    const withFavorites = attachFavoriteStateToPublicPlaylists(session, rows);
    const favCounts = getFavoriteCountsForPlaylists(
      withFavorites.map((r) => r.id),
    );
    sendJson(res, 200, {
      ok: true,
      playlists: withFavorites.map((row) =>
        toPublicSummaryDto(
          row,
          favCounts.get(row.id) ?? 0,
          row.isFavorited,
        ),
      ),
      limit,
      offset,
    });
    return true;
  }

  if (route.kind === "favorites") {
    if (method !== "GET") {
      sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
      return true;
    }
    const session = requireSession(req, res);
    if (!session) {
      return true;
    }
    const { searchParams } = readRequestUrl(req);
    let limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    if (!Number.isFinite(limit) || limit < 1) {
      limit = 20;
    }
    if (limit > 50) {
      limit = 50;
    }
    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }
    const rows = listFavoritePlaylists(session, { limit, offset });
    const favCounts = getFavoriteCountsForPlaylists(rows.map((r) => r.id));
    sendJson(res, 200, {
      ok: true,
      playlists: rows.map((row) =>
        toFavoriteSummaryDto(row, favCounts.get(row.id) ?? 0),
      ),
      limit,
      offset,
    });
    return true;
  }

  if (route.kind === "admin_public") {
    if (method !== "GET") {
      sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
      return true;
    }
    const session = requireSession(req, res);
    if (!session) {
      return true;
    }
    const admin = requirePlaylistAdminAccess(session, client);
    if (!admin.ok) {
      sendError(
        res,
        403,
        "PLAYLIST_ADMIN_REQUIRED",
        "플레이리스트 운영자 권한이 필요합니다.",
      );
      return true;
    }
    const { searchParams } = readRequestUrl(req);
    const q = searchParams.get("q") ?? undefined;
    const hiddenRaw = searchParams.get("hidden") ?? "all";
    const hidden: WebPlaylistAdminListHiddenFilter =
      hiddenRaw === "visible" || hiddenRaw === "hidden" ? hiddenRaw : "all";
    let limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    if (!Number.isFinite(limit) || limit < 1) {
      limit = 20;
    }
    if (limit > 50) {
      limit = 50;
    }
    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }
    const rows = listAdminPublicWebPlaylists({ q, hidden, limit, offset });
    const favCounts = getFavoriteCountsForPlaylists(rows.map((r) => r.id));
    sendJson(res, 200, {
      ok: true,
      playlists: rows.map((row) =>
        toAdminSummaryDto(row, favCounts.get(row.id) ?? 0),
      ),
      hidden,
      limit,
      offset,
    });
    return true;
  }

  if (route.kind === "admin_reports") {
    if (method !== "GET") {
      sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
      return true;
    }
    const session = requireSession(req, res);
    if (!session) {
      return true;
    }
    const admin = requirePlaylistAdminAccess(session, client);
    if (!admin.ok) {
      sendError(
        res,
        403,
        "PLAYLIST_ADMIN_REQUIRED",
        "플레이리스트 운영자 권한이 필요합니다.",
      );
      return true;
    }
    const { searchParams } = readRequestUrl(req);
    const q = searchParams.get("q") ?? undefined;
    const statusRaw = searchParams.get("status") ?? "open";
    const status: WebPlaylistAdminReportStatusFilter =
      statusRaw === "resolved" || statusRaw === "all" ? statusRaw : "open";
    let limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
    let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    if (!Number.isFinite(limit) || limit < 1) {
      limit = 20;
    }
    if (limit > 50) {
      limit = 50;
    }
    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }
    const rows = listAdminPlaylistReports({ status, q, limit, offset });
    sendJson(res, 200, {
      ok: true,
      reports: rows.map(toAdminReportDto),
      status,
      limit,
      offset,
    });
    return true;
  }

  if (route.kind === "admin_report_resolve" && method === "POST") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    const admin = requirePlaylistAdminAccess(session, client);
    if (!admin.ok) {
      sendError(
        res,
        403,
        "PLAYLIST_ADMIN_REQUIRED",
        "플레이리스트 운영자 권한이 필요합니다.",
      );
      return true;
    }
    const bodyResult = await readJsonBody<{ resolutionNote?: unknown }>(req);
    if (!bodyResult.ok) {
      const message =
        bodyResult.code === "PAYLOAD_TOO_LARGE"
          ? "요청 본문이 너무 큽니다."
          : "요청 JSON을 읽을 수 없습니다.";
      sendError(res, bodyResult.status, bodyResult.code, message);
      return true;
    }
    try {
      completeWebPlaylistReport(
        route.reportId,
        session.user.id,
        bodyResult.data?.resolutionNote,
      );
      sendJson(res, 200, { ok: true, resolved: true });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "playlist_favorite" && method === "POST") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    try {
      favoritePlaylist(session, route.playlistId);
      sendJson(res, 200, { ok: true, favorited: true });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "playlist_favorite" && method === "DELETE") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    try {
      unfavoritePlaylist(session, route.playlistId);
      sendJson(res, 200, { ok: true, favorited: false });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "playlist_report" && method === "POST") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    const bodyResult = await readJsonBody<unknown>(req);
    if (!bodyResult.ok) {
      const message =
        bodyResult.code === "PAYLOAD_TOO_LARGE"
          ? "요청 본문이 너무 큽니다."
          : "요청 JSON을 읽을 수 없습니다.";
      sendError(res, bodyResult.status, bodyResult.code, message);
      return true;
    }
    try {
      const body = bodyResult.data as { reason?: unknown; detail?: unknown };
      submitWebPlaylistReport(session, client, route.playlistId, body);
      sendJson(res, 200, { ok: true, reported: true });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "root" && method === "POST") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    const bodyResult = await readJsonBody<unknown>(req);
    if (!bodyResult.ok) {
      const message =
        bodyResult.code === "PAYLOAD_TOO_LARGE"
          ? "요청 본문이 너무 큽니다."
          : "요청 JSON을 읽을 수 없습니다.";
      sendError(res, bodyResult.status, bodyResult.code, message);
      return true;
    }
    try {
      const body = bodyResult.data as {
        title?: unknown;
        description?: unknown;
        visibility?: unknown;
      };
      const title = validatePlaylistTitle(body.title);
      const description = validatePlaylistDescription(body.description);
      const visibility = validatePlaylistVisibility(body.visibility);
      assertPlaylistCreateLimits(session.user.id, visibility);
      const created = createWebPlaylist({
        ownerUserId: session.user.id,
        ownerNameSnapshot: sanitizePlaylistSnapshotName(session.user),
        title,
        description,
        visibility,
      });
      sendJson(res, 200, {
        ok: true,
        playlist: toDetailDto(client, session, created, []),
      });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "detail") {
    if (method === "GET") {
      const session = requireSession(req, res);
      if (!session) {
        return true;
      }
      try {
        const playlist = getWebPlaylistById(route.playlistId);
        const viewable = requireViewablePlaylist(session, playlist, client);
        const tracks = getWebPlaylistTracks(viewable.id);
        sendJson(res, 200, {
          ok: true,
          playlist: toDetailDto(client, session, viewable, tracks),
        });
      } catch (error) {
        handlePlaylistActionError(res, error);
      }
      return true;
    }

    if (method === "PATCH") {
      const session = requireAuthenticatedSessionWithCsrf(req, res);
      if (!session) {
        return true;
      }
      const bodyResult = await readJsonBody<unknown>(req);
      if (!bodyResult.ok) {
        const message =
          bodyResult.code === "PAYLOAD_TOO_LARGE"
            ? "요청 본문이 너무 큽니다."
            : "요청 JSON을 읽을 수 없습니다.";
        sendError(res, bodyResult.status, bodyResult.code, message);
        return true;
      }
      try {
        const playlist = getWebPlaylistById(route.playlistId);
        const manageable = requireManageablePlaylist(
          session,
          playlist,
          client,
        );
        if (
          manageable.is_hidden_by_admin &&
          isPlaylistOwner(session, manageable) &&
          !isWebDashboardBotOwner(session.user.id, client)
        ) {
          const body = bodyResult.data as { visibility?: unknown };
          if (body.visibility === "public") {
            throw new PlaylistActionError(
              403,
              "PLAYLIST_HIDDEN",
              "운영자에 의해 숨김 처리된 플레이리스트입니다.",
            );
          }
        }
        const body = bodyResult.data as {
          title?: unknown;
          description?: unknown;
          visibility?: unknown;
        };
        const patch: {
          title?: string;
          description?: string;
          visibility?: "private" | "public";
        } = {};
        if (body.title !== undefined) {
          patch.title = validatePlaylistTitle(body.title);
        }
        if (body.description !== undefined) {
          patch.description = validatePlaylistDescription(body.description);
        }
        if (body.visibility !== undefined) {
          patch.visibility = validatePlaylistVisibility(body.visibility);
          assertPublicVisibilityChange(
            manageable.owner_user_id,
            patch.visibility,
            manageable.id,
          );
        }
        const updated = updateWebPlaylist(manageable.id, patch);
        if (!updated) {
          throw new PlaylistActionError(
            404,
            "PLAYLIST_NOT_FOUND",
            "플레이리스트를 찾을 수 없습니다.",
          );
        }
        const tracks = getWebPlaylistTracks(updated.id);
        sendJson(res, 200, {
          ok: true,
          playlist: toDetailDto(client, session, updated, tracks),
        });
      } catch (error) {
        handlePlaylistActionError(res, error);
      }
      return true;
    }

    if (method === "DELETE") {
      const session = requireAuthenticatedSessionWithCsrf(req, res);
      if (!session) {
        return true;
      }
      try {
        const playlist = getWebPlaylistById(route.playlistId);
        requireManageablePlaylist(session, playlist, client);
        softDeleteWebPlaylist(route.playlistId);
        sendJson(res, 200, { ok: true, deleted: true });
      } catch (error) {
        handlePlaylistActionError(res, error);
      }
      return true;
    }

    sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
    return true;
  }

  if (route.kind === "tracks" && method === "POST") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    const bodyResult = await readJsonBody<unknown>(req);
    if (!bodyResult.ok) {
      const message =
        bodyResult.code === "PAYLOAD_TOO_LARGE"
          ? "요청 본문이 너무 큽니다."
          : "요청 JSON을 읽을 수 없습니다.";
      sendError(res, bodyResult.status, bodyResult.code, message);
      return true;
    }
    try {
      const playlist = getWebPlaylistById(route.playlistId);
      const manageable = requireManageablePlaylist(session, playlist, client);
      if (countWebPlaylistTracks(manageable.id) >= MAX_WEB_PLAYLIST_TRACKS) {
        throw new PlaylistActionError(
          400,
          "PLAYLIST_TRACK_LIMIT_EXCEEDED",
          `플레이리스트에는 최대 ${MAX_WEB_PLAYLIST_TRACKS}곡까지 추가할 수 있습니다.`,
        );
      }
      const body = bodyResult.data as { query?: string; uri?: string };
      if (body.query && body.uri) {
        throw new PlaylistActionError(
          400,
          "INVALID_PLAYLIST_TRACK_INPUT",
          "query와 uri를 동시에 보낼 수 없습니다.",
        );
      }
      const meta = await resolveTrackForWebPlaylist(client, body);
      const row = addWebPlaylistTrack(manageable.id, {
        title: meta.title,
        uri: meta.uri,
        author: meta.author,
        durationMs: meta.durationMs,
        thumbnailUrl: meta.thumbnailUrl,
        source: meta.source,
      });
      sendJson(res, 200, { ok: true, track: trackRecordToDto(row) });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "track" && method === "DELETE") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    try {
      const playlist = getWebPlaylistById(route.playlistId);
      requireManageablePlaylist(session, playlist, client);
      const track = getWebPlaylistTrackById(route.playlistId, route.trackId);
      if (!track) {
        throw new PlaylistActionError(
          404,
          "PLAYLIST_TRACK_NOT_FOUND",
          "플레이리스트에서 곡을 찾을 수 없습니다.",
        );
      }
      removeWebPlaylistTrack(route.playlistId, route.trackId);
      sendJson(res, 200, { ok: true, removed: true });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "reorder" && method === "POST") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    const bodyResult = await readJsonBody<unknown>(req);
    if (!bodyResult.ok) {
      const message =
        bodyResult.code === "PAYLOAD_TOO_LARGE"
          ? "요청 본문이 너무 큽니다."
          : "요청 JSON을 읽을 수 없습니다.";
      sendError(res, bodyResult.status, bodyResult.code, message);
      return true;
    }
    try {
      const playlist = getWebPlaylistById(route.playlistId);
      requireManageablePlaylist(session, playlist, client);
      const body = bodyResult.data as { trackIds?: unknown };
      if (!Array.isArray(body.trackIds)) {
        throw new PlaylistActionError(
          400,
          "INVALID_PLAYLIST_TRACK_ORDER",
          "곡 순서 목록이 올바르지 않습니다.",
        );
      }
      const trackIds = body.trackIds.filter(
        (id): id is string => typeof id === "string",
      );
      const tracks = reorderWebPlaylistTracks(route.playlistId, trackIds);
      sendJson(res, 200, {
        ok: true,
        tracks: tracks.map(trackRecordToDto),
      });
    } catch (error) {
      handlePlaylistActionError(res, error);
    }
    return true;
  }

  if (route.kind === "admin_hide" && method === "POST") {
    const session = requireAuthenticatedSessionWithCsrf(req, res);
    if (!session) {
      return true;
    }
    const admin = requirePlaylistAdminAccess(session, client);
    if (!admin.ok) {
      sendError(
        res,
        403,
        "PLAYLIST_ADMIN_REQUIRED",
        "플레이리스트 운영자 권한이 필요합니다.",
      );
      return true;
    }
    const bodyResult = await readJsonBody<{ hidden?: unknown }>(req);
    if (!bodyResult.ok) {
      const message =
        bodyResult.code === "PAYLOAD_TOO_LARGE"
          ? "요청 본문이 너무 큽니다."
          : "요청 JSON을 읽을 수 없습니다.";
      sendError(res, bodyResult.status, bodyResult.code, message);
      return true;
    }
    if (typeof bodyResult.data?.hidden !== "boolean") {
      sendError(res, 400, "INVALID_JSON", "hidden 값이 올바르지 않습니다.");
      return true;
    }
    const playlist = getWebPlaylistById(route.playlistId);
    if (!playlist || playlist.is_deleted) {
      sendError(
        res,
        404,
        "PLAYLIST_NOT_FOUND",
        "플레이리스트를 찾을 수 없습니다.",
      );
      return true;
    }
    const updated = setWebPlaylistHiddenByAdmin(
      route.playlistId,
      bodyResult.data.hidden,
    );
    if (!updated) {
      sendError(
        res,
        404,
        "PLAYLIST_NOT_FOUND",
        "플레이리스트를 찾을 수 없습니다.",
      );
      return true;
    }
    log(
      "info",
      "web",
      `Playlist admin hide=${bodyResult.data.hidden} id=${route.playlistId}`,
    );
    sendJson(res, 200, { ok: true, hidden: bodyResult.data.hidden });
    return true;
  }

  if (route.kind === "root") {
    sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 메서드입니다.");
    return true;
  }

  sendError(res, 404, "NOT_FOUND", "요청한 경로를 찾을 수 없습니다.");
  return true;
}

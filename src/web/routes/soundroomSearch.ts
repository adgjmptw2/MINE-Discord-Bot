import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import {
  GUILD_ID_PATTERN,
  requireAuthenticatedSessionWithCsrf,
} from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import { readJsonBody, sendError, sendJson } from "@/web/http";
import {
  requireWebSoundroomQueueAccess,
  type WebAuthzError,
} from "@/web/soundroomControlAuth";
import { buildSoundroomGuildStateDto } from "@/web/soundroomDto";
import {
  SoundroomLoadIdentifierError,
  validateSoundroomQueryInput,
} from "@/web/soundroomLoadIdentifier";
import { sendWebRemoteNotice } from "@/web/soundroomChannelNotice";
import { addSoundroomPlaylistFromWeb } from "@/web/soundroomPlaylistImport";
import {
  addSoundroomTrackFromWeb,
  searchSoundroomTracks,
  SoundroomSearchActionError,
} from "@/web/soundroomSearchActions";
import {
  buildWebRemotePlaylistAddNotice,
  buildWebRemoteTrackAddNotice,
} from "@/web/soundroomWebRemoteNotices";
import type {
  SoundroomAddRequestDto,
  SoundroomAddResponseDto,
  SoundroomPlaylistAddRequestDto,
  SoundroomPlaylistAddResponseDto,
  SoundroomSearchRequestDto,
  SoundroomSearchResponseDto,
} from "@/web/types";
import { log } from "@/utils/logger";

function sendAuthzFailure(res: ServerResponse, err: WebAuthzError): void {
  sendError(res, err.status, err.code, err.message);
}

function isSearchRequestDto(value: unknown): value is SoundroomSearchRequestDto {
  if (!value || typeof value !== "object") {
    return false;
  }
  const query = (value as SoundroomSearchRequestDto).query;
  return typeof query === "string";
}

function isPlaylistAddRequestDto(
  value: unknown,
): value is SoundroomPlaylistAddRequestDto {
  if (!value || typeof value !== "object") {
    return false;
  }
  return typeof (value as SoundroomPlaylistAddRequestDto).uri === "string";
}

function parseAddRequestDto(value: unknown): SoundroomAddRequestDto | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const body = value as SoundroomAddRequestDto;
  const hasQuery = typeof body.query === "string";
  const hasUri = typeof body.uri === "string";
  if (hasQuery && hasUri) {
    return null;
  }
  if (!hasQuery && !hasUri) {
    return null;
  }
  return {
    query: hasQuery ? body.query : undefined,
    uri: hasUri ? body.uri : undefined,
  };
}

export async function handleSoundroomSearch(
  req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
  guildId: string,
): Promise<void> {
  if (!isWebDashboardAuthEnabled()) {
    sendError(
      res,
      503,
      "AUTH_DISABLED",
      "웹 대시보드 로그인이 비활성화되어 있습니다.",
    );
    return;
  }

  if (!GUILD_ID_PATTERN.test(guildId)) {
    sendError(res, 400, "INVALID_GUILD_ID", "잘못된 서버 ID입니다.");
    return;
  }

  if (!requireAuthenticatedSessionWithCsrf(req, res)) {
    return;
  }

  const bodyResult = await readJsonBody<unknown>(req);
  if (!bodyResult.ok) {
    const message =
      bodyResult.code === "PAYLOAD_TOO_LARGE"
        ? "요청 본문이 너무 큽니다."
        : "요청 JSON을 읽을 수 없습니다.";
    sendError(res, bodyResult.status, bodyResult.code, message);
    return;
  }

  if (!isSearchRequestDto(bodyResult.data)) {
    sendError(res, 400, "INVALID_QUERY", "검색어를 입력해 주세요.");
    return;
  }

  const access = await requireWebSoundroomQueueAccess(client, req, guildId);
  if ("status" in access) {
    sendAuthzFailure(res, access);
    return;
  }

  try {
    validateSoundroomQueryInput(bodyResult.data.query);
  } catch (error) {
    if (error instanceof SoundroomLoadIdentifierError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    throw error;
  }

  try {
    const result = await searchSoundroomTracks(
      client,
      guildId,
      bodyResult.data.query,
    );
    const response: SoundroomSearchResponseDto = {
      ok: true,
      query: result.query,
      results: result.results,
    };
    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof SoundroomSearchActionError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    log(
      "warn",
      "web",
      `Soundroom search failed guild=${guildId} user=${access.session.user.id}`,
    );
    sendError(res, 500, "INTERNAL_ERROR", "검색 중 오류가 발생했습니다.");
  }
}

export async function handleSoundroomAdd(
  req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
  guildId: string,
): Promise<void> {
  if (!isWebDashboardAuthEnabled()) {
    sendError(
      res,
      503,
      "AUTH_DISABLED",
      "웹 대시보드 로그인이 비활성화되어 있습니다.",
    );
    return;
  }

  if (!GUILD_ID_PATTERN.test(guildId)) {
    sendError(res, 400, "INVALID_GUILD_ID", "잘못된 서버 ID입니다.");
    return;
  }

  if (!requireAuthenticatedSessionWithCsrf(req, res)) {
    return;
  }

  const bodyResult = await readJsonBody<unknown>(req);
  if (!bodyResult.ok) {
    const message =
      bodyResult.code === "PAYLOAD_TOO_LARGE"
        ? "요청 본문이 너무 큽니다."
        : "요청 JSON을 읽을 수 없습니다.";
    sendError(res, bodyResult.status, bodyResult.code, message);
    return;
  }

  const addBody = parseAddRequestDto(bodyResult.data);
  if (!addBody) {
    const raw = bodyResult.data as SoundroomAddRequestDto | null;
    const hasBoth =
      raw &&
      typeof raw.query === "string" &&
      typeof raw.uri === "string";
    sendError(
      res,
      400,
      "INVALID_ADD_REQUEST",
      hasBoth
        ? "query와 uri를 동시에 보낼 수 없습니다."
        : "query 또는 uri 중 하나만 보내 주세요.",
    );
    return;
  }

  const access = await requireWebSoundroomQueueAccess(client, req, guildId);
  if ("status" in access) {
    sendAuthzFailure(res, access);
    return;
  }

  try {
    const added = await addSoundroomTrackFromWeb(
      client,
      guildId,
      access.soundroomChannelId,
      access.userVoiceChannelId,
      access.session.user,
      addBody,
    );
    const state = buildSoundroomGuildStateDto(client, guildId);
    const response: SoundroomAddResponseDto = {
      ok: true,
      added,
      state,
    };
    log(
      "info",
      "web",
      `Soundroom add guild=${guildId} user=${access.session.user.id}`,
    );
    void sendWebRemoteNotice(
      client,
      guildId,
      access.session.user.id,
      buildWebRemoteTrackAddNotice(added.title),
    );
    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof SoundroomSearchActionError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    if (error instanceof SoundroomLoadIdentifierError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    log(
      "warn",
      "web",
      `Soundroom add failed guild=${guildId} user=${access.session.user.id}`,
    );
    sendError(res, 500, "INTERNAL_ERROR", "노래채널에 곡을 추가하지 못했습니다.");
  }
}

export async function handleSoundroomAddPlaylist(
  req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
  guildId: string,
): Promise<void> {
  if (!isWebDashboardAuthEnabled()) {
    sendError(
      res,
      503,
      "AUTH_DISABLED",
      "웹 대시보드 로그인이 비활성화되어 있습니다.",
    );
    return;
  }

  if (!GUILD_ID_PATTERN.test(guildId)) {
    sendError(res, 400, "INVALID_GUILD_ID", "잘못된 서버 ID입니다.");
    return;
  }

  if (!requireAuthenticatedSessionWithCsrf(req, res)) {
    return;
  }

  const bodyResult = await readJsonBody<unknown>(req);
  if (!bodyResult.ok) {
    const message =
      bodyResult.code === "PAYLOAD_TOO_LARGE"
        ? "요청 본문이 너무 큽니다."
        : "요청 JSON을 읽을 수 없습니다.";
    sendError(res, bodyResult.status, bodyResult.code, message);
    return;
  }

  if (!isPlaylistAddRequestDto(bodyResult.data)) {
    sendError(
      res,
      400,
      "INVALID_PLAYLIST_URL",
      "지원되는 재생목록 URL을 입력해 주세요.",
    );
    return;
  }

  const access = await requireWebSoundroomQueueAccess(client, req, guildId);
  if ("status" in access) {
    sendAuthzFailure(res, access);
    return;
  }

  try {
    const imported = await addSoundroomPlaylistFromWeb(
      client,
      guildId,
      access.soundroomChannelId,
      access.userVoiceChannelId,
      access.session.user,
      bodyResult.data.uri,
      bodyResult.data.limit,
    );
    const state = buildSoundroomGuildStateDto(client, guildId);
    const response: SoundroomPlaylistAddResponseDto = {
      ok: true,
      addedCount: imported.addedCount,
      skippedCount: imported.skippedCount,
      requestedCount: imported.requestedCount,
      limit: imported.limit,
      truncated: imported.truncated,
      playlist: imported.playlist,
      state,
    };
    log(
      "info",
      "web",
      `Soundroom add-playlist guild=${guildId} user=${access.session.user.id} added=${imported.addedCount}`,
    );
    void sendWebRemoteNotice(
      client,
      guildId,
      access.session.user.id,
      buildWebRemotePlaylistAddNotice(
        imported.addedCount,
        imported.truncated,
      ),
    );
    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof SoundroomSearchActionError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    if (error instanceof SoundroomLoadIdentifierError) {
      sendError(res, 400, error.code, error.message);
      return;
    }
    log(
      "warn",
      "web",
      `Soundroom add-playlist failed guild=${guildId} user=${access.session.user.id}`,
    );
    sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "재생목록을 대기열에 추가하지 못했습니다.",
    );
  }
}

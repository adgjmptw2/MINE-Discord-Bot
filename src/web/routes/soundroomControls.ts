import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import { GUILD_ID_PATTERN } from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import { readJsonBody, sendError, sendJson } from "@/web/http";
import {
  ControlNothingPlayingError,
  executeSoundroomSetVolume,
  executeSoundroomSkip,
  executeSoundroomStop,
  executeSoundroomTogglePause,
  isValidSoundroomVolume,
} from "@/web/soundroomControlActions";
import {
  requireWebSoundroomControlAccess,
  type WebAuthzError,
} from "@/web/soundroomControlAuth";
import { buildSoundroomGuildStateDto } from "@/web/soundroomDto";
import type {
  SoundroomControlAction,
  SoundroomControlRequestDto,
  SoundroomControlResponseDto,
} from "@/web/types";
import { log } from "@/utils/logger";

const CONTROL_ACTIONS: ReadonlySet<SoundroomControlAction> = new Set([
  "togglePause",
  "skip",
  "stop",
  "setVolume",
]);

function sendAuthzFailure(res: ServerResponse, err: WebAuthzError): void {
  sendError(res, err.status, err.code, err.message);
}

function parseVolume(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return raw;
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Number.parseInt(raw.trim(), 10);
  }
  return null;
}

function isControlRequestDto(
  value: unknown,
): value is SoundroomControlRequestDto {
  if (!value || typeof value !== "object") {
    return false;
  }
  const action = (value as SoundroomControlRequestDto).action;
  return typeof action === "string" && CONTROL_ACTIONS.has(action as SoundroomControlAction);
}

export async function handleSoundroomControl(
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

  const bodyResult = await readJsonBody<unknown>(req);
  if (!bodyResult.ok) {
    const message =
      bodyResult.code === "PAYLOAD_TOO_LARGE"
        ? "요청 본문이 너무 큽니다."
        : "요청 JSON을 읽을 수 없습니다.";
    sendError(res, bodyResult.status, bodyResult.code, message);
    return;
  }

  if (!isControlRequestDto(bodyResult.data)) {
    sendError(
      res,
      400,
      "INVALID_ACTION",
      "지원하지 않는 Soundroom 조작입니다.",
    );
    return;
  }

  const { action } = bodyResult.data;

  const access = await requireWebSoundroomControlAccess(client, req, guildId);
  if ("status" in access) {
    sendAuthzFailure(res, access);
    return;
  }

  const { session, player } = access;

  try {
    if (action === "togglePause") {
      await executeSoundroomTogglePause(client, guildId, player);
    } else if (action === "skip") {
      // skip 직후 state.current가 null일 수 있음(trackStart 전). 패널은 이벤트 흐름이 갱신함.
      await executeSoundroomSkip(client, guildId, player);
    } else if (action === "stop") {
      await executeSoundroomStop(client, guildId, player);
    } else if (action === "setVolume") {
      const volume = parseVolume(bodyResult.data.volume);
      if (volume === null || !isValidSoundroomVolume(volume)) {
        sendError(res, 400, "INVALID_VOLUME", "볼륨 값이 올바르지 않습니다.");
        return;
      }
      await executeSoundroomSetVolume(client, guildId, player, volume);
    }
  } catch (error) {
    if (error instanceof ControlNothingPlayingError) {
      sendError(res, 409, error.code, error.message);
      return;
    }
    log(
      "warn",
      "web",
      `Soundroom control failed action=${action} guild=${guildId} user=${session.user.id}`,
    );
    sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Soundroom 조작 중 오류가 발생했습니다.",
    );
    return;
  }

  log(
    "info",
    "web",
    `Soundroom control action=${action} guild=${guildId} user=${session.user.id}`,
  );

  const state = buildSoundroomGuildStateDto(client, guildId);
  const response: SoundroomControlResponseDto = {
    ok: true,
    action,
    state,
  };
  sendJson(res, 200, response);
}

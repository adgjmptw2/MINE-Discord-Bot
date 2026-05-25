import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import { GUILD_ID_PATTERN } from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import { readJsonBody, sendError, sendJson } from "@/web/http";
import { buildSoundroomGuildStateDto } from "@/web/soundroomDto";
import {
  requireWebSoundroomQueueAccess,
  type WebAuthzError,
} from "@/web/soundroomControlAuth";
import { sendTemporarySoundroomQueueSwapNotice } from "@/web/soundroomChannelNotice";
import {
  removeSoundroomQueueItemFromWeb,
  SoundroomQueueActionError,
  swapSoundroomQueueItemsFromWeb,
  validateQueueRemoveRequest,
  validateQueueSwapRequest,
} from "@/web/soundroomQueueActions";
import type {
  SoundroomQueueRemoveResponseDto,
  SoundroomQueueSwapResponseDto,
} from "@/web/types";
import { log } from "@/utils/logger";

function sendAuthzFailure(res: ServerResponse, err: WebAuthzError): void {
  sendError(res, err.status, err.code, err.message);
}

export async function handleSoundroomQueueRemove(
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

  const removeBody = validateQueueRemoveRequest(bodyResult.data);
  if (!removeBody) {
    sendError(
      res,
      400,
      "INVALID_QUEUE_INDEX",
      "삭제할 대기열 항목이 올바르지 않습니다.",
    );
    return;
  }

  const access = await requireWebSoundroomQueueAccess(client, req, guildId);
  if ("status" in access) {
    sendAuthzFailure(res, access);
    return;
  }

  try {
    const removed = removeSoundroomQueueItemFromWeb(
      client,
      guildId,
      access.session.user,
      removeBody,
    );
    const state = buildSoundroomGuildStateDto(client, guildId);
    const response: SoundroomQueueRemoveResponseDto = {
      ok: true,
      removed,
      state,
    };
    log(
      "info",
      "web",
      `Soundroom queue remove guild=${guildId} user=${access.session.user.id} index=${removeBody.queueIndex}`,
    );
    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof SoundroomQueueActionError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    log(
      "warn",
      "web",
      `Soundroom queue remove failed guild=${guildId} user=${access.session.user.id}`,
    );
    sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "대기열에서 곡을 삭제하지 못했습니다.",
    );
  }
}

export async function handleSoundroomQueueSwap(
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

  const swapBody = validateQueueSwapRequest(bodyResult.data);
  if (!swapBody) {
    sendError(
      res,
      400,
      "INVALID_QUEUE_INDEX",
      "순서를 변경할 대기열 항목이 올바르지 않습니다.",
    );
    return;
  }

  const access = await requireWebSoundroomQueueAccess(client, req, guildId);
  if ("status" in access) {
    sendAuthzFailure(res, access);
    return;
  }

  try {
    const swapped = swapSoundroomQueueItemsFromWeb(client, guildId, swapBody);
    const state = buildSoundroomGuildStateDto(client, guildId);
    const response: SoundroomQueueSwapResponseDto = {
      ok: true,
      swapped,
      state,
    };

    void sendTemporarySoundroomQueueSwapNotice(
      client,
      guildId,
      access.session.user.id,
      swapBody.fromQueueIndex,
      swapped.from.title,
      swapBody.toQueueIndex,
      swapped.to.title,
    );

    log(
      "info",
      "web",
      `Soundroom queue swap guild=${guildId} user=${access.session.user.id} from=${swapBody.fromQueueIndex} to=${swapBody.toQueueIndex}`,
    );
    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof SoundroomQueueActionError) {
      sendError(res, error.status, error.code, error.message);
      return;
    }
    log(
      "warn",
      "web",
      `Soundroom queue swap failed guild=${guildId} user=${access.session.user.id}`,
    );
    sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "대기열 순서를 변경하지 못했습니다.",
    );
  }
}

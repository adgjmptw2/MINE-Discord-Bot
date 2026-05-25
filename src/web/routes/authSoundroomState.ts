import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import {
  canSessionAccessGuild,
  getAuthenticatedSession,
  GUILD_ID_PATTERN,
  isBotInGuild,
} from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import { sendError, sendJson } from "@/web/http";
import { buildSoundroomGuildStateDto } from "@/web/soundroomDto";
import type { AuthSoundroomStateResponseDto } from "@/web/types";

export function handleAuthSoundroomGuildState(
  req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
  guildId: string,
): void {
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

  const session = getAuthenticatedSession(req);
  if (!session) {
    sendError(res, 401, "UNAUTHORIZED", "로그인이 필요합니다.");
    return;
  }

  if (!canSessionAccessGuild(session, guildId)) {
    sendError(
      res,
      403,
      "GUILD_ACCESS_DENIED",
      "이 서버에 접근할 권한이 없습니다.",
    );
    return;
  }

  if (!isBotInGuild(client, guildId)) {
    sendError(
      res,
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
    return;
  }

  const state = buildSoundroomGuildStateDto(client, guildId);
  const body: AuthSoundroomStateResponseDto = { ok: true, state };
  sendJson(res, 200, body);
}

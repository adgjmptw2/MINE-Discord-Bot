import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import { sendError, sendJson } from "@/web/http";
import { buildSoundroomGuildStateDto } from "@/web/soundroomDto";

const GUILD_ID_PATTERN = /^\d{17,20}$/;

export function handleSoundroomGuildState(
  _req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
  guildId: string,
): void {
  if (!GUILD_ID_PATTERN.test(guildId)) {
    sendError(res, 400, "INVALID_GUILD_ID", "유효하지 않은 서버 ID입니다.");
    return;
  }

  if (!client.guilds.cache.has(guildId)) {
    sendError(
      res,
      404,
      "GUILD_NOT_FOUND",
      "봇이 해당 서버를 찾을 수 없습니다.",
    );
    return;
  }

  const state = buildSoundroomGuildStateDto(client, guildId);
  sendJson(res, 200, state);
}

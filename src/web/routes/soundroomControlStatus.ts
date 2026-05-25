import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import { GUILD_ID_PATTERN } from "@/web/authz";
import { isWebDashboardAuthEnabled } from "@/web/config";
import { sendError, sendJson } from "@/web/http";
import { getSoundroomControlStatus } from "@/web/soundroomControlAuth";
import type { SoundroomControlStatusResponseDto } from "@/web/types";

export function handleSoundroomControlStatus(
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

  void (async () => {
    const result = await getSoundroomControlStatus(client, req, guildId);
    if ("status" in result) {
      sendError(res, result.status, result.code, result.message);
      return;
    }

    const body: SoundroomControlStatusResponseDto = {
      ok: true,
      ...result,
    };
    sendJson(res, 200, body);
  })();
}

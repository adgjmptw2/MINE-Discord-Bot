import type { IncomingMessage, ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import { sendJson } from "@/web/http";
import type { HealthResponseDto } from "@/web/types";

let serverStartedAt = Date.now();

export function markWebDashboardServerStarted(): void {
  serverStartedAt = Date.now();
}

export function handleHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  client: MineClient,
): void {
  const uptimeSec = Math.floor((Date.now() - serverStartedAt) / 1000);
  const body: HealthResponseDto = {
    ok: true,
    service: "mine-soundroom-web-api",
    uptimeSec,
    guildCount: client.guilds.cache.size,
    timestamp: new Date().toISOString(),
  };
  sendJson(res, 200, body);
}

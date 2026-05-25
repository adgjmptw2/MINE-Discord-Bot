import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import {
  getWebDashboardHost,
  getWebDashboardPort,
  isWebDashboardEnabled,
} from "@/web/config";
import {
  readRequestUrl,
  sendError,
  sendOptionsNoContent,
  setCorsHeaders,
} from "@/web/http";
import { handleHealth, markWebDashboardServerStarted } from "@/web/routes/health";
import { handleSoundroomGuildState } from "@/web/routes/soundroomState";
import { log } from "@/utils/logger";

const SOUNDROOM_STATE_PATH =
  /^\/api\/soundroom\/guilds\/(\d{17,20})\/state\/?$/;

function handleRequest(
  client: MineClient,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  setCorsHeaders(req, res);

  const method = req.method?.toUpperCase() ?? "GET";

  if (method === "OPTIONS") {
    sendOptionsNoContent(res);
    return;
  }

  if (method !== "GET") {
    sendError(res, 404, "NOT_FOUND", "요청한 경로를 찾을 수 없습니다.");
    return;
  }

  try {
    const { pathname } = readRequestUrl(req);

    if (pathname === "/health") {
      handleHealth(req, res, client);
      return;
    }

    const stateMatch = pathname.match(SOUNDROOM_STATE_PATH);
    if (stateMatch) {
      handleSoundroomGuildState(req, res, client, stateMatch[1]);
      return;
    }

    sendError(res, 404, "NOT_FOUND", "요청한 경로를 찾을 수 없습니다.");
  } catch {
    log("warn", "web", "Web API request handler error");
    sendError(res, 500, "INTERNAL_ERROR", "요청 처리 중 오류가 발생했습니다.");
  }
}

export async function startWebDashboardServer(
  client: MineClient,
): Promise<void> {
  if (!isWebDashboardEnabled()) {
    return;
  }

  const host = getWebDashboardHost();
  const port = getWebDashboardPort();

  await new Promise<void>((resolve) => {
    const server = createServer((req, res) => {
      handleRequest(client, req, res);
    });

    server.on("error", (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      log("warn", "web", `Web API failed to start: ${msg}`);
      resolve();
    });

    server.listen(port, host, () => {
      markWebDashboardServerStarted();
      log("success", "web", `Web dashboard API listening on ${host}:${port}`);
      resolve();
    });
  });
}

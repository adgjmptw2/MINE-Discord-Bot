import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { MineClient } from "@/types";
import {
  getWebDashboardConfig,
  getWebDashboardHost,
  getWebDashboardPort,
  isWebDashboardEnabled,
  warnIfWebDashboardSessionSecretWeak,
} from "@/web/config";
import {
  readRequestUrl,
  sendError,
  sendMethodNotAllowed,
  sendOptionsNoContent,
  setCorsHeaders,
} from "@/web/http";
import {
  handleAuthLogout,
  handleAuthMe,
  handleDiscordCallback,
  handleDiscordLogin,
} from "@/web/routes/auth";
import { handleAuthSoundroomGuildState } from "@/web/routes/authSoundroomState";
import { handleAuthGuilds } from "@/web/routes/guilds";
import { handleHealth, markWebDashboardServerStarted } from "@/web/routes/health";
import { handleSoundroomGuildState } from "@/web/routes/soundroomState";
import { log } from "@/utils/logger";

const SOUNDROOM_STATE_PATH =
  /^\/api\/soundroom\/guilds\/(\d{17,20})\/state\/?$/;

const AUTH_SOUNDROOM_STATE_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom-state\/?$/;

async function handleRequest(
  client: MineClient,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  setCorsHeaders(req, res);

  const method = req.method?.toUpperCase() ?? "GET";

  if (method === "OPTIONS") {
    sendOptionsNoContent(res);
    return;
  }

  try {
    const { pathname } = readRequestUrl(req);

    if (pathname === "/health" && method === "GET") {
      handleHealth(req, res, client);
      return;
    }

    const stateMatch = pathname.match(SOUNDROOM_STATE_PATH);
    if (stateMatch && method === "GET") {
      handleSoundroomGuildState(req, res, client, stateMatch[1]);
      return;
    }

    if (pathname === "/api/auth/discord/login") {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      handleDiscordLogin(req, res);
      return;
    }

    if (pathname === "/api/auth/discord/callback") {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleDiscordCallback(req, res);
      return;
    }

    if (pathname === "/api/auth/me") {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      handleAuthMe(req, res);
      return;
    }

    if (pathname === "/api/auth/logout") {
      if (method !== "POST") {
        sendMethodNotAllowed(res);
        return;
      }
      handleAuthLogout(req, res);
      return;
    }

    const authSoundroomStateMatch = pathname.match(AUTH_SOUNDROOM_STATE_PATH);
    if (authSoundroomStateMatch) {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      handleAuthSoundroomGuildState(
        req,
        res,
        client,
        authSoundroomStateMatch[1],
      );
      return;
    }

    if (pathname === "/api/auth/guilds") {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      handleAuthGuilds(req, res, client);
      return;
    }

    if (
      pathname === "/health" ||
      stateMatch ||
      authSoundroomStateMatch ||
      pathname.startsWith("/api/auth/") ||
      pathname.startsWith("/api/soundroom/")
    ) {
      sendMethodNotAllowed(res);
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

  const webConfig = getWebDashboardConfig();
  warnIfWebDashboardSessionSecretWeak(webConfig);

  const host = getWebDashboardHost();
  const port = getWebDashboardPort();

  await new Promise<void>((resolve) => {
    const server = createServer((req, res) => {
      void handleRequest(client, req, res);
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

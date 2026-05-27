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
  handleAuthCsrf,
  handleAuthLogout,
  handleAuthMe,
  handleDiscordCallback,
  handleDiscordLogin,
} from "@/web/routes/auth";
import { handleAuthSoundroomGuildState } from "@/web/routes/authSoundroomState";
import { handleAuthGuilds } from "@/web/routes/guilds";
import { handleSoundroomControl } from "@/web/routes/soundroomControls";
import { handleSoundroomControlStatus } from "@/web/routes/soundroomControlStatus";
import {
  handleSoundroomQueueRemove,
  handleSoundroomQueueSwap,
} from "@/web/routes/soundroomQueue";
import {
  handleSoundroomAdd,
  handleSoundroomAddPlaylist,
  handleSoundroomSearch,
} from "@/web/routes/soundroomSearch";
import { handleHealth, markWebDashboardServerStarted } from "@/web/routes/health";
import { handleSoundroomGuildState } from "@/web/routes/soundroomState";
import { handleLegalPageRequest } from "@/web/legalPages";
import { handleHomePageRequest } from "@/web/homePage";
import { applyWebApiRateLimit } from "@/web/rateLimit";
import {
  isAuthApiPathRequiringStrongSecret,
  requireStrongSessionSecretIfEnabled,
} from "@/web/security";
import { readSessionFromRequest } from "@/web/session";
import {
  handleStaticDashboardRequest,
  warnIfStaticDashboardRootMissing,
} from "@/web/staticDashboard";
import { log } from "@/utils/logger";

const SOUNDROOM_STATE_PATH =
  /^\/api\/soundroom\/guilds\/(\d{17,20})\/state\/?$/;

const AUTH_SOUNDROOM_STATE_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom-state\/?$/;

const AUTH_SOUNDROOM_CONTROL_STATUS_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/control-status\/?$/;

const AUTH_SOUNDROOM_CONTROL_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/control\/?$/;

const AUTH_SOUNDROOM_SEARCH_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/search\/?$/;

const AUTH_SOUNDROOM_ADD_PLAYLIST_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/add-playlist\/?$/;

const AUTH_SOUNDROOM_ADD_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/add\/?$/;

const AUTH_SOUNDROOM_QUEUE_REMOVE_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/queue\/remove\/?$/;

const AUTH_SOUNDROOM_QUEUE_SWAP_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/queue\/swap\/?$/;

function applyWebApiGuards(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  webConfig: ReturnType<typeof getWebDashboardConfig>,
): boolean {
  if (isAuthApiPathRequiringStrongSecret(pathname)) {
    if (!requireStrongSessionSecretIfEnabled(res)) {
      return false;
    }
  }

  const session = pathname.startsWith("/api/auth/")
    ? readSessionFromRequest(req)
    : null;
  return applyWebApiRateLimit(
    req,
    res,
    pathname,
    method,
    session,
    webConfig.rateLimitEnabled,
  );
}

async function handleRequest(
  client: MineClient,
  req: IncomingMessage,
  res: ServerResponse,
  webConfig: ReturnType<typeof getWebDashboardConfig>,
): Promise<void> {
  setCorsHeaders(req, res);

  const method = req.method?.toUpperCase() ?? "GET";

  if (method === "OPTIONS") {
    sendOptionsNoContent(res);
    return;
  }

  try {
    const { pathname } = readRequestUrl(req);

    if (pathname.startsWith("/api/")) {
      if (!applyWebApiGuards(req, res, pathname, method, webConfig)) {
        return;
      }
    }

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

    if (pathname === "/api/auth/csrf") {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      handleAuthCsrf(req, res);
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

    const authSoundroomControlStatusMatch = pathname.match(
      AUTH_SOUNDROOM_CONTROL_STATUS_PATH,
    );
    if (authSoundroomControlStatusMatch) {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      handleSoundroomControlStatus(
        req,
        res,
        client,
        authSoundroomControlStatusMatch[1],
      );
      return;
    }

    const authSoundroomControlMatch = pathname.match(AUTH_SOUNDROOM_CONTROL_PATH);
    if (authSoundroomControlMatch) {
      if (method !== "POST") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleSoundroomControl(
        req,
        res,
        client,
        authSoundroomControlMatch[1],
      );
      return;
    }

    const authSoundroomSearchMatch = pathname.match(AUTH_SOUNDROOM_SEARCH_PATH);
    if (authSoundroomSearchMatch) {
      if (method !== "POST") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleSoundroomSearch(
        req,
        res,
        client,
        authSoundroomSearchMatch[1],
      );
      return;
    }

    const authSoundroomAddPlaylistMatch = pathname.match(
      AUTH_SOUNDROOM_ADD_PLAYLIST_PATH,
    );
    if (authSoundroomAddPlaylistMatch) {
      if (method !== "POST") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleSoundroomAddPlaylist(
        req,
        res,
        client,
        authSoundroomAddPlaylistMatch[1],
      );
      return;
    }

    const authSoundroomAddMatch = pathname.match(AUTH_SOUNDROOM_ADD_PATH);
    if (authSoundroomAddMatch) {
      if (method !== "POST") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleSoundroomAdd(req, res, client, authSoundroomAddMatch[1]);
      return;
    }

    const authSoundroomQueueRemoveMatch = pathname.match(
      AUTH_SOUNDROOM_QUEUE_REMOVE_PATH,
    );
    if (authSoundroomQueueRemoveMatch) {
      if (method !== "POST") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleSoundroomQueueRemove(
        req,
        res,
        client,
        authSoundroomQueueRemoveMatch[1],
      );
      return;
    }

    const authSoundroomQueueSwapMatch = pathname.match(
      AUTH_SOUNDROOM_QUEUE_SWAP_PATH,
    );
    if (authSoundroomQueueSwapMatch) {
      if (method !== "POST") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleSoundroomQueueSwap(
        req,
        res,
        client,
        authSoundroomQueueSwapMatch[1],
      );
      return;
    }

    const authSoundroomStateMatch = pathname.match(AUTH_SOUNDROOM_STATE_PATH);
    if (authSoundroomStateMatch) {
      if (method !== "GET") {
        sendMethodNotAllowed(res);
        return;
      }
      await handleAuthSoundroomGuildState(
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

    // /privacy, /terms: /api 가드(rate limit·SESSION_SECRET_WEAK) 밖 — 공개 HTML
    if (handleLegalPageRequest(req, res, pathname, webConfig)) {
      return;
    }

    if (handleHomePageRequest(req, res, pathname, webConfig, client)) {
      return;
    }

    if (await handleStaticDashboardRequest(req, res, pathname, webConfig)) {
      return;
    }

    if (
      pathname === "/health" ||
      stateMatch ||
      authSoundroomControlStatusMatch ||
      authSoundroomControlMatch ||
      authSoundroomSearchMatch ||
      authSoundroomAddPlaylistMatch ||
      authSoundroomAddMatch ||
      authSoundroomQueueRemoveMatch ||
      authSoundroomQueueSwapMatch ||
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
  if (webConfig.staticEnabled) {
    await warnIfStaticDashboardRootMissing(webConfig.staticRoot);
  }

  const host = getWebDashboardHost();
  const port = getWebDashboardPort();

  await new Promise<void>((resolve) => {
    const server = createServer((req, res) => {
      void handleRequest(client, req, res, webConfig);
    });

    server.on("error", (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      log("warn", "web", `Web API failed to start: ${msg}`);
      resolve();
    });

    server.listen(port, host, () => {
      markWebDashboardServerStarted();
      log("success", "web", `Web dashboard API listening on ${host}:${port}`);
      log("success", "web", "Legal pages at /privacy and /terms");
      log("success", "web", "Home page at /");
      if (webConfig.staticEnabled) {
        log("success", "web", "Dashboard UI available at /dashboard");
      }
      if (webConfig.publicUrl) {
        log("success", "web", "Soundroom panel web remote link enabled");
      }
      resolve();
    });
  });
}

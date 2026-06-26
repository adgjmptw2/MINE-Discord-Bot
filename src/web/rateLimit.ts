import type { IncomingMessage, ServerResponse } from "node:http";
import { sendError } from "@/web/http";
import type { WebSession } from "@/web/session";

export type RateLimitBucket =
  | "auth-login"
  | "auth-callback"
  | "auth-read"
  | "state-read"
  | "control"
  | "search"
  | "add"
  | "playlist-add"
  | "playlist-read"
  | "playlist-write"
  | "playlist-add-to-queue"
  | "playlist-admin"
  | "playlist-report"
  | "playlist-favorite-read"
  | "playlist-favorite-write"
  | "queue"
  | "logout";

const BUCKET_LIMITS: Record<RateLimitBucket, { windowMs: number; max: number }> =
  {
    "auth-login": { windowMs: 60_000, max: 10 },
    "auth-callback": { windowMs: 60_000, max: 20 },
    "auth-read": { windowMs: 10_000, max: 30 },
    "state-read": { windowMs: 10_000, max: 30 },
    control: { windowMs: 3_000, max: 5 },
    search: { windowMs: 10_000, max: 5 },
    add: { windowMs: 5_000, max: 5 },
    "playlist-add": { windowMs: 30_000, max: 3 },
    "playlist-read": { windowMs: 10_000, max: 30 },
    "playlist-write": { windowMs: 10_000, max: 10 },
    "playlist-add-to-queue": { windowMs: 30_000, max: 3 },
    "playlist-admin": { windowMs: 30_000, max: 10 },
    "playlist-report": { windowMs: 60_000, max: 3 },
    "playlist-favorite-read": { windowMs: 10_000, max: 30 },
    "playlist-favorite-write": { windowMs: 10_000, max: 10 },
    queue: { windowMs: 5_000, max: 10 },
    logout: { windowMs: 10_000, max: 10 },
  };

const PUBLIC_STATE_PATH =
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
const AUTH_SOUNDROOM_QUEUE_SHUFFLE_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/queue\/shuffle\/?$/;
const AUTH_PLAYLIST_ADD_TO_QUEUE_PATH =
  /^\/api\/auth\/guilds\/(\d{17,20})\/soundroom\/playlists\/[^/]+\/add-to-queue\/?$/;
const AUTH_PLAYLISTS_PATH = /^\/api\/auth\/playlists(\/|$)/;

interface WindowCounter {
  count: number;
  windowStart: number;
}

const counters = new Map<string, WindowCounter>();
let checksSinceCleanup = 0;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function getClientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? "unknown";
}

export function getRateLimitKey(
  req: IncomingMessage,
  session: WebSession | null,
  bucket: RateLimitBucket,
): string {
  const actor = session?.user.id ?? getClientIp(req);
  return `${bucket}:${actor}`;
}

export function resolveRateLimitBucket(
  pathname: string,
  method: string,
): RateLimitBucket | null {
  if (pathname === "/api/auth/discord/login" && method === "GET") {
    return "auth-login";
  }
  if (pathname === "/api/auth/discord/callback" && method === "GET") {
    return "auth-callback";
  }
  if (pathname === "/api/auth/logout" && method === "POST") {
    return "logout";
  }
  if (pathname === "/api/auth/me" && method === "GET") {
    return "auth-read";
  }
  if (pathname === "/api/auth/csrf" && method === "GET") {
    return "auth-read";
  }
  if (pathname === "/api/auth/guilds" && method === "GET") {
    return "auth-read";
  }
  if (PUBLIC_STATE_PATH.test(pathname) && method === "GET") {
    return "state-read";
  }
  if (AUTH_SOUNDROOM_STATE_PATH.test(pathname) && method === "GET") {
    return "state-read";
  }
  if (AUTH_SOUNDROOM_CONTROL_STATUS_PATH.test(pathname) && method === "GET") {
    return "state-read";
  }
  if (AUTH_SOUNDROOM_CONTROL_PATH.test(pathname) && method === "POST") {
    return "control";
  }
  if (AUTH_SOUNDROOM_SEARCH_PATH.test(pathname) && method === "POST") {
    return "search";
  }
  if (AUTH_SOUNDROOM_ADD_PLAYLIST_PATH.test(pathname) && method === "POST") {
    return "playlist-add";
  }
  if (AUTH_SOUNDROOM_ADD_PATH.test(pathname) && method === "POST") {
    return "add";
  }
  if (
    (AUTH_SOUNDROOM_QUEUE_REMOVE_PATH.test(pathname) ||
      AUTH_SOUNDROOM_QUEUE_SWAP_PATH.test(pathname) ||
      AUTH_SOUNDROOM_QUEUE_SHUFFLE_PATH.test(pathname)) &&
    method === "POST"
  ) {
    return "queue";
  }
  if (AUTH_PLAYLIST_ADD_TO_QUEUE_PATH.test(pathname) && method === "POST") {
    return "playlist-add-to-queue";
  }
  if (AUTH_PLAYLISTS_PATH.test(pathname)) {
    if (pathname.includes("/admin/public") && method === "GET") {
      return "playlist-admin";
    }
    if (pathname.includes("/admin/reports") && method === "GET") {
      return "playlist-admin";
    }
    if (pathname.includes("/admin/reports/") && pathname.endsWith("/resolve")) {
      return "playlist-admin";
    }
    if (pathname.includes("/admin/hide") && method === "POST") {
      return "playlist-admin";
    }
    if (pathname.endsWith("/report") && method === "POST") {
      return "playlist-report";
    }
    if (
      (pathname === "/api/auth/playlists/favorites" ||
        pathname === "/api/auth/playlists/favorites/") &&
      method === "GET"
    ) {
      return "playlist-favorite-read";
    }
    if (/\/favorite\/?$/.test(pathname) && method === "POST") {
      return "playlist-favorite-write";
    }
    if (/\/favorite\/?$/.test(pathname) && method === "DELETE") {
      return "playlist-favorite-write";
    }
    if (method === "GET") {
      return "playlist-read";
    }
    if (method === "POST" || method === "PATCH" || method === "DELETE") {
      return "playlist-write";
    }
  }
  return null;
}

export function cleanupRateLimitBuckets(): void {
  const now = Date.now();
  const maxRetentionMs = 120_000;
  for (const [key, entry] of counters) {
    if (now - entry.windowStart > maxRetentionMs) {
      counters.delete(key);
    }
  }
}

export function checkRateLimit(
  req: IncomingMessage,
  session: WebSession | null,
  bucket: RateLimitBucket,
  enabled: boolean,
): RateLimitResult {
  if (!enabled) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  checksSinceCleanup += 1;
  if (checksSinceCleanup >= 200) {
    checksSinceCleanup = 0;
    cleanupRateLimitBuckets();
  }

  const { windowMs, max } = BUCKET_LIMITS[bucket];
  const key = getRateLimitKey(req, session, bucket);
  const now = Date.now();
  let entry = counters.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 1, windowStart: now };
    counters.set(key, entry);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfterMs = entry.windowStart + windowMs - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function sendRateLimitExceeded(
  res: ServerResponse,
  retryAfterSeconds: number,
): void {
  res.setHeader("Retry-After", String(Math.max(1, retryAfterSeconds)));
  sendError(
    res,
    429,
    "RATE_LIMITED",
    "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  );
}

export function applyWebApiRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  session: WebSession | null,
  enabled: boolean,
): boolean {
  const bucket = resolveRateLimitBucket(pathname, method);
  if (!bucket) {
    return true;
  }
  const result = checkRateLimit(req, session, bucket, enabled);
  if (!result.allowed) {
    sendRateLimitExceeded(res, result.retryAfterSeconds);
    return false;
  }
  return true;
}

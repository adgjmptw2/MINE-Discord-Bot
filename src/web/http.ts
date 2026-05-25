import type { IncomingMessage, ServerResponse } from "node:http";
import { getWebDashboardAllowedOrigin } from "@/web/config";

export type ReadJsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 413; code: "PAYLOAD_TOO_LARGE" }
  | { ok: false; status: 400; code: "INVALID_JSON" };

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export async function readRequestBody(
  req: IncomingMessage,
  maxBytes = 8192,
): Promise<Buffer | "too_large" | "error"> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        resolve("too_large");
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", () => {
      resolve("error");
    });
  });
}

export async function readJsonBody<T>(
  req: IncomingMessage,
  maxBytes = 8192,
): Promise<ReadJsonBodyResult<T>> {
  const raw = await readRequestBody(req, maxBytes);
  if (raw === "too_large") {
    return { ok: false, status: 413, code: "PAYLOAD_TOO_LARGE" };
  }
  if (raw === "error") {
    return { ok: false, status: 400, code: "INVALID_JSON" };
  }

  if (raw.length === 0) {
    return { ok: false, status: 400, code: "INVALID_JSON" };
  }

  try {
    return { ok: true, data: JSON.parse(raw.toString("utf8")) as T };
  } catch {
    return { ok: false, status: 400, code: "INVALID_JSON" };
  }
}

export function readRequestUrl(req: IncomingMessage): URL {
  const host = req.headers.host ?? "127.0.0.1";
  return new URL(req.url ?? "/", `http://${host}`);
}

export function getRequestHost(req: IncomingMessage): string {
  return req.headers.host ?? "127.0.0.1";
}

export function getRequestOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin.length === 0) {
    return null;
  }
  return origin;
}

export function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = getRequestOrigin(req);
  const allowed = getWebDashboardAllowedOrigin();
  if (origin && origin === allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  const body = JSON.stringify(data);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", JSON_CONTENT_TYPE);
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

export function sendError(
  res: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
): void {
  sendJson(res, statusCode, { ok: false, code, message });
}

export function sendRedirect(
  res: ServerResponse,
  location: string,
  statusCode = 302,
): void {
  res.statusCode = statusCode;
  res.setHeader("Location", location);
  res.end();
}

export function sendOptionsNoContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.end();
}

export function sendMethodNotAllowed(res: ServerResponse): void {
  sendError(res, 405, "METHOD_NOT_ALLOWED", "허용되지 않은 HTTP 메서드입니다.");
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      out[key] = decodeURIComponent(value);
    }
  }
  return out;
}

export interface CookieOptions {
  maxAgeSeconds?: number;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  secure?: boolean;
}

export function setCookie(
  res: ServerResponse,
  name: string,
  value: string,
  options: CookieOptions = {},
): void {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  const path = options.path ?? "/";
  parts.push(`Path=${path}`);
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.secure) {
    parts.push("Secure");
  }
  const existing = res.getHeader("Set-Cookie");
  const next = parts.join("; ");
  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, next]);
  } else if (typeof existing === "string") {
    res.setHeader("Set-Cookie", [existing, next]);
  } else {
    res.setHeader("Set-Cookie", next);
  }
}

export function clearCookie(res: ServerResponse, name: string): void {
  setCookie(res, name, "", {
    maxAgeSeconds: 0,
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: false,
  });
}

import type { IncomingMessage, ServerResponse } from "node:http";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export function getWebDashboardAllowedOrigin(): string {
  return (
    process.env.WEB_DASHBOARD_ALLOWED_ORIGIN?.trim() ||
    "http://localhost:3000"
  );
}

export function readRequestUrl(req: IncomingMessage): URL {
  const host = req.headers.host ?? "127.0.0.1";
  return new URL(req.url ?? "/", `http://${host}`);
}

export function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  const allowed = getWebDashboardAllowedOrigin();
  if (origin && origin === allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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

export function sendOptionsNoContent(res: ServerResponse): void {
  res.statusCode = 204;
  res.end();
}

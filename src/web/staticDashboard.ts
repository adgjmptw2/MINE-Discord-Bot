import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebDashboardConfig } from "@/web/config";
import { log } from "@/utils/logger";

const DASHBOARD_PREFIX = "/dashboard";

const BLOCKED_EXTENSIONS = new Set([
  ".map",
  ".env",
  ".db",
  ".sqlite",
  ".ts",
]);

let warnedMissingStaticDir = false;

export function resolveStaticDashboardRoot(staticDir: string): string {
  if (path.isAbsolute(staticDir)) {
    return path.resolve(staticDir);
  }
  return path.resolve(process.cwd(), staticDir);
}

export async function isStaticDashboardRootReady(root: string): Promise<boolean> {
  try {
    const info = await stat(root);
    return info.isDirectory();
  } catch {
    return false;
  }
}

export async function warnIfStaticDashboardRootMissing(
  root: string,
): Promise<void> {
  if (await isStaticDashboardRootReady(root)) {
    return;
  }
  if (warnedMissingStaticDir) {
    return;
  }
  warnedMissingStaticDir = true;
  log(
    "warn",
    "web",
    "Dashboard static directory is missing; /dashboard will return 404 until built",
  );
}

function isPathInsideRoot(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function isDashboardStaticPath(pathname: string): boolean {
  return (
    pathname === DASHBOARD_PREFIX ||
    pathname.startsWith(`${DASHBOARD_PREFIX}/`)
  );
}

export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function getCacheControl(filePath: string, isIndex: boolean): string {
  if (isIndex || path.basename(filePath) === "index.html") {
    return "no-cache";
  }
  const normalized = filePath.split(path.sep).join("/");
  if (normalized.includes("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  return "no-cache";
}

/** staticRoot 밖으로 나가는 경로·위험 확장자 차단 */
export function resolveDashboardStaticPath(
  staticRoot: string,
  pathname: string,
): { filePath: string; spaFallback: boolean } | null {
  if (!isDashboardStaticPath(pathname)) {
    return null;
  }

  let subPath = pathname.slice(DASHBOARD_PREFIX.length);
  if (subPath === "") {
    subPath = "/";
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(subPath);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) {
    return null;
  }

  const relative = decoded.replace(/^\/+/, "");
  if (relative.length > 0) {
    const segments = relative.split(/[/\\]/);
    if (segments.some((segment) => segment === "..")) {
      return null;
    }
  }

  if (relative.length === 0) {
    const indexPath = path.join(staticRoot, "index.html");
    if (!isPathInsideRoot(staticRoot, indexPath)) {
      return null;
    }
    return { filePath: indexPath, spaFallback: false };
  }

  const candidate = path.join(staticRoot, relative);
  if (!isPathInsideRoot(staticRoot, candidate)) {
    return null;
  }

  const ext = path.extname(candidate).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return null;
  }

  if (ext.length === 0) {
    const indexPath = path.join(staticRoot, "index.html");
    if (!isPathInsideRoot(staticRoot, indexPath)) {
      return null;
    }
    return { filePath: indexPath, spaFallback: true };
  }

  return { filePath: candidate, spaFallback: false };
}

function sendStaticNotFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end("Not Found");
}

async function writeStaticFile(
  res: ServerResponse,
  filePath: string,
  headOnly: boolean,
): Promise<boolean> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      return false;
    }
    const isIndex = path.basename(filePath) === "index.html";
    res.statusCode = 200;
    res.setHeader("Content-Type", getContentType(filePath));
    res.setHeader("Cache-Control", getCacheControl(filePath, isIndex));
    if (headOnly) {
      res.end();
      return true;
    }
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on("error", reject);
      res.on("error", reject);
      res.on("finish", resolve);
      stream.pipe(res);
    });
    return true;
  } catch {
    return false;
  }
}

export async function handleStaticDashboardRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  config: WebDashboardConfig,
): Promise<boolean> {
  if (!config.staticEnabled || !isDashboardStaticPath(pathname)) {
    return false;
  }

  const method = req.method?.toUpperCase() ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  if (!(await isStaticDashboardRootReady(config.staticRoot))) {
    sendStaticNotFound(res);
    return true;
  }

  const resolved = resolveDashboardStaticPath(config.staticRoot, pathname);
  if (!resolved) {
    sendStaticNotFound(res);
    return true;
  }

  const headOnly = method === "HEAD";
  const served = await writeStaticFile(res, resolved.filePath, headOnly);
  if (served) {
    return true;
  }

  if (!resolved.spaFallback) {
    sendStaticNotFound(res);
    return true;
  }

  const indexPath = path.join(config.staticRoot, "index.html");
  if (await writeStaticFile(res, indexPath, headOnly)) {
    return true;
  }

  sendStaticNotFound(res);
  return true;
}

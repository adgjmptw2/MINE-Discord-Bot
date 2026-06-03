// 웹 대시보드 배포 전 .env 점검(시크릿 미출력)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

let hasFail = false;

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = Object.create(null);
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseBool(raw, fallback) {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  return raw.trim().toLowerCase() === "true";
}

function isSessionSecretStrong(secret) {
  const s = secret.trim();
  if (!s) {
    return false;
  }
  if (s === "change-me-long-random-string") {
    return false;
  }
  if (s.startsWith("change-me")) {
    return false;
  }
  if (s.length < 32) {
    return false;
  }
  return true;
}

function isLocalOrigin(origin) {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function normalizeOrigin(origin) {
  return origin.replace(/\/+$/, "");
}

function normalizePublicUrl(raw) {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const without = trimmed.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(without)) {
    return null;
  }
  return without;
}

function ok(msg) {
  console.log(`[OK] ${msg}`);
}

function warn(msg) {
  console.log(`[WARN] ${msg}`);
}

function fail(msg) {
  hasFail = true;
  console.log(`[FAIL] ${msg}`);
}

function info(msg) {
  console.log(`[INFO] ${msg}`);
}

function main() {
  console.log("MINE Soundroom Web Dashboard preflight\n");

  if (!fs.existsSync(ENV_PATH)) {
    fail(".env file not found — create .env from .env.example");
    console.log("\nResult: FAIL");
    process.exit(1);
  }

  const env = parseEnvFile(ENV_PATH);

  const enabled = parseBool(env.WEB_DASHBOARD_ENABLED, false);
  if (enabled) {
    ok("WEB_DASHBOARD_ENABLED=true");
  } else {
    warn(
      "WEB_DASHBOARD_ENABLED is not true — web API server will not start",
    );
  }

  const authEnabled = parseBool(env.WEB_DASHBOARD_AUTH_ENABLED, false);
  if (authEnabled) {
    ok("WEB_DASHBOARD_AUTH_ENABLED=true");
  } else {
    warn(
      "WEB_DASHBOARD_AUTH_ENABLED is not true — public dashboard login not enabled",
    );
  }

  const staticEnabled = parseBool(env.WEB_DASHBOARD_STATIC_ENABLED, false);
  if (staticEnabled) {
    ok("WEB_DASHBOARD_STATIC_ENABLED=true");
  } else {
    warn(
      "WEB_DASHBOARD_STATIC_ENABLED is not true — /dashboard static serving disabled",
    );
  }

  const staticDirRaw = env.WEB_DASHBOARD_STATIC_DIR?.trim();
  const staticDir = staticDirRaw
    ? path.isAbsolute(staticDirRaw)
      ? staticDirRaw
      : path.join(ROOT, staticDirRaw)
    : path.join(ROOT, "dashboard", "dist");

  const indexPath = path.join(staticDir, "index.html");
  if (!fs.existsSync(staticDir)) {
    fail(
      `WEB_DASHBOARD_STATIC_DIR missing — directory not found (${staticDirRaw || "dashboard/dist"})`,
    );
  } else if (!fs.existsSync(indexPath)) {
    fail(
      "WEB_DASHBOARD_STATIC_DIR — index.html not found (run npm run dashboard:build)",
    );
  } else {
    ok(
      `WEB_DASHBOARD_STATIC_DIR — index.html present (${staticDirRaw || "dashboard/dist"})`,
    );
    const assetsDir = path.join(staticDir, "assets");
    if (!fs.existsSync(assetsDir)) {
      warn("WEB_DASHBOARD_STATIC_DIR — assets/ directory not found");
    }
  }

  const allowedOriginRaw = env.WEB_DASHBOARD_ALLOWED_ORIGIN?.trim() ?? "";
  let allowedOrigin = "";
  if (!allowedOriginRaw) {
    fail("WEB_DASHBOARD_ALLOWED_ORIGIN is not set");
  } else {
    allowedOrigin = normalizeOrigin(allowedOriginRaw);
    try {
      const u = new URL(allowedOrigin);
      if (u.protocol === "https:") {
        ok(`WEB_DASHBOARD_ALLOWED_ORIGIN=${allowedOrigin}`);
      } else if (isLocalOrigin(allowedOrigin)) {
        warn(
          `WEB_DASHBOARD_ALLOWED_ORIGIN=${allowedOrigin} — local development origin`,
        );
      } else if (u.protocol === "http:") {
        warn(
          `WEB_DASHBOARD_ALLOWED_ORIGIN=${allowedOrigin} — HTTPS is recommended for production`,
        );
      } else {
        warn(`WEB_DASHBOARD_ALLOWED_ORIGIN=${allowedOrigin} — check origin format`);
      }
    } catch {
      fail("WEB_DASHBOARD_ALLOWED_ORIGIN is not a valid URL");
    }
  }

  const clientId = env.DISCORD_OAUTH_CLIENT_ID?.trim() ?? "";
  if (clientId) {
    ok("DISCORD_OAUTH_CLIENT_ID is set");
  } else {
    fail("DISCORD_OAUTH_CLIENT_ID is not set");
  }

  const clientSecret = env.DISCORD_OAUTH_CLIENT_SECRET?.trim() ?? "";
  if (clientSecret) {
    ok("DISCORD_OAUTH_CLIENT_SECRET is set");
  } else {
    fail("DISCORD_OAUTH_CLIENT_SECRET is not set");
  }

  const redirectUriRaw = env.DISCORD_OAUTH_REDIRECT_URI?.trim() ?? "";
  if (!redirectUriRaw) {
    fail("DISCORD_OAUTH_REDIRECT_URI is not set");
  } else {
    const expected =
      allowedOrigin &&
      `${allowedOrigin}/api/auth/discord/callback`;
    if (expected && redirectUriRaw === expected) {
      ok("DISCORD_OAUTH_REDIRECT_URI matches ALLOWED_ORIGIN callback path");
    } else if (allowedOrigin) {
      warn(
        `DISCORD_OAUTH_REDIRECT_URI differs from ${allowedOrigin}/api/auth/discord/callback — verify reverse proxy / portal settings`,
      );
    } else {
      ok("DISCORD_OAUTH_REDIRECT_URI is set");
    }
  }

  const sessionSecret = env.WEB_DASHBOARD_SESSION_SECRET ?? "";
  if (!sessionSecret.trim()) {
    fail("WEB_DASHBOARD_SESSION_SECRET is not set");
  } else if (!isSessionSecretStrong(sessionSecret)) {
    fail(
      "WEB_DASHBOARD_SESSION_SECRET is weak — use a random string at least 32 characters (not change-me*)",
    );
  } else {
    ok("WEB_DASHBOARD_SESSION_SECRET strength check passed");
  }

  const publicState = parseBool(env.WEB_DASHBOARD_PUBLIC_STATE_ENABLED, false);
  if (publicState) {
    warn(
      "WEB_DASHBOARD_PUBLIC_STATE_ENABLED=true — unauthenticated state API is exposed",
    );
  } else {
    ok("WEB_DASHBOARD_PUBLIC_STATE_ENABLED=false");
  }

  const cookieSecure = parseBool(env.WEB_DASHBOARD_COOKIE_SECURE, false);
  const originIsLocal = allowedOrigin ? isLocalOrigin(allowedOrigin) : false;
  if (cookieSecure) {
    ok("WEB_DASHBOARD_COOKIE_SECURE=true");
  } else if (originIsLocal) {
    ok("WEB_DASHBOARD_COOKIE_SECURE=false — acceptable for local http origin");
  } else if (allowedOrigin) {
    try {
      const u = new URL(allowedOrigin);
      if (u.protocol === "https:") {
        warn(
          "WEB_DASHBOARD_COOKIE_SECURE=false — set true for HTTPS production",
        );
      } else {
        ok("WEB_DASHBOARD_COOKIE_SECURE=false");
      }
    } catch {
      ok("WEB_DASHBOARD_COOKIE_SECURE=false");
    }
  } else {
    warn("WEB_DASHBOARD_COOKIE_SECURE=false — review for production HTTPS");
  }

  const requireStrong = parseBool(
    env.WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET,
    false,
  );
  if (requireStrong) {
    ok("WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET=true");
  } else {
    warn(
      "WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET is not true — recommended for production",
    );
  }

  const rateLimit = parseBool(env.WEB_DASHBOARD_RATE_LIMIT_ENABLED, true);
  if (rateLimit) {
    ok("WEB_DASHBOARD_RATE_LIMIT_ENABLED=true (or default)");
  } else {
    warn("WEB_DASHBOARD_RATE_LIMIT_ENABLED=false — rate limiting disabled");
  }

  const contactEmail = env.WEB_DASHBOARD_CONTACT_EMAIL?.trim() ?? "";
  if (contactEmail) {
    ok("WEB_DASHBOARD_CONTACT_EMAIL configured");
  } else {
    warn(
      "WEB_DASHBOARD_CONTACT_EMAIL is not set — /privacy and /terms will use fallback contact text",
    );
  }

  const publicUrlRaw = env.WEB_DASHBOARD_PUBLIC_URL?.trim() ?? "";
  const publicUrl = normalizePublicUrl(publicUrlRaw);
  if (publicUrl) {
    ok("WEB_DASHBOARD_PUBLIC_URL is set");
    if (allowedOrigin && publicUrl !== allowedOrigin) {
      warn(
        "WEB_DASHBOARD_PUBLIC_URL differs from WEB_DASHBOARD_ALLOWED_ORIGIN — verify both are correct",
      );
    }
  } else if (publicUrlRaw) {
    warn(
      "WEB_DASHBOARD_PUBLIC_URL is invalid — must start with http:// or https://",
    );
  } else {
    info(
      "WEB_DASHBOARD_PUBLIC_URL is not set — Soundroom panel will not show the web remote link button",
    );
  }

  const homeStats = parseBool(env.WEB_DASHBOARD_HOME_STATS_ENABLED, false);
  if (homeStats) {
    ok("WEB_DASHBOARD_HOME_STATS_ENABLED=true — public aggregate stats on landing page");
    info(
      "Landing stats expose counts only (no server names, user names, or IDs)",
    );
  } else {
    ok("WEB_DASHBOARD_HOME_STATS_ENABLED=false — landing page shows static intro cards");
  }

  console.log("");
  if (allowedOrigin) {
    info(`Privacy Policy URL: ${allowedOrigin}/privacy`);
    info(`Terms of Service URL: ${allowedOrigin}/terms`);
  }
  if (redirectUriRaw) {
    info(`Discord OAuth Redirect URI (register in Developer Portal): ${redirectUriRaw}`);
  }
  if (publicUrl) {
    info(`Public home page: ${publicUrl}/`);
    info(`Soundroom panel web remote: ${publicUrl}/dashboard`);
  }
  info(
    "Register Privacy Policy URL, Terms URL, and Redirect URI in Discord Developer Portal (OAuth2)",
  );

  console.log("");
  if (hasFail) {
    console.log("Result: FAIL — fix FAIL items before production");
    process.exit(1);
  }
  console.log("Result: PASS (review WARN items for your deployment)");
  process.exit(0);
}

main();

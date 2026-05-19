"use strict";

const path = require("path");
const { spawn } = require("child_process");
const {
  loadProjectEnv,
  getJarDir,
  assertJarPresent,
  isLocalLavalinkHost,
  spawnLavalink,
  waitForLocalLavalinkReady,
} = require("./lavalink-util.js");

function parsePort() {
  const p = Number(process.env.LAVALINK_PORT || 2333);
  if (!Number.isFinite(p) || p < 1 || p > 65535) {
    throw new Error("Invalid LAVALINK_PORT");
  }
  return p;
}

function parseHost() {
  return String(process.env.LAVALINK_HOST || "localhost").trim();
}

function killProcessTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    /* ignore */
  }
}

async function main() {
  const projectRoot = loadProjectEnv();
  const host = parseHost();
  const port = parsePort();

  if (!isLocalLavalinkHost(host)) {
    console.error(
      "start:all only starts a local Lavalink JAR. LAVALINK_HOST must be localhost, 127.0.0.1, or ::1.",
    );
    console.error(
      "If Lavalink runs elsewhere, start it there and run npm run start:bot in another terminal.",
    );
    process.exit(1);
  }

  const jarDir = assertJarPresent(getJarDir());
  const lavalinkChild = spawnLavalink(jarDir);

  lavalinkChild.on("error", (err) => {
    console.error("Failed to start Lavalink:", err.message);
    process.exit(1);
  });

  let cleaned = false;
  function cleanupLavalink() {
    if (cleaned) return;
    cleaned = true;
    killProcessTree(lavalinkChild);
  }

  try {
    console.log(`Waiting for Lavalink at ${host}:${port} ...`);
    await waitForLocalLavalinkReady(lavalinkChild, host, port, {
      timeoutMs: 120_000,
      intervalMs: 400,
    });
    console.log("Lavalink port is open. Starting Discord bot ...");
  } catch (e) {
    console.error(e.message || e);
    cleanupLavalink();
    process.exit(1);
  }

  const botPath = path.join(projectRoot, "dist", "index.js");
  const botChild = spawn(process.execPath, [botPath], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });

  lavalinkChild.on("exit", () => {
    if (botChild.exitCode !== null) return;
    console.error("Lavalink exited while the bot was running.");
    killProcessTree(botChild);
  });

  function shutdown() {
    killProcessTree(botChild);
    cleanupLavalink();
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  botChild.on("exit", (code, sig) => {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
    cleanupLavalink();
    process.exit(code ?? (sig ? 1 : 0));
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

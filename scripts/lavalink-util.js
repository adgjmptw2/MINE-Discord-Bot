"use strict";

const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

function loadProjectEnv() {
  const root = path.join(__dirname, "..");
  dotenv.config({ path: path.join(root, ".env") });
  return root;
}

function getJarDir() {
  const dir = process.env.LAVALINK_JAR_DIR;
  if (!dir || !String(dir).trim()) {
    throw new Error(
      "LAVALINK_JAR_DIR is not set. Add it to .env: absolute path to the folder that contains Lavalink.jar.",
    );
  }
  return path.resolve(String(dir).trim());
}

function assertJarPresent(jarDir) {
  const jar = path.join(jarDir, "Lavalink.jar");
  if (!fs.existsSync(jar)) {
    throw new Error(`Lavalink.jar not found in ${jarDir}`);
  }
  return jarDir;
}

function isLocalLavalinkHost(host) {
  const h = String(host || "localhost")
    .trim()
    .toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function parseJavaOpts() {
  const o = process.env.LAVALINK_JAVA_OPTS;
  if (o && String(o).trim()) return String(o).trim();
  return "-Xms512m -Xmx1536m";
}

function spawnLavalink(jarDir) {
  const javaOpts = parseJavaOpts().split(/\s+/).filter(Boolean);
  const args = [...javaOpts, "-jar", "Lavalink.jar"];
  return spawn("java", args, {
    cwd: jarDir,
    stdio: "inherit",
    windowsHide: true,
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tryConnectOnce(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.on("error", () => {
      socket.destroy();
      reject();
    });
  });
}

// Lavalink TCP 준비 대기
async function waitForLocalLavalinkReady(lavalinkChild, host, port, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 400;
  const start = Date.now();
  let lavalinkExited = false;
  let exitCode = null;
  let exitSig = null;
  const onExit = (code, sig) => {
    lavalinkExited = true;
    exitCode = code;
    exitSig = sig;
  };
  lavalinkChild.on("exit", onExit);
  try {
    while (Date.now() - start < timeoutMs) {
      if (lavalinkExited) {
        throw new Error(
          `Lavalink exited before the port was ready (code=${exitCode}, signal=${exitSig ?? "none"})`,
        );
      }
      try {
        await tryConnectOnce(host, port);
        return;
      } catch {
        await sleep(intervalMs);
      }
    }
    throw new Error(`Timed out after ${timeoutMs}ms waiting for ${host}:${port}`);
  } finally {
    lavalinkChild.removeListener("exit", onExit);
  }
}

module.exports = {
  loadProjectEnv,
  getJarDir,
  assertJarPresent,
  isLocalLavalinkHost,
  spawnLavalink,
  waitForLocalLavalinkReady,
};

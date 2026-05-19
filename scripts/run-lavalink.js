"use strict";

const {
  loadProjectEnv,
  getJarDir,
  assertJarPresent,
  spawnLavalink,
} = require("./lavalink-util.js");

try {
  loadProjectEnv();
  const jarDir = assertJarPresent(getJarDir());
  const child = spawnLavalink(jarDir);
  child.on("error", (err) => {
    console.error("Failed to start Lavalink:", err.message);
    process.exit(1);
  });
  child.on("exit", (code, sig) => {
    process.exit(code ?? (sig ? 1 : 0));
  });
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}

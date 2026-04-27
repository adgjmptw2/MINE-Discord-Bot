import { ShardingManager } from "discord.js";
import "dotenv/config";

const token = process.env.TOKEN?.trim();

if (!token) {
  throw new Error("Missing TOKEN in environment. Set TOKEN in .env before running the bot.");
}

const manager = new ShardingManager("./dist/index.js", {
  token,
  totalShards: "auto",
});

manager.on("shardCreate", (shard) => {
  console.log(`[SHARD] Launched shard ${shard.id}`);
});

void manager.spawn();

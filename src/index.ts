import { Collection, GatewayIntentBits } from "discord.js";
import { Riffy } from "riffy";
import "dotenv/config";
import loadEvents from "@/handlers/event";
import loadRiffyEvents from "@/handlers/riffy";
import loadSlashCommands from "@/handlers/slashcommand";
import config from "@/settings/config";
import { log, printBanner } from "@/utils/logger";
import { MineClient } from "@/types";

const token = process.env.TOKEN?.trim();

if (!token) {
  throw new Error("Missing TOKEN in environment. Set TOKEN in .env before running the bot.");
}

const parsedShardList = process.env.SHARD_LIST
  ? process.env.SHARD_LIST.split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0)
  : [];

const parsedShardCount = process.env.SHARD_COUNT ? Number(process.env.SHARD_COUNT.trim()) : undefined;
const shardCount = Number.isInteger(parsedShardCount) && (parsedShardCount as number) >= 1 ? (parsedShardCount as number) : 1;

const client = new MineClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  shards: parsedShardList.length > 0 ? parsedShardList : "auto",
  shardCount,
});

client.config = config;
client.slashCommands = new Collection();
client.riffy = new Riffy(client, client.config.nodes, {
  send: (payload: { d?: { guild_id?: string } }) => {
    const guildId = payload.d?.guild_id;
    const guild = guildId ? client.guilds.cache.get(guildId) : null;
    guild?.shard.send(payload);
  },
  defaultSearchPlatform: client.config.engine,
  restVersion: "v4",
});

printBanner();

process.on("unhandledRejection", (reason, promise) => {
  log("error", "process", "Unhandled promise rejection", { reason, promise });
});

process.on("uncaughtException", (error) => {
  log("error", "process", "Uncaught exception", error);
});

process.on("warning", (warning) => {
  log("warn", "process", `${warning.name}: ${warning.message}`);
});

client.on("error", (error) => {
  log("error", "client", "Discord client error", error);
});

client.on("shardError", (error, shardId) => {
  log("error", "shard", `Shard ${shardId} error`, error);
});

client.riffy.on("nodeError", (node, error) => {
  const nodeName = (node as { name?: string }).name ?? "unknown";
  log("error", "riffy", `Node ${nodeName} reported an error`, error);
});

void Promise.all([loadEvents(client), loadRiffyEvents(client), loadSlashCommands(client)]).then(() => {
  void client.login(token);
});

export default client;

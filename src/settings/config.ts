import type { BotConfig } from "@/types";

function envValue(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(envValue(name));
  return Number.isFinite(value) ? value : fallback;
}

function envBoolean(name: string, fallback: boolean): boolean {
  const value = envValue(name).toLowerCase();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function envList(name: string): string[] {
  return envValue(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Discord Application ID (OAuth2 "Client ID") — must be numeric snowflake, not a placeholder string. */
function requireDiscordApplicationId(raw: string): string {
  const value = raw.trim();
  if (!value) {
    throw new Error(
      'CLIENT_ID is empty. Set CLIENT_ID in .env to the numeric Application ID from Discord Developer Portal → Your Bot → OAuth2 (or General) → "Client ID".',
    );
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `CLIENT_ID must be digits only (Discord snowflake). You still have a placeholder or typo: "${value.slice(0, 48)}${value.length > 48 ? "…" : ""}".`,
    );
  }
  if (value.length < 17 || value.length > 22) {
    throw new Error(
      `CLIENT_ID length looks invalid (${value.length} digits). Copy the full Application ID from https://discord.com/developers/applications`,
    );
  }
  return value;
}

const config: BotConfig = {
  clientid: requireDiscordApplicationId(envValue("CLIENT_ID")),
  engine: envValue("LAVALINK_ENGINE", "ytsearch"),
  color: 0x7c5cff,
  developers: envList("DISCORD_OWNER_IDS"),
  nodes: [
    {
      name: envValue("LAVALINK_NAME", "mine-main"),
      host: envValue("LAVALINK_HOST", "localhost"),
      password: envValue("LAVALINK_PASSWORD", "youshallnotpass"),
      port: envNumber("LAVALINK_PORT", 2333),
      secure: envBoolean("LAVALINK_SECURE", false),
    },
  ],
  soundroom: {
    brandName: "마인",
    /** 공백은 Discord 채널 이름에서 거부되는 경우가 많아 하이픈만 사용 */
    channelName: "🎵-마인-노래채널",
  },
};

export default config;

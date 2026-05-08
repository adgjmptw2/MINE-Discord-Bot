import type { BotConfig, StockPriceProvider } from "@/types";
import { log } from "@/utils/logger";

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

// 시세 갱신 주기 기본 5분 / 최소 1분 (더 짧게 두면 Twelve Data만 거덜남)
const STOCK_REFRESH_MS_DEFAULT = 300_000;
const STOCK_REFRESH_MS_MIN = 60_000;

function parseStockPriceProvider(raw: string): StockPriceProvider {
  const v = raw.trim().toLowerCase();
  if (v === "mock" || v === "twelvedata" || v === "yahoo") {
    return v;
  }
  if (v === "") {
    return "mock";
  }
  log("warn", "config", `STOCK_PRICE_PROVIDER 값 이상함("${raw.trim()}") → mock으로 감`);
  return "mock";
}

function envStockPriceRefreshIntervalMs(): number {
  const raw = envValue("STOCK_PRICE_REFRESH_INTERVAL_MS");
  if (raw === "") {
    return STOCK_REFRESH_MS_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    log("warn", "config", `STOCK_PRICE_REFRESH_INTERVAL_MS 숫자 아님("${raw}") → 기본 ${STOCK_REFRESH_MS_DEFAULT}ms`);
    return STOCK_REFRESH_MS_DEFAULT;
  }
  if (n < STOCK_REFRESH_MS_MIN) {
    log("warn", "config", `STOCK_PRICE_REFRESH_INTERVAL_MS=${n}ms 너무 짧음 → 최소 ${STOCK_REFRESH_MS_MIN}ms로 맞춤`);
    return STOCK_REFRESH_MS_MIN;
  }
  return n;
}

function envTwelveDataApiKey(): string {
  // 나중에 twelvedata 모드일 때 없으면 그때 에러 내면 됨
  return envValue("TWELVE_DATA_API_KEY");
}

/** 디스코드 앱 Client ID — 숫자만, 플레이스홀더 넣으면 여기서 터짐 */
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
  // 모의주식 — 지금은 설정만 씀
  stock: {
    stockPriceProvider: parseStockPriceProvider(envValue("STOCK_PRICE_PROVIDER")),
    stockPriceRefreshIntervalMs: envStockPriceRefreshIntervalMs(),
    twelveDataApiKey: envTwelveDataApiKey(),
  },
};

export default config;

import type { BotConfig, StockPriceProvider, StockPriceRefreshMode } from "@/types";
import { log } from "@/utils/logger";
import { parseKstTimeToMinutes } from "@/utils/date";

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
  log(
    "warn",
    "config",
    `STOCK_PRICE_PROVIDER 값 이상함("${raw.trim()}") → mock으로 감`,
  );
  return "mock";
}

function envStockPriceRefreshIntervalMs(): number {
  const raw = envValue("STOCK_PRICE_REFRESH_INTERVAL_MS");
  if (raw === "") {
    return STOCK_REFRESH_MS_DEFAULT;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    log(
      "warn",
      "config",
      `STOCK_PRICE_REFRESH_INTERVAL_MS 숫자 아님("${raw}") → 기본 ${STOCK_REFRESH_MS_DEFAULT}ms`,
    );
    return STOCK_REFRESH_MS_DEFAULT;
  }
  if (n < STOCK_REFRESH_MS_MIN) {
    log(
      "warn",
      "config",
      `STOCK_PRICE_REFRESH_INTERVAL_MS=${n}ms 너무 짧음 → 최소 ${STOCK_REFRESH_MS_MIN}ms로 맞춤`,
    );
    return STOCK_REFRESH_MS_MIN;
  }
  return n;
}

const DEFAULT_SCHEDULED_CLOSE_TIMES_STR = "15:31,15:35,15:40,16:00";
const DEFAULT_SCHEDULED_CLOSE_MINUTES = [931, 935, 940, 960];

function parseStockPriceRefreshMode(raw: string): StockPriceRefreshMode {
  const v = raw.trim().toLowerCase();
  if (v === "interval" || v === "scheduled-close") {
    return v;
  }
  if (v === "") {
    return "interval";
  }
  log(
    "warn",
    "config",
    `STOCK_PRICE_REFRESH_MODE 값 이상함("${raw.trim()}") → interval로 감`,
  );
  return "interval";
}

function parseStockScheduledCloseRefreshTimesKst(raw: string): number[] {
  const source = raw.trim() === "" ? DEFAULT_SCHEDULED_CLOSE_TIMES_STR : raw;
  const tokens = source
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return [...DEFAULT_SCHEDULED_CLOSE_MINUTES];
  }
  const parsed: number[] = [];
  for (const t of tokens) {
    const m = parseKstTimeToMinutes(t);
    if (!Number.isFinite(m)) {
      log(
        "warn",
        "config",
        `STOCK_SCHEDULED_CLOSE_REFRESH_TIMES_KST에 잘못된 항목("${t}") → 기본 ${DEFAULT_SCHEDULED_CLOSE_TIMES_STR} 사용`,
      );
      return [...DEFAULT_SCHEDULED_CLOSE_MINUTES];
    }
    parsed.push(m);
  }
  return [...new Set(parsed)].sort((a, b) => a - b);
}

const DEFAULT_TRADING_START_STR = "09:00";
const DEFAULT_TRADING_END_STR = "15:30";
const DEFAULT_TRADING_START_MIN = 9 * 60;
const DEFAULT_TRADING_END_MIN = 15 * 60 + 30;

const DEFAULT_STOCK_BUY_FEE = 0.00015;
const DEFAULT_STOCK_SELL_FEE = 0.00015;
const DEFAULT_STOCK_SELL_TAX = 0.002;
const MAX_STOCK_FEE_OR_TAX_RATE = 0.1;

function parseStockTradingWindowMinutes(): {
  startMinutes: number;
  endMinutes: number;
} {
  const startStr = envValue(
    "STOCK_TRADING_START_KST",
    DEFAULT_TRADING_START_STR,
  );
  const endStr = envValue("STOCK_TRADING_END_KST", DEFAULT_TRADING_END_STR);
  const start = parseKstTimeToMinutes(startStr);
  const end = parseKstTimeToMinutes(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    log(
      "warn",
      "config",
      `STOCK_TRADING_*_KST 파싱 실패 → ${DEFAULT_TRADING_START_STR}~${DEFAULT_TRADING_END_STR}`,
    );
    return {
      startMinutes: DEFAULT_TRADING_START_MIN,
      endMinutes: DEFAULT_TRADING_END_MIN,
    };
  }
  if (start >= end) {
    log(
      "warn",
      "config",
      `STOCK_TRADING 시작>=종료 (${startStr}, ${endStr}) → 기본 ${DEFAULT_TRADING_START_STR}~${DEFAULT_TRADING_END_STR}`,
    );
    return {
      startMinutes: DEFAULT_TRADING_START_MIN,
      endMinutes: DEFAULT_TRADING_END_MIN,
    };
  }
  return { startMinutes: start, endMinutes: end };
}

function parseStockFeeOrTaxRate(name: string, fallback: number): number {
  const raw = envValue(name);
  if (raw === "") {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_STOCK_FEE_OR_TAX_RATE) {
    log(
      "warn",
      "config",
      `${name} 값 이상("${raw}") → 기본 ${fallback}`,
    );
    return fallback;
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

const stockTradingWindow = parseStockTradingWindowMinutes();

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
    stockPriceProvider: parseStockPriceProvider(
      envValue("STOCK_PRICE_PROVIDER"),
    ),
    stockPriceRefreshIntervalMs: envStockPriceRefreshIntervalMs(),
    stockPriceRefreshMode: parseStockPriceRefreshMode(
      envValue("STOCK_PRICE_REFRESH_MODE"),
    ),
    stockScheduledCloseRefreshTimesKst: parseStockScheduledCloseRefreshTimesKst(
      envValue("STOCK_SCHEDULED_CLOSE_REFRESH_TIMES_KST"),
    ),
    twelveDataApiKey: envTwelveDataApiKey(),
    stockTradingHoursEnabled: envBoolean("STOCK_TRADING_HOURS_ENABLED", false),
    stockTradingStartMinutesKst: stockTradingWindow.startMinutes,
    stockTradingEndMinutesKst: stockTradingWindow.endMinutes,
    stockBuyFeeRate: parseStockFeeOrTaxRate(
      "STOCK_BUY_FEE_RATE",
      DEFAULT_STOCK_BUY_FEE,
    ),
    stockSellFeeRate: parseStockFeeOrTaxRate(
      "STOCK_SELL_FEE_RATE",
      DEFAULT_STOCK_SELL_FEE,
    ),
    stockSellTaxRate: parseStockFeeOrTaxRate(
      "STOCK_SELL_TAX_RATE",
      DEFAULT_STOCK_SELL_TAX,
    ),
  },
};

export default config;

import { findStockSymbol } from "@/settings/stockSymbols";
import { STOCK_QUANTITY_SCALE, type CoinGameLogEntry } from "@/storage/stock";

export function formatKrwPrice(price: number): string {
  return price.toLocaleString("ko-KR");
}

export function formatCoin(amount: number): string {
  return `${formatKrwPrice(amount)} 코인`;
}

export const formatMine = formatCoin;

export function formatSignedCoin(amount: number): string {
  const abs = formatKrwPrice(Math.abs(amount));
  if (amount > 0) {
    return `+${abs} 코인`;
  }
  if (amount < 0) {
    return `-${abs} 코인`;
  }
  return `${abs} 코인`;
}

export const formatSignedMine = formatSignedCoin;

export function formatPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export type StockQuoteTrend = "UP" | "DOWN" | "FLAT";

export function classifyStockTrend(changePercent: number | null): StockQuoteTrend {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return "FLAT";
  }
  if (changePercent > 0) {
    return "UP";
  }
  if (changePercent < 0) {
    return "DOWN";
  }
  return "FLAT";
}

export function quoteTrendTitleEmoji(trend: StockQuoteTrend): string {
  if (trend === "UP") {
    return "📈";
  }
  if (trend === "DOWN") {
    return "📉";
  }
  return "📊";
}

export function quoteAccentRgb(trend: StockQuoteTrend): number {
  if (trend === "UP") {
    return 0xef4444;
  }
  if (trend === "DOWN") {
    return 0x3b82f6;
  }
  return 0x9ca3af;
}

export function formatQuoteCurrentPriceLine(price: number): string {
  return `현재가: **${formatKrwPrice(price)} 코인**`;
}

export function formatQuoteDayChangeLine(
  price: number,
  changePercent: number | null,
): string {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return "전일 대비: 확인 불가";
  }
  const delta = estimateChangeAmount(price, changePercent);
  const absCoin = formatKrwPrice(Math.abs(delta));
  const pct = formatPercent(changePercent);
  if (changePercent > 0) {
    return `전일 대비: 🔺 **+${absCoin} 코인 (${pct})**`;
  }
  if (changePercent < 0) {
    return `전일 대비: 🔻 **-${absCoin} 코인 (${pct})**`;
  }
  return `전일 대비: ➖ **0 코인 (${pct})**`;
}

export function formatQuoteOhlcLine(
  open: number | null,
  high: number | null,
): string {
  const o =
    open === null ? "-" : `${formatKrwPrice(Math.round(open))} 코인`;
  const h =
    high === null ? "-" : `${formatKrwPrice(Math.round(high))} 코인`;
  return `시가: ${o} · 고가: ${h}`;
}

export function formatQuoteLowLine(low: number | null): string {
  const l =
    low === null ? "-" : `${formatKrwPrice(Math.round(low))} 코인`;
  return `저가: ${l}`;
}

export function formatStockRefreshTime(date: Date | null): string {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatStockDisplayName(symbol: string): string {
  const meta = findStockSymbol(symbol.trim());
  if (meta) {
    return `${meta.nameKo} (${meta.code})`;
  }
  return symbol.trim();
}

export function formatStockQuantity(quantityMicro: number): string {
  const shares = quantityMicro / STOCK_QUANTITY_SCALE;
  return `${shares.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주`;
}

export const ANSI_RESET = "\u001b[0m";
export const ANSI_RED = "\u001b[31m";
export const ANSI_BLUE = "\u001b[34m";
export const ANSI_GRAY = "\u001b[90m";

export function getAnsiStockColor(changePercent: number | null): string {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return ANSI_GRAY;
  }
  if (changePercent > 0) {
    return ANSI_RED;
  }
  if (changePercent < 0) {
    return ANSI_BLUE;
  }
  return ANSI_GRAY;
}

export function estimateChangeAmount(
  price: number,
  changePercent: number | null,
): number {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return 0;
  }
  const prev = price / (1 + changePercent / 100);
  return Math.round(price - prev);
}

export function formatAnsiStockChange(
  price: number,
  changePercent: number | null,
): string {
  const color = getAnsiStockColor(changePercent);
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return `${color}(정보 없음)${ANSI_RESET}`;
  }
  const delta = estimateChangeAmount(price, changePercent);
  const signed = formatSignedCoin(delta);
  const pct = formatPercent(changePercent);
  return `${color}(${pct} | ${signed})${ANSI_RESET}`;
}

export function formatAnsiQuoteLine(
  price: number,
  changePercent: number | null,
): string {
  return `${formatKrwPrice(price)} 코인 ${formatAnsiStockChange(price, changePercent)}`;
}

export function wrapAnsiCodeBlock(inner: string): string {
  return `\`\`\`ansi\n${inner}\n\`\`\``;
}

export function formatLatestGameLogForProfile(
  log: CoinGameLogEntry | null,
): string {
  if (!log) {
    return "최근 게임 없음";
  }
  if (log.gameType === "RPS") {
    const label = "가위바위보";
    if (log.result === "WIN") {
      return `${label} 승리 (${formatSignedCoin(log.balanceDelta)})`;
    }
    if (log.result === "LOSE") {
      return `${label} 패배 (${formatSignedCoin(log.balanceDelta)})`;
    }
    if (log.result === "DRAW") {
      return `${label} 무승부 (${formatSignedCoin(log.balanceDelta)})`;
    }
  }
  return `${log.gameType} ${log.result} (${formatSignedCoin(log.balanceDelta)})`;
}

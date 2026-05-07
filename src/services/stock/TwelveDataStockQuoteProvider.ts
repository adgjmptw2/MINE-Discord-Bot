import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import type { StockSymbol } from "@/settings/stockSymbols";
import type { StockQuoteProvider } from "./StockQuoteProvider";
import type { StockPrice } from "./types";

const QUOTE_BASE = "https://api.twelvedata.com/quote";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isTwelveDataErrorPayload(data: Record<string, unknown>): boolean {
  return data.status === "error";
}

function buildQuoteErrorMessage(symbol: string, data: Record<string, unknown>): string {
  const msg = typeof data.message === "string" ? data.message : "unknown error";
  const code = typeof data.code === "number" || typeof data.code === "string" ? String(data.code) : "";
  return code ? `Twelve Data [${symbol}]: ${msg} (code: ${code})` : `Twelve Data [${symbol}]: ${msg}`;
}

function pickClosePrice(data: Record<string, unknown>, symbol: string): number {
  for (const key of ["close", "price", "open"] as const) {
    const n = parseFiniteNumber(data[key]);
    if (n !== null) {
      return Math.round(n);
    }
  }
  throw new Error(`Twelve Data [${symbol}]: 유효한 가격 필드(close 등)가 없습니다`);
}

function pickPercentChange(data: Record<string, unknown>): number | null {
  const n = parseFiniteNumber(data.percent_change);
  return n !== null ? n : null;
}

function parseUpdatedAt(data: Record<string, unknown>): Date {
  if (typeof data.datetime === "string" && data.datetime.trim() !== "") {
    const ms = Date.parse(data.datetime);
    if (!Number.isNaN(ms)) {
      return new Date(ms);
    }
  }
  const ts = parseFiniteNumber(data.timestamp);
  if (ts !== null && ts > 0) {
    return new Date(ts * 1000);
  }
  return new Date();
}

export class TwelveDataStockQuoteProvider implements StockQuoteProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error("TWELVE_DATA_API_KEY is required when STOCK_PRICE_PROVIDER=twelvedata");
    }
  }

  private resolveToSymbol(input: string): StockSymbol {
    const t = input.trim();
    const list = getSupportedStockSymbols();
    const found = list.find((s) => s.symbol === t || s.code === t);
    if (!found) {
      throw new Error(`지원하지 않는 종목 코드입니다: "${input.trim()}"`);
    }
    return found;
  }

  private async fetchQuote(meta: StockSymbol): Promise<StockPrice> {
    const params = new URLSearchParams({
      symbol: meta.twelveDataSymbol,
      exchange: meta.exchange,
      apikey: this.apiKey.trim(),
    });

    const url = `${QUOTE_BASE}?${params.toString()}`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`Twelve Data [${meta.symbol}]: 네트워크 오류 — ${e instanceof Error ? e.message : String(e)}`);
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new Error(`Twelve Data [${meta.symbol}]: JSON 파싱 실패`);
    }

    if (!isRecord(raw)) {
      throw new Error(`Twelve Data [${meta.symbol}]: JSON 객체가 아님`);
    }
    if (isTwelveDataErrorPayload(raw)) {
      throw new Error(buildQuoteErrorMessage(meta.symbol, raw));
    }
    if (!res.ok) {
      const hint = typeof raw.message === "string" ? raw.message : res.statusText;
      throw new Error(`Twelve Data [${meta.symbol}]: HTTP ${res.status} — ${hint}`);
    }

    const price = pickClosePrice(raw, meta.symbol);

    return {
      symbol: meta.symbol,
      code: meta.code,
      nameKo: meta.nameKo,
      nameEn: meta.nameEn,
      exchange: meta.exchange,
      price,
      changePercent: pickPercentChange(raw),
      currency: "KRW",
      provider: "twelvedata",
      updatedAt: parseUpdatedAt(raw),
    };
  }

  async getPrice(symbol: string): Promise<StockPrice> {
    const meta = this.resolveToSymbol(symbol);
    return this.fetchQuote(meta);
  }

  async getPrices(symbols: string[]): Promise<StockPrice[]> {
    return Promise.all(symbols.map((s) => this.getPrice(s)));
  }
}

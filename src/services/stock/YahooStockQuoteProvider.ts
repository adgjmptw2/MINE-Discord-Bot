/**
 * Yahoo Finance `chart` 응답 기반의 demo/delayed 시세 Provider입니다.
 * 공식 투자용 API가 아니며, 국내주식 MVP·검증용으로만 사용하세요.
 * 운영에서 정식 라이선스 Provider로 바꾸려면 `StockQuoteProvider` 구현을 교체하면 됩니다.
 */
import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import type { StockSymbol } from "@/settings/stockSymbols";
import type { StockQuoteProvider } from "./StockQuoteProvider";
import type { StockPrice } from "./types";

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

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

function pickLastValidClose(quote: unknown): number | null {
  if (!isRecord(quote)) {
    return null;
  }
  const close = quote.close;
  if (!Array.isArray(close)) {
    return null;
  }
  for (let i = close.length - 1; i >= 0; i -= 1) {
    const n = parseFiniteNumber(close[i]);
    if (n !== null) {
      return Math.round(n);
    }
  }
  return null;
}

function buildChartUrl(yahooTicker: string): string {
  const u = new URL(`${CHART_BASE}/${encodeURIComponent(yahooTicker)}`);
  u.searchParams.set("interval", "1m");
  u.searchParams.set("range", "1d");
  return u.toString();
}

function formatChartError(err: unknown): string {
  if (isRecord(err) && typeof err.description === "string") {
    return err.description;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export class YahooStockQuoteProvider implements StockQuoteProvider {
  private resolveToSymbol(input: string): StockSymbol {
    const t = input.trim();
    const list = getSupportedStockSymbols();
    const found = list.find((s) => s.symbol === t || s.code === t);
    if (!found) {
      throw new Error(`지원하지 않는 종목 코드입니다: "${input.trim()}"`);
    }
    return found;
  }

  private parseChartResponse(
    raw: unknown,
    meta: StockSymbol,
  ): Omit<StockPrice, "symbol" | "code" | "nameKo" | "nameEn" | "exchange"> {
    if (!isRecord(raw)) {
      throw new Error(`Yahoo [${meta.symbol}]: JSON 객체가 아님`);
    }

    const chart = raw.chart;
    if (!isRecord(chart)) {
      throw new Error(`Yahoo [${meta.symbol}]: chart 없음`);
    }

    if (chart.error != null) {
      throw new Error(
        `Yahoo [${meta.symbol}]: chart.error — ${formatChartError(chart.error)}`,
      );
    }

    const result = chart.result;
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error(`Yahoo [${meta.symbol}]: chart.result 없음`);
    }

    const first = result[0];
    if (!isRecord(first)) {
      throw new Error(`Yahoo [${meta.symbol}]: chart.result[0] 형식 오류`);
    }

    const chartMeta = first.meta;
    if (!isRecord(chartMeta)) {
      throw new Error(`Yahoo [${meta.symbol}]: meta 없음`);
    }

    let priceRaw = parseFiniteNumber(chartMeta.regularMarketPrice);
    if (priceRaw === null) {
      const indicators = first.indicators;
      if (isRecord(indicators)) {
        const quotes = indicators.quote;
        if (Array.isArray(quotes) && quotes[0] !== undefined) {
          const fromClose = pickLastValidClose(quotes[0]);
          if (fromClose !== null) {
            priceRaw = fromClose;
          }
        }
      }
    }

    if (priceRaw === null || Number.isNaN(priceRaw)) {
      throw new Error(`Yahoo [${meta.symbol}]: 가격을 찾을 수 없음`);
    }

    const price = Math.round(Number(priceRaw));
    if (!Number.isFinite(price)) {
      throw new Error(`Yahoo [${meta.symbol}]: 가격이 유효한 숫자가 아님`);
    }

    const prevClose =
      parseFiniteNumber(chartMeta.chartPreviousClose) ??
      parseFiniteNumber(chartMeta.previousClose);

    let changePercent: number | null = null;
    if (prevClose !== null && prevClose !== 0) {
      changePercent = ((price - prevClose) / prevClose) * 100;
    }

    let updatedAt = new Date();
    const rmt = parseFiniteNumber(chartMeta.regularMarketTime);
    if (rmt !== null && rmt > 0) {
      const ms = rmt > 1e12 ? rmt : rmt * 1000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        updatedAt = d;
      }
    }

    return {
      price,
      changePercent,
      currency: "KRW",
      provider: "yahoo",
      updatedAt,
    };
  }

  private async fetchQuote(meta: StockSymbol): Promise<StockPrice> {
    const url = buildChartUrl(meta.yahooSymbol);

    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(
        `Yahoo [${meta.symbol}]: 네트워크 오류 — ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      throw new Error(`Yahoo [${meta.symbol}]: JSON 파싱 실패`);
    }

    if (!res.ok) {
      const hint =
        isRecord(raw) && typeof raw.message === "string"
          ? raw.message
          : res.statusText;
      throw new Error(`Yahoo [${meta.symbol}]: HTTP ${res.status} — ${hint}`);
    }

    const parsed = this.parseChartResponse(raw, meta);

    return {
      symbol: meta.symbol,
      code: meta.code,
      nameKo: meta.nameKo,
      nameEn: meta.nameEn,
      exchange: meta.exchange,
      ...parsed,
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

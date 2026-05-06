import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import type { StockSymbol } from "@/settings/stockSymbols";
import type { StockQuoteProvider } from "./StockQuoteProvider";
import type { StockPrice } from "./types";

/** 종목코드(심볼)당 기준가 — Mock에서만 ±2% 흔듦 */
const BASE_PRICE_WON: Readonly<Record<string, number>> = {
  "005930": 80_000,
  "000660": 200_000,
  "035420": 180_000,
  "035720": 50_000,
  "005380": 250_000,
};

function randomAroundOne(plusMinus: number): number {
  return 1 + (Math.random() * 2 * plusMinus - plusMinus);
}

function randomChangePercent(): number {
  return Math.random() * 6 - 3;
}

export class MockStockQuoteProvider implements StockQuoteProvider {
  private resolveToSymbol(input: string): StockSymbol {
    const t = input.trim();
    const list = getSupportedStockSymbols();
    const found = list.find((s) => s.symbol === t || s.code === t);
    if (!found) {
      throw new Error(`지원하지 않는 종목 코드입니다: "${input.trim()}"`);
    }
    return found;
  }

  private buildPrice(meta: StockSymbol): StockPrice {
    const base = BASE_PRICE_WON[meta.symbol];
    if (base === undefined) {
      throw new Error(`Mock 기준가가 없는 종목입니다: ${meta.symbol}`);
    }
    const price = Math.round(base * randomAroundOne(0.02));
    return {
      symbol: meta.symbol,
      code: meta.code,
      nameKo: meta.nameKo,
      nameEn: meta.nameEn,
      exchange: meta.exchange,
      price,
      changePercent: randomChangePercent(),
      currency: "KRW",
      provider: "mock",
      updatedAt: new Date(),
    };
  }

  async getPrice(symbol: string): Promise<StockPrice> {
    const meta = this.resolveToSymbol(symbol);
    return this.buildPrice(meta);
  }

  async getPrices(symbols: string[]): Promise<StockPrice[]> {
    return Promise.all(symbols.map((s) => this.getPrice(s)));
  }
}

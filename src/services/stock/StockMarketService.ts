import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import { log } from "@/utils/logger";
import type { StockQuoteProvider } from "./StockQuoteProvider";
import type { StockPrice } from "./types";

export class StockMarketService {
  readonly provider: StockQuoteProvider;

  private readonly refreshIntervalMs: number;

  private readonly prices = new Map<string, StockPrice>();

  private lastRefreshAt: Date | null = null;

  private lastError: string | null = null;

  private timer: NodeJS.Timeout | null = null;

  private started = false;

  constructor(provider: StockQuoteProvider, refreshIntervalMs: number) {
    this.provider = provider;
    this.refreshIntervalMs = refreshIntervalMs;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    void this.refreshAll();
    this.timer = setInterval(() => {
      void this.refreshAll();
    }, this.refreshIntervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.started = false;
  }

  async refreshAll(): Promise<void> {
    const symbols = getSupportedStockSymbols().map((s) => s.symbol);
    try {
      const list = await this.provider.getPrices(symbols);
      this.prices.clear();
      for (const p of list) {
        this.prices.set(p.symbol, p);
      }
      this.lastRefreshAt = new Date();
      this.lastError = null;
      log("debug", "stock", `Stock quotes refreshed: ${list.length} symbols`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.lastError = msg;
      log("warn", "stock", `Failed to refresh stock quotes: ${msg}`);
    }
  }

  getCachedPrice(symbol: string): StockPrice | null {
    const key = symbol.trim();
    return this.prices.get(key) ?? null;
  }

  getCachedPrices(): StockPrice[] {
    return [...this.prices.values()];
  }

  getLastRefreshAt(): Date | null {
    return this.lastRefreshAt;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  isReady(): boolean {
    return this.prices.size > 0;
  }
}

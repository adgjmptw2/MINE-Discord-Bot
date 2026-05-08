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
    const results = await Promise.allSettled(
      symbols.map((sym) => this.provider.getPrice(sym)),
    );

    const failures: string[] = [];
    let successCount = 0;

    for (let i = 0; i < results.length; i += 1) {
      const r = results[i]!;
      const sym = symbols[i]!;
      if (r.status === "fulfilled") {
        this.prices.set(r.value.symbol, r.value);
        successCount += 1;
      } else {
        const reason =
          r.reason instanceof Error ? r.reason.message : String(r.reason);
        failures.push(`${sym}: ${reason}`);
      }
    }

    if (successCount > 0) {
      this.lastRefreshAt = new Date();
      const detail =
        successCount === symbols.length
          ? `${successCount} symbols`
          : `${successCount}/${symbols.length} symbols`;
      log("debug", "stock", `Stock quotes refreshed: ${detail}`);
    }

    if (failures.length > 0) {
      this.lastError = failures.join("; ");
      log("warn", "stock", `Stock quote refresh failures: ${this.lastError}`);
    } else {
      this.lastError = null;
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

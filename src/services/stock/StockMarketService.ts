import { getSupportedStockSymbols } from "@/settings/stockSymbols";
import type { StockConfig } from "@/types";
import {
  formatKstMinutesAsClock,
  getKstDateString,
  getKstMinutesOfDay,
  isKstWeekday,
  msUntilNextKstMinuteEdge,
} from "@/utils/date";
import { log } from "@/utils/logger";
import type { StockQuoteProvider } from "./StockQuoteProvider";
import type { StockPrice } from "./types";

export class StockMarketService {
  readonly provider: StockQuoteProvider;

  private readonly stock: StockConfig;

  private readonly prices = new Map<string, StockPrice>();

  private lastRefreshAt: Date | null = null;

  private lastError: string | null = null;

  private intervalTimer: NodeJS.Timeout | null = null;

  private scheduleTickTimer: NodeJS.Timeout | null = null;

  private started = false;

  private isRefreshing = false;

  private executedScheduledRefreshKeys = new Set<string>();

  private lastScheduleTickKstDate: string | null = null;

  constructor(provider: StockQuoteProvider, stock: StockConfig) {
    this.provider = provider;
    this.stock = stock;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const providerName = this.stock.stockPriceProvider;

    if (this.stock.stockPriceRefreshMode === "interval") {
      log(
        "info",
        "stock",
        `Stock market service started: provider=${providerName}, mode=interval, interval=${this.stock.stockPriceRefreshIntervalMs}ms`,
      );
      void this.refreshAll();
      this.intervalTimer = setInterval(() => {
        void this.refreshAll();
      }, this.stock.stockPriceRefreshIntervalMs);
      return;
    }

    const times = this.stock.stockScheduledCloseRefreshTimesKst
      .map((m) => formatKstMinutesAsClock(m))
      .join(",");
    log(
      "info",
      "stock",
      `Stock market service started: provider=${providerName}, mode=scheduled-close, times=${times} KST`,
    );

    void this.refreshAll();

    const delay = msUntilNextKstMinuteEdge();
    this.scheduleTickTimer = setTimeout(() => {
      void this.onScheduledCloseTick();
      this.scheduleTickTimer = setInterval(() => {
        void this.onScheduledCloseTick();
      }, 60_000);
    }, delay);
  }

  stop(): void {
    if (this.intervalTimer !== null) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.scheduleTickTimer !== null) {
      clearTimeout(this.scheduleTickTimer);
      clearInterval(this.scheduleTickTimer);
      this.scheduleTickTimer = null;
    }
    this.started = false;
  }

  private async onScheduledCloseTick(): Promise<void> {
    const now = new Date();
    const dateStr = getKstDateString(now);

    if (this.lastScheduleTickKstDate !== dateStr) {
      this.executedScheduledRefreshKeys.clear();
      this.lastScheduleTickKstDate = dateStr;
    }

    if (!isKstWeekday(now)) {
      return;
    }

    const minuteNow = getKstMinutesOfDay(now);

    for (const targetMin of this.stock.stockScheduledCloseRefreshTimesKst) {
      if (targetMin !== minuteNow) {
        continue;
      }
      const key = `${dateStr}:${targetMin}`;
      if (this.executedScheduledRefreshKeys.has(key)) {
        continue;
      }
      this.executedScheduledRefreshKeys.add(key);

      const label = formatKstMinutesAsClock(targetMin);
      log(
        "info",
        "stock",
        `Scheduled stock quote refresh started: ${label} KST`,
      );

      try {
        await this.refreshAll();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("warn", "stock", `Failed to refresh stock quotes: ${msg}`);
      }
    }
  }

  async refreshAll(): Promise<void> {
    if (this.isRefreshing) {
      return;
    }
    this.isRefreshing = true;
    try {
      await this.runRefreshAllInternal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("warn", "stock", `Failed to refresh stock quotes: ${msg}`);
    } finally {
      this.isRefreshing = false;
    }
  }

  private async runRefreshAllInternal(): Promise<void> {
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

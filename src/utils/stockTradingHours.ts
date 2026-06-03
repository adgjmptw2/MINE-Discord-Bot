import type { StockConfig } from "@/types";
import {
  formatKstMinutesAsClock,
  isKstWeekday,
  isWithinKstTimeRange,
} from "@/utils/date";

export type StockTradingBlockReason = "WEEKEND" | "OUT_OF_HOURS";

export interface StockTradingAllowedResult {
  allowed: boolean;
  reason?: StockTradingBlockReason;
  startLabel: string;
  endLabel: string;
}

export function isStockTradingAllowed(
  stock: StockConfig,
  now = new Date(),
): StockTradingAllowedResult {
  const startLabel = formatKstMinutesAsClock(stock.stockTradingStartMinutesKst);
  const endLabel = formatKstMinutesAsClock(stock.stockTradingEndMinutesKst);

  if (!stock.stockTradingHoursEnabled) {
    return { allowed: true, startLabel, endLabel };
  }

  if (!isKstWeekday(now)) {
    return { allowed: false, reason: "WEEKEND", startLabel, endLabel };
  }

  const ok = isWithinKstTimeRange(
    now,
    stock.stockTradingStartMinutesKst,
    stock.stockTradingEndMinutesKst,
  );
  if (!ok) {
    return { allowed: false, reason: "OUT_OF_HOURS", startLabel, endLabel };
  }

  return { allowed: true, startLabel, endLabel };
}

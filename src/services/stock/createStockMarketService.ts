import type { StockConfig } from "@/types";
import { createStockQuoteProvider } from "./createStockQuoteProvider";
import { StockMarketService } from "./StockMarketService";

export function createStockMarketService(
  stock: StockConfig,
): StockMarketService {
  const provider = createStockQuoteProvider(stock);
  return new StockMarketService(provider, stock);
}

import type { StockConfig } from "@/types";
import { MockStockQuoteProvider } from "./MockStockQuoteProvider";
import type { StockQuoteProvider } from "./StockQuoteProvider";

export function createStockQuoteProvider(stock: StockConfig): StockQuoteProvider {
  switch (stock.stockPriceProvider) {
    case "mock":
      return new MockStockQuoteProvider();
    case "twelvedata":
      throw new Error("Twelve Data provider is not implemented yet");
    default: {
      const _never: never = stock.stockPriceProvider;
      return _never;
    }
  }
}

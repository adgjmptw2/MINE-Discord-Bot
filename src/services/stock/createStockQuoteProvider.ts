import type { StockConfig } from "@/types";
import { MockStockQuoteProvider } from "./MockStockQuoteProvider";
import { TwelveDataStockQuoteProvider } from "./TwelveDataStockQuoteProvider";
import type { StockQuoteProvider } from "./StockQuoteProvider";

export function createStockQuoteProvider(stock: StockConfig): StockQuoteProvider {
  switch (stock.stockPriceProvider) {
    case "mock":
      return new MockStockQuoteProvider();
    case "twelvedata":
      return new TwelveDataStockQuoteProvider(stock.twelveDataApiKey);
    default: {
      const _never: never = stock.stockPriceProvider;
      return _never;
    }
  }
}

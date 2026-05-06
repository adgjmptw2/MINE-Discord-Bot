import type { StockPrice } from "./types";

export interface StockQuoteProvider {
  getPrice(symbol: string): Promise<StockPrice>;
  getPrices(symbols: string[]): Promise<StockPrice[]>;
}

export interface StockChartPoint {
  timestamp: number;
  price: number;
}

export interface StockQuoteDisplayExtras {
  points: StockChartPoint[];
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
}

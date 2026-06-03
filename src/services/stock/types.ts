import type { StockPriceProvider } from "@/types";

export type StockPrice = {
  symbol: string;
  code: string;
  nameKo: string;
  nameEn: string;
  exchange: string;
  price: number;
  changePercent: number | null;
  currency: "KRW";
  provider: StockPriceProvider;
  updatedAt: Date;
};

import type { StockPriceProvider } from "@/types";

/** 시세 한 건 (원 단위 정수, DB 저장은 다음 단계) */
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

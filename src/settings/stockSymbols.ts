export type StockSymbol = {
  /** 우리 쪽에서 쓰는 키 — 지금은 종목코드랑 같음 */
  symbol: string;
  /** 6자리 종목코드 */
  code: string;
  nameKo: string;
  nameEn: string;
  exchange: "KRX";
  /** Twelve Data 넘길 때 쓸 문자열. 아직은 코드 그대로 씀 */
  twelveDataSymbol: string;
  /** Yahoo Finance chart API용 티커 (예: 005930.KS) */
  yahooSymbol: string;
};

const SUPPORTED: readonly StockSymbol[] = [
  // 그냥 잘 나가는 국장 대형주 5개 — 늘리면 이 배열만
  {
    symbol: "005930",
    code: "005930",
    nameKo: "삼성전자",
    nameEn: "Samsung Electronics",
    exchange: "KRX",
    twelveDataSymbol: "005930",
    yahooSymbol: "005930.KS",
  },
  {
    symbol: "000660",
    code: "000660",
    nameKo: "SK하이닉스",
    nameEn: "SK hynix",
    exchange: "KRX",
    twelveDataSymbol: "000660",
    yahooSymbol: "000660.KS",
  },
  {
    symbol: "035420",
    code: "035420",
    nameKo: "NAVER",
    nameEn: "NAVER",
    exchange: "KRX",
    twelveDataSymbol: "035420",
    yahooSymbol: "035420.KS",
  },
  {
    symbol: "035720",
    code: "035720",
    nameKo: "카카오",
    nameEn: "Kakao",
    exchange: "KRX",
    twelveDataSymbol: "035720",
    yahooSymbol: "035720.KS",
  },
  {
    symbol: "005380",
    code: "005380",
    nameKo: "현대차",
    nameEn: "Hyundai Motor",
    exchange: "KRX",
    twelveDataSymbol: "005380",
    yahooSymbol: "005380.KS",
  },
] as const;

export function getSupportedStockSymbols(): readonly StockSymbol[] {
  return SUPPORTED;
}

// 슬래시 명령 붙이기 전에 미리 만들어 둔 검색 — 코드/한글/영문 섞여 들어와도 찾게
export function findStockSymbol(input: string): StockSymbol | undefined {
  const q = input.trim();
  if (!q) {
    return undefined;
  }

  const lower = q.toLowerCase();

  for (const s of SUPPORTED) {
    if (s.code === q || s.symbol === q || s.twelveDataSymbol === q || s.yahooSymbol === q) {
      return s;
    }
    if (s.nameKo === q) {
      return s;
    }
    if (s.nameEn.toLowerCase() === lower || s.nameKo.toLowerCase() === lower) {
      return s;
    }
    if (s.yahooSymbol.toLowerCase() === lower) {
      return s;
    }
  }

  if (lower.length < 2) {
    return undefined;
  }

  for (const s of SUPPORTED) {
    if (s.nameEn.toLowerCase().includes(lower)) {
      return s;
    }
    if (s.nameKo.toLowerCase().includes(lower)) {
      return s;
    }
  }

  return undefined;
}

import { findStockSymbol } from "@/settings/stockSymbols";
import { STOCK_QUANTITY_SCALE, type CoinGameLogEntry } from "@/storage/stock";

/** 천 단위 쉼표만 (예: 80,000) */
export function formatKrwPrice(price: number): string {
  return price.toLocaleString("ko-KR");
}

/** 모의투자 금액 표시 (예: 10,000 코인) */
export function formatCoin(amount: number): string {
  return `${formatKrwPrice(amount)} 코인`;
}

/** 기존 코드 호환 — `formatCoin`과 동일 */
export const formatMine = formatCoin;

/** 손익 등 부호가 필요한 코인 (예: +1,234 코인 / -500 코인) */
export function formatSignedCoin(amount: number): string {
  const abs = formatKrwPrice(Math.abs(amount));
  if (amount > 0) {
    return `+${abs} 코인`;
  }
  if (amount < 0) {
    return `-${abs} 코인`;
  }
  return `${abs} 코인`;
}

/** 기존 코드 호환 — `formatSignedCoin`과 동일 */
export const formatSignedMine = formatSignedCoin;

export function formatPercent(value: number | null): string {
  if (value === null) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** 서울 기준, 마지막 갱신 시각 표시 */
export function formatStockRefreshTime(date: Date | null): string {
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** 지원 종목이면 `삼성전자 (005930)`, 아니면 심볼만 */
export function formatStockDisplayName(symbol: string): string {
  const meta = findStockSymbol(symbol.trim());
  if (meta) {
    return `${meta.nameKo} (${meta.code})`;
  }
  return symbol.trim();
}

/** 보유 수량 (마이크로 단위 → 주) */
export function formatStockQuantity(quantityMicro: number): string {
  const shares = quantityMicro / STOCK_QUANTITY_SCALE;
  return `${shares.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주`;
}

/** Discord ```ansi 블록용 이스케이프 */
export const ANSI_RESET = "\u001b[0m";
export const ANSI_RED = "\u001b[31m";
export const ANSI_BLUE = "\u001b[34m";
export const ANSI_GRAY = "\u001b[90m";

/** 등락률에 따른 ANSI 색 — 상승 빨강, 하락 파랑, 그 외 회색 */
export function getAnsiStockColor(changePercent: number | null): string {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return ANSI_GRAY;
  }
  if (changePercent > 0) {
    return ANSI_RED;
  }
  if (changePercent < 0) {
    return ANSI_BLUE;
  }
  return ANSI_GRAY;
}

/**
 * 현재가·등락률로 전일 대비 추정 변동액(코인, 정수).
 * 등락률 = (현재가 - 전일가) / 전일가 * 100 가정.
 */
export function estimateChangeAmount(
  price: number,
  changePercent: number | null,
): number {
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return 0;
  }
  const prev = price / (1 + changePercent / 100);
  return Math.round(price - prev);
}

/**
 * 상승·하락 색이 들어간 변동 괄호 (RESET 포함).
 * 표시 순서: `(퍼센트 | 변동 코인)` — 계산식 변경 금지.
 */
export function formatAnsiStockChange(
  price: number,
  changePercent: number | null,
): string {
  const color = getAnsiStockColor(changePercent);
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return `${color}(정보 없음)${ANSI_RESET}`;
  }
  const delta = estimateChangeAmount(price, changePercent);
  const signed = formatSignedCoin(delta);
  const pct = formatPercent(changePercent);
  return `${color}(${pct} | ${signed})${ANSI_RESET}`;
}

/** 한 줄 시세: `가격 코인` + 색 있는 변동 부분 — 코드블록 안에 넣을 본문만 */
export function formatAnsiQuoteLine(
  price: number,
  changePercent: number | null,
): string {
  return `${formatKrwPrice(price)} 코인 ${formatAnsiStockChange(price, changePercent)}`;
}

/** ```ansi … ``` 래퍼 (코드블록 안에는 백틱 없음) */
export function wrapAnsiCodeBlock(inner: string): string {
  return `\`\`\`ansi\n${inner}\n\`\`\``;
}

/** `/프로필` 등: 최근 미니게임 1건 요약 */
export function formatLatestGameLogForProfile(
  log: CoinGameLogEntry | null,
): string {
  if (!log) {
    return "최근 게임 없음";
  }
  if (log.gameType === "RPS") {
    const label = "가위바위보";
    if (log.result === "WIN") {
      return `${label} 승리 (${formatSignedCoin(log.balanceDelta)})`;
    }
    if (log.result === "LOSE") {
      return `${label} 패배 (${formatSignedCoin(log.balanceDelta)})`;
    }
    if (log.result === "DRAW") {
      return `${label} 무승부 (${formatSignedCoin(log.balanceDelta)})`;
    }
  }
  return `${log.gameType} ${log.result} (${formatSignedCoin(log.balanceDelta)})`;
}

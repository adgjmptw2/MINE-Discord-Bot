/** 천 단위 쉼표만 (예: 80,000) */
export function formatKrwPrice(price: number): string {
  return price.toLocaleString("ko-KR");
}

/** 모의투자 금액 표시 (예: 10,000 코인) */
export function formatMine(amount: number): string {
  return `${formatKrwPrice(amount)} 코인`;
}

/** 손익 등 부호가 필요한 코인 (예: +1,234 코인 / -500 코인) */
export function formatSignedMine(amount: number): string {
  const abs = formatKrwPrice(Math.abs(amount));
  if (amount > 0) {
    return `+${abs} 코인`;
  }
  if (amount < 0) {
    return `-${abs} 코인`;
  }
  return `${abs} 코인`;
}

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

export type ParsedSellInput =
  | { mode: "all" }
  | { mode: "percent"; percent: number }
  | { mode: "amount"; amount: number };

/** `/매도` 두 번째 인자: `전부`, `5000`, `50%` 등 */
export function parseSellInput(raw: string): ParsedSellInput | null {
  const s = raw.trim();
  if (!s) {
    return null;
  }

  const lower = s.toLowerCase();
  if (lower === "전부" || lower === "all" || lower === "전체") {
    return { mode: "all" };
  }

  if (s.includes("%")) {
    const numPart = s.replace(/%/g, "").trim();
    const n = Number(numPart.replace(/,/g, ""));
    if (!Number.isFinite(n)) {
      return null;
    }
    return { mode: "percent", percent: n };
  }

  const cleaned = s.replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  return { mode: "amount", amount: Math.floor(n) };
}

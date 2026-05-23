import type { StockChartPoint } from "@/services/stock/chartTypes";
import type { StockQuoteTrend } from "@/utils/stockFormat";

export interface StockChartRenderInput {
  title: string;
  points: readonly StockChartPoint[];
  trend: StockQuoteTrend;
}

export interface StockChartRenderResult {
  filename: string;
  contentType: "image/svg+xml";
  buffer: Buffer;
}

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trendLineColor(trend: StockQuoteTrend): string {
  if (trend === "UP") {
    return "#ef4444";
  }
  if (trend === "DOWN") {
    return "#3b82f6";
  }
  return "#9ca3af";
}

const W = 900;
const H = 420;
const PAD = 48;
const TOP_TITLE = 36;

export function renderStockLineChartSvg(
  input: StockChartRenderInput,
): StockChartRenderResult {
  const pts = input.points;
  if (pts.length < 2) {
    throw new Error("stock chart: need at least 2 points");
  }

  const plotX0 = PAD;
  const plotY0 = PAD + TOP_TITLE;
  const plotW = W - PAD * 2;
  const plotH = H - PAD - plotY0;

  const prices = pts.map((p) => p.price);
  let yMin = Math.min(...prices);
  let yMax = Math.max(...prices);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yPad = (yMax - yMin) * 0.06;
  yMin -= yPad;
  yMax += yPad;

  const t0 = pts[0]!.timestamp;
  const t1 = pts[pts.length - 1]!.timestamp;

  const toX = (i: number) => plotX0 + (i / (pts.length - 1)) * plotW;
  const toY = (price: number) =>
    plotY0 + plotH - ((price - yMin) / (yMax - yMin)) * plotH;

  const lineD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(p.price).toFixed(2)}`)
    .join(" ");

  const last = pts[pts.length - 1]!;
  const lx = toX(pts.length - 1);
  const ly = toY(last.price);
  const stroke = trendLineColor(input.trend);

  const yMid = (yMin + yMax) / 2;
  const fmtY = (v: number) =>
    escapeSvgText(Math.round(v).toLocaleString("ko-KR"));

  const fmtTime = (ms: number) =>
    escapeSvgText(
      new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(ms)),
    );

  const gridYs = [yMin, yMid, yMax];
  const gridLines = gridYs
    .map(
      (yv) =>
        `<line x1="${plotX0}" y1="${toY(yv).toFixed(2)}" x2="${plotX0 + plotW}" y2="${toY(yv).toFixed(2)}" stroke="#374151" stroke-width="1" opacity="0.55"/>`,
    )
    .join("\n    ");

  const yLabels = gridYs
    .map(
      (yv) =>
        `<text x="${plotX0 - 8}" y="${toY(yv) + 4}" fill="#9ca3af" font-size="13" text-anchor="end">${fmtY(yv)}</text>`,
    )
    .join("\n    ");

  const titleEsc = escapeSvgText(input.title);
  const bg = "#111827";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="${W / 2}" y="${PAD}" fill="#e5e7eb" font-size="18" font-weight="600" text-anchor="middle">${titleEsc}</text>
  ${gridLines}
  ${yLabels}
  <text x="${plotX0}" y="${H - 16}" fill="#6b7280" font-size="12">${fmtTime(t0)}</text>
  <text x="${plotX0 + plotW}" y="${H - 16}" fill="#6b7280" font-size="12" text-anchor="end">${fmtTime(t1)}</text>
  <path d="${lineD}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${lx.toFixed(2)}" cy="${ly.toFixed(2)}" r="5" fill="${stroke}"/>
</svg>`;

  return {
    filename: "chart.svg",
    contentType: "image/svg+xml",
    buffer: Buffer.from(svg, "utf-8"),
  };
}

import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  MessageFlags,
} from "discord.js";
import {
  findStockSymbol,
  getSupportedStockSymbols,
} from "@/settings/stockSymbols";
import type { StockMarketService } from "@/services/stock/StockMarketService";
import type { StockPrice } from "@/services/stock/types";
import { YahooStockQuoteProvider } from "@/services/stock/YahooStockQuoteProvider";
import { panelEdit, panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import {
  classifyStockTrend,
  estimateChangeAmount,
  formatKrwPrice,
  formatPercent,
  formatQuoteLowLine,
  formatQuoteOhlcLine,
  quoteAccentRgb,
  quoteTrendTitleEmoji,
} from "@/utils/stockFormat";
import { renderStockLineChartSvg } from "@/utils/stockChartImage";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const YAHOO_EXTRAS_MS = 2000;

function formatStockPriceDescription(
  price: number,
  changePercent: number | null,
): string {
  const priceLabel = formatKrwPrice(price);
  if (changePercent === null || !Number.isFinite(changePercent)) {
    return `**${priceLabel} 코인**`;
  }
  const delta = estimateChangeAmount(price, changePercent);
  if (delta === 0) {
    return `**${priceLabel} 코인** (0)`;
  }
  const sign = delta > 0 ? "+" : "-";
  return `**${priceLabel} 코인** (${sign}${formatKrwPrice(Math.abs(delta))})`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    void promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

async function resolveStockPriceForDisplay(
  market: StockMarketService | undefined,
  symbol: string,
): Promise<StockPrice | null> {
  const cached = market?.getCachedPrice(symbol);
  if (cached) {
    return cached;
  }
  const prov = market?.provider;
  if (!prov) {
    return null;
  }
  try {
    return await prov.getPrice(symbol);
  } catch {
    return null;
  }
}

const command: SlashCommand = {
  name: "주식",
  description: "종목의 현재 시세와 그래프를 확인합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "종목",
      description: "종목명 또는 종목코드",
      required: true,
      maxLength: 64,
    },
  ],

  async run(client: MineClient, interaction) {
    const scheduleIfEphemeral = () => scheduleEphemeralReplyDelete(interaction);

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleIfEphemeral();
      return;
    }

    const raw = interaction.options.getString("종목", true);
    const sym = findStockSymbol(raw);

    if (!sym) {
      const hint = getSupportedStockSymbols()
        .map((s) => `${s.nameKo} (${s.code})`)
        .join("\n");
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "📊 종목 시세",
            lines: [
              "알 수 없는 입력입니다. 아래 지원 종목 중에서 다시 입력해 주세요.",
              "",
              hint,
            ],
          },
          allowedMentions: NO_MENTION,
        }),
      );
      scheduleIfEphemeral();
      return;
    }

    await interaction.deferReply();

    const market = client.stockMarket;

    const editUnavailable = () =>
      interaction.editReply(
        panelEdit({
          panel: {
            title: "📊 종목 시세",
            description: "시세를 표시하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            lines: [
              `${sym.nameKo} (${sym.code})`,
              "데이터 제공자 응답이 없거나 시세 갱신이 지연 중입니다.",
            ],
            accentColor: quoteAccentRgb("FLAT"),
          },
          allowedMentions: NO_MENTION,
        }),
      );

    try {
      const p = await resolveStockPriceForDisplay(market, sym.symbol);

      if (!p) {
        await editUnavailable();
        return;
      }

      const trend = classifyStockTrend(p.changePercent);
      const pctStr = formatPercent(p.changePercent);
      const trendArrow =
        trend === "UP" ? "▲" : trend === "DOWN" ? "▼" : "";
      const titleSuffix =
        pctStr !== "—" && trendArrow
          ? `  ${trendArrow} ${pctStr}`
          : pctStr !== "—"
            ? `  ${pctStr}`
            : "";
      const title = `${quoteTrendTitleEmoji(trend)} ${p.nameKo} (${p.code})${titleSuffix}`;
      const lines: string[] = [];

      let open: number | null = null;
      let high: number | null = null;
      let low: number | null = null;
      let chartPoints: readonly { timestamp: number; price: number }[] | null =
        null;

      const prov = market?.provider;
      if (prov instanceof YahooStockQuoteProvider) {
        const extras = await withTimeout(
          prov.fetchQuoteDisplayExtras(sym.symbol),
          YAHOO_EXTRAS_MS,
          null,
        );
        if (extras) {
          open = extras.open;
          high = extras.high;
          low = extras.low;
          if (extras.points.length >= 2) {
            chartPoints = extras.points;
          }
        }
      }

      lines.push(formatQuoteOhlcLine(open, high), formatQuoteLowLine(low));

      const files: AttachmentBuilder[] = [];
      if (chartPoints !== null && chartPoints.length >= 2) {
        try {
          const rendered = renderStockLineChartSvg({
            title: `${p.nameKo} (${p.code})`,
            points: chartPoints,
            trend,
          });
          files.push(
            new AttachmentBuilder(rendered.buffer, {
              name: `stock-${sym.code}-1d.svg`,
              description: undefined,
            }),
          );
        } catch {
          /* 그래프 생략 */
        }
      }

      await interaction.editReply(
        panelEdit({
          panel: {
            title,
            description: formatStockPriceDescription(p.price, p.changePercent),
            lines,
            accentColor: quoteAccentRgb(trend),
          },
          files: files.length > 0 ? files : undefined,
          allowedMentions: NO_MENTION,
        }),
      );
    } catch {
      await editUnavailable().catch(() => undefined);
    }
  },
};

export default command;

import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  MessageFlags,
} from "discord.js";
import {
  findStockSymbol,
  getSupportedStockSymbols,
} from "@/settings/stockSymbols";
import { YahooStockQuoteProvider } from "@/services/stock/YahooStockQuoteProvider";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import {
  classifyStockTrend,
  formatQuoteCurrentPriceLine,
  formatQuoteDayChangeLine,
  formatQuoteLowLine,
  formatQuoteOhlcLine,
  quoteAccentRgb,
  quoteTrendTitleEmoji,
} from "@/utils/stockFormat";
import { renderStockLineChartSvg } from "@/utils/stockChartImage";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "시세",
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

    const market = client.stockMarket;
    const p = market?.getCachedPrice(sym.symbol);

    if (!p) {
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "📊 종목 시세",
            description: "시세 준비 중입니다. 잠시 후 다시 시도해 주세요.",
            lines: [`**${sym.nameKo}** (${sym.code})`],
            accentColor: quoteAccentRgb("FLAT"),
          },
          allowedMentions: NO_MENTION,
        }),
      );
      return;
    }

    const trend = classifyStockTrend(p.changePercent);
    const title = `${quoteTrendTitleEmoji(trend)} ${p.nameKo} (${p.code})`;
    const lines: string[] = [
      formatQuoteCurrentPriceLine(p.price),
      formatQuoteDayChangeLine(p.price, p.changePercent),
      "",
    ];

    let open: number | null = null;
    let high: number | null = null;
    let low: number | null = null;
    let chartPoints: readonly { timestamp: number; price: number }[] | null =
      null;

    const prov = market?.provider;
    if (prov instanceof YahooStockQuoteProvider) {
      const extras = await prov.fetchQuoteDisplayExtras(sym.symbol);
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

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title,
          lines,
          accentColor: quoteAccentRgb(trend),
        },
        files: files.length > 0 ? files : undefined,
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;

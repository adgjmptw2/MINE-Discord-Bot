import { MessageFlags } from "discord.js";
import {
  getStockAssetSummary,
  STOCK_QUANTITY_SCALE,
  type StockAssetSummary,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import {
  formatCoin,
  formatPercent,
  formatSignedCoin,
  formatStockDisplayName,
  formatStockQuantity,
} from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const STOCK_ASSET_DETAIL_DELETE_MS = 60_000;

const NO_MENTION = { parse: [] as const };

function fmtPlain(n: number): string {
  return n.toLocaleString("ko-KR");
}

const HOLDINGS_PREVIEW_MAX = 3;

function buildHoldingsLines(
  summary: StockAssetSummary,
  market: MineClient["stockMarket"],
): string[] {
  if (summary.holdings.length === 0) {
    return ["보유 종목 없음"];
  }

  const shown = summary.holdings.slice(0, HOLDINGS_PREVIEW_MAX);
  const lines = shown.map((h) => {
    const px = market?.getCachedPrice(h.symbol)?.price;
    const evalDisplay =
      px !== undefined
        ? formatCoin(
            Math.round((h.quantityMicro / STOCK_QUANTITY_SCALE) * px),
          )
        : "시세 없음";
    return `${formatStockDisplayName(h.symbol)} · 평가 ${evalDisplay} · ${formatStockQuantity(h.quantityMicro)}`;
  });

  const rest = summary.holdings.length - shown.length;
  if (rest > 0) {
    lines.push(`외 ${rest}종목`);
  }

  return lines;
}

const command: SlashCommand = {
  name: "주식자산",
  description: "내 주식 보유 현황을 자세히 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const market = client.stockMarket;
    const cachedPrices = market?.getCachedPrices() ?? [];
    const cacheEmpty = !market?.isReady() || cachedPrices.length === 0;

    const summary = getStockAssetSummary(guildId, userId, cachedPrices);

    if (!summary) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "📊 주식자산",
            description:
              "아직 지갑이 없습니다. `/출석`으로 코인을 받고 모의투자를 시작해 보세요.",
            lines: [
              "_서버 내 모의투자 · 가상 코인 재화입니다._",
            ],
          },
          allowedMentions: NO_MENTION,
        }),
      );
      scheduleEphemeralReplyDelete(interaction, STOCK_ASSET_DETAIL_DELETE_MS);
      return;
    }

    const profitLoss = summary.totalAssets - summary.wallet.totalDeposit;
    const description = `평가액 \`${fmtPlain(summary.stockValueTotal)} 코인\`  ·  보유 ${summary.holdings.length}종목  ·  손익 ${formatSignedCoin(profitLoss)}  ·  ${formatPercent(summary.profitLossPercent)}`;
    const lines: string[] = [
      `현금 ${fmtPlain(summary.cashTotal)} 코인  ·  총자산 ${fmtPlain(summary.totalAssets)} 코인`,
      ...buildHoldingsLines(summary, market),
    ];

    const footnotes: string[] = [];
    if (cacheEmpty) {
      footnotes.push("시세 캐시 준비 중");
    } else if (summary.unavailableSymbols.length > 0) {
      const missing = summary.unavailableSymbols
        .map((sym) => formatStockDisplayName(sym))
        .join(", ");
      footnotes.push(`시세 미반영: ${missing}`);
    }
    footnotes.push("모의투자 · 가상 코인");
    lines.push(`_${footnotes.join(" · ")}_`);

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "📊 주식자산",
          description,
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );

    scheduleEphemeralReplyDelete(interaction, STOCK_ASSET_DETAIL_DELETE_MS);
  },
};

export default command;

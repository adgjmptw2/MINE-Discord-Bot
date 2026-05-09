import { MessageFlags } from "discord.js";
import {
  getStockAssetSummary,
  STOCK_QUANTITY_SCALE,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import {
  formatCoin,
  formatPercent,
  formatStockDisplayName,
  formatStockQuantity,
} from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

/** 상세 자산(ephemeral) 자동 삭제까지 — 너무 짧지 않게 */
const STOCK_ASSET_DETAIL_DELETE_MS = 60_000;

const NO_MENTION = { parse: [] as const };

function fmtPlain(n: number): string {
  return n.toLocaleString("ko-KR");
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
            title: "내 주식 자산",
            description:
              "아직 지갑이 없습니다. `/출석`으로 코인을 받고 시작해 보세요.",
            lines: ["※ 모의투자 게임입니다. 실제 투자가 아닙니다."],
          },
          allowedMentions: NO_MENTION,
        }),
      );
      scheduleEphemeralReplyDelete(interaction, STOCK_ASSET_DETAIL_DELETE_MS);
      return;
    }

    const lines: string[] = [
      `💰 현금: ${fmtPlain(summary.cashTotal)} 코인`,
      `📈 주식 평가액: ${fmtPlain(summary.stockValueTotal)} 코인`,
      `🏦 총자산: ${fmtPlain(summary.totalAssets)} 코인`,
      `📥 누적 입금: ${fmtPlain(summary.wallet.totalDeposit)} 코인`,
      `📊 수익률: ${formatPercent(summary.profitLossPercent)}`,
      "",
      "**📊 보유 종목**",
    ];

    if (summary.holdings.length === 0) {
      lines.push("보유 종목 없음");
    } else {
      for (const h of summary.holdings) {
        const nameLine = formatStockDisplayName(h.symbol);
        const qtyLine = formatStockQuantity(h.quantityMicro);
        const avgLine = formatCoin(h.averageBuyPrice);
        const px = market?.getCachedPrice(h.symbol)?.price;
        const evalLine =
          px !== undefined
            ? formatCoin(
                Math.round(
                  (h.quantityMicro / STOCK_QUANTITY_SCALE) * px,
                ),
              )
            : "시세 없음";
        lines.push(
          "",
          nameLine,
          `- 수량: ${qtyLine}`,
          `- 평균 매수가: ${avgLine}`,
          `- 평가액: ${evalLine}`,
        );
      }
    }

    if (cacheEmpty) {
      lines.push("", "_시세 캐시 준비 중일 수 있습니다._");
    } else if (summary.unavailableSymbols.length > 0) {
      const missing = summary.unavailableSymbols
        .map((sym) => formatStockDisplayName(sym))
        .join(", ");
      lines.push("", `_일부 종목 시세 없음: ${missing}_`);
    }

    lines.push("", "※ 모의투자 게임입니다. 실제 투자가 아닙니다.");

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "내 주식 자산",
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );

    scheduleEphemeralReplyDelete(interaction, STOCK_ASSET_DETAIL_DELETE_MS);
  },
};

export default command;

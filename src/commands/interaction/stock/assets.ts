import { MessageFlags } from "discord.js";
import { getStockAssetSummary, STOCK_QUANTITY_SCALE } from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

const command: SlashCommand = {
  name: "자산",
  description: "내 모의투자 자산을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "서버에서만 사용할 수 있습니다.", flags: MessageFlags.Ephemeral });
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
            title: "자산",
            description: "아직 지갑이 없습니다. `/출석`으로 시작하세요.",
            lines: ["※ 모의투자 게임입니다. 실제 투자가 아닙니다."],
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const lines: string[] = [
      `현금: **${fmt(summary.cashTotal)}** MINE`,
      `주식 평가액: **${fmt(summary.stockValueTotal)}** MINE`,
      `총자산: **${fmt(summary.totalAssets)}** MINE`,
      `누적 입금: **${fmt(summary.wallet.totalDeposit)}** MINE`,
      `수익률: **${summary.profitLossPercent.toFixed(2)}%**`,
    ];

    if (summary.holdings.length === 0) {
      lines.push("", "보유 종목 없음");
    } else {
      const holdingLines = summary.holdings.map((h) => {
        const qty = h.quantityMicro / STOCK_QUANTITY_SCALE;
        return `• **${h.symbol}** — 수량 ${qty.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}`;
      });
      lines.push("", "**보유 종목**", ...holdingLines);
    }

    if (cacheEmpty) {
      lines.push("", "_시세 캐시 준비 중일 수 있습니다._");
    } else if (summary.unavailableSymbols.length > 0) {
      lines.push("", `_일부 종목 시세 없음: ${summary.unavailableSymbols.join(", ")}_`);
    }

    lines.push("", "※ 모의투자 게임입니다. 실제 투자가 아닙니다.");

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "자산",
          lines,
        },
      }),
    );

    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

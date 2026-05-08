import { MessageFlags } from "discord.js";
import { getStockRanking } from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import { formatMine, formatPercent, formatSignedMine } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const RANKING_LIMIT = 10;

const command: SlashCommand = {
  name: "주식랭킹",
  description: "이 서버의 모의투자 자산 랭킹을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "서버에서만 사용할 수 있습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guildId = interaction.guildId;

    const market = client.stockMarket;
    if (!market || !market.isReady()) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "주식랭킹",
            description: "시세 캐시가 아직 준비되지 않았습니다.",
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const cachedPrices = market.getCachedPrices();
    const ranking = getStockRanking(guildId, cachedPrices, RANKING_LIMIT);

    if (ranking.length === 0) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "주식랭킹",
            description: "아직 랭킹에 표시할 사용자가 없습니다. `/출석`으로 시작해보세요.",
          },
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const lines: string[] = [];
    let anyUnavailable = false;

    for (let i = 0; i < ranking.length; i += 1) {
      const e = ranking[i]!;
      if (e.unavailableSymbols.length > 0) {
        anyUnavailable = true;
      }
      const rank = i + 1;
      lines.push(
        `${rank}위. <@${e.userId}>`,
        `총자산: ${formatMine(e.totalAssets)}`,
        `손익: ${formatSignedMine(e.profitLoss)} (${formatPercent(e.profitLossPercent)})`,
        "",
      );
    }

    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    lines.push("", "※ 모의투자 게임용 랭킹입니다. 실제 투자와 무관합니다.");

    if (anyUnavailable) {
      lines.push("", "_일부 종목은 시세 준비 중이라 평가액에서 제외될 수 있습니다._");
    }

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "주식랭킹",
          lines,
        },
      }),
    );

    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

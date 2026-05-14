import {
  getEquippedTitleDisplayName,
  getStockRanking,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { formatCoin } from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const RANKING_LIMIT = 10;

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "랭킹",
  description: "서버 코인 랭킹을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        allowedMentions: NO_MENTION,
      });
      return;
    }

    const guildId = interaction.guildId;

    const market = client.stockMarket;
    if (!market || !market.isReady()) {
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🏆 서버 코인 랭킹",
            description: "시세 캐시가 아직 준비되지 않았습니다.",
          },
          allowedMentions: NO_MENTION,
        }),
      );
      return;
    }

    const cachedPrices = market.getCachedPrices();
    const ranking = getStockRanking(guildId, cachedPrices, RANKING_LIMIT);

    if (ranking.length === 0) {
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🏆 서버 코인 랭킹",
            description:
              "아직 랭킹에 표시할 사용자가 없습니다. `/출석`으로 시작해 보세요.",
          },
          allowedMentions: NO_MENTION,
        }),
      );
      return;
    }

    let anyUnavailable = false;
    const rankLines = ranking.map((e, index) => {
      if (e.unavailableSymbols.length > 0) {
        anyUnavailable = true;
      }
      const rank = index + 1;
      const titleName = getEquippedTitleDisplayName(guildId, e.userId);
      const titlePart = titleName ? `[${titleName}] ` : "";
      return `${rank}위 ${titlePart}<@${e.userId}> ${formatCoin(e.totalAssets)}`;
    });

    const rankBlock = rankLines.join("\n");

    const lines: string[] = [rankBlock, "서버 코인 랭킹입니다."];

    if (anyUnavailable) {
      lines.push(
        "_일부 종목은 시세 준비 중이라 평가액에서 제외될 수 있습니다._",
      );
    }

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🏆 서버 코인 랭킹",
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;

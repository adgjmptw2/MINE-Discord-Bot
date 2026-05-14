import {
  getEquippedTitleDisplayName,
  getStockAssetSummary,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import type { MineClient, SlashCommand } from "@/types";

function fmtPlain(n: number): string {
  return n.toLocaleString("ko-KR");
}

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "자산",
  description: "내 총 잔액을 공개 메시지로 확인합니다.",
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
    const userId = interaction.user.id;

    const market = client.stockMarket;
    const cachedPrices = market?.getCachedPrices() ?? [];
    const cacheEmpty = !market?.isReady() || cachedPrices.length === 0;

    const summary = getStockAssetSummary(guildId, userId, cachedPrices);

    if (!summary) {
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "잔액",
            description:
              "아직 잔액이 없습니다. `/출석`으로 시작해보세요.",
          },
          allowedMentions: NO_MENTION,
        }),
      );
      return;
    }

    const equipName = getEquippedTitleDisplayName(guildId, userId);
    const title = equipName
      ? `[${equipName}] <@${userId}>님의 잔액`
      : `<@${userId}>님의 잔액`;

    const lines: string[] = [`${fmtPlain(summary.totalAssets)} 코인`];

    if (cacheEmpty || summary.unavailableSymbols.length > 0) {
      lines.push("", "_일부 시세는 준비 중입니다._");
    }

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title,
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;

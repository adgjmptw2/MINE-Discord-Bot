import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import {
  getCoinAchievementSummary,
  getCoinProfileSummary,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import {
  formatLatestGameLogForProfile,
} from "@/utils/stockFormat";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "프로필",
  description: "유저의 코인 프로필을 확인합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "유저",
      description: "조회할 유저(비우면 본인)",
      required: false,
    },
  ],

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildId = interaction.guildId;
    const target =
      interaction.options.getUser("유저") ?? interaction.user;
    const userId = target.id;

    const market = client.stockMarket;
    const cachedPrices = market?.getCachedPrices() ?? [];

    const p = getCoinProfileSummary(guildId, userId, cachedPrices);
    const ach = getCoinAchievementSummary(guildId, userId);

    if (!p.wallet && !p.assetSummary) {
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "👤 프로필",
            description:
              "아직 프로필 정보가 없습니다. /출석으로 시작해보세요.",
          },
          allowedMentions: NO_MENTION,
        }),
      );
      return;
    }

    const summary = p.assetSummary;
    const total = summary?.totalAssets ?? p.wallet?.cashBalance ?? 0;
    const cash = summary?.cashTotal ?? p.wallet?.cashBalance ?? 0;
    const stockVal = summary?.stockValueTotal ?? 0;

    const title = p.equippedTitle
      ? `👤 [${p.equippedTitle}] <@${userId}>님의 프로필`
      : `👤 <@${userId}>님의 프로필`;

    const lines: string[] = [
      `총자산: \`${total.toLocaleString("ko-KR")} 코인\``,
      `현금: \`${cash.toLocaleString("ko-KR")} 코인\``,
      `주식 평가액: \`${stockVal.toLocaleString("ko-KR")} 코인\``,
      `보유 아이템: \`${p.inventoryCount.toLocaleString("ko-KR")}개\``,
      `업적: \`${ach.completedCount} / ${ach.totalCount}\``,
      `최근 게임: \`${formatLatestGameLogForProfile(p.latestGameLog)}\``,
      `현재 시즌: \`${p.activeSeason?.name ?? "없음"}\``,
      "",
      "서버 내 가상 코인 프로필입니다.",
    ];

    if (!market?.isReady() || (summary && summary.unavailableSymbols.length > 0)) {
      lines.splice(
        lines.length - 2,
        0,
        "_일부 시세는 준비 중일 수 있습니다._",
        "",
      );
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

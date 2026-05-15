import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import {
  claimAllCompletedAchievementRewards,
  getCoinAchievementSummary,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { SlashCommand } from "@/types";

function formatAchievementLine(a: {
  name: string;
  completed: boolean;
  claimed: boolean;
  rewardAmount: number;
}): string {
  if (!a.completed) {
    return `⬜ ${a.name} — 미달성`;
  }
  if (a.claimed) {
    return `✅ ${a.name} — 수령 완료`;
  }
  const coin = a.rewardAmount.toLocaleString("ko-KR");
  return `✅ ${a.name} — 보상 가능 \`${coin} 코인\``;
}

const command: SlashCommand = {
  name: "업적",
  description: "내 업적 진행도와 보상을 확인합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.Boolean,
      name: "보상받기",
      description: "true면 완료된 미수령 업적 보상을 모두 받습니다.",
      required: false,
    },
  ],

  async run(_client, interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const claimAll = interaction.options.getBoolean("보상받기") === true;

    if (claimAll) {
      try {
        const result = claimAllCompletedAchievementRewards(guildId, userId);
        const got = result.totalReward.toLocaleString("ko-KR");
        const bal = result.balanceAfter.toLocaleString("ko-KR");
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              title: "🏅 업적 보상 수령 완료",
              lines: [
                `수령한 업적: **${result.claimedAchievementKeys.length.toLocaleString("ko-KR")}**개`,
                `획득 코인: \`${got} 코인\``,
                `현재 잔액: \`${bal} 코인\``,
              ],
            },
          }),
        );
      } catch (e) {
        if (
          e instanceof StockStorageError &&
          e.code === "ACHIEVEMENT_REWARD_NOT_AVAILABLE"
        ) {
          await interaction.reply(
            panelReply({
              ephemeral: true,
              panel: {
                title: "🏅 업적",
                description: "받을 수 있는 업적 보상이 없습니다.",
              },
            }),
          );
        } else {
          throw e;
        }
      }
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const summary = getCoinAchievementSummary(guildId, userId);
    const lines = summary.achievements.map((a) => formatAchievementLine(a));
    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "🏅 내 업적",
          lines: [
            `진행도: **${summary.completedCount}** / ${summary.totalCount}`,
            `보상 수령: **${summary.claimedCount}** / ${summary.totalCount}`,
            "",
            ...lines,
            "",
            "완료된 업적 보상은 `/업적 보상받기:true`로 받을 수 있습니다.",
          ],
        },
      }),
    );
    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

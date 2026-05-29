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

const ACHIEVEMENT_PREVIEW_MAX = 5;

function formatAchievementLine(a: {
  name: string;
  completed: boolean;
  claimed: boolean;
  rewardAmount: number;
}): string {
  if (!a.completed) {
    return `⬜ ${a.name}`;
  }
  if (a.claimed) {
    return `✅ ${a.name}`;
  }
  const coin = a.rewardAmount.toLocaleString("ko-KR");
  return `✅ ${a.name} · 보상 ${coin} 코인`;
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
              description: `+${got} 코인  ·  잔액 ${bal} 코인`,
              lines: [
                `수령 ${result.claimedAchievementKeys.length.toLocaleString("ko-KR")}개`,
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
    const shown = summary.achievements.slice(0, ACHIEVEMENT_PREVIEW_MAX);
    const lines = shown.map((a) => formatAchievementLine(a));
    const rest = summary.achievements.length - shown.length;
    if (rest > 0) {
      lines.push(`외 ${rest}개`);
    }
    lines.push("보상: `/업적 보상받기:true`");

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "🏅 업적",
          description: `완료 ${summary.completedCount}/${summary.totalCount}  ·  수령 ${summary.claimedCount}/${summary.totalCount}`,
          lines,
        },
      }),
    );
    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

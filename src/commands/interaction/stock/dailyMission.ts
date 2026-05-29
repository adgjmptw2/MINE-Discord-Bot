import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import {
  claimDailyMissionReward,
  getDailyMissionSummary,
  StockStorageError,
} from "@/storage/stock";
import { getKstDateString } from "@/utils/date";
import { panelReply } from "@/utils/discord";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "미션",
  description: "오늘의 코인 미션 진행도를 확인합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.Boolean,
      name: "보상받기",
      description: "켜면 일일 미션 보상을 받습니다(전부 완료 시에만).",
      required: false,
    },
  ],

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const today = getKstDateString();
    const claim = interaction.options.getBoolean("보상받기") === true;

    if (claim) {
      try {
        const r = claimDailyMissionReward(guildId, userId, today);
        const rewardStr = `\`${r.rewardAmount.toLocaleString("ko-KR")} 코인\``;
        const balStr = `\`${r.balanceAfter.toLocaleString("ko-KR")} 코인\``;
        await interaction.reply(
          panelReply({
            ephemeral: false,
            panel: {
              title: "🗓️ 일일미션 완료",
              description: `보상 ${rewardStr}  ·  잔액 ${balStr}`,
              lines: [`<@${userId}>`],
            },
            allowedMentions: NO_MENTION,
          }),
        );
      } catch (e) {
        if (
          e instanceof StockStorageError &&
          e.code === "DAILY_MISSION_REWARD_ALREADY_CLAIMED"
        ) {
          await interaction.reply({
            content: "오늘 일일 미션 보상은 이미 받았습니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (
          e instanceof StockStorageError &&
          e.code === "DAILY_MISSION_NOT_COMPLETED"
        ) {
          await interaction.reply({
            content:
              "아직 완료되지 않은 미션이 있습니다. `/미션`으로 진행도를 확인해 주세요.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        throw e;
      }
      return;
    }

    const s = getDailyMissionSummary(guildId, userId, today);
    const MISSION_PREVIEW_MAX = 5;
    const shown = s.missions.slice(0, MISSION_PREVIEW_MAX);
    const lines = shown.map((m) =>
      m.completed ? `✅ ${m.label}` : `⬜ ${m.label}`,
    );
    const rest = s.missions.length - shown.length;
    if (rest > 0) {
      lines.push(`외 ${rest}개`);
    }

    const rewardPending =
      !s.rewardClaimed && s.completedCount >= s.totalCount;
    const description = rewardPending
      ? `완료 ${s.completedCount}/${s.totalCount}  ·  보상 대기 ${s.rewardAmount.toLocaleString("ko-KR")} 코인`
      : `완료 ${s.completedCount}/${s.totalCount}  ·  보상 ${s.rewardAmount.toLocaleString("ko-KR")} 코인`;

    if (s.rewardClaimed) {
      lines.push("오늘 보상 수령 완료");
    } else if (s.completedCount >= s.totalCount) {
      lines.push("보상: `/미션 보상받기:true`");
    } else {
      lines.push("완료 시 `/미션 보상받기:true`");
    }

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🗓️ 일일미션",
          description,
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;

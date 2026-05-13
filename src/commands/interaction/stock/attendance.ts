import { MessageFlags } from "discord.js";
import {
  DAILY_MISSION_KEY_ATTENDANCE,
  getOrCreateCoinGuildSettings,
  recordDailyMissionProgress,
  recordStockAttendance,
} from "@/storage/stock";
import { getKstDateString } from "@/utils/date";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { SlashCommand } from "@/types";

const command: SlashCommand = {
  name: "출석",
  description: "오늘의 가상 투자 보상을 받습니다.",
  category: "stock",
  guildOnly: true,

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
    const today = getKstDateString();

    const settings = getOrCreateCoinGuildSettings(guildId);

    const result = recordStockAttendance(
      guildId,
      userId,
      today,
      settings.attendanceReward,
    );
    recordDailyMissionProgress(guildId, userId, today, DAILY_MISSION_KEY_ATTENDANCE);
    const cash = result.wallet.cashBalance.toLocaleString("ko-KR");

    if (result.alreadyClaimed) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "출석",
            description: "오늘은 이미 출석했습니다.",
            lines: [`현금 잔고: **${cash}** 코인`],
          },
        }),
      );
    } else {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "출석",
            description: `+${result.rewardAmount.toLocaleString("ko-KR")} 코인 지급`,
            lines: [`현금 잔고: **${cash}** 코인`],
          },
        }),
      );
    }

    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

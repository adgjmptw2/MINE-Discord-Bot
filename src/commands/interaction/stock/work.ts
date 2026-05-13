import { randomInt } from "node:crypto";
import { MessageFlags } from "discord.js";
import {
  DAILY_MISSION_KEY_WORK,
  performCoinWork,
  canWorkNow,
  recordDailyMissionProgress,
  StockStorageError,
} from "@/storage/stock";
import { getKstDateString } from "@/utils/date";
import { panelReply } from "@/utils/discord";
import { formatRemainingCooldown } from "@/utils/runtimeFormat";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const WORK_LABELS = [
  "편의점 알바",
  "카페 알바",
  "배달 알바",
  "PC방 알바",
  "전단지 알바",
] as const;

const command: SlashCommand = {
  name: "알바",
  description: "일정 시간마다 알바를 해서 코인을 법니다.",
  category: "stock",
  guildOnly: true,

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

    try {
      const r = performCoinWork(guildId, userId);
      recordDailyMissionProgress(
        guildId,
        userId,
        getKstDateString(),
        DAILY_MISSION_KEY_WORK,
      );
      const label = WORK_LABELS[randomInt(0, WORK_LABELS.length - 1)]!;
      const rewardStr = `\`${r.rewardAmount.toLocaleString("ko-KR")} 코인\``;
      const balStr = `\`${r.balanceAfter.toLocaleString("ko-KR")} 코인\``;

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🧹 알바 완료",
            lines: [
              `<@${userId}>님이 ${label}를 하고`,
              `${rewardStr}을 벌었습니다.`,
              "",
              `현재 잔액: ${balStr}`,
            ],
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError && e.code === "WORK_COOLDOWN") {
        const { remainingMs } = canWorkNow(guildId, userId);
        const wait = formatRemainingCooldown(remainingMs);
        await interaction.reply({
          content:
            `⏳ 아직 알바를 할 수 없습니다.\n\n다음 알바 가능 시간: \`${wait} 후\``,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      throw e;
    }
  },
};

export default command;

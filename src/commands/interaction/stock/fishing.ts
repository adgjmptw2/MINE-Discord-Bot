import { MessageFlags } from "discord.js";
import {
  DAILY_MISSION_KEY_FISHING,
  performCoinFishing,
  canFishNow,
  recordDailyMissionProgress,
  StockStorageError,
  FISHING_RARITY_NONE,
  FISHING_RARITY_LEGENDARY,
} from "@/storage/stock";
import { getKstDateString } from "@/utils/date";
import { panelReply } from "@/utils/discord";
import { formatRemainingCooldown } from "@/utils/runtimeFormat";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "낚시",
  description: "낚시를 해서 코인을 법니다.",
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
      const r = performCoinFishing(guildId, userId);
      recordDailyMissionProgress(
        guildId,
        userId,
        getKstDateString(),
        DAILY_MISSION_KEY_FISHING,
      );
      const rewardStr = `\`${r.rewardAmount.toLocaleString("ko-KR")} 코인\``;
      const balStr = `\`${r.balanceAfter.toLocaleString("ko-KR")} 코인\``;

      let title: string;
      if (r.rarity === FISHING_RARITY_NONE) {
        title = "🎣 낚시 실패";
      } else if (r.rarity === FISHING_RARITY_LEGENDARY) {
        title = "🌟 황금 물고기!";
      } else {
        title = "🎣 낚시 성공";
      }

      let panel: { title: string; description?: string; lines?: string[] };
      if (r.rarity === FISHING_RARITY_NONE) {
        panel = {
          title,
          description: "이번엔 아무것도 걸리지 않았어요.",
          lines: [`획득 ${rewardStr}  ·  잔액 ${balStr}`],
        };
      } else if (r.rarity === FISHING_RARITY_LEGENDARY) {
        panel = {
          title,
          description: `\`${r.fishName}\`  ·  **${rewardStr}**`,
          lines: [`잔액 ${balStr}`],
        };
      } else {
        panel = {
          title,
          description: `\`${r.fishName}\`  ·  ${rewardStr}`,
          lines: [`잔액 ${balStr}`],
        };
      }

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel,
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError && e.code === "FISHING_COOLDOWN") {
        const { remainingMs } = canFishNow(guildId, userId);
        const wait = formatRemainingCooldown(remainingMs);
        await interaction.reply({
          content:
            `⏳ 아직 낚시를 할 수 없습니다.\n\n다음 낚시 가능 시간: \`${wait} 후\``,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      throw e;
    }
  },
};

export default command;

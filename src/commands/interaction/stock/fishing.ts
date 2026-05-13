import { MessageFlags } from "discord.js";
import {
  performCoinFishing,
  canFishNow,
  StockStorageError,
  FISHING_RARITY_NONE,
  FISHING_RARITY_LEGENDARY,
} from "@/storage/stock";
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

      const lines =
        r.rarity === FISHING_RARITY_NONE
          ? [
              `<@${userId}>님이 낚싯대를 던졌지만 아무것도 잡지 못했습니다.`,
              "",
              `획득: ${rewardStr}`,
              `현재 잔액: ${balStr}`,
            ]
          : [
              `<@${userId}>님이 \`${r.fishName}\`를 낚았습니다!`,
              "",
              `획득: ${rewardStr}`,
              `현재 잔액: ${balStr}`,
            ];

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: { title, lines },
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

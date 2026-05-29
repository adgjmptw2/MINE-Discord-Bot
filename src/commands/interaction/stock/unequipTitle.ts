import { MessageFlags } from "discord.js";
import { unequipCoinItem } from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };
const TITLE_TYPE = "TITLE";

const command: SlashCommand = {
  name: "칭호해제",
  description: "현재 장착 중인 칭호를 해제합니다.",
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
    unequipCoinItem(guildId, userId, TITLE_TYPE);

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🏷️ 칭호 해제",
          description: "장착 칭호를 해제했습니다.",
          lines: [`<@${userId}>`],
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;

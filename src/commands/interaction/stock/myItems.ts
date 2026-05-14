import { MessageFlags } from "discord.js";
import {
  getEquippedCoinItem,
  listCoinInventoryItems,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const command: SlashCommand = {
  name: "내아이템",
  description: "보유한 상점 아이템과 장착 상태를 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const items = listCoinInventoryItems(guildId, userId);
    const equipped = getEquippedCoinItem(guildId, userId, "TITLE");

    if (items.length === 0) {
      await interaction.reply({
        content: "보유한 아이템이 없습니다. /상점에서 구매해보세요.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const lines: string[] = [
      "칭호",
      ...items.map((i) => {
        const mark =
          equipped?.itemKey === i.itemKey ? " 장착 중" : "";
        return `- ${i.itemName}${mark}`;
      }),
    ];

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "🎒 내 아이템",
          lines,
        },
      }),
    );
    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

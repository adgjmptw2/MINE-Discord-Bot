import { MessageFlags } from "discord.js";
import {
  getEquippedCoinItem,
  listCoinConsumableItems,
  listCoinInventoryItems,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

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
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const titles = listCoinInventoryItems(guildId, userId);
    const consumables = listCoinConsumableItems(guildId, userId);
    const equipped = getEquippedCoinItem(guildId, userId, "TITLE");

    if (titles.length === 0 && consumables.length === 0) {
      await interaction.reply({
        content: "보유한 아이템이 없습니다. /상점에서 구매해보세요.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const lines: string[] = [];

    if (titles.length > 0) {
      lines.push("**칭호**");
      lines.push(
        ...titles.map((i) => {
          const mark = equipped?.itemKey === i.itemKey ? " (장착 중)" : "";
          return `- **${i.itemName}**${mark}`;
        }),
      );
    }

    if (consumables.length > 0) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push("**소비 아이템**");
      lines.push(
        ...consumables.map(
          (c) =>
            `- **${c.itemName}** × ${c.quantity.toLocaleString("ko-KR")}`,
        ),
      );
    }

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "🎒 내 아이템",
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

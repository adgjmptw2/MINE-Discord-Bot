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
const ITEM_PREVIEW_MAX = 5;

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

    const totalKinds = titles.length + consumables.length;

    if (totalKinds === 0) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "🎒 내 아이템",
            description: "보유한 아이템이 없습니다.",
            lines: ["`/상점`에서 구매할 수 있습니다."],
          },
          allowedMentions: NO_MENTION,
        }),
      );
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    type ItemRow = { label: string };
    const rows: ItemRow[] = [
      ...titles.map((i) => {
        const mark = equipped?.itemKey === i.itemKey ? " · 장착" : "";
        return { label: `${i.itemName}${mark}` };
      }),
      ...consumables.map(
        (c) => ({
          label: `${c.itemName} × ${c.quantity.toLocaleString("ko-KR")}`,
        }),
      ),
    ];

    const shown = rows.slice(0, ITEM_PREVIEW_MAX);
    const lines = shown.map((r) => r.label);
    const rest = rows.length - shown.length;
    if (rest > 0) {
      lines.push(`외 ${rest}개`);
    }

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "🎒 내 아이템",
          description: `보유 아이템 ${totalKinds}종`,
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
    scheduleEphemeralReplyDelete(interaction);
  },
};

export default command;

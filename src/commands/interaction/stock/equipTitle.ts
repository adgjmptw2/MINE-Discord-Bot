import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import { findCoinShopItem } from "@/settings/coinShopItems";
import {
  equipCoinInventoryItem,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "칭호장착",
  description: "구매한 칭호를 장착합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "칭호",
      description: "장착할 칭호 이름·키·번호",
      required: true,
      minLength: 1,
      maxLength: 64,
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
    const raw = interaction.options.getString("칭호", true);
    const found = findCoinShopItem(raw);

    if (!found) {
      await interaction.reply({
        content:
          "상점에 등록된 칭호를 입력해 주세요. `/상점`에서 목록을 확인할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const r = equipCoinInventoryItem(guildId, userId, found.itemKey);
      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🏷️ 칭호 장착",
            description: `\`${r.itemName}\``,
            lines: [`<@${userId}>`],
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError) {
        if (e.code === "ITEM_NOT_OWNED") {
          await interaction.reply({
            content:
              "보유하지 않은 칭호입니다. /상점에서 구매해보세요.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "INVALID_ITEM_TYPE") {
          await interaction.reply({
            content: "이 아이템은 칭호로 장착할 수 없습니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "ITEM_NOT_FOUND") {
          await interaction.reply({
            content:
              "상점에 등록된 칭호를 입력해 주세요. `/상점`에서 목록을 확인할 수 있습니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      throw e;
    }
  },
};

export default command;

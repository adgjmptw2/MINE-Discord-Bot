import {
  ApplicationCommandOptionType,
  MessageFlags,
} from "discord.js";
import { findCoinShopItem } from "@/settings/coinShopItems";
import {
  purchaseCoinShopItem,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "구매",
  description: "상점 아이템을 구매합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "아이템",
      description: "상점 아이템 이름·키·번호",
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
        allowedMentions: NO_MENTION,
      });
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const raw = interaction.options.getString("아이템", true);
    const found = findCoinShopItem(raw);

    if (!found) {
      await interaction.reply({
        content:
          "상점에 없는 아이템입니다.\n`/상점`에서 목록과 이름을 확인해 주세요.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      return;
    }

    try {
      const r = purchaseCoinShopItem({ guildId, userId, item: found });
      const priceStr = `\`${r.item.price.toLocaleString("ko-KR")} 코인\``;
      const balStr = `\`${r.balanceAfter.toLocaleString("ko-KR")} 코인\``;

      const isTitle = r.item.itemType === "TITLE";
      const lines: string[] = [
        `<@${userId}>  ·  ${isTitle ? "칭호" : "소비"} \`${r.item.name}\``,
      ];
      if (!isTitle && r.consumableQuantityAfter !== undefined) {
        lines.push(
          `보유 ${r.consumableQuantityAfter.toLocaleString("ko-KR")}개  ·  잔액 ${balStr}`,
        );
      } else {
        lines.push(`잔액 ${balStr}`);
      }

      await interaction.reply(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🛒 구매 완료",
            description: `${r.item.name}  ·  ${priceStr}`,
            lines,
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } catch (e) {
      if (e instanceof StockStorageError) {
        if (e.code === "WALLET_NOT_FOUND") {
          await interaction.reply({
            content: "먼저 /출석으로 코인을 받아주세요.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          return;
        }
        if (e.code === "INSUFFICIENT_CASH") {
          await interaction.reply({
            content: "코인이 부족합니다.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          return;
        }
        if (e.code === "ITEM_ALREADY_OWNED") {
          await interaction.reply({
            content: "이미 보유한 아이템입니다.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          return;
        }
        if (e.code === "ITEM_NOT_FOUND") {
          await interaction.reply({
            content:
              "상점에 없는 아이템입니다.\n`/상점`에서 목록을 확인해 주세요.",
            flags: MessageFlags.Ephemeral,
            allowedMentions: NO_MENTION,
          });
          return;
        }
      }
      throw e;
    }
  },
};

export default command;

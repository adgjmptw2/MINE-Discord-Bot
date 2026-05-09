import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  MAX_ADMIN_COIN_ADJUSTMENT,
  removeCoinsFromWallet,
  StockStorageError,
} from "@/storage/stock";
import { panelReply } from "@/utils/discord";
import { canUseStockAdminCommand } from "@/utils/permissions";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "코인차감",
  description: "관리자가 유저의 코인을 차감합니다.",
  category: "stock",
  guildOnly: true,
  options: [
    {
      type: ApplicationCommandOptionType.User,
      name: "유저",
      description: "코인을 차감할 유저",
      required: true,
    },
    {
      type: ApplicationCommandOptionType.Integer,
      name: "금액",
      description: "차감할 코인 (1 이상, 상한 적용)",
      required: true,
      minValue: 1,
      maxValue: MAX_ADMIN_COIN_ADJUSTMENT,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: "사유",
      description: "차감 사유",
      required: false,
      maxLength: 200,
    },
  ],

  async run(client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!canUseStockAdminCommand(client, interaction)) {
      await interaction.reply({
        content: "이 명령어는 서버 관리자만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = interaction.options.getUser("유저", true);
    const amount = interaction.options.getInteger("금액", true);
    const reasonRaw = interaction.options.getString("사유");
    const reason = reasonRaw?.trim() ?? "";

    const guildId = interaction.guildId;

    try {
      removeCoinsFromWallet(guildId, target.id, amount);
    } catch (e) {
      if (e instanceof StockStorageError) {
        if (e.code === "INVALID_AMOUNT") {
          await interaction.reply({
            content: `금액은 1 ~ ${MAX_ADMIN_COIN_ADJUSTMENT.toLocaleString("ko-KR")} 코인 사이의 정수여야 합니다.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "WALLET_NOT_FOUND") {
          await interaction.reply({
            content:
              "대상 유저의 지갑이 없습니다. `/출석` 등으로 지갑을 만든 뒤 다시 시도해 주세요.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (e.code === "INSUFFICIENT_CASH") {
          await interaction.reply({
            content: "차감할 현금이 부족합니다.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }
      throw e;
    }

    const amtStr = amount.toLocaleString("ko-KR");

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🪙 코인 차감 완료",
          lines: [
            `<@${target.id}>님의 잔액에서 \`${amtStr} 코인\`을 차감했습니다.`,
            ...(reason ? [`사유: ${reason}`] : []),
          ],
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;

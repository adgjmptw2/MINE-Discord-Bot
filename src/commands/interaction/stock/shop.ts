import { MessageFlags } from "discord.js";
import { getCoinShopItems } from "@/settings/coinShopItems";
import { panelReply } from "@/utils/discord";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const command: SlashCommand = {
  name: "상점",
  description: "코인으로 구매할 수 있는 아이템을 확인합니다.",
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

    const items = getCoinShopItems();
    const lines: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const n = i + 1;
      lines.push(`${n}. ${it.name}`);
      lines.push(`가격: \`${it.price.toLocaleString("ko-KR")} 코인\``);
      lines.push(`설명: ${it.description}`);
      lines.push("");
    }
    lines.push("구매:", "`/구매 아이템:초보 투자자`");

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🛒 코인 상점",
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
  },
};

export default command;

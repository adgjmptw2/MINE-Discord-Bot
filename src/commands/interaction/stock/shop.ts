import { MessageFlags } from "discord.js";
import { buildCoinShopPanelOptions } from "@/handlers/coinShopInteractions";
import { panelReply } from "@/utils/discord";
import type { MineClient, SlashCommand } from "@/types";

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

    await interaction.reply(panelReply(buildCoinShopPanelOptions(0)));
  },
};

export default command;

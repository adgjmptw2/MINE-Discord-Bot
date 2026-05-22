import { MessageFlags } from "discord.js";
import { getOrCreateCoinSword } from "@/storage/stock";
import { formatSwordName, getSwordTier } from "@/utils/swordDisplay";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };
const MY_SWORD_REPLY_DELETE_MS = 30_000;

const command: SlashCommand = {
  name: "내검",
  description: "내 검 강화 상태를 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
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
    const sword = getOrCreateCoinSword(guildId, userId);
    const tier = getSwordTier(sword.level);

    const lines: string[] = [
      `등급: **${tier.tier}**`,
      `현재 강화: **+${sword.level}**`,
      `최고 강화: **+${sword.highestLevel}**`,
      "",
      "**기록**",
      `시도 ${sword.totalAttempts}회 · 성공 ${sword.successCount}회 · 실패 ${sword.failCount}회`,
      `하락 ${sword.downgradeCount}회 · 파괴 ${sword.destroyCount}회`,
    ];

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: `${tier.emoji} 내 검`,
          description: formatSwordName(sword.level),
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
    scheduleEphemeralReplyDelete(interaction, MY_SWORD_REPLY_DELETE_MS);
  },
};

export default command;

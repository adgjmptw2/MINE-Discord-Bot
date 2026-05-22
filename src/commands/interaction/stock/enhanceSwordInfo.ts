import { MessageFlags } from "discord.js";
import {
  calculateDungeonReward,
  DESTROY_PROTECTION_TICKET_KEY,
  DOWNGRADE_PROTECTION_TICKET_KEY,
  getCoinConsumableItem,
  getOrCreateCoinSword,
  getSwordEnhanceRate,
  MAX_SWORD_LEVEL,
} from "@/storage/stock";
import {
  formatSwordDangerHint,
  formatSwordName,
  SWORD_VIRTUAL_GAME_FOOTER,
} from "@/utils/swordDisplay";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };
const REPLY_DELETE_MS = 60_000;

function consumableQty(
  guildId: string,
  userId: string,
  itemKey: string,
): number {
  const row = getCoinConsumableItem(guildId, userId, itemKey);
  const q = row?.quantity ?? 0;
  return Math.max(0, Math.trunc(Number(q)));
}

function failKeepPercent(
  success: number,
  downgrade: number,
  destroy: number,
): number {
  return Math.max(0, 100 - success - downgrade - destroy);
}

function protectionBlock(guildId: string, userId: string): string[] {
  const down = consumableQty(guildId, userId, DOWNGRADE_PROTECTION_TICKET_KEY);
  const dest = consumableQty(guildId, userId, DESTROY_PROTECTION_TICKET_KEY);
  return [
    "**보유 방지권**",
    `하락 방지권: **${down.toLocaleString("ko-KR")}개**`,
    `파괴 방지권: **${dest.toLocaleString("ko-KR")}개**`,
  ];
}

function dungeonBlock(level: number): string[] {
  const reward = calculateDungeonReward(level);
  return [
    "**던전 보상**",
    `**${reward.toLocaleString("ko-KR")} 코인**`,
  ];
}

const command: SlashCommand = {
  name: "강화정보",
  description: "내 검의 다음 강화 비용과 확률을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction, REPLY_DELETE_MS);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sword = getOrCreateCoinSword(guildId, userId);
    const level = sword.level;
    const rate = getSwordEnhanceRate(level);

    const lines: string[] = [];

    if (level >= MAX_SWORD_LEVEL) {
      lines.push(
        `현재: **+${level}**`,
        "이미 최대 강화입니다.",
        "",
        ...dungeonBlock(level),
        "",
        ...protectionBlock(guildId, userId),
        "",
        ...SWORD_VIRTUAL_GAME_FOOTER,
      );
    } else if (!rate) {
      lines.push(
        `현재: **+${level}**`,
        "강화 정보를 불러올 수 없습니다.",
        "",
        ...protectionBlock(guildId, userId),
        "",
        ...dungeonBlock(level),
        "",
        ...SWORD_VIRTUAL_GAME_FOOTER,
      );
    } else {
      const fk = failKeepPercent(
        rate.successPercent,
        rate.downgradePercent,
        rate.destroyPercent,
      );
      lines.push(
        `현재: **+${level}** → 목표: **+${level + 1}**`,
        `강화 비용: **${rate.cost.toLocaleString("ko-KR")} 코인**`,
        "",
        "**확률**",
        `성공 **${rate.successPercent}%** · 유지 **${fk}%**`,
        `하락 **${rate.downgradePercent}%** · 파괴 **${rate.destroyPercent}%**`,
        "",
        ...protectionBlock(guildId, userId),
        "",
        ...dungeonBlock(level),
        "",
        `※ ${formatSwordDangerHint(level)}`,
        ...SWORD_VIRTUAL_GAME_FOOTER,
      );
    }

    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "🧾 강화 정보",
          description: formatSwordName(level),
          lines,
        },
        allowedMentions: NO_MENTION,
      }),
    );
    scheduleEphemeralReplyDelete(interaction, REPLY_DELETE_MS);
  },
};

export default command;

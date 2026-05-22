import { MessageFlags } from "discord.js";
import {
  runCoinDungeon,
  type RunCoinDungeonResult,
} from "@/storage/stock";
import {
  addKstCalendarDays,
  getKstDateString,
  getKstDayUtcIsoBounds,
} from "@/utils/date";
import {
  formatDungeonMoodLine,
  formatSwordName,
  SWORD_VIRTUAL_GAME_FOOTER,
} from "@/utils/swordDisplay";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };
const DUNGEON_REPLY_DELETE_MS = 60_000;

function formatRoughTimeUntilNextKstDay(now: Date): string {
  const today = getKstDateString(now);
  const tomorrow = addKstCalendarDays(today, 1);
  const { startIso } = getKstDayUtcIsoBounds(tomorrow);
  const ms = Math.max(0, new Date(startIso).getTime() - now.getTime());
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) {
    return `${h}시간 ${m}분`;
  }
  return `${m}분`;
}

function buildSuccessPanel(r: RunCoinDungeonResult) {
  const reward = r.run.rewardAmount;
  const level = r.sword.level;
  return {
    title: "⚔️ 던전 완료",
    description: `**+${reward.toLocaleString("ko-KR")} 코인** 획득`,
    lines: [
      `검: ${formatSwordName(level)}`,
      `잔고: **${r.wallet.cashBalance.toLocaleString("ko-KR")} 코인**`,
      "",
      formatDungeonMoodLine(level),
      "",
      ...SWORD_VIRTUAL_GAME_FOOTER,
    ],
  };
}

function buildAlreadyDonePanel(r: RunCoinDungeonResult, now: Date) {
  const left = formatRoughTimeUntilNextKstDay(now);
  return {
    title: "⚔️ 던전 완료됨",
    lines: [
      "오늘 던전을 이미 완료했습니다.",
      `최근 보상: **${r.run.rewardAmount.toLocaleString("ko-KR")} 코인**`,
      `당시: **+${r.run.swordLevel}**`,
      `지금 검: ${formatSwordName(r.sword.level)}`,
      `다음: 약 **${left}** 후 (KST)`,
      "",
      ...SWORD_VIRTUAL_GAME_FOOTER,
    ],
  };
}

const command: SlashCommand = {
  name: "던전",
  description: "하루 한 번 던전을 돌고 검 강화 수치에 따른 코인을 획득합니다.",
  category: "stock",
  guildOnly: true,

  async run(_client: MineClient, interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({
        content: "서버에서만 사용할 수 있습니다.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction, DUNGEON_REPLY_DELETE_MS);
      return;
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const today = getKstDateString();
    const now = new Date();

    try {
      const r = runCoinDungeon(guildId, userId, today);
      const panel = r.alreadyCompleted
        ? buildAlreadyDonePanel(r, now)
        : buildSuccessPanel(r);

      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: panel,
          allowedMentions: NO_MENTION,
        }),
      );
    } catch {
      await interaction.reply({
        content: "던전 처리 중 오류가 발생했습니다.",
        flags: MessageFlags.Ephemeral,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(interaction, DUNGEON_REPLY_DELETE_MS);
      return;
    }

    scheduleEphemeralReplyDelete(interaction, DUNGEON_REPLY_DELETE_MS);
  },
};

export default command;

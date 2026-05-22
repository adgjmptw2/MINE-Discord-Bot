import { MessageFlags } from "discord.js";
import {
  DAILY_MISSION_KEY_ATTENDANCE,
  getOrCreateCoinGuildSettings,
  listStockAttendanceDatesInMonth,
  recordDailyMissionProgress,
  recordStockAttendance,
} from "@/storage/stock";
import {
  getKstDateString,
  getKstDayUtcIsoBounds,
  getKstMonthCalendarBounds,
} from "@/utils/date";
import { panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

const ATTENDANCE_REPLY_DELETE_MS = 60_000;

function kstFirstOfMonthWeekdaySun0(firstYmd: string): number {
  const { startIso } = getKstDayUtcIsoBounds(firstYmd);
  const w = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(startIso));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[w] ?? 0;
}

function buildAttendanceCalendarBlock(
  attended: ReadonlySet<string>,
  year: string,
  month: string,
  firstYmd: string,
  lastYmd: string,
): string {
  const R = "\u001b[1;31m";
  const G = "\u001b[1;32m";
  const B = "\u001b[1;34m";
  const D = "\u001b[2;37m";
  const Z = "\u001b[0m";

  const lastDay = Number(lastYmd.slice(8, 10));
  const pad = kstFirstOfMonthWeekdaySun0(firstYmd);
  const header = `${R}Sun${Z} ${G}Mon Tue Wed Thu Fri${Z} ${B}Sat${Z}`;
  const rule = `${D}───────────────────────────${Z}`;

  const rows: string[] = [];

  const slots: string[] = [];
  for (let i = 0; i < pad; i++) {
    slots.push("   ");
  }
  for (let day = 1; day <= lastDay; day++) {
    const ymd = `${year}-${month}-${String(day).padStart(2, "0")}`;
    const mark = attended.has(ymd) ? "✓" : " ";
    slots.push(`${String(day).padStart(2, " ")}${mark}`);
  }
  while (slots.length % 7 !== 0) {
    slots.push("   ");
  }
  for (let i = 0; i < slots.length; i += 7) {
    rows.push(
      slots
        .slice(i, i + 7)
        .map((s) => s.padEnd(3, " "))
        .join(" ")
        .trimEnd(),
    );
  }

  return ["```ansi", header, rule, ...rows, "```"].join("\n");
}

const command: SlashCommand = {
  name: "출석",
  description: "오늘의 출석 보상을 받고 출석 달력을 확인합니다.",
  category: "stock",
  guildOnly: true,

  async run(_client, interaction) {
    if (!interaction.inGuild()) {
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
    const now = new Date();
    const today = getKstDateString(now);

    const settings = getOrCreateCoinGuildSettings(guildId);

    const result = recordStockAttendance(
      guildId,
      userId,
      today,
      settings.attendanceReward,
    );
    recordDailyMissionProgress(
      guildId,
      userId,
      today,
      DAILY_MISSION_KEY_ATTENDANCE,
    );

    const cash = result.wallet.cashBalance.toLocaleString("ko-KR");
    const monthDates = listStockAttendanceDatesInMonth(guildId, userId, now);
    const attended = new Set(monthDates);
    const { year, month, firstYmd, lastYmd } = getKstMonthCalendarBounds(now);
    const calendarBlock = buildAttendanceCalendarBlock(
      attended,
      year,
      month,
      firstYmd,
      lastYmd,
    );

    if (result.alreadyClaimed) {
      const lines: string[] = [
        `연속 출석: **${result.streakDays}**일`,
        `현금 잔고: **${cash}** 코인`,
        "**이번 달 출석**",
        calendarBlock,
      ];
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "출석",
            description: "오늘은 이미 출석했습니다.",
            lines,
          },
          allowedMentions: NO_MENTION,
        }),
      );
    } else {
      const lines: string[] = [
        `+${result.rewardAmount.toLocaleString("ko-KR")} 코인 지급`,
        `연속 출석: **${result.streakDays}**일`,
      ];
      if (result.streakBonusAmount > 0) {
        lines.push(
          `추가 보상: +${result.streakBonusAmount.toLocaleString("ko-KR")} 코인`,
        );
      }
      lines.push(`현금 잔고: **${cash}** 코인`, "**이번 달 출석**", calendarBlock);

      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "출석",
            description: "출석 완료",
            lines,
          },
          allowedMentions: NO_MENTION,
        }),
      );
    }

    scheduleEphemeralReplyDelete(interaction, ATTENDANCE_REPLY_DELETE_MS);
  },
};

export default command;
